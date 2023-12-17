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
  if ( !allowPattern.test(c.req.header("cf-connectiong-ip") ?? "") ) { //"??":c.req.header(cf-connectiong-ip")でnullが返ってきたときに""として扱う演算子
    return c.text("Forbidden", 403);
  }

  /*学生の認証を行う*/
  //sessionがcookieあるか確認
  const session = c.get("session");
  if ( !session ){
    return c.text("Unauthorized", 401);
  }

  /*まとめてクエリを実行する*/
  const now = new Date();
  const [ existResult, accountEntry, attendanceBoardEntry ] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT * FROM session WHERE id = ?").bind(session.id),
    c.env.DB.prepare("SELECT * FROM account WHERE role = 'STUDENT' AND id = ?").bind(session.account_id),
    c.env.DB.prepare("SELECT id FROM attendance_board WHERE start_from  <= ?1 AND seconds_from_be_late_to_end >= ?2").bind(now, now),
  ]);
  //session情報がsessionテーブルにある確認
  const exists = existResult !== null;
  if ( !exists ){
    return c.text("Unauthorized", 401);
  }
  //roleが学生か確認
  const isStudent = accountEntry !== null;
  if (!isStudent) {
    return c.text("Unauthorized", 401);
  }

  /*出席申請受付が開始されている科目をDBから探す、存在しなければ404を返す*/
  const isSubjectNone = attendanceBoardEntry == null;
  if ( isSubjectNone ){
    return c.text("Not Found", 404);
  }

  /*まとめてクエリを実行する*/
  const [ attendResult, request ] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT * FROM attendance WHERE \"where\" = ?").bind(attendanceBoardEntry),
    c.env.DB.prepare("INSERT INTO attendance (id, create_at, who, \"where\") VALUES (?1, ?2, ?3, ?4)").bind(nanoid(), new Date(), session.account_id, attendanceBoardEntry)
  ])
  /*打刻を行う*/
  //既に出席申請されていないか確認する
  const existAttendance = attendResult != null;
  if ( existAttendance ){
    return c.text("Unprocessable Entity", 422);
  }
  //打刻を行う
  if (!request.success) {
    throw new Error("failed to attend");
  }

  return new Response();
});

export default app;
