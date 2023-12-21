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
import { Teacher } from "./model/account";
import { newSubject } from "./service/new-subject";
import { D1SubjectRepository } from "./adaptor/subject";
import { attend } from "./service/attend";
import { D1AttendanceBoardRepository } from "./adaptor/attendance-board";
import { D1AttendanceRepository } from "./adaptor/attendance";

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
  let body: unknown;
  try {
    body = await c.req.json();
  } catch (error) {
    c.req.text().then(console.log);
    return c.text("Bad Request", 400);
  }

  if (
    !(
      typeof body === "object" &&
      body !== null &&
      "name" in body &&
      "assignees" in body
    )
  ) {
    return c.text("Bad Request", 400);
  }
  if (typeof body.name !== "string" || body.name === "") {
    return c.text("Bad Request", 400);
  }
  if (
    !(
      Array.isArray(body.assignees) &&
      body.assignees.length >= 1 &&
      body.assignees.every(
        (assignee: unknown): assignee is ID<Teacher> =>
          typeof assignee === "string",
      )
    )
  ) {
    return c.text("Bad Request", 400);
  }

  const ret = await newSubject({
    session: login,
    params: {
      name: body.name,
      assignees: body.assignees,
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
  const subjectID = c.req.param("course_id");
  const honoSession = c.get("session");
  const session = honoSession.get("login") as Session | null;
  if (!session) {
    return c.text("Unauthorized", 401);
  }

  const [subjectResult, registration] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT id FROM subject WHERE id = ?").bind(subjectID),
    c.env.DB.prepare(
      "SELECT * registration WHERE subject_id = ?1 AND student_id = ?2",
    ).bind(subjectID, session.account.id),
  ]);
  const subjectExists = subjectResult.results.length === 1;
  const isRegistration = registration.results.length === 1;
  if (!subjectExists) {
    return c.text("Not Found", 404);
  }
  if (!isRegistration) {
    return c.text("Not Found", 404);
  }

  const entry = await c.env.DB.prepare(
    `
    SELECT
      SUM(CASE WHEN attendance_board.start_from <= attendance.created_at AND attendance.created_at < (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late) THEN 1 ELSE 0 END) AS on_time,
      SUM(CASE WHEN (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late) <= attendance.created_at AND attendance.created_at < (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late + attendance_board.seconds_from_be_late_to_end) THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late + attendance_board.seconds_from_be_late_to_end) <= attendance.created_at THEN 1 ELSE 0 END) AS miss
    FROM attendance
    INNER JOIN attendance_board
      ON attendance."where" = attendance_board.id
    WHERE attendance.who = ?1 AND attendance_board.subject_id = ?2
  `,
  )
    .bind(session.account.id, subjectID)
    .first();

  if (entry === null) {
    throw new Error("SUM up query was invalid");
  }
  const { on_time, late, miss } = entry;

  return c.json({
    on_time: on_time ?? 0,
    late: late ?? 0,
    miss: miss ?? 0,
  });
});

app.get("/me", async (c) => {
  const HonoSession = c.get("session");
  const login = HonoSession.get("login") as Session | null;
  if (!login) {
    return c.text("Unauthorized", 401);
  }
  const entry = await c.env.DB.prepare("SELECT name FROM account WHERE id = ?")
    .bind(login.account.id)
    .first();

  if (entry === null) {
    throw new Error("Entry was invalid");
  }

  const { name } = entry;
  return c.json({
    name: name,
    email: login.account.email,
  });
});

export default app;
