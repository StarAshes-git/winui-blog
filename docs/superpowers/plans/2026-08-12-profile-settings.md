# 主页头像、名称与可配置网站名 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增可配置的头像 URL 与网站名称，主页居中展示头像与名称，管理员可修改，导航栏标题改为网站名。

**Architecture:** 后端 `settings` 表新增 `site_name`、`avatar_url` 两个 key，扩展 `GET/PUT /api/site` 返回与保存这两个字段；前端 `SiteInfo` 类型扩展、`updateSite` 参数扩展，HomeView 展示头像+名称，App.vue 导航标题使用 site_name，AdminView「自我介绍」tab 增加两个输入框。

**Tech Stack:** Hono + Cloudflare D1（worker），Vue 3 + Vite + WinUIonWeb（frontend），vitest。

## Global Constraints

- 后端默认值：`site_name`、`avatar_url` 未设置时返回空串 `""`（数据库 `first` 返回 null 时兜底）
- 前端兜底名称：`site_name` 为空时显示「个人博客」
- 头像加载失败或 URL 为空时，显示占位圆环（内含名称首字）
- `PUT /api/site` 三个字段（`intro`、`site_name`、`avatar_url`）全部可选，只更新传入字段
- 前端已有状态管理：无 Pinia，使用组件内 `ref`；导航栏标题在 App.vue 用 `ref` 管理
- 后端沿用 Hono 路由与 `Env` 绑定模式；前端沿用现有 `client` API 封装
- 全部代码注释使用简体中文

---

### Task 1: 后端 db.ts 新增 site_name / avatar_url 读写函数

**Files:**
- Modify: `D:\blog\worker\src\db.ts`（在 `setIntro` 之后追加）
- Test: `D:\blog\worker\src\db.test.ts`

**Interfaces:**
- Produces:
  - `export async function getSiteName(env: Env): Promise<string>`
  - `export async function setSiteName(env: Env, name: string): Promise<void>`
  - `export async function getAvatarUrl(env: Env): Promise<string>`
  - `export async function setAvatarUrl(env: Env, url: string): Promise<void>`

- [ ] **Step 1: 添加失败测试**

在 `db.test.ts` 的 `it("db.ts 存在且导出所需函数", ...)` 的 expect 列表中追加 4 个断言：

```ts
    expect(typeof getSiteName).toBe("function");
    expect(typeof setSiteName).toBe("function");
    expect(typeof getAvatarUrl).toBe("function");
    expect(typeof setAvatarUrl).toBe("function");
```

并在 import 语句中补充：

```ts
  getSiteName,
  setSiteName,
  getAvatarUrl,
  setAvatarUrl,
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/db.test.ts`
Expected: FAIL，报 `getSiteName is not a function`

- [ ] **Step 3: 实现读写函数**

在 `D:\blog\worker\src\db.ts` 的 `setIntro` 函数（约 28-34 行）之后追加：

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/db.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add worker/src/db.ts worker/src/db.test.ts
git commit -m "feat: db 新增 site_name 与 avatar_url 读写函数"
```

---

### Task 2: 扩展 GET /api/site 与 PUT /api/site

**Files:**
- Modify: `D:\blog\worker\src\routes\public.ts`（GET /api/site）
- Modify: `D:\blog\worker\src\routes\admin.ts`（PUT /api/site）
- Test: 新建 `D:\blog\worker\src\site.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `getSiteName`、`setSiteName`、`getAvatarUrl`、`setAvatarUrl`
- Produces:
  - `GET /api/site` 返回 `{ intro: string, site_name: string, avatar_url: string }`
  - `PUT /api/site` 接受 `{ intro?: string, site_name?: string, avatar_url?: string }`，只更新传入字段

- [ ] **Step 1: 添加测试文件**

新建 `D:\blog\worker\src\site.test.ts`，复用 login.test.ts 的 `makeD1` / `makeEnv` 模式：

