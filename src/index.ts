import { Hono } from "hono";
import { poweredBy } from "hono/powered-by";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", poweredBy());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;
