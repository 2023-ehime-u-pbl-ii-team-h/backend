import { D1AccountRepository } from "./adaptor/account";
import { D1AttendanceRepository } from "./adaptor/attendance";
import { D1AttendanceBoardRepository } from "./adaptor/attendance-board";
import { D1AttendanceStudentRepository } from "./adaptor/attendance-student";
import { D1SubjectRepository } from "./adaptor/subject";
import { D1SubjectStudentRepository } from "./adaptor/subject-student";
import { D1SubjectTeacherRepository } from "./adaptor/subject-teacher";
import { loginMiddleware } from "./middleware/login";
import { Account, Teacher, isStudent, isTeacher } from "./model/account";
import { Attendance } from "./model/attendance";
import { AttendanceBoard, nextBoardEnd } from "./model/attendance-board";
import { ID } from "./model/id";
import { Subject } from "./model/subject";
import { attend } from "./service/attend";
import { correctAttendance } from "./service/correct-attendance";
import { newBoards } from "./service/new-boards";
import { newSubject } from "./service/new-subject";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

type Bindings = {
  DB: D1Database;
  AZURE_CLIENT_SECRET: string;
  ALLOW_IP_REGEX: string;
};

const app = new Hono<{
  Bindings: Bindings;
  Variables: {
    account: Account;
  };
}>();

app.use("*", loginMiddleware());

app.use(
  "*",
  cors({
    origin: ["https://student-66e.pages.dev", "https://teacher-3zl.pages.dev"],
  }),
);

app.post("/logout", async () => {
  return new Response();
});

app.post("/attendances", async (c) => {
  await attend({
    input: {
      ipAddress: c.req.header("cf-connecting-ip") ?? "",
      account: c.get("account"),
    },
    config: {
      allowIpRegex: c.env.ALLOW_IP_REGEX,
    },
    clock: {
      nowSeconds: () => Math.floor(Date.now() / 1000),
    },
    boardQuery: new D1AttendanceBoardRepository(c.env.DB),
    repo: new D1AttendanceRepository(c.env.DB),
  });

  return new Response();
});

app.put("/attendances/:attendance_id", async (c) => {
  const attendanceId = c.req.param("attendance_id") as ID<Attendance>;

  let jsonBody;
  try {
    jsonBody = await c.req.json();
  } catch {
    c.req.text().then(console.log);
    return c.text("", 400);
  }
  const schema = z.object({
    time_to_set: z.string().datetime(),
  });
  const parseResult = await schema.safeParseAsync(jsonBody);
  if (!parseResult.success) {
    return c.text("", 400);
  }

  const serviceResult = await correctAttendance({
    account: c.get("account"),
    target: attendanceId,
    timeToSet: new Date(parseResult.data.time_to_set),
    attendanceRepo: new D1AttendanceRepository(c.env.DB),
    boardRepo: new D1AttendanceBoardRepository(c.env.DB),
  });
  switch (serviceResult) {
    case "BAD_REQUEST":
      return c.text("", 400);
    case "UNAUTHORIZED":
      return c.text("", 401);
    case "OK":
      return new Response();
  }
});

app.get("/me", async (c) => {
  const account = c.get("account");
  switch (true) {
    case isStudent(account):
      const [registrations] = await new D1SubjectStudentRepository(
        c.env.DB,
      ).subjectsByEachStudent([account]);
      return c.json({
        name: account.name,
        email: account.email,
        registrations,
      });
    case isTeacher(account):
      const [charges] = await new D1SubjectTeacherRepository(
        c.env.DB,
      ).subjectsByEachTeacher([account]);
      return c.json({
        name: account.name,
        email: account.email,
        charges,
      });
    default:
      throw new Error("unreachable");
  }
});

app.get("/me/subjects", async (c) => {
  const account = c.get("account");
  let subjects: Subject[];
  if (isStudent(account)) {
    [subjects] = await new D1SubjectStudentRepository(
      c.env.DB,
    ).subjectsByEachStudent([account]);
  } else if (isTeacher(account)) {
    [subjects] = await new D1SubjectTeacherRepository(
      c.env.DB,
    ).subjectsByEachTeacher([account]);
  } else {
    throw new Error(`unknown role: ${account.role}`);
  }

  const latestBoards = await new D1AttendanceBoardRepository(
    c.env.DB,
  ).boardsByEachSubject(subjects);
  return c.json(
    subjects.map(({ id, name }, index) => ({
      id,
      name,
      boards: latestBoards[index],
    })),
  );
});

app.put("/me/registrations/:subject_id", async (c) => {
  const account = c.get("account");
  if (!isStudent(account)) {
    return c.text("", 401);
  }

  const subjectId = c.req.param("subject_id");
  const res = await new D1SubjectStudentRepository(c.env.DB).insert(
    subjectId as ID<Subject>,
    account.id,
  );
  switch (res) {
    case "OK":
      return new Response();
    case "ALREADY_EXISTS":
      return new Response(null, { status: 204 });
    case "UNKNOWN_SUBJECT":
      return c.text("", 400);
  }
});