```ts
import { describe, it, expect } from "vitest";
import worker from "./index";

function makeD1(settings: Map<string, string>): D1Database {
  return {
    prepare: (sql: string) => {
      const stmt = {
        async first<T>(col?: string): Promise<T | null> {
          const m = /key = '?(\w+)'?/.exec(sql);
          if (!m) return null;
          const val = settings.get(m[1]);
          if (!val) return null;
          if (col) return (val as unknown) as T;
          return { value: val } as unknown as T;
        },
        async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
          const m = /key = '?(\w+)'?/.exec(sql);
          const v = /VALUES \('(.*)'\)/.exec(sql);
          if (m && v) settings.set(m[1], v[1]);
          return { meta: { changes: 1, last_row_id: 1 } };
        },
        async all() {
          return { results: [] };
        },
        bind() {
          return this;
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
}

function makeEnv(settings: Map<string, string>) {
  return {
    DB: makeD1(settings),
    SESSIONS: {
      put: async () => undefined,
      get: async () => JSON.stringify({ createdAt: Date.now() }),
      delete: async () => undefined,
    } as unknown as KVNamespace,
    ASSETS: {
      fetch: (request: Request) => new Response("asset-mock", { status: 200 }),
    } as unknown as Fetcher,
  };
}

describe("site 接口", () => {
  it("GET /api/site 返回 intro、site_name、avatar_url", async () => {
    const settings = new Map([
      ["intro", "你好"],
      ["site_name", "小明博客"],
      ["avatar_url", "https://example.com/a.png"],
    ]);
    const env = makeEnv(settings);
    const res = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      intro: "你好",
      site_name: "小明博客",
      avatar_url: "https://example.com/a.png",
    });
  });

  it("GET /api/site 未设置字段返回空串", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ intro: "", site_name: "", avatar_url: "" });
  });

  it("PUT /api/site 只更新传入字段", async () => {
    const settings = new Map([["intro", "旧自我介绍"]]);
    const env = makeEnv(settings);
    const res = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ site_name: "新名字", avatar_url: "https://example.com/b.png" }),
        headers: { "Content-Type": "application/json" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    expect(settings.get("intro")).toBe("旧自我介绍");
    expect(settings.get("site_name")).toBe("新名字");
    expect(settings.get("avatar_url")).toBe("https://example.com/b.png");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/site.test.ts`
Expected: FAIL（GET 返回缺字段 / PUT 不识别 site_name）

- [ ] **Step 3: 实现 GET 路由**

修改 `D:\blog\worker\src\routes\public.ts` 顶部 import：

```ts
import { getSiteIntro, listPosts, getPost, incrementViews, listTags, getStoredPassword, getSiteName, getAvatarUrl } from "../db";
```

替换 GET /api/site 实现：

```ts
publicApi.get("/site", async (c) => {
  const [intro, site_name, avatar_url] = await Promise.all([
    getSiteIntro(c.env),
    getSiteName(c.env),
    getAvatarUrl(c.env),
  ]);
  return c.json({ intro, site_name, avatar_url });
});
```

- [ ] **Step 4: 实现 PUT 路由**

修改 `D:\blog\worker\src\routes\admin.ts` 顶部 import：

```ts
import {
  setIntro,
  createPost,
  updatePost,
  deletePost,
  getStoredPassword,
  setPassword,
  setSiteName,
  setAvatarUrl,
} from "../db";
```

替换 PUT /api/site 实现：

```ts
adminApi.put("/site", async (c) => {
  const body = await c.req.json().catch(() => null);
  const tasks: Promise<void>[] = [];
  if (typeof body?.intro === "string") tasks.push(setIntro(c.env, body.intro));
  if (typeof body?.site_name === "string") tasks.push(setSiteName(c.env, body.site_name));
  if (typeof body?.avatar_url === "string") tasks.push(setAvatarUrl(c.env, body.avatar_url));
  await Promise.all(tasks);
  return c.json({ ok: true });
});
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/site.test.ts`
Expected: PASS

- [ ] **Step 6: 运行全部后端测试**

Run: `npx vitest run`
Expected: PASS（原有测试不受影响）

- [ ] **Step 7: 类型检查与提交**

Run: `npm run typecheck`（worker 目录）
Expected: 无错误

```bash
git add worker/src/db.ts worker/src/routes/public.ts worker/src/routes/admin.ts worker/src/site.test.ts worker/src/db.test.ts
git commit -m "feat: site 接口支持 site_name 与 avatar_url"
```

---

### Task 3: 前端类型与 API 客户端扩展

**Files:**
- Modify: `D:\blog\frontend\src\api\types.ts`
- Modify: `D:\blog\frontend\src\api\client.ts`

