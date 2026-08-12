import type { Env } from "./index";

export interface PostSummary {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
  views: number;
  tags: string[];
}

export interface PostDetail extends PostSummary {
  content: string;
}

export interface TagCount {
  name: string;
  count: number;
}

export async function getSiteIntro(env: Env): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind("intro")
    .first<string>("value");
  return row ?? "";
}

export async function setIntro(env: Env, intro: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('intro', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(intro)
    .run();
}

export async function getSiteName(env: Env): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind("site_name")
    .first<string>("value");
  return row ?? "";
}

export async function setSiteName(env: Env, name: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('site_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(name)
    .run();
}

export async function getAvatarUrl(env: Env): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind("avatar_url")
    .first<string>("value");
  return row ?? "";
}

export async function setAvatarUrl(env: Env, url: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('avatar_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(url)
    .run();
}

export async function getStoredPassword(env: Env): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind("password_hash")
    .first<string>("value");
  return row ?? null;
}

export async function setPassword(env: Env, stored: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('password_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(stored)
    .run();
}

function splitTags(input: string[]): string[] {
  const cleaned = input
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of cleaned) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

async function replaceTags(env: Env, postId: number, tags: string[]): Promise<void> {
  // 对标签去重并保序
  const clean = splitTags(tags);

  // 第一步：一次性 batch 插入所有标签（幂等，已存在则跳过）
  if (clean.length > 0) {
    await env.DB.batch(
      clean.map((name) =>
        env.DB.prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING").bind(name)
      )
    );
  }

  // 第二步：先删除旧关联，保证本次改写总能生效且幂等
  await env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(postId).run();

  // 第三步：此时所有标签必然已存在，逐个查 id 并建立关联
  if (clean.length > 0) {
    const links: D1PreparedStatement[] = [];
    for (const name of clean) {
      const row = await env.DB.prepare("SELECT id FROM tags WHERE name = ?").bind(name).first();
      if (row) {
        links.push(
          env.DB.prepare("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)").bind(
            postId,
            row.id
          )
        );
      }
    }
    if (links.length > 0) {
      await env.DB.batch(links);
    }
  }
}

export async function listPosts(
  env: Env,
  opts: { tag?: string; page: number; limit: number }
): Promise<{ posts: PostSummary[]; total: number }> {
  const page = Math.max(1, opts.page);
  const limit = Math.min(50, Math.max(1, opts.limit));
  const offset = (page - 1) * limit;

  const baseFilter = opts.tag
    ? `WHERE EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND t.name = ?)`
    : "";
  const params: (string | number)[] = opts.tag ? [opts.tag] : [];

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM posts p ${baseFilter}`
  )
    .bind(...params)
    .first<number>("n");
  const total = countRow ?? 0;

  const rows = await env.DB.prepare(
    `SELECT p.id, p.title, p.created_at, p.updated_at, p.views
     FROM posts p ${baseFilter}
     ORDER BY p.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`
  )
    .bind(...params)
    .all<{
      id: number;
      title: string;
      created_at: number;
      updated_at: number;
      views: number;
    }>();

  const posts: PostSummary[] = [];
  for (const row of rows.results) {
    const tagsRows = await env.DB.prepare(
      `SELECT t.name FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.name`
    )
      .bind(row.id)
      .all<{ name: string }>();
    posts.push({ ...row, tags: tagsRows.results.map((r) => r.name) });
  }
  return { posts, total };
}

export async function getPost(env: Env, id: number): Promise<PostDetail | null> {
  const row = await env.DB.prepare(
    "SELECT id, title, content, created_at, updated_at, views FROM posts WHERE id = ?"
  )
    .bind(id)
    .first<{
      id: number;
      title: string;
      content: string;
      created_at: number;
      updated_at: number;
      views: number;
    }>();
  if (!row) return null;
  const tagsRows = await env.DB.prepare(
    `SELECT t.name FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.name`
  )
    .bind(id)
    .all<{ name: string }>();
  return { ...row, tags: tagsRows.results.map((r) => r.name) };
}

export async function incrementViews(env: Env, id: number): Promise<void> {
  await env.DB.prepare("UPDATE posts SET views = views + 1 WHERE id = ?").bind(id).run();
}

export async function listTags(env: Env): Promise<TagCount[]> {
  const rows = await env.DB.prepare(
    `SELECT t.name, COUNT(pt.post_id) AS count
     FROM tags t LEFT JOIN post_tags pt ON t.id = pt.tag_id
     GROUP BY t.id, t.name ORDER BY count DESC, t.name ASC`
  ).all<{ name: string; count: number }>();
  return rows.results;
}

export async function createPost(
  env: Env,
  data: { title: string; content: string; tags: string[] }
): Promise<number> {
  const now = Date.now();
  const res = await env.DB.prepare(
    "INSERT INTO posts (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)"
  )
    .bind(data.title, data.content, now, now)
    .run();
  const id = res.meta.last_row_id;
  await replaceTags(env, id, data.tags);
  return id;
}

export async function updatePost(
  env: Env,
  id: number,
  data: { title: string; content: string; tags: string[] }
): Promise<boolean> {
  const res = await env.DB.prepare(
    "UPDATE posts SET title = ?, content = ?, updated_at = ? WHERE id = ?"
  )
    .bind(data.title, data.content, Date.now(), id)
    .run();
  if (res.meta.changes === 0) return false;
  await replaceTags(env, id, data.tags);
  return true;
}

export async function deletePost(env: Env, id: number): Promise<boolean> {
  const statements = [
    env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(id),
    env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  ];
  const results = await env.DB.batch(statements);
  const changes = results[1].meta.changes;
  return changes > 0;
}