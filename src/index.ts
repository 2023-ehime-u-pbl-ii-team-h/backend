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
import { Subject } from "./model/subject";
import { nanoid } from "nanoid";
import { Teacher } from "./model/account";

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
      code: form.get("code"),
      requestUrl: c.req.url,
      userAgent: c.req.header("user-agent"),
      returnUrl: form.get("state"),
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
  const body: unknown = await c.req.json();

  if (!(typeof body === "object" && "name" in body && "assignees" in body)) {
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

  const assigneesSet = new Set(body.assignees);
  if (!assigneesSet.has(login.account.id as ID<Teacher>)) {
    return c.text("Bad Request", 400);
  }

  const assignees = [...assigneesSet.values()];
  const statement = c.env.DB.prepare("SELECT * FROM account WHERE id = ?");
  const rows = await c.env.DB.batch(assignees.map((id) => statement.bind(id)));
  if (!rows.every((row) => row.results.length === 1)) {
    return c.text("Bad Request", 400);
  }

  const newSubjectID = nanoid() as ID<Subject>;
  const insertCharge = c.env.DB.prepare(
    "INSERT INTO charge (id, teacher_id, subject_id) VALUES (?, ?, ?)",
  );
  await c.env.DB.batch(
    [
      c.env.DB.prepare("INSERT INTO subject (id, name) VALUES (?, ?)").bind(
        newSubjectID,
        body.name,
      ),
    ].concat(
      assignees.map((assignee) =>
        insertCharge.bind(nanoid(), assignee, newSubjectID),
      ),
    ),
  );

  return c.json({
    id: newSubjectID,
    name: body.name,
    assignees,
  });
});

export default app;
