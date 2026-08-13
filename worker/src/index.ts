import { Hono } from "hono";
import { publicApi } from "./routes/public";
import { adminApi } from "./routes/admin";
import { getSiteName } from "./db";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

const DEFAULT_TITLE = "个人博客";

async function renderIndexHtml(c: { env: Env }): Promise<Response> {
  const siteName = (await getSiteName(c.env)).trim() || DEFAULT_TITLE;
  const assetRes = await c.env.ASSETS.fetch(new Request("https://assets/index.html"));
  if (!assetRes.ok) return assetRes;
  const raw = await assetRes.text();
  const html = raw.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${siteName.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] as string))}</title>`
  );
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

app.route("/api", publicApi);
app.route("/api", adminApi);

app.get("/", async (c) => renderIndexHtml(c));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "服务器内部错误" }, 500);
});

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/")) {
    return c.json({ error: "Not Found" }, 404);
  }
  if (/\.[A-Za-z0-9]{1,10}$/.test(path)) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return renderIndexHtml(c);
});

export default {
  fetch: app.fetch,
};
