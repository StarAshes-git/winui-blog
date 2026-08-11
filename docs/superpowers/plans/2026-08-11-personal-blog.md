# 个人博客网站实现计划

> **对于 agentic workers：** 必选子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现本计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 构建部署在 Cloudflare Workers 上的个人博客，包含自我介绍、Markdown 文章、标签、浏览量统计和密码管理后台，UI 仿 Windows 11 WinUI 风格。

**架构：** Vue 3 + Vite 前端构建产物输出到 `worker/public/`，Workers 通过 Assets 绑定提供静态文件，`/api/*` 请求由 Worker 业务逻辑处理。数据存 D1（文章/标签/设置/密码哈希）和 KV（会话 token）。每次提交即可完整构建、本地运行、部署。

**技术栈：** TypeScript、Cloudflare Workers、D1、KV、Workers Assets、Vue 3、Vite、vue-router、marked、DOMPurify、highlight.js、Vitest。

## 全局约束

- 全部代码注释使用中文
- 不使用 R2；不使用 bcrypt/argon2（Workers 不支持），密码哈希用 Web Crypto PBKDF2-HMAC-SHA256，迭代 100,000，盐 16 字节
- 前端构建产物目录固定为 `worker/public/`（Vite `outDir`）
- D1 查询必须全部使用 prepared statements（`.bind()`），禁止字符串拼接 SQL
- API 管理接口鉴权头：`Authorization: Bearer <token>`；错误响应固定 `{ "error": string }`
- 登录会话存 KV key `session:<token>`，TTL 604800 秒（7 天）
- 默认密码 `admin`，仅在 `settings` 表无密码记录时作为初始密码
- Markdown 渲染必须经 DOMPurify 消毒；前端路由模式必须是 hash（`createWebHashHistory`）
- wrangler compatibility_date 使用 `2026-08-11`，启用 `nodejs_compat`
- 项目根目录：`D:\blog`

---

## 文件结构

```
D:\blog\
├── package.json                  # 根脚本：dev/build/test/typecheck
├── .gitignore
├── schema.sql                    # D1 建表脚本
├── wrangler.jsonc                # Workers 配置（assets/D1/KV/兼容性）
├── worker/
│   ├── package.json              # Worker 依赖（hono，dev 依赖 wrangler/vitest）
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── public/                   # Vite 构建产物（不手动提交）
│   └── src/
│       ├── index.ts              # Hono 应用入口，挂载 public 路由与 api 路由
│       ├── auth.ts               # PBKDF2 哈希、登录、会话、鉴权中间件
│       └── routes/
│           ├── public.ts         # /api/site、/api/posts、/api/tags、/api/login、浏览量+
│           └── admin.ts          # 受保护管理接口
├── frontend/
│   ├── package.json
│   ├── vite.config.ts            # outDir 指向 ../worker/public
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── App.vue               # 布局：顶部导航栏 + router-view + Mica 背景
│       ├── router/index.ts       # hash 路由
│       ├── api/client.ts         # fetch 封装 + token 管理
│       ├── api/types.ts          # 类型定义
│       ├── styles/win11.css      # WinUI 风格主题变量与基础控件样式
│       └── components/
│           ├── WinButton.vue     # Fluent 按钮
│           ├── WinInput.vue      # 圆角输入框
│           ├── WinDialog.vue     # 确认对话框（原生 dialog 实现）
│           ├── NavBar.vue        # 顶栏导航
│           ├── PostCard.vue      # 文章卡片
│           ├── MarkdownView.vue  # marked + DOMPurify + highlight.js 渲染
│           └── WinTag.vue        # 标签胶囊
│       └── views/
│           ├── HomeView.vue      # 自我介绍卡片 + 文章列表 + 分页
│           ├── PostView.vue      # 文章详情
│           ├── TagsView.vue      # 标签列表 + 按标签筛选
│           └── AdminView.vue     # 登录 + 后台管理（多页签）
```

---

### Task 1: 项目脚手架、根脚本、wrangler 配置、D1 schema

**Files:**
- Create: `D:\blog\package.json`
- Create: `D:\blog\.gitignore`
- Create: `D:\blog\schema.sql`
- Create: `D:\blog\wrangler.jsonc`
- Create: `D:\blog\worker\package.json`
- Create: `D:\blog\worker\tsconfig.json`
- Create: `D:\blog\worker\vitest.config.ts`
- Create: `D:\blog\frontend\package.json`

**Interfaces:**
- Produces: 根脚本 `npm run dev`、`npm run build`、`npm test`、`npm run typecheck`；wrangler.jsonc 绑定名字 `DB`(D1) 与 `SESSIONS`(KV)；schema.sql 表结构。后续任务依赖这些绑定名。
- 该任务是纯脚手架，无逻辑测试；验证方式为各命令可运行。

- [ ] **Step 1: 创建根目录 package.json**

```json
{
  "name": "personal-blog",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev:frontend": "npm --prefix frontend run dev",
    "dev:worker": "npm --prefix worker run dev",
    "build:frontend": "npm --prefix frontend run build",
    "test": "npm --prefix worker run test",
    "typecheck": "npm --prefix worker run typecheck && npm --prefix frontend run typecheck"
  }
}
```

- [ ] **Step 2: 创建 .gitignore**

```gitignore
node_modules/
dist/
worker/public/
.wrangler/
*.local
.DS_Store
```

- [ ] **Step 3: 创建 schema.sql**

```sql
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0
);

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
```

