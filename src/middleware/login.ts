import { D1AccountRepository } from "../adaptor/account";
import { MicrosoftGraph } from "../adaptor/microsoft-graph";
import { Account, newAccount } from "../model/account";
import type { MiddlewareHandler } from "hono";

export const loginMiddleware =
  (): MiddlewareHandler<{
    Bindings: {
      DB: D1Database;
    };
    Variables: {
      account: Account;
    };
  }> =>
  async (c, next) => {
    const authorization = c.req.header("Authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      console.log("missing Authorization header");
      return c.text("", 401);
    }
    const token = authorization.slice("Bearer ".length);

    const { name, email } = await new MicrosoftGraph().getMe(token);

    const accountRepo = new D1AccountRepository(c.env.DB);
    let account = await accountRepo.getAccount(email);
    if (!account) {
      const created = newAccount(name, email);
      if (!created) {
        console.log(`unknown user: ${name} (${email})`);
        return c.text("", 400);
      }
      await accountRepo.addAccount(created);
      account = created;
    }
    c.set("account", account);

    return next();
  };
