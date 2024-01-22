import { Session } from "../model/session";
import { MiddlewareHandler } from "hono";
import { Session as HonoSession } from "hono-sessions";

export const loginMiddleware =
  (
    expirationSeconds: number,
    ignorePaths: readonly string[],
  ): MiddlewareHandler<{
    Bindings: {
      DB: D1Database;
    };
    Variables: {
      session: HonoSession;
      login: Session;
    };
  }> =>
  async (c, next) => {
    if (!ignorePaths.includes(c.req.path)) {
      const session = c.get("session");
      const login = session.get("login") as Session | null;
      if (!login) {
        console.log(`there is no session cookie`);
        return c.text("", 401);
      }

      const loginAt = await c.env.DB.prepare(
        "SELECT login_at FROM session WHERE id = ?1",
      )
        .bind(login.id)
        .first<number>("login_at");
      if (!loginAt) {
        console.log(`session (${login.id}) is not found`);
        return c.text("", 401);
      }

      const isExpired = !(Date.now() / 1000 < loginAt + expirationSeconds);
      if (isExpired) {
        await c.env.DB.prepare("DELETE FROM session WHERE id = ?1")
          .bind(login.id)
          .run();
        console.log(
          `session (${login.id}) from ${new Date(loginAt * 1000)} was expired`,
        );
        return c.text("", 401);
      }
      c.set("login", login);
    }
    return next();
  };
