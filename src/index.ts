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
const MICROSOFT_OAUTH_ROOT =
  "https://login.microsoftonline.com/orginzations/oauth2/v2.0";
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

interface PkceCodes {
  challengeMethod: string;
  verifier: string;
  challenge: string;
}

const PKCE_CODES_KEY = "pkce_codes";
const PKCE_CHALLENGE_METHOD = "S256";

function encodeBase64Url(array: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(array))
    .map((byte) => String.fromCharCode(byte))
    .reduce((str, digit) => str + digit, "");
  return btoa(bytes).replace("+", "-").replace("/", "_").replace("=", "");
}

app.get("/login", async (c) => {
  const randomArray = crypto.getRandomValues(new Uint8Array(32));
  const verifier = encodeBase64Url(randomArray);
  const challengeArray = await crypto.subtle.digest(
    { name: "SHA-256" },
    randomArray,
  );
  const challenge = encodeBase64Url(challengeArray);

  c.get("session").set(PKCE_CODES_KEY, {
    challengeMethod: PKCE_CHALLENGE_METHOD,
    verifier,
    challenge,
  });

  try {
    const authorizeUrl =
      MICROSOFT_OAUTH_ROOT +
      "/authorize?" +
      new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        response_type: "code",
        redirect_uri: new URL("/redirect", c.req.url).toString(),
        response_mode: "query",
        scope: AZURE_APP_SCOPE,
        state: c.req.header("Referer"),
        code_challenge: challenge,
        code_challenge_method: PKCE_CHALLENGE_METHOD,
      });
    return c.redirect(authorizeUrl);
  } catch (error) {
    console.dir(error);
    return c.text("Internal Server Error", 500);
  }
});

app.get("/redirect", async (c) => {
  const session = c.get("session");
  const codes = session.get(PKCE_CODES_KEY) as PkceCodes;
  session.set(PKCE_CODES_KEY, {});

  const res = await fetch(MICROSOFT_OAUTH_ROOT + "/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      scope: AZURE_APP_SCOPE,
      code: c.req.query("code"),
      redirect_uri: new URL("/redirect", c.req.url).toString(),
      code_verifier: codes.verifier,
      client_secret: c.env.AZURE_CLIENT_SECRET,
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
  return new Response();
});

export default app;
