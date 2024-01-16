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
    this.session.set(LOGIN_KEY, newSession);
  }
}
