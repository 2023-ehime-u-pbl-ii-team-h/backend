import { Hono, MiddlewareHandler } from "hono";
import {
  sessionMiddleware,
  CookieStore,
  Session as HonoSession,
} from "hono-sessions";
import { REDIRECT_API_PATH, login, loginRedirect } from "./service/login";
import { HonoSessionRepository } from "./adaptor/session";
import { MicrosoftGraph } from "./adaptor/microsoft-graph";
import { MicrosoftOAuth } from "./adaptor/microsoft-oauth";
import { D1AccountRepository } from "./adaptor/account";
import { Session } from "./model/session";
import { ID } from "./model/id";
import { Student, Teacher } from "./model/account";
import { newSubject } from "./service/new-subject";
import { D1SubjectRepository } from "./adaptor/subject";
import { attend } from "./service/attend";
import { D1AttendanceBoardRepository } from "./adaptor/attendance-board";
import { D1AttendanceRepository } from "./adaptor/attendance";
import { Subject } from "./model/subject";
import { z } from "zod";
import { cors } from "hono/cors";
import { AttendanceBoard } from "./model/attendance-board";

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

app.use("*", (c, next) => {
  const middleware = sessionMiddleware({
    store,
    encryptionKey: c.env.COOKIE_SECRET,
    expireAfterSeconds: 300,
    cookieOptions: {
      httpOnly: true,
    },
  }) as unknown as MiddlewareHandler;
  return middleware(c, next);
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
    new HonoSessionRepository(c.get("session")),
  );
  return c.redirect(redirectUrl);
});

app.post(REDIRECT_API_PATH, async (c) => {
  const form = await c.req.formData();
  const session = c.get("session");

  const sessionRepo = new HonoSessionRepository(session);
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
  });
  return c.redirect(redirectUrl);
});

app.post("/logout", async (c) => {
  c.get("session").deleteSession();
  return new Response();
});

app.post("/subjects", async (c) => {
  const session = c.get("session");
  const login = session.get("login") as Session;

  const schema = z.object({
    name: z.string().min(1),
    assignees: z.array(z.string().min(1)).min(1),
  });
  const result = await schema.safeParseAsync(await c.req.json());
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

app.post("/attendance", async (c) => {
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
      return c.json({
        name,
        email: login.account.email,
        registrations: info.enrolling,
      });
    case "TEACHER":
      return c.json({
        name,
        email: login.account.email,
        charges: info.assigned,
      });
    default:
      throw new Error("unreachable");
  }
});

app.get("/subjects/:subject_id", async (c) => {
  const subjectId = c.req.param("subject_id") as ID<Subject>;

  const subject = await new D1SubjectRepository(c.env.DB).getSubject(subjectId);
  if (!subject) {
    return c.text("Not Found", 404);
  }

  return c.json({
    name: subject.name,
    assignees: subject.assigned,
    boards: subject.boards.map(
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

function sinceAndUntilSetting(since: string = '0001-01-01T00:00:00', until: string = '9999-12-31T23:59:59'): { secondsSince: number; secondsUntil: number; } | null {
  const msSince = Date.parse(since);
  const msUntil = Date.parse(until);
  if ( Number.isNaN(msSince) || Number.isNaN(msUntil) ){
    return null;
  }
  const secondsSince = Math.floor(msSince / 1000);
  const secondsUntil = Math.floor(msUntil / 1000);

  return { secondsSince, secondsUntil }
}

app.get("/subject/:subject_id/:board_id/attendances", async (c) => {
  //各パラメータの受け取り
  const { since, until }= c.req.query();
  const boardId = c.req.param("board_id");

  //認証する
  const HonoSession = c.get("session");
  const login = HonoSession.get("login") as Session | null;
  if (!login) {
    return c.text("Unauthorized", 401);
  }

  //教員かどうかチェックする
  const accountRepo = new D1AccountRepository(c.env.DB);
  const accountInfo = await accountRepo.getStudentOrTeacher(login.account.id);
  if ( !accountInfo ) {
    return c.text("Unauthorized", 401);
  }

  if ( accountInfo.role != 'TEACHER' ){
    return c.text("Unauthorized", 401);
  }

  //sinceとuntilを設定する
  const parsed = sinceAndUntilSetting(since, until);
  if ( parsed === null ){
    return c.text("Bad Request", 400);
  }
  const { secondsSince, secondsUntil } = parsed;

  //DBにアクセスしてattendanceのid, created_atを取得
  const attendanceAndAccountEntry = await c.env.DB
  .prepare(`
    SELECT attendance.id, attendance.created_at, account.id as student_id, account.name, account.email
    FROM attendance
    INNER JOIN account
      ON attendance.who = account.id
    WHERE attendance.created_at BETWEEN ?1 AND ?2 AND attendance."where" = ?3`)
  .bind(secondsSince, secondsUntil, boardId)
  .all();
  const { results } = attendanceAndAccountEntry;
  if ( results === null ){
    throw new Error("attendance query was invalid");
  }

  //JSONで返す
  return c.json(results.map(({ id, created_at, student_id, name, email }) => ({
    id,
    created_at,
    who: {
      id: student_id,
      name,
      email,
    },
  })));
});

export default app;