**Interfaces:**
- Produces:
  - `interface SiteInfo { intro: string; site_name: string; avatar_url: string }`
  - `client.updateSite(body: { intro?: string; site_name?: string; avatar_url?: string })`

- [ ] **Step 1: 扩展类型**

修改 `D:\blog\frontend\src\api\types.ts`：

```ts
export interface SiteInfo {
  intro: string;
  site_name: string;
  avatar_url: string;
}
```

- [ ] **Step 2: 扩展客户端方法**

修改 `D:\blog\frontend\src\api\client.ts`，替换 `updateSite`：

```ts
  updateSite: (body: { intro?: string; site_name?: string; avatar_url?: string }) =>
    request<{ ok: boolean }>("/site", { method: "PUT", body: JSON.stringify(body) }),
```

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`（frontend 目录）
Expected: 通过（注意：HomeView 等调用 `getSite()` 后对 `SiteInfo` 的赋值需在 Task 4/6 适配，当前步骤若因现有代码报错属预期，先确认错误仅出现在视图文件）

- [ ] **Step 4: 提交**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts
git commit -m "feat: 前端 SiteInfo 扩展 site_name 与 avatar_url"
```

---

### Task 4: HomeView 显示头像与名称

**Files:**
- Modify: `D:\blog\frontend\src\views\HomeView.vue`

**Interfaces:**
- Consumes: Task 3 的 `SiteInfo`（含 `site_name`、`avatar_url`）、`client.getSite()`
- Produces: 主页自我介绍卡片顶部居中显示头像（占位圆环 fallback）与名称

- [ ] **Step 1: 修改 script 部分**

在 `D:\blog\frontend\src\views\HomeView.vue` 中：

- 新增响应式状态（放在 `site` 之后）：

```ts
const site = ref<SiteInfo>({ intro: "", site_name: "", avatar_url: "" });
const avatarFailed = ref(false);
```

- 修改 `loadSite`：

```ts
async function loadSite(): Promise<void> {
  try {
    site.value = await client.getSite();
    avatarFailed.value = false;
  } catch {
    site.value = { intro: "", site_name: "", avatar_url: "" };
  }
}
```

- 新增计算属性：

```ts
const displayName = () => site.value.site_name || "个人博客";
const avatarInitial = () => (displayName() || "客").trim().charAt(0);
const showAvatarImage = () => site.value.avatar_url && !avatarFailed.value;
```

- [ ] **Step 2: 修改模板**

替换 `intro-card` section 为：

```html
    <section class="intro-card">
      <div class="profile">
        <div class="avatar">
          <img
            v-if="showAvatarImage()"
            :src="site.avatar_url"
            alt="头像"
            class="avatar-img"
            @error="avatarFailed = true"
          />
          <span v-else class="avatar-fallback">{{ avatarInitial() }}</span>
        </div>
        <WinTextBlock class="profile-name" FontSize="20" FontWeight="600" :Text="displayName()" />
        <WinTextBlock v-if="site.intro" class="intro-body" :Text="site.intro" />
      </div>
    </section>
```

- [ ] **Step 3: 修改样式**

替换 `.intro-card` 相关样式为：

```css
.intro-card {
  padding: 28px 24px;
  margin-bottom: 20px;
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
}
.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 12px;
  border: 1px solid var(--card-stroke);
  background: var(--subtle-tertiary);
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 36px;
  font-weight: 600;
  color: var(--accent-base);
}
.profile-name {
  margin-bottom: 8px;
  color: var(--text-primary);
  display: block;
}
.intro-body {
  white-space: pre-wrap;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 640px;
  display: block;
}
```

- [ ] **Step 4: 类型检查与构建**

Run: `npm run typecheck && npm run build`（frontend 目录）
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/HomeView.vue
git commit -m "feat: 主页展示头像与名称"
```

---

### Task 5: App.vue 导航栏标题使用网站名

**Files:**
- Modify: `D:\blog\frontend\src\App.vue`

**Interfaces:**
- Consumes: `client.getSite()`
- Produces: `PaneTitle` 响应式；`site_name` 为空时显示「个人博客」

- [ ] **Step 1: 引入 client 并添加标题状态**

在 `D:\blog\frontend\src\App.vue` 的 script 中：

- 顶部 import 追加：

```ts
import { client } from "./api/client";
```

- 在 `menuItems` 定义之后新增：

```ts
const paneTitle = ref("个人博客");

