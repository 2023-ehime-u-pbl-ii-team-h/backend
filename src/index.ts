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

  const name = await new D1AccountRepository(c.env.DB).selectAccountName(
    login.account.id,
  );

  return c.json({
    name,
    email: login.account.email,
  });
});

app.get("/subjects/:subject_id", async (c) => {
  const subjectID = c.req.param("subject_id") as ID<Subject>;

  const [ subjectEntry, teacherEntry, attendanceBoardEntry ] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT name FROM subject WHERE id = ?").bind(subjectID),
    c.env.DB.prepare("SELECT teacher_id FROM charge WHERE subject_id = ?").bind(subjectID),
    c.env.DB.prepare("SELECT id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end FROM attendance_board WHERE subject_id = ?").bind(subjectID),
  ]);
  if ( subjectEntry === null ){
    throw new Error("Subject query was invalid");
  }
  if ( teacherEntry === null ){
    throw new Error("Charge query was invalid"); 
  }
  if ( attendanceBoardEntry === null ){
    return c.text("Not Found", 404);
  }

  const { subjectName } = subjectEntry;
  const { chargeTeacherID } = teacherEntry;
  const { attendanceBoardID, startFrom, secondsFromStartToBeLate, secondsFromBeLateToEnd } = attendanceBoardEntry;

  return c.json({
    name: subjectName,
    assignees: chargeTeacherID,
    boards: {
      id: attendanceBoardID,
      startFrom: startFrom.toISOString(),
      secondsFromStartToBeLate: secondsFromStartToBeLate,
      secondsFromBeLateToEnd: secondsFromBeLateToEnd,
    }
  });
});
export default app;
