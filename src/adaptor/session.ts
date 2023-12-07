import { Session as HonoSession } from "hono-sessions";
import { LoginRepository, VerifierRepository } from "../service/login";
import { Session } from "../model/session";

const PKCE_VERIFIER_KEY = "pkce_verifier";
const LOGIN_KEY = "login";

export class HonoSessionRepository
  implements VerifierRepository, LoginRepository
{
  constructor(private readonly session: HonoSession) {}

  store(verifier: string): Promise<void> {
    this.session.set(PKCE_VERIFIER_KEY, verifier);
    return Promise.resolve();
  }
  load(): Promise<string> {
    return Promise.resolve(this.session.get(PKCE_VERIFIER_KEY) as string);
  }

  createLoginSession(newSession: Session): Promise<void> {
    this.session.set(LOGIN_KEY, newSession);
    return Promise.resolve();
  }
}
