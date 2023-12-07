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
import { generatePkceKeys } from "./model/auth";

const MICROSOFT_GRAPH_API_ROOT = "https://graph.microsoft.com/v1.0";
const MICROSOFT_OAUTH_ROOT =
  "https://login.microsoftonline.com/organizations/oauth2/v2.0";
const AZURE_CLIENT_ID = "788aebee-7aa0-4286-b58c-7e35bf22e92a";
const AZURE_APP_SCOPE = "https://graph.microsoft.com/user.read";

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

const PKCE_VERIFIER_KEY = "pkce_verifier";

app.get("/login", async (c) => {
  const { verifier, challenge } = await generatePkceKeys();

  c.get("session").set(PKCE_VERIFIER_KEY, verifier);

  const authorizeUrl =
    MICROSOFT_OAUTH_ROOT +
    "/authorize?" +
    new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      response_type: "code",
      redirect_uri: new URL("/redirect", c.req.url).toString(),
      response_mode: "form_post",
      scope: AZURE_APP_SCOPE,
      state: c.req.header("Referer") ?? "",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
  return c.redirect(authorizeUrl);
});

app.post("/redirect", async (c) => {
  const form = await c.req.formData();
  const session = c.get("session");
  const verifier = session.get(PKCE_VERIFIER_KEY) as string;
  session.set(PKCE_VERIFIER_KEY, "");

  const res = await fetch(MICROSOFT_OAUTH_ROOT + "/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "",
    },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      scope: AZURE_APP_SCOPE,
      code: form.get("code"),
      redirect_uri: new URL("/redirect", c.req.url).toString(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    res.text().then(console.log);
    return c.text("Bad Request", 400);
  }

  const { access_token: accessToken } = (await res.json()) as {
    access_token: string;
  };

  const info = await fetch(MICROSOFT_GRAPH_API_ROOT + "/me", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (!info.ok) {
    info.text().then(console.log);
    return new Response(null, { status: 401 });
  }

  const { mail: mails, displayName: name } = (await info.json()) as {
    mail: string;
    displayName: string;
  };

  const parser = new UAParser(c.req.header("user-agent"));
  const parserResults = parser.getResult();

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
  session.set("login", newSession);
  return c.redirect(form.get("state"));
});

export default app;