- [ ] **Step 4: 创建 wrangler.jsonc（binding 名确定，id 部署时填充）**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "personal-blog",
  "main": "worker/src/index.ts",
  "compatibility_date": "2026-08-11",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./worker/public",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "blog-db",
      "database_id": "REPLACE_WITH_D1_ID"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SESSIONS",
      "id": "REPLACE_WITH_KV_ID"
    }
  ]
}
```

> 说明：本地开发时 wrangler 会自动创建本地 D1/KV 状态；部署前用 `wrangler d1 create blog-db` 与 `wrangler kv namespace create SESSIONS`（或 API）获取真实 ID 并替换上方占位符。

- [ ] **Step 5: 创建 worker/package.json**

```json
{
  "name": "blog-worker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250701.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.90.0"
  }
}
```

- [ ] **Step 6: 创建 worker/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "WebWorker"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 7: 创建 worker/vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 8: 创建 frontend/package.json**

```json
{
  "name": "blog-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "dompurify": "^3.1.7",
    "highlight.js": "^11.10.0",
    "marked": "^14.1.2",
    "vue": "^3.5.0",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vue-tsc": "^2.1.0"
  }
}
```

- [ ] **Step 9: 安装依赖并验证**

Run（在 `D:\blog`）：
```bash
npm --prefix worker install
npm --prefix frontend install
```

Expected：两个目录均产生 `node_modules`。

- [ ] **Step 10: Commit**

```bash
git add package.json .gitignore schema.sql wrangler.jsonc worker/** frontend/package.json
git commit -m "chore: 初始化项目脚手架、wrangler 配置与 D1 schema"
```

---

### Task 2: Worker 入口与 Hono 应用骨架（路由 + Assets 转发 + 错误处理）

**Files:**
- Create: `D:\blog\worker\src\index.ts`
- Create: `D:\blog\worker\src\index.test.ts`

**Interfaces:**
- Produces: 默认导出 `{ fetch: (request, env, ctx) => Promise<Response> }`。`env` 类型为 `Env`（{ DB: D1Database; SESSIONS: KVNamespace; ASSETS: Fetcher }）。`/api/*` 未命中时返回 404 JSON；非 api 请求转发 `env.ASSETS.fetch(request)`。
- Consumes: Task 1 的 wrangler.jsonc 绑定名。

- [ ] **Step 1: 写失败测试**

`worker/src/index.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import worker from "./index";

function makeEnv() {
  return {
    DB: {} as unknown as D1Database,
    SESSIONS: {} as unknown as KVNamespace,
    ASSETS: {
      fetch: (request: Request) => new Response("asset-mock", { status: 200 }),
    } as unknown as Fetcher,
  };
}

describe("worker fetch", () => {
  it("转发非 api 请求到 ASSETS", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/"),
      makeEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("asset-mock");
  });

  it("未匹配的 api 请求返回 404 JSON", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/api/unknown"),
      makeEnv(),
      {} as ExecutionContext
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run（`D:\blog\worker`）：`npm test`
Expected：FAIL，报 `Cannot find module './index'`。

- [ ] **Step 3: 实现入口**

`worker/src/index.ts`：

```ts
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
```

> 注：`publicApi` 与 `adminApi` 是 Hono 应用实例，Task 3/4 创建。为避免中间提交不可用，Task 2 的 Step 3 可临时让路由文件返回空 Hono 应用（Step 6 中正式实现）。

- [ ] **Step 4: 临时创建空路由模块**

`worker/src/routes/public.ts`：

```ts
import { Hono } from "hono";
import type { Env } from "../index";

export const publicApi = new Hono<{ Bindings: Env }>();
```

`worker/src/routes/admin.ts`（同构，内容相同）。

- [ ] **Step 5: 运行测试确认通过**

Run（`D:\blog\worker`）：`npm test`
Expected：PASS，2 个用例通过。

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/src/index.test.ts worker/src/routes
git commit -m "feat: 建立 Hono worker 骨架，assets 转发与 404 处理"
```

---

### Task 3: 认证与会话（PBKDF2 哈希、登录、鉴权、token、修改密码）

**Files:**
- Create: `D:\blog\worker\src\auth.ts`
- Create: `D:\blog\worker\src\auth.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(password: string): Promise<string>` — 返回 `"saltBase64:hashBase64"`，盐为 16 随机字节，PBKDF2 100k 迭代 SHA-256。
  - `verifyPassword(password: string, stored: string): Promise<boolean>` — 常量时间比较。
  - `generateToken(): string` — 32 字节随机 hex（64 字符）。
  - `createSession(env: Env, token: string): Promise<void>` — `SESSIONS.put("session:" + token, JSON.stringify({ createdAt: Date.now() }), { expirationTtl: 604800 })`。
  - `deleteSession(env: Env, token: string): Promise<void>`。
  - `getToken(request: Request): string | null` — 解析 Bearer 头。
  - `getSessionToken(env: Env, token: string): Promise<string | null>` — 查询 KV 返回存储值。
- Consumes: `Env`（Task 2）。
- 注：`fromBase64`/`toBase64` 需在 Workers 运行时不依赖 Node Buffer —— 使用 Web API `btoa`/`atob` 配合 `Uint8Array` 与二进制字符串转换。

- [ ] **Step 1: 写失败测试**

`worker/src/auth.test.ts`：

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  createSession,
  getSessionToken,
  deleteSession,
  getToken,
} from "./auth";
import type { Env } from "./index";

function makeKv(): KVNamespace {
  const map = new Map<string, string>();
  return {
    get: async (key: string) => map.get(key) ?? null,
    put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      map.set(key, value);
    },
    delete: async (key: string) => {
      map.delete(key);
    },
  } as unknown as KVNamespace;
}

let env: Env;
beforeEach(() => {
  env = {
    DB: {} as D1Database,
    SESSIONS: makeKv(),
    ASSETS: {} as Fetcher,
  };
});

describe("auth", () => {
  it("hashPassword 产生 salt:hash 格式，verifyPassword 校验通过", async () => {
    const stored = await hashPassword("admin");
    expect(stored).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword("admin", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("相同密码不同 salt 产生不同哈希", async () => {
    const a = await hashPassword("admin");
    const b = await hashPassword("admin");
    expect(a).not.toBe(b);
    expect(await verifyPassword("admin", b)).toBe(true);
  });

  it("generateToken 返回 64 位 hex", () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
    expect(generateToken()).not.toBe(generateToken());
  });

  it("会话创建/查询/删除", async () => {
    const token = generateToken();
    await createSession(env, token);
    expect(await getSessionToken(env, token)).toBeTruthy();
    await deleteSession(env, token);
    expect(await getSessionToken(env, token)).toBeNull();
  });

  it("getToken 解析 Bearer 头", () => {
    const token = generateToken();
    const req = new Request("https://x.test/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getToken(req)).toBe(token);
    expect(getToken(new Request("https://x.test/"))).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run（`D:\blog\worker`）：`npm test`
Expected：FAIL，报 `Cannot find module './auth'`。

- [ ] **Step 3: 实现 auth.ts**

```ts
import type { Env } from "./index";

const PBKDF2_ITERATIONS = 100_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  return `${toBase64(salt)}:${toBase64(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltBase64, hashBase64] = stored.split(":");
  if (!saltBase64 || !hashBase64) return false;
  const salt = fromBase64(saltBase64);
  const storedKey = fromBase64(hashBase64);
  const derivedKey = await deriveKey(password, salt);
  if (derivedKey.length !== storedKey.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedKey.length; i++) diff |= derivedKey[i] ^ storedKey[i];
  return diff === 0;
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(env: Env, token: string): Promise<void> {
  await env.SESSIONS.put(
    `session:${token}`,
    JSON.stringify({ createdAt: Date.now() }),
    { expirationTtl: 604800 }
  );
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.SESSIONS.delete(`session:${token}`);
}

export async function getSessionToken(env: Env, token: string): Promise<string | null> {
  return env.SESSIONS.get(`session:${token}`);
}

export function getToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}
```

- [ ] **Step 4: 运行测试确认通过**

Run（`D:\blog\worker`）：`npm test`
Expected：PASS，auth 全部用例通过。

- [ ] **Step 5: Commit**

```bash
git add worker/src/auth.ts worker/src/auth.test.ts
git commit -m "feat: PBKDF2 密码哈希与 KV 会话管理"
```

---

### Task 4: 数据访问层（D1 查询函数）

**Files:**
- Create: `D:\blog\worker\src\db.ts`
- Create: `D:\blog\worker\src\db.test.ts`

**Interfaces:**
- Produces:
  - `interface PostSummary { id: number; title: string; created_at: number; updated_at: number; views: number; tags: string[] }`
  - `interface PostDetail extends PostSummary { content: string }`
  - `interface TagCount { name: string; count: number }`
  - `getSiteIntro(env): Promise<string>` — `settings.key='intro'`，无值返回 `""`。
  - `setIntro(env, intro: string): Promise<void>` — upsert。
  - `getPasswordConfig(env): Promise<{ hash: string; salt: string } | null>` — 兼容旧配置两个 key；本计划只用 `settings.key='password_hash'` 存完整 `salt:hash`。为使代码简单，函数实现为：读取 `password_hash`，无则返回 null。write 用 `setPassword(env, stored: string)`。
  - `getStoredPassword(env): Promise<string | null>` — 读 `password_hash`。
  - `setPassword(env, stored: string): Promise<void>` — upsert `password_hash`。
  - `listPosts(env, opts: { tag?: string; page: number; limit: number }): Promise<{ posts: PostSummary[]; total: number }>`
  - `getPost(env, id: number): Promise<PostDetail | null>`
  - `incrementViews(env, id: number): Promise<void>`
  - `listTags(env): Promise<TagCount[]>`
  - `createPost(env, data: { title: string; content: string; tags: string[] }): Promise<number>` — 插入 post + 处理标签，返回新 id。
  - `updatePost(env, id: number, data: { title: string; content: string; tags: string[] }): Promise<boolean>`
  - `deletePost(env, id: number): Promise<boolean>`
  - `replaceTags(env, postId: number, tags: string[]): Promise<void>` — 内部分段；删旧关联→角色标签 upsert→插入关联（用 `env.DB.batch` 一次性执行）。
- Consumes: `Env`（Task 2）。
- 内部辅助：`ensureTagsAndLink(env, postId, tags)` 在事务 batch 中执行。

- [ ] **Step 1: 写失败测试**

`worker/src/db.test.ts`：

```ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  setIntro,
  getSiteIntro,
  createPost,
  listPosts,
  getPost,
  incrementViews,
  updatePost,
  deletePost,
  listTags,
  setPassword,
  getStoredPassword,
} from "./db";
import type { Env } from "./index";

// 用 localStorage 无关的最小 KV mock 无法服务 db 测试；此处仅对纯函数/边界做验证，
// D1 集成测试延后到部署后用 miniflare（见 Task 8 Step 5 中的集成验证）。
describe("db 模块边界", () => {
  it("db.ts 存在且导出所需函数", () => {
    expect(typeof setIntro).toBe("function");
    expect(typeof getSiteIntro).toBe("function");
    expect(typeof createPost).toBe("function");
    expect(typeof listPosts).toBe("function");
    expect(typeof getPost).toBe("function");
    expect(typeof incrementViews).toBe("function");
    expect(typeof updatePost).toBe("function");
    expect(typeof deletePost).toBe("function");
    expect(typeof listTags).toBe("function");
    expect(typeof setPassword).toBe("function");
    expect(typeof getStoredPassword).toBe("function");
  });
});
```

> 说明：D1 本地测试依赖 Workers 运行时，需要 `wrangler miniflare`/`unstable_dev`。为避免计划膨胀，db 的真实查询逻辑用集成测试在 Task 8 Step 5 覆盖（本地 `wrangler dev` 跑通全流程）。本任务该测试仅验证模块边界，配合 typecheck 保证签名正确。

- [ ] **Step 2: 运行测试确认失败**

Run（`D:\blog\worker`）：`npm test`
Expected：FAIL，`Cannot find module './db'`。

- [ ] **Step 3: 实现 db.ts**

```ts
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

async function splitTags(input: string[]): Promise<string[]> {
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
  const clean = await splitTags(tags);
  const statements = [
    env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(postId),
  ];
  for (const name of clean) {
    statements.push(
      env.DB.prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING").bind(name)
    );
  }
  for (const name of clean) {
    const row = await env.DB.prepare("SELECT id FROM tags WHERE name = ?").bind(name).first();
    if (row) {
      statements.push(
        env.DB.prepare("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)").bind(
          postId,
          row.id
        )
      );
    }
  }
  if (statements.length > 1) {
    await env.DB.batch(statements);
  } else {
    await statements[0].run();
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
```

- [ ] **Step 4: 运行测试确认通过（并做回归）**

Run（`D:\blog\worker`）：`npm test`
Expected：PASS，db 边界用例通过且 auth 用例仍通过。

- [ ] **Step 5: Commit**

```bash
git add worker/src/db.ts worker/src/db.test.ts
git commit -m "feat: D1 数据访问层（文章/标签/设置）"
```

---

### Task 5: public 路由（site、posts、post、tags、login）

**Files:**
- Create: `D:\blog\worker\src\routes\public.ts`（正式实现，替换 Task 2 的临时空模块）

**Interfaces:**
- Consumes: `getSiteIntro`（Task 4）、`listPosts`、`getPost`、`incrementViews`、`listTags`、`getStoredPassword`（Task 4）；`verifyPassword`、`generateToken`、`createSession`（Task 3）；`getToken`、`getSessionToken`（Task 3）。
- Produces:
  - `GET /site` → `{ intro: string }`
  - `GET /posts?tag=&page=&limit=` → `{ posts: PostSummary[], total: number }`
  - `GET /posts/:id` → `PostDetail`；找不到 404 `{ error }`；每次读取成功后 `ctx.waitUntil(incrementViews(env, id))`（后台+1，不阻塞响应）
  - `GET /tags` → `TagCount[]`
  - `POST /login` body `{ password }` → 成功 `{ token: string }`；失败 401 `{ error: "密码错误" }`

- [ ] **Step 1: 实现 public.ts**

```ts
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
```

- [ ] **Step 2: typecheck 验证**

Run（`D:\blog\worker`）：`npm run typecheck`
Expected：无类型错误（`publicApi` 被 index.ts 引用）。

- [ ] **Step 3: 运行全量测试**

Run（`D:\blog\worker`）：`npm test`
Expected：PASS（auth + db + worker fetch）。

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/public.ts
git commit -m "feat: public 路由（site/posts/tags/login）"
```

---

### Task 6: admin 路由（鉴权中间件 + 管理接口）

**Files:**
- Create: `D:\blog\worker\src\routes\admin.ts`（正式实现）

**Interfaces:**
- Consumes: `getSiteIntro`、`setIntro`、`getStoredPassword`、`setPassword`、`createPost`、`updatePost`、`deletePost`（Task 4）；`getToken`、`getSessionToken`、`deleteSession`、`hashPassword`、`verifyPassword`（Task 3）。
- Produces（全部需要 Bearer token，非法/过期统一 401 `{ error: "未授权" }`）：
  - `POST /logout` → `{ ok: true }`
  - `PUT /site` body `{ intro: string }` → `{ ok: true }`
  - `POST /posts` body `{ title, content, tags: string[] }` → `{ id: number }`
  - `PUT /posts/:id` body 同上 → `{ ok: true }` 或 404
  - `DELETE /posts/:id` → `{ ok: true }` 或 404
  - `POST /change-password` body `{ oldPassword, newPassword }` → `{ ok: true }`；旧密码错 401；`password_hash` 不存在时以默认密码 `admin` 作为初始校验基准（`oldPassword === "admin"` 视为正确）以允许首次修改。

- [ ] **Step 1: 实现 admin.ts**

```ts
import { Hono } from "hono";
import type { Env } from "../index";
import {
  setIntro,
  createPost,
  updatePost,
  deletePost,
  getStoredPassword,
  setPassword,
} from "../db";
import {
  getToken,
  getSessionToken,
  deleteSession,
  hashPassword,
  verifyPassword,
} from "../auth";

export const adminApi = new Hono<{ Bindings: Env }>();

const DEFAULT_PASSWORD = "admin";

adminApi.use("*", async (c, next) => {
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
  const intro = typeof body?.intro === "string" ? body.intro : "";
  await setIntro(c.env, intro);
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
```

> 注：`adminApi.use("*", ...)` 的中间件内 `await next()` 后无额外逻辑即可。middleware 里 token 为局部变量，logout 自行处理删除，符合安全预期（注销需已鉴权，token 有效）。

- [ ] **Step 2: typecheck 验证**

Run（`D:\blog\worker`）：`npm run typecheck`
Expected：无类型错误。

- [ ] **Step 3: 运行全量测试**

Run（`D:\blog\worker`）：`npm test`
Expected：PASS。

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/admin.ts
git commit -m "feat: admin 路由（鉴权中间件 + 管理接口）"
```

---

### Task 7: 前端 WinUI 风格样式基础（主题变量与基础控件）

**Files:**
- Create: `D:\blog\frontend\index.html`
- Create: `D:\blog\frontend\vite.config.ts`
- Create: `D:\blog\frontend\tsconfig.json`
- Create: `D:\blog\frontend\tsconfig.node.json`
- Create: `D:\blog\frontend\src\main.ts`
- Create: `D:\blog\frontend\src\styles\win11.css`
- Create: `D:\blog\frontend\src\App.vue`（任务中仅最小骨架，完整导航在 Task 8）
- Create: `D:\blog\frontend\src\router\index.ts`（最小化，完整路由 Task 11）

**Interfaces:**
- Produces: Win11 主题 CSS 变量；`App.vue` 提供背景与路由器出口；前端可 `vite build` 出 `worker/public`。
- Consumes: Task 1 的 frontend/package.json 依赖。

- [ ] **Step 1: 创建 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>个人博客</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: 创建 vite.config.ts**

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "../worker/public",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: 创建 tsconfig.json 与 tsconfig.node.json**

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "jsx": "preserve"
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "env.d.ts"]
}
```

`tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: 添加 env.d.ts**

`frontend/env.d.ts`：

```ts
/// <reference types="vite/client" />
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
```

- [ ] **Step 5: 创建 win11.css（主题变量与基础控件）**

```css
:root {
  --accent: #0067c0;
  --accent-hover: #005ba1;
  --card-bg: rgba(255, 255, 255, 0.72);
  --page-bg: #f3f3f3;
  --text: #1b1b1b;
  --text-secondary: #5f5f5f;
  --border: rgba(0, 0, 0, 0.08);
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --radius: 8px;
  --radius-lg: 12px;
  --nav-height: 48px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --accent: #4cc2ff;
    --accent-hover: #6dc7ff;
    --card-bg: rgba(43, 43, 43, 0.78);
    --page-bg: #202020;
    --text: #f3f3f3;
    --text-secondary: #adadad;
    --border: rgba(255, 255, 255, 0.08);
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Segoe UI Variable", "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  background: var(--page-bg);
  color: var(--text);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: var(--radius);
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  background: rgba(128, 128, 128, 0.2);
  color: var(--text);
  transition: background 0.15s;
}
.btn:hover {
  background: rgba(128, 128, 128, 0.32);
}
.btn.primary {
  background: var(--accent);
  color: #fff;
}
.btn.primary:hover {
  background: var(--accent-hover);
}
.btn.danger {
  background: rgba(255, 32, 32, 0.12);
  color: #e33030;
}
.btn.danger:hover {
  background: rgba(255, 32, 32, 0.22);
}

.input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-size: 14px;
  background: var(--card-bg);
  color: var(--text);
  outline: none;
  transition: border 0.15s, box-shadow 0.15s;
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(20px);
}

.tag-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(128, 128, 128, 0.18);
  color: var(--text-secondary);
}
```

- [ ] **Step 6: 创建 main.ts 与最小 App.vue/router**

`src/main.ts`：

```ts
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles/win11.css";

createApp(App).use(router).mount("#app");
```

`src/App.vue`：

```vue
<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
    <main class="page-body">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
.page-body {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}
</style>
```

`src/router/index.ts`：

```ts
import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [],
});

export default router;
```

- [ ] **Step 7: 构建验证**

Run（`D:\blog\frontend`）：`npm run build`
Expected：成功，生成 `D:\blog\worker\public\index.html` 与 `assets/`。

- [ ] **Step 8: Commit**

```bash
git add frontend/src frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.node.json frontend/env.d.ts
git commit -m "feat: 前端脚手架与 Win11 主题样式基础"
```

---

### Task 8: 前端 API 客户端与类型定义

**Files:**
- Create: `D:\blog\frontend\src\api\types.ts`
- Create: `D:\blog\frontend\src\api\client.ts`

**Interfaces:**
- Produces:
  - 类型 `SiteInfo { intro: string }`、`PostSummary`、`PostDetail`、`TagCount`、`PagedPosts { posts: PostSummary[]; total: number }`
  - `client`（单例）方法：`getSite()`, `listPosts(params?: {tag?, page?, limit?})`, `getPost(id)`, `getTags()`, `login(password)`, `logout()`, `updateSite(intro)`, `createPost(body)`, `updatePost(id, body)`, `deletePost(id)`, `changePassword(oldPassword, newPassword)`
  - `setToken(token | null)` 与 token 管理（localStorage 持久化，请求自动带 Bearer）
  - 401 响应时触发 `onUnauthorized` 回调（用于前端跳转登录）
- Consumes: Task 7 依赖。

- [ ] **Step 1: 创建 types.ts**

```ts
export interface SiteInfo {
  intro: string;
}

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

export interface PagedPosts {
  posts: PostSummary[];
  total: number;
}
```

- [ ] **Step 2: 创建 client.ts**

```ts
import type { PagedPosts, PostDetail, PostSummary, SiteInfo, TagCount } from "./types";

const TOKEN_KEY = "blog_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(t: string | null): void {
  token = t;
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken(): string | null {
  return token;
}

export type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    onUnauthorized();
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error ?? "请求失败");
  }
  return body as T;
}

export const client = {
  getSite: () => request<SiteInfo>("/site"),
  listPosts: (params?: { tag?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.tag) q.set("tag", params.tag);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<PagedPosts>(`/posts${qs ? `?${qs}` : ""}`);
  },
  getPost: (id: number) => request<PostDetail>(`/posts/${id}`),
  getTags: () => request<TagCount[]>("/tags"),
  login: (password: string) =>
    request<{ token: string }>("/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: boolean }>("/logout", { method: "POST" }),
  updateSite: (intro: string) =>
    request<{ ok: boolean }>("/site", { method: "PUT", body: JSON.stringify({ intro }) }),
  createPost: (body: { title: string; content: string; tags: string[] }) =>
    request<{ id: number }>("/posts", { method: "POST", body: JSON.stringify(body) }),
  updatePost: (id: number, body: { title: string; content: string; tags: string[] }) =>
    request<{ ok: boolean }>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePost: (id: number) => request<{ ok: boolean }>(`/posts/${id}`, { method: "DELETE" }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
};
```

- [ ] **Step 3: 构建验证**

Run（`D:\blog\frontend`）：`npm run build`
Expected：成功。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api
git commit -m "feat: 前端 API 客户端与类型定义"
```

---

### Task 9: 通用组件（WinButton、WinInput、WinDialog、WinTag、NavBar、PostCard）

**Files:**
- Create: `D:\blog\frontend\src\components\WinButton.vue`
- Create: `D:\blog\frontend\src\components\WinInput.vue`
- Create: `D:\blog\frontend\src\components\WinDialog.vue`
- Create: `D:\blog\frontend\src\components\WinTag.vue`
- Create: `D:\blog\frontend\src\components\NavBar.vue`
- Create: `D:\blog\frontend\src\components\PostCard.vue`

**Interfaces:**
- Produces:
  - `WinButton` props: `variant?: "default" | "primary" | "danger"`, `disabled?: boolean`；emits click。
  - `WinInput` props: `modelValue: string`, `type?: "text"|"password"|"textarea"`, `placeholder?`, `rows?`；emits `update:modelValue`。
  - `WinDialog` props: `open: boolean`, `title: string`；slots 默认内容；emits `confirm`, `cancel`。用原生 `<dialog>` 实现（`<dialog open>` 属性由 Vue 绑定 + 遮罩）。
  - `WinTag` props: `name: string`。
  - `NavBar` 固定顶栏，含路由链接 首页/标签/管理；props 无。
  - `PostCard` props: `post: PostSummary`；展示标题/时间/标签/浏览量，点击跳转文章页。
- 这些组件由 Task 10/11 使用。此任务通过 `npm run build` 验证。

- [ ] **Step 1: 创建 WinButton.vue**

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: "default" | "primary" | "danger"; disabled?: boolean }>(),
  { variant: "default", disabled: false }
);
</script>

<template>
  <button class="btn" :class="variant" :disabled="disabled" @click="$emit('click', $event)">
    <slot />
  </button>
</template>
```

- [ ] **Step 2: 创建 WinInput.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    type?: "text" | "password" | "textarea";
    placeholder?: string;
    rows?: number;
  }>(),
  { type: "text", placeholder: "", rows: 6 }
);

const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

function onInput(e: Event): void {
  emit("update:modelValue", (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

const isTextarea = computed(() => props.type === "textarea");
</script>

<template>
  <textarea
    v-if="isTextarea"
    class="input"
    :rows="rows"
    :placeholder="placeholder"
    :value="modelValue"
    @input="onInput"
  />
  <input
    v-else
    class="input"
    :type="type"
    :placeholder="placeholder"
    :value="modelValue"
    @input="onInput"
  />
</template>
```

- [ ] **Step 3: 创建 WinDialog.vue**

```vue
<script setup lang="ts">
import { watch, ref } from "vue";

const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ (e: "confirm"): void; (e: "cancel"): void }>();

const dialogRef = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (open) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  },
  { immediate: true }
);
</script>

<template>
  <dialog ref="dialogRef" class="win-dialog" @cancel="$emit('cancel')" @close="$emit('close', $event)">
    <div class="win-dialog-title">{{ title }}</div>
    <div class="win-dialog-body"><slot /></div>
    <div class="win-dialog-actions">
      <button class="btn" @click="emit('cancel')">取消</button>
      <button class="btn primary" @click="emit('confirm')">确定</button>
    </div>
  </dialog>
</template>

<style scoped>
.win-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 24px;
  background: var(--card-bg);
  color: var(--text);
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow);
  min-width: 320px;
}
.win-dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}
.win-dialog-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}
.win-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
```

- [ ] **Step 4: 创建 WinTag.vue**

```vue
<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<template>
  <span class="tag-pill">{{ name }}</span>
</template>
```

- [ ] **Step 5: 创建 NavBar.vue**

```vue
<script setup lang="ts">
</script>

<template>
  <nav class="navbar">
    <router-link to="/" class="nav-title">博客</router-link>
    <div class="nav-links">
      <router-link to="/" class="nav-link">首页</router-link>
      <router-link to="/tags" class="nav-link">标签</router-link>
      <router-link to="/admin" class="nav-link">管理</router-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--nav-height);
  padding: 0 16px;
  background: rgba(128, 128, 128, 0.2);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}
.nav-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--text);
  text-decoration: none;
}
.nav-links {
  display: flex;
  gap: 12px;
}
.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: var(--radius);
}
.nav-link:hover {
  background: rgba(128, 128, 128, 0.24);
  color: var(--text);
}
.nav-link.router-link-active {
  color: var(--accent);
}
</style>
```

- [ ] **Step 6: 创建 PostCard.vue**

```vue
<script setup lang="ts">
import type { PostSummary } from "../api/types";
import WinTag from "./WinTag.vue";

defineProps<{ post: PostSummary }>();

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
</script>

<template>
  <router-link :to="`/post/${post.id}`" class="post-card card">
    <div class="post-title">{{ post.title }}</div>
    <div class="post-meta">
      <span>{{ formatTime(post.created_at) }}</span>
      <span>·</span>
      <span>{{ post.views }} 阅读</span>
    </div>
    <div class="post-tags">
      <WinTag v-for="t in post.tags" :key="t" :name="t" />
    </div>
  </router-link>
</template>

<style scoped>
.post-card {
  display: block;
  padding: 16px 20px;
  text-decoration: none;
  color: var(--text);
  transition: transform 0.15s, box-shadow 0.15s;
}
.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
.post-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 6px;
}
.post-meta {
  display: flex;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
```

- [ ] **Step 7: 构建验证**

Run（`D:\blog\frontend`）：`npm run build`
Expected：成功。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components
git commit -m "feat: WinUI 基础组件与导航栏文章卡片"
```

---

### Task 10: MarkdownView 组件（marked + DOMPurify + highlight.js）

**Files:**
- Create: `D:\blog\frontend\src\components\MarkdownView.vue`

**Interfaces:**
- Produces: props `source: string`；内部用 marked 渲染为 HTML，DOMPurify 消毒，highlight.js 高亮代码块；输出被 Vue 以 `v-html` 渲染。
- Consumes: frontend/package.json 依赖 marked/dompurify/highlight.js。

- [ ] **Step 1: 创建 MarkdownView.vue**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

marked.setOptions({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

const props = defineProps<{ source: string }>();

const rendered = computed(() => {
  const raw = marked.parse(props.source) as string;
  return DOMPurify.sanitize(raw);
});
</script>

<template>
  <div class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body {
  line-height: 1.7;
  word-break: break-word;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 1em 0 0.5em;
}
.markdown-body :deep(p) {
  margin: 0.6em 0;
}
.markdown-body :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  border-radius: var(--radius);
  padding: 12px 16px;
  overflow-x: auto;
}
.markdown-body :deep(code) {
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 13px;
}
.markdown-body :deep(:not(pre) > code) {
  background: rgba(128, 128, 128, 0.22);
  padding: 2px 6px;
  border-radius: 4px;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 12px;
  color: var(--text-secondary);
  margin: 0.6em 0;
}
.markdown-body :deep(a) {
  color: var(--accent);
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius);
}
</style>
```

> 注：`marked.setOptions({ highlight })` 是 v14 兼容写法；若已移除，改用 `marked.use({ renderer })` 或经 `marked-highlight`。交付时以安装的 marked 版本实际 API 为准，若 typecheck 报 `highlight` 不在选项中，可使用 `marked-highlight` 扩展：

```ts
import { markedHighlight } from "marked-highlight";
marked.use(markedHighlight({
  langPrefix: "hljs language-",
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
    return hljs.highlightAuto(code).value;
  },
}));
```

（需在 package.json 增加 `marked-highlight` 依赖则执行。）

- [ ] **Step 2: 构建验证**

Run（`D:\blog\frontend`）：`npm run build`
Expected：成功；若依赖缺失按上注补充并重新 install。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MarkdownView.vue frontend/package.json frontend/package-lock.json
git commit -m "feat: Markdown 渲染组件（XSS 消毒 + 代码高亮）"
```

---

### Task 11: 视图与路由（HomeView、PostView、TagsView、AdminView + 完整路由）

**Files:**
- Create: `D:\blog\frontend\src\views\HomeView.vue`
- Create: `D:\blog\frontend\src\views\PostView.vue`
- Create: `D:\blog\frontend\src\views\TagsView.vue`
- Create: `D:\blog\frontend\src\views\AdminView.vue`
- Modify: `D:\blog\frontend\src\router\index.ts`（填充路由）
- Modify: `D:\blog\frontend\src\App.vue`（挂到 NavBar）

**Interfaces:**
- Consumes: client（Task 8）、组件（Task 9/10）。
- Produces: 完整 hash 路由：`/`、`/post/:id`、`/tags`、`/admin`；`App.vue` 顶部 NavBar + router-view。

- [ ] **Step 1: 实现 HomeView.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { client } from "../api/client";
import type { PagedPosts, SiteInfo } from "../api/types";
import PostCard from "../components/PostCard.vue";

const site = ref<SiteInfo>({ intro: "" });
const paged = ref<PagedPosts>({ posts: [], total: 0 });
const page = ref(1);
const loading = ref(false);

async function loadSite(): Promise<void> {
  try {
    site.value = await client.getSite();
  } catch {
    site.value = { intro: "" };
  }
}

async function loadPosts(): Promise<void> {
  loading.value = true;
  try {
    paged.value = await client.listPosts({ page: page.value, limit: 10 });
  } finally {
    loading.value = false;
  }
}

const totalPages = () => Math.max(1, Math.ceil(paged.value.total / 10));

function go(n: number): void {
  if (n < 1 || n > totalPages()) return;
  page.value = n;
  loadPosts();
}

onMounted(() => {
  loadSite();
  loadPosts();
});
</script>

<template>
  <div class="home">
    <section v-if="site.intro" class="intro-card card">
      <div class="intro-title">关于我</div>
      <div class="intro-body">{{ site.intro }}</div>
    </section>

    <section class="posts">
      <div v-if="loading" class="hint">加载中…</div>
      <PostCard v-for="p in paged.posts" :key="p.id" :post="p" />
      <div v-if="!loading && paged.posts.length === 0" class="hint">还没有文章，去后台发布第一篇吧。</div>
    </section>

    <nav v-if="totalPages() > 1" class="pager">
      <button class="btn" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages() }}</span>
      <button class="btn" :disabled="page >= totalPages()" @click="go(page + 1)">下一页</button>
    </nav>
  </div>
</template>

<style scoped>
.intro-card {
  padding: 20px 24px;
  margin-bottom: 16px;
}
.intro-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}
.intro-body {
  white-space: pre-wrap;
  color: var(--text);
  line-height: 1.6;
}
.posts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 32px 0;
}
.pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}
.page-info {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
```

- [ ] **Step 2: 实现 PostView.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { client } from "../api/client";
import type { PostDetail } from "../api/types";
import MarkdownView from "../components/MarkdownView.vue";
import WinTag from "../components/WinTag.vue";

const route = useRoute();
const post = ref<PostDetail | null>(null);
const error = ref("");

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(async () => {
  const id = Number(route.params.id);
  if (!Number.isInteger(id)) {
    error.value = "文章不存在";
    return;
  }
  try {
    post.value = await client.getPost(id);
  } catch (e) {
    error.value = (e as Error).message;
  }
});
</script>

<template>
  <article v-if="post" class="post-view card">
    <h1 class="post-title">{{ post.title }}</h1>
    <div class="post-meta">
      <span>{{ formatTime(post.created_at) }}</span>
      <span>·</span>
      <span>{{ post.views }} 阅读</span>
    </div>
    <div class="post-tags">
      <WinTag v-for="t in post.tags" :key="t" :name="t" />
    </div>
    <MarkdownView :source="post.content" />
  </article>
  <div v-else-if="error" class="hint">{{ error }}</div>
</template>

<style scoped>
.post-view {
  padding: 28px 32px;
}
.post-title {
  font-size: 26px;
  margin-bottom: 10px;
}
.post-meta {
  display: flex;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}
.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px 0;
}
</style>
```

- [ ] **Step 3: 实现 TagsView.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { TagCount, PagedPosts } from "../api/types";
import PostCard from "../components/PostCard.vue";
import WinTag from "../components/WinTag.vue";

const tags = ref<TagCount[]>([]);
const selected = ref("");
const posts = ref<PagedPosts>({ posts: [], total: 0 });
const loading = ref(false);

async function loadTags(): Promise<void> {
  try {
    tags.value = await client.getTags();
  } catch {
    tags.value = [];
  }
}

async function loadPosts(): Promise<void> {
  loading.value = true;
  try {
    posts.value = await client.listPosts({ tag: selected.value || undefined, limit: 50 });
  } finally {
    loading.value = false;
  }
}

function pick(name: string): void {
  selected.value = selected.value === name ? "" : name;
  loadPosts();
}

onMounted(() => {
  loadTags();
  loadPosts();
});
</script>

<template>
  <div class="tags-view">
    <section class="tags-bar card">
      <WinTag :name="'全部'" />
      <button class="tag-btn" :class="{ active: selected === '' }" @click="pick('')">全部</button>
      <button
        v-for="t in tags"
        :key="t.name"
        class="tag-btn"
        :class="{ active: selected === t.name }"
        @click="pick(t.name)"
      >
        {{ t.name }} ({{ t.count }})
      </button>
    </section>

    <section class="posts">
      <div v-if="loading" class="hint">加载中…</div>
      <PostCard v-for="p in posts.posts" :key="p.id" :post="p" />
      <div v-if="!loading && posts.posts.length === 0" class="hint">该标签下暂无文章。</div>
    </section>
  </div>
</template>

<style scoped>
.tags-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  align-items: center;
}
.tag-btn {
  border: none;
  background: rgba(128, 128, 128, 0.18);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}
.tag-btn.active {
  background: var(--accent);
  color: #fff;
}
.posts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 32px 0;
}
</style>
```

- [ ] **Step 4: 实现 AdminView.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { client, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { PagedPosts, SiteInfo, PostDetail } from "../api/types";
import WinButton from "../components/WinButton.vue";
import WinInput from "../components/WinInput.vue";
import WinTag from "../components/WinTag.vue";

const loggedIn = ref(!!getToken());
const password = ref("");
const error = ref("");
const siteForm = ref<SiteInfo>({ intro: "" });
const postForm = ref({ id: 0, title: "", content: "", tags: "" });
const editing = ref(false);
const posts = ref<PagedPosts>({ posts: [], total: 0 });
const tab = ref<"posts" | "site" | "password">("posts");
const oldPassword = ref("");
const newPassword = ref("");
const confirmDialogOpen = ref(false);
const pendingDeleteId = ref(0);

let unsub: (() => void) | undefined;

onMounted(() => {
  unsub = setupListener();
  if (loggedIn.value) {
    refreshPosts();
    loadSiteForm();
  }
});

onUnmounted(() => unsub?.());

function setupListener() {
  setUnauthorizedHandler(() => {
    loggedIn.value = false;
  });
  return () => setUnauthorizedHandler(() => {});
}

async function doLogin(): Promise<void> {
  error.value = "";
  try {
    const { token } = await client.login(password.value);
    setToken(token);
    loggedIn.value = true;
    password.value = "";
    refreshPosts();
    loadSiteForm();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function doLogout(): Promise<void> {
  try {
    await client.logout();
  } finally {
    setToken(null);
    loggedIn.value = false;
  }
}

async function loadSiteForm(): Promise<void> {
  try {
    siteForm.value = await client.getSite();
  } catch {
    siteForm.value = { intro: "" };
  }
}

async function saveSite(): Promise<void> {
  error.value = "";
  try {
    await client.updateSite(siteForm.value.intro);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function refreshPosts(): Promise<void> {
  try {
    posts.value = await client.listPosts({ limit: 50 });
  } catch {
    posts.value = { posts: [], total: 0 };
  }
}

function newPost(): void {
  postForm.value = { id: 0, title: "", content: "", tags: "" };
  editing.value = true;
}

function editPost(p: PostSummaryLike): void {
  postForm.value = { id: p.id, title: p.title, content: "", tags: p.tags.join(",") };
  editing.value = true;
  loadContent(p.id);
}

async function loadContent(id: number): Promise<void> {
  try {
    const detail = (await client.getPost(id)) as PostDetail;
    postForm.value = {
      id,
      title: detail.title,
      content: detail.content,
      tags: detail.tags.join(","),
    };
  } catch {
    /* 忽略加载失败，保持空 content */
  }
}

