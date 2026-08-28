import { Hono } from "hono";
import { publicApi } from "./routes/public";
import { adminApi } from "./routes/admin";
import { getSiteName, getBackgroundUrl } from "./db";

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

const DEFAULT_TITLE = "个人博客";

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] as string));
}

async function renderIndexHtml(c: { env: Env }): Promise<Response> {
  const [siteName, bgUrl] = await Promise.all([
    getSiteName(c.env),
    getBackgroundUrl(c.env),
  ]);
  const assetRes = await c.env.ASSETS.fetch(new Request("https://assets/index.html"));
  if (!assetRes.ok) return assetRes;
  let raw = await assetRes.text();
  raw = raw.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(siteName.trim() || DEFAULT_TITLE)}</title>`
  );
  if (bgUrl.trim()) {
    const escapedBg = bgUrl.replace(/"/g, "%22");
    raw = raw.replace(
      /<html([^>]*)>/,
      `<html$1 class="has-user-bg" style="--user-bg:url(&quot;${escapedBg}&quot;);--user-bg-size:cover;--user-bg-position:center;--user-bg-attachment:fixed">`
    );
  }
  return new Response(raw, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
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
  if (/\.[a-zA-Z0-9]{1,10}$/.test(path)) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(res.body, { status: res.status, headers });
    }
    return res;
  }
  return renderIndexHtml(c);
});

export default {
  fetch: app.fetch,
};
