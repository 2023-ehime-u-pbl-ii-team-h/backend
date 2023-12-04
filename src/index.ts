import { Hono } from "hono";
import { nanoid } from 'nanoid'
import { ID } from './model/id'
import { Account, Student, Teacher } from "./model/account"
import { poweredBy } from "hono/powered-by";
import { Session, Clock } from "./model/session";
import { sessionMiddleware, CookieStore, Session } from 'hono-sessions'

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{
  Bindings: Bindings
  Variables: {
    session: Session,
    session_key_rotation: boolean
  }
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
  });
  return middleware(c, next);
});

async function getOrNewAccount(db: D1Database, mails, role, name): Promise<Account>{
  const entry = await db.prepare("SELECT * FROM account WHERE email = ?").bind(mails).first();
  const isNewUser = entry == null;
  if ( isNewUser ){
    const account: Account = {
      id: nanoid() as ID <Account>,
      email: mails
    };
    const statement = db.prepare("INSERT INTO account (id, name, email, role) VALUES (?1, ?2, ?3, ?4");
    if ( role == "STUDENT" ){
      const newStudent: Student = {
        account,
        role: "STUDENT",
        enrolling: [],
      };
      statement.bind(newStudent.id, name, newStudent.email, newStudent.role);
    }
    else if ( role == "TEACHER" ){
      const newTeacher: Teacher = {
        account,
        role: "TEACHER",
        enrolling: [],
      };
      statement.bind(newTeacher.id, name, newTeacher.email, newTeacher.role);
    }
    await statement.run();
    return account;
  }
  else {
    return {
      id: entry['id'] as ID <Account>, 
      email: entry['email'] as string
    };
  }
};

/*Microsoft Graphから情報をとってくる*/
app.post("/login", async(c) => {
  const token = c.req.header("Authorization");
  if ( !token ){
    const option = { status: 401 }
    const errorResponse = new Response(null, option);
    return errorResponse;
  }

  const info = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      "Authorization": token
    }
  });

  if ( !info.ok ){
    info.text().then(console.log);
    return new Response(null, { status: 401 });
  }
  /*とってきた情報を使えるように形を変える*/
  const { mail: mails, jobTitle: role, displayName: name } = await info.json();

  /*デバイス名関連*/
  const parser = new UAParser(c.req.header("user-agent"));
  const parserResults = parser.getResult(); //デバイス名の取得に必要
  
  const account =  await getOrNewAccount(c.env.DB, mails, role, name);
  const clock: Clock = {
    now: () => Date.now(),
  };
  const newSession = Session.newSession(clock, account, parserResults.getDevice().type + parserResults.getBrouser().name);
  c.get('session').set('login', newSession);
  const option = {
    status: 200,
  }
  const response = new Response(null, option);
  return response;
});

export default app;
