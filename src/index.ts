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
import { nanoid } from "nanoid";
import { ID } from "./model/id";
import { Teacher } from "./model/account";
import { newSubject } from "./service/new-subject";
import { D1SubjectRepository } from "./adaptor/subject";
import { AttendanceBoard, AttendanceState, determineState } from "./model/attendance-board";

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
  /*ネットワークの確認を行う*/
  const allowPattern = new RegExp(c.env.ALLOW_IP_REGEX);
  if ( !allowPattern.test(c.req.header("cf-connectiong-ip") ?? "") ) { //"??":c.req.header(cf-connectiong-ip")でnullが返ってきたときに""として扱う演算子
    return c.text("Forbidden", 403);
  }

  /*学生の認証を行う*/
  //sessionがcookieあるか確認
  const honoSession = c.get('session');
  const session = honoSession.get("login") as Session | null;
  if ( !session ){
    return c.text("Unauthorized", 401);
  }

  /*まとめてクエリを実行する*/
  const now = Math.floor(Date.now() / 1000);
  const [ existResult, accountEntry, attendanceBoardEntry ] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT * FROM session WHERE id = ?").bind(session.id),
    c.env.DB.prepare("SELECT * FROM account WHERE role = 'STUDENT' AND id = ?").bind(session.account.id),
    c.env.DB.prepare(
      `
        SELECT id
        FROM attendance_board
        WHERE start_from  <= ?1
          AND ?1 <= start_from + seconds_from_be_late_to_end
          AND subject_id IN (
            SELECT subject_id
            FROM registration
            WHERE student_id = ?2
          )
      `,
    ).bind(now, session.account.id),
  ]);
  //session情報がsessionテーブルにあるか確認
  const existsSession = existResult.results.length === 1;
  if ( !existsSession ){
    return c.text("Unauthorized", 401);
  }
  //roleが学生か確認
  const isStudent = accountEntry.results.length === 1;
  if (!isStudent) {
    return c.text("Unauthorized", 401);
  }

  /*出席申請受付が開始されている科目をDBから探す、存在しなければ404を返す*/
  const isOpenBoard = attendanceBoardEntry.results.length === 1;
  if ( !isOpenBoard ){
    return c.text("Not Found", 404);
  }

  /*クエリを実行する*/
  const attendEntry = await c.env.DB
  .prepare("SELECT * FROM attendance WHERE who ?1 AND \"where\" = ?2")
  .bind(session.account.id, attendanceBoardEntry.results[0])
  .first();

  /*打刻を行う*/
  //既に出席申請されていないか確認する
  if ( attendEntry !== null ){
    return c.text("Unprocessable Entity", 422);
  }
  //打刻を行う
  const request = await c.env.DB
  .prepare("INSERT INTO attendance (id, create_at, who, \"where\") VALUES (?1, ?2, ?3, ?4)")
  .bind(nanoid(), now, session.account.id, attendanceBoardEntry.results[0])
  .run();
  if (!request.success) {
    throw new Error("failed to attend");
  }

  return new Response();
});

app.get("/attendances/:course_id", async(c) => {
  const subjectID = c.req.param('course_id');
  const honoSession = c.get('session');
  const session = honoSession.get("login") as Session | null;
  if ( !session ){
    return c.text("Unauthorized", 401);
  }

  //科目が存在するか、履修しているかをチェック
  const [subjectResult, registration] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT id FROM subject WHERE id = ?").bind(subjectID),
    c.env.DB.prepare("SELECT * registration WHERE subject_id = ?1 AND student_id = ?2").bind(subjectID, session.account.id)
  ])
  const subjectExists = subjectResult.results.length === 1;
  const isRegistration = registration.results.length === 1;
  if ( !subjectExists ){
    return c.text("Not Found", 404);
  }
  if ( !isRegistration ){
    return c.text("Not Found", 404);
  }

  /*出席状況を取得*/
   const entry = await c.env.DB
  .prepare(`
    SELECT
      SUM(CASE WHEN attendance.created_at BETWEEN attendance_board.start_from AND (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late) THEN 1 ELSE 0 END) AS on_time,
      SUM(CASE WHEN attendance.created_at BETWEEN (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late) AND (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late + attendance_board.seconds_from_be_late_to_end) THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN attendance.created_at >= (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late + attendance_board.seconds_from_be_late_to_end) THEN 1 ELSE 0 END) AS miss
    FROM attendance
    INNER JOIN attendance_board
      ON attendance."where" = attendance_board.id
    WHERE attendance.who = ?1 AND attendance_board.subject_id = ?2
  `)
  .bind(session.account.id, subjectID)
  .first();

  if ( entry === null ){
    throw new Error("SUM up query was invalid");
  }
  const { on_time, late, miss } = entry;

  /*JSON形式で返す*/
  return c.json({
    on_time: on_time ?? 0,
    late: late ?? 0,
    miss: miss ?? 0
  });
});

export default app;
