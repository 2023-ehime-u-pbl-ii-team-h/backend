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

const store = new CookieStore()

app.use("*", poweredBy(), sessionMiddleware({
  store,
  encryptionKey: COOKIE_SECRET,
  expireAfterSeconds: 300,
  cookieOptions: {
    httpOnly: true
  }
}));

/*Microsoft Graphから情報をとってくる*/
app.post("/login", async(c) => {
  if ( c.header["Authorization"] == "" ){ //Authorizationがないとき   
    const option = { status: 401 }
    const errorResponse = new Response(null, option);
    return errorResponse;
  }
  const token = c.header["Authorization"];
  const info = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      "Authorization": token
    }
  });
  /*とってきた情報を使えるように形を変える*/
  const { mail: mails, jobTitle: role, displayName: name } = await info.json();

  /*デバイス名関連*/
  let parser = new UAParser(c.req.header("user-agent"));
  let parserResults = parser.getResult(); //デバイス名の取得に必要
  
  /*DB内にMcrofoft Graphから得られたemailを持つアカウントがあるか探す*/
  let { results } = await c.env.DB.prepare("SELECT * FROM account WHERE email = ?").bind(mails).all();
  if ( results['email'] == '' ){ //emailがなかったとき
    const newAccount: Account = {
      id: nanoid() as ID <Account>,
      email: mails
    }
    const statement = c.env.DB.prepare("INSERT INTO account (id, name, email, role) VALUES (?1, ?2, ?3, ?4");
    if ( role == 'STUDENT' ){
      const newStudent: Student = {
        Account: newAccount,
        role: "STUDENT",
        enrolling: ID<Subject>[]
      }
      statement.bind(newStudent.id, name, newStudent.email, newStudent.role);
    }
    else if ( role == 'TEACHER' ){
      const newTeacher: Teacher = {
        Account: newAccount,
        role: "TEACHER",
        enrolling: ID<Subject>[]
      }
      statement.bind(newTeacher.id, name, newTeacher.email, newTeacher.role);
    }
    statement.run();
  }
  else if ( results['email'] != '' ){ //emailがあった
    const account: Account = {
      id: results['id'] as ID <Account>, 
      email: results['email']
    }

    const clock: Clock = {
      now: () => Date.now(),
    };
    const newSession = Session.newSession(clock, account, parserResults)
  }
  const option = {
    status: 200,
  }
  const response = new Response(null, option);
  return response;
});

export default app;
