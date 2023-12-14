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
import { nanoid } from "nanoid";

type Bindings = {
  DB: D1Database;
  COOKIE_SECRET: string;
  AZURE_CLIENT_SECRET: string;
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
      code: form.get("code") as string,
      requestUrl: c.req.url,
      userAgent: c.req.header("user-agent") as string,
      returnUrl: form.get("state") as string,
    },
    accessTokenService: new MicrosoftOAuth(),
    verifierRepo: sessionRepo,
    userRepo: new MicrosoftGraph(),
    accountRepo: new D1AccountRepository(c.env.DB),
    sessionRepo,
  });
  return c.redirect(redirectUrl);
});

app.post("/logout", async(c) => {
  c.get('session').deleteSession();
  return new Response();
});

app.post("/attendance", async(c) => {
  /*ネットワークの確認を行う*/
  const allowPattern = new RegExp(c.env.ALLOW_IP_REGEX);
  if ( !allowPattern.test(c.req.header("cf-connectiong-ip") as string) ) {
    return c.text("Forbidden", 403);
  }

  /*学生の認証を行う*/
  //sessionがcookieあるか確認
  const session = c.get("session");
  if ( !session ){
    return c.text("Unauthorized", 401);
  }
  //session情報がsessionテーブルにある確認
  const existResult = await c.env.DB
  .prepare("SELECT * FROM session WHERE id = ?")
  .bind(session['id'])
  .first();
  const isExist = existResult == null;
  if ( isExist ){
    return c.text("Unauthorized", 401);
  }
  //roleが学生か確認
  const isStudent = await c.env.DB
  .prepare("SELECT * FROM account WHERE role = STUDENT AND id = ?")
  .bind(session['account_id'])
  .first();
  if ( isStudent ){
    return c.text("Unauthorized", 401);
  }

  /*出席申請受付が開始されている科目をDBから探す、存在しなければ404を返す*/
  const now = new Date();
  const attendance_boardResult = await c.env.DB
  .prepare("SELECT id FROM attendance_board WHERE ? BETWEEN start_from AND seconds_from_be_late_to_end")
  .bind(now)
  .first();
  const isSubjectNone = attendance_boardResult == null;
  if ( isSubjectNone ){
    return c.text("Not Found", 404);
  }

  /*打刻を行う*/
  //既に出席申請されていないか確認する
  const attendResult = await c.env.DB
  .prepare("SELECT * FROM attendance WHERE where = ?")
  .bind(attendance_boardResult)
  .first();
  const existAttendance = attendResult != null;
  if ( existAttendance ){
    return c.text("Unprocessable Entity", 422);
  }
  //打刻を行う
  const attendanceId = nanoid();
  const reqest = await c.env.DB
  .prepare("INSERT INTO attendance (id, create_at, who, where) VALUES (?1, ?2, ?3, ?4)")
  .bind(attendanceId, now, session['account_id'], attendance_boardResult)
  .run();

  if (!reqest.success) {
    throw new Error("failed to attend");
  }

  return new Response();
});

export default app;
