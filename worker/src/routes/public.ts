import { Hono } from "hono";
import type { Env } from "../index";
import { getSiteIntro, listPosts, getPost, incrementViews, listTags, getStoredPassword } from "../db";
import { verifyPassword, generateToken, createSession } from "../auth";

export const publicApi = new Hono<{ Bindings: Env }>();

publicApi.get("/site", async (c) => {
  const intro = await getSiteIntro(c.env);
  return c.json({ intro });
});

publicApi.get("/posts", async (c) => {
  const tag = c.req.query("tag") || undefined;
  const page = Number(c.req.query("page")) || 1;
  const limit = Number(c.req.query("limit")) || 10;
  const data = await listPosts(c.env, { tag, page, limit });
  return c.json(data);
});

publicApi.get("/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "文章不存在" }, 404);
  }
  const post = await getPost(c.env, id);
  if (!post) {
    return c.json({ error: "文章不存在" }, 404);
  }
  c.executionCtx.waitUntil(incrementViews(c.env, id));
  return c.json(post);
});

publicApi.get("/tags", async (c) => {
  return c.json(await listTags(c.env));
});

publicApi.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return c.json({ error: "请输入密码" }, 400);
  const stored = await getStoredPassword(c.env);
  if (!stored || !(await verifyPassword(password, stored))) {
    return c.json({ error: "密码错误" }, 401);
  }
  const token = generateToken();
  await createSession(c.env, token);
  return c.json({ token });
});