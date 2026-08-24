import type { Env } from "./index";

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "create_posts",
    sql: `CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      views INTEGER NOT NULL DEFAULT 0
    );`
  },
  {
    version: 2,
    name: "create_tags_and_post_tags",
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS post_tags (
        post_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (post_id, tag_id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    `
  },
  {
    version: 3,
    name: "create_projects",
    sql: `CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      project_url TEXT NOT NULL DEFAULT '',
      demo_url TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`
  }
];

export async function runMigrations(env: Env): Promise<void> {
  const currentVersion = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'schema_version'"
  ).first<{ value: string }>();

  const current = currentVersion ? parseInt(currentVersion.value, 10) : 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      console.log(`Running migration ${migration.version}: ${migration.name}`);
      await env.DB.batch([
        env.DB.prepare(migration.sql),
        env.DB.prepare(
          "INSERT INTO settings (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        ).bind(String(migration.version))
      ]);
    }
  }
}
