import { D1AccountRepository } from "./adaptor/account";
import { D1AttendanceRepository } from "./adaptor/attendance";
import { D1AttendanceBoardRepository } from "./adaptor/attendance-board";
import { D1AttendanceStudentRepository } from "./adaptor/attendance-student";
import { MicrosoftGraph } from "./adaptor/microsoft-graph";
import { MicrosoftOAuth } from "./adaptor/microsoft-oauth";
import { HonoSessionRepository } from "./adaptor/session";
import { D1SubjectRepository } from "./adaptor/subject";
import { D1SubjectStudentRepository } from "./adaptor/subject-student";
import { D1SubjectTeacherRepository } from "./adaptor/subject-teacher";
import { loginMiddleware } from "./middleware/login";
import { Student, Teacher, isStudent, isTeacher } from "./model/account";
import { Attendance } from "./model/attendance";
import { AttendanceBoard, nextBoardEnd } from "./model/attendance-board";
import { ID } from "./model/id";
import { Session } from "./model/session";
import { Subject } from "./model/subject";
import { attend } from "./service/attend";
import { correctAttendance } from "./service/correct-attendance";
import { REDIRECT_API_PATH, login, loginRedirect } from "./service/login";
import { newSubject } from "./service/new-subject";
import { Hono, MiddlewareHandler } from "hono";
import {
  sessionMiddleware,
  CookieStore,
  Session as HonoSession,
} from "hono-sessions";
import { cors } from "hono/cors";
import { nanoid } from "nanoid";

const EXPIRE_AFTER_SECONDS = 300;
const IGNORE = ["/login", REDIRECT_API_PATH, "/logout"];

type Bindings = {
  DB: D1Database;
  COOKIE_SECRET: string;
  AZURE_CLIENT_SECRET: string;
  ALLOW_IP_REGEX: string;
};

const app = new Hono<{
  Bindings: Bindings;
  Variables: {
    session: HonoSession;
    session_key_rotation: boolean;
    login: Session;
  };
}>();

const store = new CookieStore();

app.use("*", (c, next) => {
  const middleware = sessionMiddleware({
    store,
    encryptionKey: c.env.COOKIE_SECRET,
    expireAfterSeconds: EXPIRE_AFTER_SECONDS,
    cookieOptions: {
      httpOnly: true,
    },
  }) as unknown as MiddlewareHandler;
  return middleware(c, next);
});

app.use("*", loginMiddleware(EXPIRE_AFTER_SECONDS, IGNORE));

app.use(
  "*",
  cors({
    origin: ["https://student-66e.pages.dev", "https://teacher-3zl.pages.dev"],
  }),
);

app.get("/login", async (c) => {
  const redirectUrl = await login(
    {
      requestUrl: c.req.url,
      requestReferer: c.req.header("Referer") ?? "",
    },
    new MicrosoftOAuth(),
    new HonoSessionRepository(c.get("session"), c.env.DB),
  );
  return c.redirect(redirectUrl);
});

app.post(REDIRECT_API_PATH, async (c) => {
  const form = await c.req.formData();
  const session = c.get("session");

  const sessionRepo = new HonoSessionRepository(session, c.env.DB);
  const redirectUrl = await loginRedirect({
    query: {
      code: form.get("code") ?? "",
      requestUrl: c.req.url,
      userAgent: c.req.header("user-agent") ?? "",
      returnUrl: form.get("state") ?? "",
    },
    accessTokenService: new MicrosoftOAuth(),
    verifierRepo: sessionRepo,
    userRepo: new MicrosoftGraph(),
    accountRepo: new D1AccountRepository(c.env.DB),
    sessionRepo,
    clock: {
      now: () => new Date(),
    },
  });
  return c.redirect(redirectUrl);
});

app.post("/logout", async (c) => {
  const session = c.get("session");
  const login = session.get("login") as Session | null;
  if (login) {
    await c.env.DB.prepare("DELETE FROM session WHERE id = ?1")
      .bind(login.id)
      .run();
  }
  session.deleteSession();
  return new Response();
});

app.post("/attendances", async (c) => {
  const login = c.get("login");
  await attend({
    input: {
      ipAddress: c.req.header("cf-connecting-ip") ?? "",
      session: login,
    },
    config: {
      allowIpRegex: c.env.ALLOW_IP_REGEX,
    },
    clock: {
      nowSeconds: () => Math.floor(Date.now() / 1000),
    },
    studentQuery: new D1AccountRepository(c.env.DB),
    boardQuery: new D1AttendanceBoardRepository(c.env.DB),
    repo: new D1AttendanceRepository(c.env.DB),
  });

  return new Response();
});

