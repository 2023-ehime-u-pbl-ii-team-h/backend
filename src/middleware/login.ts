import { HonoSessionRepository } from "../adaptor/session";
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
      const login = await new HonoSessionRepository(
        session,
        c.env.DB,
      ).getSession();
      if (!login) {
        console.log(`there is no session cookie`);
        return c.text("", 401);
      }

      const isExpired = !(
        Date.now() <
        login.loginAt.valueOf() + expirationSeconds * 1000
      );
      if (isExpired) {
        await c.env.DB.prepare("DELETE FROM session WHERE id = ?1")
          .bind(login.id)
          .run();
        console.log(`session (${login.id}) from ${login.loginAt} was expired`);
        return c.text("", 401);
      }
      c.set("login", login);
    }
    return next();
  };
