import { Account } from "../model/account";
import { ID } from "../model/id";
import { Session } from "../model/session";
import { LoginRepository, VerifierRepository } from "../service/login";
import { Session as HonoSession } from "hono-sessions";

const PKCE_VERIFIER_KEY = "pkce_verifier";
const LOGIN_KEY = "login";

export class HonoSessionRepository
  implements VerifierRepository, LoginRepository
{
  constructor(
    private readonly session: HonoSession,
    private readonly db: D1Database,
  ) {}

  store(verifier: string): Promise<void> {
    this.session.set(PKCE_VERIFIER_KEY, verifier);
    return Promise.resolve();
  }
  load(): Promise<string> {
    return Promise.resolve(this.session.get(PKCE_VERIFIER_KEY) as string);
  }

  async createLoginSession(newSession: Session): Promise<void> {
    const loginAtSec = Math.floor(newSession.loginAt.getTime() / 1000);
    await this.db
      .prepare(
        "INSERT INTO session(id, account_id, login_at, device_name) VALUES (?1, ?2, ?3, ?4)",
      )
      .bind(
        newSession.id,
        newSession.account.id,
        loginAtSec,
        newSession.deviceName,
      )
      .run();
    this.session.set(LOGIN_KEY, newSession.id);
  }

  async getSession(): Promise<Session | null> {
    const sessionId = this.session.get(LOGIN_KEY) as ID<Session> | undefined;
    if (!sessionId) {
      return null;
    }
    const row = await this.db
      .prepare(
        "SELECT session.id, session.account_id, session.login_at, session.device_name, account.name, account.email, account.role FROM session JOIN account ON session.account_id = account.id AND session.id = ?1",
      )
      .bind(sessionId)
      .first<{
        id: ID<Session>;
        account_id: ID<Account>;
        login_at: number;
        device_name: string;
        name: string;
        email: string;
        role: string;
      }>();
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      account: {
        id: row.account_id,
        name: row.name,
        email: row.email,
        role: row.role,
      },
      loginAt: new Date(row.login_at * 1000),
      deviceName: row.device_name,
    };
  }
}