app.get("/subjects", async (c) => {
  const now = new Date();
  const name = c.req.query("name") ?? "";
  const page = c.req.query("page") ?? "1";

  const pageIndex = parseInt(page, 10);
  if (!Number.isSafeInteger(pageIndex) || pageIndex <= 0) {
    return c.text("", 400);
  }

  const PAGE_SIZE = 50;
  const subjects = await new D1SubjectRepository(c.env.DB).searchSubjects(
    name,
    PAGE_SIZE,
    (pageIndex - 1) * PAGE_SIZE,
  );
  const teachersBySubject = await new D1SubjectTeacherRepository(
    c.env.DB,
  ).teachersByEachSubject(subjects);
  const boardsBySubject = await new D1AttendanceBoardRepository(
    c.env.DB,
  ).boardsByEachSubject(subjects);
  return c.json(
    subjects.map((subject, index) => ({
      id: subject.id,
      name: subject.name,
      next_board_end: nextBoardEnd(boardsBySubject[index], now),
      assigned: teachersBySubject[index].map(({ name }) => name),
    })),
  );
});

app.post("/subjects", async (c) => {
  let jsonBody;
  try {
    jsonBody = await c.req.json();
  } catch {
    return c.text("", 400);
  }
  const schema = z.object({
    name: z.string().min(1),
    assignees: z.array(z.string().min(1)).min(1),
  });
  const result = await schema.safeParseAsync(jsonBody);
  if (!result.success) {
    return c.text("Bad Request", 400);
  }
  const { name, assignees } = result.data;

  const ret = await newSubject({
    account: c.get("account"),
    params: {
      name,
      assignees: assignees as ID<Teacher>[],
    },
    query: new D1AccountRepository(c.env.DB),
    repo: new D1SubjectRepository(c.env.DB),
  });
  if (ret === null) {
    return c.text("Bad Request", 400);
  }
  return c.json(ret);
});

app.get("/subjects/:subject_id", async (c) => {
  const subjectId = c.req.param("subject_id") as ID<Subject>;

  const subject = await new D1SubjectRepository(c.env.DB).getSubject(subjectId);
  if (!subject) {
    return c.text("Not Found", 404);
  }

  const [assignees] = await new D1SubjectTeacherRepository(
    c.env.DB,
  ).teachersByEachSubject([subject]);
  const [boards] = await new D1AttendanceBoardRepository(
    c.env.DB,
  ).boardsByEachSubject([subject]);

  return c.json({
    name: subject.name,
    assignees,
    boards: boards.map(
      ({
        id,
        startFrom,
        secondsFromStartToBeLate,
        secondsFromBeLateToEnd,
      }) => ({
        id,
        startFrom: startFrom.toISOString(),
        secondsFromStartToBeLate,
        secondsFromBeLateToEnd,
      }),
    ),
  });
});

app.get("/subjects/:subject_id/all_attendances", async (c) => {
  const account = c.get("account");
  const subjectId = c.req.param("subject_id") as ID<Subject>;

  if (!isStudent(account)) {
    return c.text("", 401);
  }

  const sum = await new D1AttendanceRepository(c.env.DB).sumAttendances(
    account.id,
    subjectId,
  );

  return c.json(sum);
});

app.post("/subjects/:subject_id/boards", async (c) => {
  const reqBody = await c.req.json();

  const res = await newBoards({
    reqBody,
    repo: new D1AttendanceBoardRepository(c.env.DB),
  });

  if (res[0] === "BAD_REQUEST") {
    return c.text("", 400);
  }
  return c.json({ ids: res[1] });
});

app.get("/subjects/:subject_id/boards/:board_id/attendances", async (c) => {
  const account = c.get("account");
  if (!isTeacher(account)) {
    return c.text("Unauthorized", 401);
  }

  const schema = z.object({
    since: z.string().datetime().optional(),
    until: z.string().datetime().optional(),
  });
  const parseResult = await schema.safeParseAsync(c.req.query());
  if (!parseResult.success) {
    return c.text("", 400);
  }

  const { since = "0001-01-01T00:00:00", until = "9999-12-31T23:59:59" } =
    parseResult.data;
  const attendanceAndStudents = await new D1AttendanceStudentRepository(
    c.env.DB,
  ).getAttendancesBetween(
    c.req.param("board_id") as ID<AttendanceBoard>,
    new Date(since),
    new Date(until),
  );

  return c.json(
    attendanceAndStudents.map(([attendance, student]) => ({
      id: attendance.id,
      created_at: attendance.created_at,
      who: {
        id: student.id,
        name: student.name,
        email: student.email,
      },
    })),
  );
});

export default app;