app.put("/attendances/:attendance_id", async (c) => {
  const attendanceId = c.req.param("attendance_id") as ID<Attendance>;
  const session = c.get("login");

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
    session,
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
  const login = c.get("login");
  const repo = new D1AccountRepository(c.env.DB);
  const name = await repo.selectAccountName(login.account.id);
  const info = await repo.getStudentOrTeacher(login.account.id);
  if (!info) {
    throw new Error("account info not found");
  }

  switch (info.role) {
    case "STUDENT":
      const [registrations] = await new D1SubjectStudentRepository(
        c.env.DB,
      ).subjectsByEachStudent([info]);
      return c.json({
        name,
        email: login.account.email,
        registrations,
      });
    case "TEACHER":
      const [charges] = await new D1SubjectTeacherRepository(
        c.env.DB,
      ).subjectsByEachTeacher([info]);
      return c.json({
        name,
        email: login.account.email,
        charges,
      });
    default:
      throw new Error("unreachable");
  }
});

app.get("/me/subjects", async (c) => {
  const login = c.get("login");
  let subjects: Subject[];
  if (isStudent(login.account)) {
    [subjects] = await new D1SubjectStudentRepository(
      c.env.DB,
    ).subjectsByEachStudent([login.account]);
  } else if (isTeacher(login.account)) {
    [subjects] = await new D1SubjectTeacherRepository(
      c.env.DB,
    ).subjectsByEachTeacher([login.account]);
  } else {
    throw new Error(`unknown role: ${login.account.role}`);
  }

  const latestBoards = await new D1AttendanceBoardRepository(
    c.env.DB,
  ).boardsByEachSubject(subjects);
  return c.json(
    subjects.map(({ id, name }, index) => ({
      id,
      name,
      lastDate: latestBoards[index][0]?.startFrom.toISOString() ?? "",
    })),
  );
});

app.put("/me/registrations/:subject_id", async (c) => {
  const login = c.get("login");
  if (!isStudent(login.account)) {
    return c.text("", 401);
  }

  const subjectId = c.req.param("subject_id");
  const { success } = await c.env.DB.prepare(
    "INSERT INTO registration (student_id, subject_id) VALUES (?1, ?2)",
  )
    .bind(login.account.id, subjectId)
    .run();
  return c.text("", success ? 200 : 400);
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
    pageIndex * PAGE_SIZE,
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
  const login = c.get("login");

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
    session: login,
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
  const session = c.get("login");
  const subjectId = c.req.param("subject_id") as ID<Subject>;

  const sum = await new D1AttendanceRepository(c.env.DB).sumAttendances(
    session.account.id as ID<Student>,
    subjectId,
  );

  return c.json(sum);
});

app.get("/subjects/:subject_id/boards/:board_id/attendances", async (c) => {
  const login = c.get("login");
  if (!login) {
    return c.text("Unauthorized", 401);
  }
  if (login.account.role !== "TEACHER") {
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

app.post("/attendance_board", async (c) => {
  const reqBody = await c.req.json();
  const schema = z.object({
    subject: z.string().min(1),
    boards: z
      .array(
        z.object({
          startFrom: z.string().datetime(),
          secondsFromStartToBeLate: z.number().int().positive(),
          secondsFromBeLateToEnd: z.number().int().positive(),
        }),
      )
      .min(1),
  });
  const result = await schema.safeParseAsync(reqBody);
  if (!result.success) {
    return c.text("Bad Request", 400);
  }
  const { subject, boards: boardParams } = result.data;

  const boards = boardParams.map(
    ({
      startFrom,
      secondsFromStartToBeLate,
      secondsFromBeLateToEnd,
    }): AttendanceBoard => ({
      id: nanoid() as ID<AttendanceBoard>,
      subject: subject as ID<Subject>,
      startFrom: new Date(startFrom),
      secondsFromStartToBeLate,
      secondsFromBeLateToEnd,
    }),
  );
  boards.sort((a, b) => a.startFrom.getTime() - b.startFrom.getTime());

  const statement = c.env.DB.prepare(
    "insert into attendance_board(id, subject_id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end) values (?1, ?2, ?3, ?4 ,?5)",
  );
  const statements = boards.map(
    ({
      id,
      subject,
      startFrom,
      secondsFromStartToBeLate,
      secondsFromBeLateToEnd,
    }) =>
      statement.bind(
        id,
        subject,
        startFrom,
        secondsFromStartToBeLate,
        secondsFromBeLateToEnd,
      ),
  );

  const rows = await c.env.DB.batch(statements);
  if (!rows.every((row) => row.success)) {
    throw new Error("insert borads failed");
  }
  return c.json({ ids: boards.map((board) => board.id) });
});

export default app;
