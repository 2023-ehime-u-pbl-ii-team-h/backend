import { Hono, MiddlewareHandler } from "hono";
import { nanoid } from "nanoid";
import { ID } from "./model/id";
import { Account, Student, Teacher } from "./model/account";
import { Session, Clock } from "./model/session";
import {
  sessionMiddleware,
  CookieStore,
  Session as HonoSession,
} from "hono-sessions";
import { UAParser } from "ua-parser-js";

const MICROSOFT_GRAPH_API_ROOT = "https://graph.microsoft.com/v1.0";

type Bindings = {
  DB: D1Database;
  COOKIE_SECRET: string;
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

async function getOrNewAccount(
  db: D1Database,
  mails: string,
  name: string,
): Promise<Account | null> {
  const entry = await db
    .prepare("SELECT * FROM account WHERE email = ?")
    .bind(mails)
    .first();
  const isNewUser = entry == null;
  if (isNewUser) {
    const account: Account = {
      id: nanoid() as ID<Account>,
      email: mails,
    };
    const statement = db.prepare(
      "INSERT INTO account (id, name, email, role) VALUES (?1, ?2, ?3, ?4)",
    );

    const isStudent = /^[a-z]\d{6}[a-z]@mails\.cc\.ehime-u\.ac\.jp$/.test(
      mails,
    );
    const isTeacher = /@(.+\.)?ehime-u\.ac\.jp$/.test(mails);
    if (isStudent) {
      const newStudent: Student = {
        ...account,
        role: "STUDENT",
        enrolling: [],
      };
      statement.bind(newStudent.id, name, newStudent.email, newStudent.role);
    } else if (isTeacher) {
      const newTeacher: Teacher = {
        ...account,
        role: "TEACHER",
        assigned: [],
      };
      statement.bind(newTeacher.id, name, newTeacher.email, newTeacher.role);
    } else {
      return null;
    }
    await statement.run();
    return account;
  }
  return {
    id: entry["id"] as ID<Account>,
    email: entry["email"] as string,
  };
}

app.post("/login", async (c) => {
  const token = c.req.header("Authorization");
  if (!token) {
    const option = { status: 401 };
    const errorResponse = new Response(null, option);
    return errorResponse;
  }

  const info = await fetch(MICROSOFT_GRAPH_API_ROOT + "/me", {
    headers: {
      Authorization: token,
    },
  });

  if (!info.ok) {
    info.text().then(console.log);
    return new Response(null, { status: 401 });
  }

  const { mail: mails, displayName: name } = await info.json<{
    mail: string;
    displayName: string;
  }>();

  /*デバイス名関連*/
  const parser = new UAParser(c.req.header("user-agent"));
  const parserResults = parser.getResult(); //デバイス名の取得に必要

  const account = await getOrNewAccount(c.env.DB, mails, name);
  if (!account) {
    return new Response(null, { status: 401 });
  }
  const clock: Clock = {
    now: () => new Date(),
  };
  const newSession = Session.newSession(
    clock,
    account,
    parserResults.device.type + parserResults.browser.name,
  );
  c.get("session").set("login", newSession);
  return new Response();
});

export default app;