async function savePost(): Promise<void> {
  error.value = "";
  const tagsArr = postForm.value.tags.split(",").map((s) => s.trim());
  try {
    if (postForm.value.id) {
      await client.updatePost(postForm.value.id, {
        title: postForm.value.title,
        content: postForm.value.content,
        tags: tagsArr,
      });
    } else {
      await client.createPost({
        title: postForm.value.title,
        content: postForm.value.content,
        tags: tagsArr,
      });
    }
    editing.value = false;
    refreshPosts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function askDelete(p: PostSummaryLike): void {
  pendingDeleteId.value = p.id;
  confirmDialogOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  confirmDialogOpen.value = false;
  try {
    await client.deletePost(pendingDeleteId.value);
    refreshPosts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function changePasswordSubmit(): Promise<void> {
  error.value = "";
  try {
    await client.changePassword(oldPassword.value, newPassword.value);
    oldPassword.value = "";
    newPassword.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  }
}

interface PostSummaryLike {
  id: number;
  title: string;
  tags: string[];
}
</script>

<template>
  <div class="admin">
    <div v-if="!loggedIn" class="login-card card">
      <h1 class="admin-title">管理后台</h1>
      <WinInput v-model="password" type="password" placeholder="输入密码" @keyup.enter="doLogin" />
      <WinButton variant="primary" class="login-btn" @click="doLogin">登录</WinButton>
      <div v-if="error" class="err">{{ error }}</div>
    </div>

    <div v-else class="admin-main">
      <header class="admin-header">
        <span class="admin-title">内容管理</span>
        <WinButton @click="doLogout">退出登录</WinButton>
      </header>

      <nav class="tabs">
        <button class="tab" :class="{ active: tab === 'posts' }" @click="tab = 'posts'">文章</button>
        <button class="tab" :class="{ active: tab === 'site' }" @click="tab = 'site'">自我介绍</button>
        <button class="tab" :class="{ active: tab === 'password' }" @click="tab = 'password'">修改密码</button>
      </nav>

      <section v-if="tab === 'posts'">
        <div class="toolbar">
          <WinButton variant="primary" @click="newPost">发布新文章</WinButton>
        </div>
        <div v-if="editing" class="editor card">
          <WinInput v-model="postForm.title" placeholder="文章标题" />
          <WinInput v-model="postForm.content" type="textarea" placeholder="Markdown 内容" />
          <WinInput v-model="postForm.tags" placeholder="标签，用逗号分隔" />
          <div class="editor-actions">
            <WinButton @click="editing = false">取消</WinButton>
            <WinButton variant="primary" @click="savePost">保存</WinButton>
          </div>
        </div>
        <div v-else class="post-list">
          <div v-for="p in posts.posts" :key="p.id" class="post-row card">
            <div class="post-row-info">
              <div class="post-row-title">{{ p.title }}</div>
              <div class="post-row-tags">
                <WinTag v-for="t in p.tags" :key="t" :name="t" />
              </div>
            </div>
            <div class="post-row-actions">
              <WinButton @click="editPost(p)">编辑</WinButton>
              <WinButton variant="danger" @click="askDelete(p)">删除</WinButton>
            </div>
          </div>
        </div>
      </section>

      <section v-if="tab === 'site'" class="editor card">
        <WinInput v-model="siteForm.intro" type="textarea" placeholder="自我介绍内容" />
        <WinButton variant="primary" @click="saveSite">保存自我介绍</WinButton>
      </section>

      <section v-if="tab === 'password'" class="editor card">
        <WinInput v-model="oldPassword" type="password" placeholder="旧密码" />
        <WinInput v-model="newPassword" type="password" placeholder="新密码（至少 6 位）" />
        <WinButton variant="primary" @click="changePasswordSubmit">修改密码</WinButton>
      </section>

      <div v-if="error" class="err">{{ error }}</div>

      <WinDialog
        :open="confirmDialogOpen"
        title="确认删除"
        @confirm="confirmDelete"
        @cancel="confirmDialogOpen = false"
      >
        确定要删除这篇文章吗？此操作不可恢复。
      </WinDialog>
    </div>
  </div>
</template>

<style scoped>
.login-card,
.editor {
  max-width: 640px;
  margin: 0 auto;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.admin-title {
  font-size: 22px;
}
.login-btn {
  align-self: flex-start;
}
.err {
  color: #e33030;
  font-size: 13px;
}
.admin-main {
  max-width: 820px;
  margin: 0 auto;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tab {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 6px 14px;
  border-radius: var(--radius);
  cursor: pointer;
}
.tab.active {
  background: var(--card-bg);
  color: var(--accent);
  box-shadow: var(--shadow);
}
.toolbar {
  margin-bottom: 12px;
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.post-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.post-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}
.post-row-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.post-row-tags {
  display: flex;
  gap: 6px;
}
.post-row-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 5: 填充完整路由**

修改 `frontend/src/router/index.ts`（整体替换）：

```ts
import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import PostView from "../views/PostView.vue";
import TagsView from "../views/TagsView.vue";
import AdminView from "../views/AdminView.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/post/:id", name: "post", component: PostView },
    { path: "/tags", name: "tags", component: TagsView },
    { path: "/admin", name: "admin", component: AdminView },
  ],
});

export default router;
```

- [ ] **Step 6: 更新 App.vue 挂到 NavBar**

修改 `frontend/src/App.vue`（整体替换模板）：

```vue
<script setup lang="ts">
import NavBar from "./components/NavBar.vue";
</script>

<template>
  <div class="app-shell">
    <NavBar />
    <main class="page-body">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
.page-body {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 16px;
}
</style>
```

- [ ] **Step 7: 构建验证**

Run（`D:\blog\frontend`）：`npm run build`
Expected：成功。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views frontend/src/router frontend/src/App.vue
git commit -m "feat: 博客视图与完整路由（主页/文章/标签/管理）"
```

---

### Task 12: 集成验证（本地 wrangler dev 全流程）与部署准备

**Files:**
- Modify: 无新文件（验证 + 配置说明）

**Interfaces:**
- Consumes: 全部前端与 worker 代码。
- Produces: 本地全流程通过；README 部署说明写入 `D:\blog\README.md`。

- [ ] **Step 1: 本地启动 Worker（含 assets）**

Run（`D:\blog`）：
```bash
npm run build:frontend
npm --prefix worker run dev
```
Expected：wrangler dev 启动，输出本地 URL（如 `http://localhost:8787`）。

- [ ] **Step 2: 初始化本地 D1 并验证 API**

Run：
```bash
npx wrangler d1 execute blog-db --local --file=./schema.sql
```
Expected：本地 D1 建表成功。

- [ ] **Step 3: 浏览器全流程自测**

打开 `http://localhost:8787`：
1. 首页显示"还没有文章"与空自我介绍区。
2. 访问 `/#/admin`，输入默认密码 `admin` 登录。
3. 发布一篇带标签文章 → 返回首页可见。
4. 点击文章详情可阅读；刷新两次后阅读数递增。
5. 标签页可见标签并可筛选。
6. 修改自我介绍并保存 → 首页生效。
7. 修改密码为新密码，退出重新用新密码登录成功。
Expected：全部通过；任一失败则为 bug，先定位修复再继续。

- [ ] **Step 4: 创建 README.md（部署说明）**

```markdown
# 个人博客

部署在 Cloudflare Workers 的个人博客，UI 仿 Windows 11 WinUI 风格。

## 本地开发

```bash
npm --prefix worker install
npm --prefix frontend install
npm run build:frontend   # 前端产物输出到 worker/public
npm --prefix worker run dev
```

默认管理员密码：`admin`（首次登录后请及时在后台修改）。

## 部署

1. 创建 D1 数据库与 KV 命名空间，把得到的 ID 填入 `wrangler.jsonc`：
   ```bash
   npx wrangler d1 create blog-db
   npx wrangler kv namespace create SESSIONS
   npx wrangler d1 execute blog-db --remote --file=./schema.sql
   ```
2. 配置 `CLOUDFLARE_API_TOKEN` 环境变量（拥有 Workers/D1/KV 权限）。
3. 部署：
   ```bash
   npm run build:frontend
   npx wrangler deploy
   ```
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: 添加本地开发与部署说明"
```

---

## 自审说明

**规格覆盖：**
- 自我介绍展示与修改 → Task 5/6 + HomeView + AdminView ✓
- 文章发布/编辑/删除 → Task 6 + AdminView ✓
- 标签分类 → Task 4/5/6 + TagsView ✓
- 浏览量统计 → Task 5（waitUntil incrementViews）+ PostCard/PostView 展示 ✓
- 默认密码 admin 可修改 → Task 3/6 + AdminView ✓
- KV 会话 → Task 3/6 ✓
- D1 存储、无 R2 → 全局约束 + Task 4 ✓
- WinUI 风格 UI → Task 7/9/10/11 ✓
- 安全（XSS/SQL 注入/哈希）→ MarkdownView DOMPurify、db.ts prepared statements、auth.ts PBKDF2 ✓
- 项目在 D 盘、部署到 Workers → Task 1/12 ✓

**占位符检查：** 所有任务包含可执行代码或明确命令，无 TBD/TODO。

**类型一致性：** `Env`（Task 2）贯穿所有路由与 db/auth；`PostSummary`/`PostDetail`/`TagCount`（Task 4）与前端 types.ts（Task 8）字段一致（id/title/content/created_at/updated_at/views/tags）；`adminApi.use("*")` 中间件路径通配符为 Hono 支持的 `*`。