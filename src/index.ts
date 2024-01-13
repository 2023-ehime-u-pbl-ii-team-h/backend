import { D1AccountRepository } from "./adaptor/account";
import { D1AttendanceRepository } from "./adaptor/attendance";
import { D1AttendanceBoardRepository } from "./adaptor/attendance-board";
import { MicrosoftGraph } from "./adaptor/microsoft-graph";
import { MicrosoftOAuth } from "./adaptor/microsoft-oauth";
import { HonoSessionRepository } from "./adaptor/session";
import { D1SubjectRepository } from "./adaptor/subject";
import { D1SubjectStudentRepository } from "./adaptor/subject-student";
import { D1SubjectTeacherRepository } from "./adaptor/subject-teacher";
import { Student, Teacher } from "./model/account";
import { Attendance } from "./model/attendance";
import { nextBoardEnd } from "./model/attendance-board";
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
import { z } from "zod";

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
  };
}>();

const store = new CookieStore();

const EXPIRE_AFTER_SECONDS = 300;

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

app.use("*", async (c, next) => {
  const IGNORE = ["/login", REDIRECT_API_PATH, "/logout"];
  if (!IGNORE.includes(c.req.path)) {
    const session = c.get("session");
    const login = session.get("login") as Session | null;
    if (!login) {
      return c.text("", 401);
    }

    const loginAt = await c.env.DB.prepare(
      "SELECT login_at FROM session WHERE id = ?1",
    )
      .bind(login.id)
      .first<number>("login_at");
    if (!loginAt) {
      return c.text("", 401);
    }

    const isExpired = !(loginAt + EXPIRE_AFTER_SECONDS < Date.now() / 1000);
    if (isExpired) {
      await c.env.DB.prepare("DELETE FROM session WHERE id = ?1")
        .bind(login.id)
        .run();
      return c.text("", 401);
    }
  }
  return next();
});

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

app.post("/subjects", async (c) => {
  const session = c.get("session");
  const login = session.get("login") as Session;

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

app.post("/attendances", async (c) => {
  const session = c.get("session");
  const login = session.get("login") as Session;
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

app.get("/attendances/:course_id", async (c) => {
  const subjectId = c.req.param("course_id") as ID<Subject>;
  const honoSession = c.get("session");
  const session = honoSession.get("login") as Session | null;
  if (!session) {
    return c.text("Unauthorized", 401);
  }

  const sum = await new D1AttendanceRepository(c.env.DB).sumAttendances(
    session.account.id as ID<Student>,
    subjectId,
  );

  return c.json(sum);
});

app.put("/attendances/:attendance_id", async (c) => {
  const attendanceId = c.req.param("attendance_id") as ID<Attendance>;
  const honoSession = c.get("session");
  const session = honoSession.get("login") as Session | null;
  if (!session) {
    return c.text("", 401);
  }

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
  const HonoSession = c.get("session");
  const login = HonoSession.get("login") as Session | null;
  if (!login) {
    return c.text("Unauthorized", 401);
  }

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

app.put("/me/registrations/:subject_id", async (c) => {
  const HonoSession = c.get("session");
  const login = HonoSession.get("login") as Session | null;
  if (!login || login.account.role !== "STUDENT") {
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
export default app;