async function loadPaneTitle(): Promise<void> {
  try {
    const site = await client.getSite();
    paneTitle.value = site.site_name || "个人博客";
  } catch {
    /* 保持默认标题 */
  }
}
```

- [ ] **Step 2: onMounted 调用**

在现有 `onMounted` 中添加：

```ts
onMounted(() => {
  loadPaneTitle();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  theme.value = prefersDark ? "dark" : "light";
  applyTheme();
});
```

- [ ] **Step 3: 模板使用变量**

替换 `PaneTitle="个人博客"` 为：

```html
      :PaneTitle="paneTitle"
```

- [ ] **Step 4: 类型检查与构建**

Run: `npm run typecheck && npm run build`（frontend 目录）
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add frontend/src/App.vue
git commit -m "feat: 导航栏标题使用可配置网站名"
```

---

### Task 6: AdminView 增加名称与头像编辑

**Files:**
- Modify: `D:\blog\frontend\src\views\AdminView.vue`

**Interfaces:**
- Consumes: Task 3 的 `SiteInfo` 与 `client.updateSite`
- Produces: 「自我介绍」tab 含名称、头像 URL、自我介绍三个输入框，保存时一并提交

- [ ] **Step 1: 扩展表单状态**

修改 `D:\blog\frontend\src\views\AdminView.vue` 中：

```ts
const siteForm = ref<SiteInfo>({ intro: "", site_name: "", avatar_url: "" });
```

- [ ] **Step 2: 修改 loadSiteForm 与 saveSite**

```ts
async function loadSiteForm(): Promise<void> {
  try {
    siteForm.value = await client.getSite();
  } catch {
    siteForm.value = { intro: "", site_name: "", avatar_url: "" };
  }
}

async function saveSite(): Promise<void> {
  error.value = "";
  try {
    await client.updateSite({
      intro: siteForm.value.intro,
      site_name: siteForm.value.site_name,
      avatar_url: siteForm.value.avatar_url,
    });
  } catch (e) {
    error.value = (e as Error).message;
  }
}
```

- [ ] **Step 3: 模板增加输入框**

替换「自我介绍」section：

```html
      <section v-if="tab === 'site'" class="editor">
        <WinTextBox
          v-model:Text="siteForm.site_name"
          PlaceholderText="网站名称"
          Header="名称"
        />
        <WinTextBox
          v-model:Text="siteForm.avatar_url"
          PlaceholderText="头像图片 URL"
          Header="头像 URL"
        />
        <WinTextBox
          v-model:Text="siteForm.intro"
          PlaceholderText="自我介绍内容"
          Header="自我介绍"
          AcceptsReturn
          TextWrapping="Wrap"
          :MinHeight="160"
        />
        <div class="row">
          <WinButton Content="保存自我介绍" @Click="saveSite" />
        </div>
      </section>
```

- [ ] **Step 4: 类型检查与构建**

Run: `npm run typecheck && npm run build`（frontend 目录）
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/AdminView.vue
git commit -m "feat: 后台支持修改名称与头像 URL"
```

---

### Task 7: 端到端验证与部署

**Files:**
- None（仅部署）

- [ ] **Step 1: 后端全量测试**

Run: `npx vitest run`（worker 目录）
Expected: PASS

- [ ] **Step 2: 前端类型检查**

Run: `npm run typecheck`（frontend 目录）
Expected: PASS

- [ ] **Step 3: 构建前端**

Run: `npm run build`（frontend 目录）
Expected: 构建成功，产物输出到 `../worker/public/`

- [ ] **Step 4: 部署**

Run: `npx wrangler deploy`（D:\blog 目录）
Expected: 部署成功

- [ ] **Step 5: 验证接口**

Run: `Invoke-RestMethod -Uri "https://personal-blog.bixie45.workers.dev/api/site" -Method Get`
Expected: 返回包含 `intro`、`site_name`、`avatar_url` 三字段的 JSON

- [ ] **Step 6: 手工验证**

登录后台，在「自我介绍」tab 设置名称与头像 URL 并保存；刷新主页确认头像与名称居中显示；确认导航栏标题更新。
