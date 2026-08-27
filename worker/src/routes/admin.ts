import { Hono } from "hono";
import type { Env } from "../index";
import {
  setIntro,
  createPost,
  updatePost,
  deletePost,
  getStoredPassword,
  setPassword,
  setSiteName,
  setAvatarUrl,
  setFooterRecord,
  setSocialLinks,
  setBackgroundUrl,
  type SocialLink,
  createProject,
  updateProject,
  deleteProject,
} from "../db";
import {
  getToken,
  getSessionToken,
  deleteSession,
  hashPassword,
  verifyPassword,
  DEFAULT_PASSWORD,
} from "../auth";

export const adminApi = new Hono<{ Bindings: Env }>();

const ADMIN_PATHS = /^\/api\/(logout|site|change-password)$|^\/api\/(?:posts|projects)(?:\/[^/]+)?$/;

adminApi.use("*", async (c, next) => {
  if (!ADMIN_PATHS.test(c.req.path)) return next();
  const token = getToken(c.req.raw);
  if (!token) return c.json({ error: "未授权" }, 401);
  const session = await getSessionToken(c.env, token);
  if (!session) return c.json({ error: "未授权" }, 401);
  await next();
  // 响应期间保留对 token 的引用，用于下方 logout 场景（logout 接口自行处理删除）
});

adminApi.post("/logout", async (c) => {
  const token = getToken(c.req.raw);
  if (token) await deleteSession(c.env, token);
  return c.json({ ok: true });
});

adminApi.put("/site", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body?.footer_record !== undefined && body.footer_record !== null) {
    const record = body.footer_record;
    if (typeof record?.text !== "string" || typeof record?.link !== "string") {
      return c.json({ error: "备案信息格式错误" }, 400);
    }
    if (record.link && !/^https?:\/\//.test(record.link)) {
      return c.json({ error: "备案链接必须以 http:// 或 https:// 开头" }, 400);
    }
  }
  const tasks: Promise<void>[] = [];
  if (typeof body?.intro === "string") tasks.push(setIntro(c.env, body.intro));
  if (typeof body?.site_name === "string") tasks.push(setSiteName(c.env, body.site_name));
  if (typeof body?.avatar_url === "string") tasks.push(setAvatarUrl(c.env, body.avatar_url));
  if (typeof body?.background_url === "string") tasks.push(setBackgroundUrl(c.env, body.background_url));
  if (body?.footer_record !== undefined) {
    if (body.footer_record === null || body.footer_record.text === "") {
      tasks.push(setFooterRecord(c.env, null));
    } else {
      tasks.push(setFooterRecord(c.env, { text: body.footer_record.text, link: body.footer_record.link }));
    }
  }
  if (Array.isArray(body?.social_links)) {
    const links: SocialLink[] = body.social_links.filter(
      (item: unknown): item is SocialLink =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SocialLink).name === "string" &&
        typeof (item as SocialLink).url === "string"
    );
    tasks.push(setSocialLinks(c.env, links));
  }
  await Promise.all(tasks);
  return c.json({ ok: true });
});

adminApi.post("/posts", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || typeof body.content !== "string") {
    return c.json({ error: "标题和内容为必填项" }, 400);
  }
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
  const id = await createPost(c.env, { title: body.title, content: body.content, tags });
  return c.json({ id });
});

adminApi.put("/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  if (!Number.isInteger(id) || id <= 0 || !body || typeof body.title !== "string" || typeof body.content !== "string") {
    return c.json({ error: "参数错误" }, 400);
  }
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
  const ok = await updatePost(c.env, id, { title: body.title, content: body.content, tags });
  if (!ok) return c.json({ error: "文章不存在" }, 404);
  return c.json({ ok: true });
});

adminApi.delete("/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "参数错误" }, 400);
  const ok = await deletePost(c.env, id);
  if (!ok) return c.json({ error: "文章不存在" }, 404);
  return c.json({ ok: true });
});

adminApi.post("/change-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const oldPassword = typeof body?.oldPassword === "string" ? body.oldPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 6) {
    return c.json({ error: "新密码至少 6 位" }, 400);
  }
  const stored = await getStoredPassword(c.env);
  if (stored) {
    if (!(await verifyPassword(oldPassword, stored))) {
      return c.json({ error: "旧密码错误" }, 401);
    }
  } else if (oldPassword !== DEFAULT_PASSWORD) {
    return c.json({ error: "旧密码错误" }, 401);
  }
  await setPassword(c.env, await hashPassword(newPassword));
  return c.json({ ok: true });
});

adminApi.post("/projects", async (c) => {
  const body = await c.req.json<{
    title?: string;
    description?: string;
    cover_url?: string;
    project_url?: string;
    demo_url?: string;
    tags?: string[];
  }>();
  
  if (!body.title || !body.title.trim()) {
    return c.json({ error: "title is required" }, 400);
  }
  
  const id = await createProject(c.env, {
    title: body.title.trim(),
    description: body.description?.trim() || "",
    cover_url: body.cover_url?.trim() || "",
    project_url: body.project_url?.trim() || "",
    demo_url: body.demo_url?.trim() || "",
    tags: body.tags || []
  });
  
  return c.json({ id }, 201);
});

adminApi.put("/projects/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  
  const body = await c.req.json<{
    title?: string;
    description?: string;
    cover_url?: string;
    project_url?: string;
    demo_url?: string;
    tags?: string[];
  }>();
  
  if (!body.title || !body.title.trim()) {
    return c.json({ error: "title is required" }, 400);
  }
  
  const ok = await updateProject(c.env, id, {
    title: body.title.trim(),
    description: body.description?.trim() || "",
    cover_url: body.cover_url?.trim() || "",
    project_url: body.project_url?.trim() || "",
    demo_url: body.demo_url?.trim() || "",
    tags: body.tags || []
  });
  
  if (!ok) {
    return c.json({ error: "Not found" }, 404);
  }
  
  return c.json({ ok: true });
});

adminApi.delete("/projects/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  
  const ok = await deleteProject(c.env, id);
  if (!ok) {
    return c.json({ error: "Not found" }, 404);
  }
  
  return c.json({ ok: true });
});