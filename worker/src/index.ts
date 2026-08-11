import { Hono } from "hono";
import { publicApi } from "./routes/public";
import { adminApi } from "./routes/admin";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

app.route("/api", publicApi);
app.route("/api", adminApi);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "服务器内部错误" }, 500);
});

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/")) {
    return c.json({ error: "Not Found" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
};
