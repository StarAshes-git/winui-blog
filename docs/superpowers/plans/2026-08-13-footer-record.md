# 底部备案信息功能 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在博客底部显示可配置的备案号，点击跳转到配置链接，管理后台可配置。

**Architecture:** 复用 `settings` key-value 表，新增 `footer_record` key 存 JSON `{"text","link"}`。`GET/PUT /api/site` 透传该字段；App.vue 底部渲染；AdminView「自我介绍」tab 加两个输入框。

**Tech Stack:** Hono + Cloudflare D1（worker），Vue 3 + TypeScript + WinUIonWeb 组件（frontend）。

## Global Constraints

- 工作区 `D:\blog` 有**未提交修改**（密码输入重复字符修复 WinPasswordBox/WinTextBox、侧栏 hover 修复 WinNavigationView/App.vue），编辑时保留这些改动，勿回退。
- `link` 必须 `http://` 或 `https://` 开头，否则后端拒绝保存（400）。
- `footer_record` 的 `text` 为空串或 key 不存在 → 前端不渲染底部备案。
- 测试用 vitest（worker 目录 `npx vitest run`）；前端无单测，用 `npm run typecheck` + `npm run build`。
- 部署：`npx wrangler deploy`（工作目录 `D:\blog`）。
- 代码注释与交互语言为中文。

---

### Task 1: worker 后端 footer_record 存取与接口

**Files:**
- Modify: `worker/src/db.ts`（在 `setAvatarUrl` 后追加）
- Modify: `worker/src/routes/public.ts`
- Modify: `worker/src/routes/admin.ts`
- Test: `worker/src/site.test.ts`

**Interfaces:**
- Consumes: `Env`（`env.DB` 已存在）、`setIntro/setSiteName/setAvatarUrl` 模式。
- Produces:
  - `export async function getFooterRecord(env: Env): Promise<{ text: string; link: string } | null>`
  - `export async function setFooterRecord(env: Env, record: { text: string; link: string } | null): Promise<void>`
  - `GET /api/site` 响应新增 `footer_record` 字段。
  - `PUT /api/site` 接受可选 `footer_record`（对象或 null）。

- [ ] **Step 1: 写失败测试（追加到 site.test.ts）**

```ts
describe("footer_record", () => {
  it("GET /api/site 返回 footer_record（未配置为 null）", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect((await res.json() as { footer_record: unknown }).footer_record).toBeNull();
  });

  it("PUT /api/site 写入 footer_record 后可读回", async () => {
    const settings = new Map();
    const env = makeEnv(settings);
    const put = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ footer_record: { text: "京ICP备12345678号", link: "https://beian.miit.gov.cn/" } }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(put.status).toBe(200);
    const stored = settings.get("footer_record");
    expect(JSON.parse(stored)).toEqual({ text: "京ICP备12345678号", link: "https://beian.miit.gov.cn/" });

    const get = await worker.fetch(new Request("https://example.com/api/site"), env, {} as ExecutionContext);
    expect(await get.json()).toMatchObject({ footer_record: { text: "京ICP备12345678号", link: "https://beian.miit.gov.cn/" } });
  });

  it("PUT /api/site 非法 link 返回 400", async () => {
    const env = makeEnv(new Map());
    const res = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ footer_record: { text: "X", link: "javascript:alert(1)" } }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(400);
  });

  it("PUT /api/site footer_record 传 null 清除", async () => {
    const settings = new Map([["footer_record", JSON.stringify({ text: "A", link: "https://a.com" })]]);
    const env = makeEnv(settings);
    const res = await worker.fetch(
      new Request("https://example.com/api/site", {
        method: "PUT",
        body: JSON.stringify({ footer_record: null }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    expect(settings.has("footer_record")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/site.test.ts`（工作目录 `D:\blog\worker`）
Expected: FAIL（`footer_record` 字段不存在、写入逻辑未实现）

- [ ] **Step 3: 实现 db.ts 存取函数（追加在 setAvatarUrl 之后）**

```ts
export async function getFooterRecord(env: Env): Promise<{ text: string; link: string } | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind("footer_record")
    .first<string>("value");
  if (!row) return null;
  try {
    const parsed = JSON.parse(row) as { text?: string; link?: string };
    return { text: typeof parsed.text === "string" ? parsed.text : "", link: typeof parsed.link === "string" ? parsed.link : "" };
  } catch {
    return null;
  }
}

export async function setFooterRecord(env: Env, record: { text: string; link: string } | null): Promise<void> {
  if (!record) {
    await env.DB.prepare("DELETE FROM settings WHERE key = ?").bind("footer_record").run();
    return;
  }
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('footer_record', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(JSON.stringify(record))
    .run();
}
```

- [ ] **Step 4: 实现 public.ts（GET /site 加入 footer_record）**

```ts
import { getSiteIntro, listPosts, getPost, incrementViews, listTags, getStoredPassword, getSiteName, getAvatarUrl, getFooterRecord } from "../db";

publicApi.get("/site", async (c) => {
  const [intro, site_name, avatar_url, footer_record] = await Promise.all([
    getSiteIntro(c.env),
    getSiteName(c.env),
    getAvatarUrl(c.env),
    getFooterRecord(c.env),
  ]);
  return c.json({ intro, site_name, avatar_url, footer_record });
});
```

- [ ] **Step 5: 实现 admin.ts（PUT /site 处理 footer_record + link 校验）**

```ts
import { setIntro, createPost, updatePost, deletePost, getStoredPassword, setPassword, setSiteName, setAvatarUrl, setFooterRecord } from "../db";

adminApi.put("/site", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body && body.footer_record !== undefined && body.footer_record !== null) {
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
  if (body?.footer_record !== undefined) {
    if (body.footer_record === null || body.footer_record.text === "") {
      tasks.push(setFooterRecord(c.env, null));
    } else {
      tasks.push(setFooterRecord(c.env, { text: body.footer_record.text, link: body.footer_record.link }));
    }
  }
  await Promise.all(tasks);
  return c.json({ ok: true });
});
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/site.test.ts`（工作目录 `D:\blog\worker`）
Expected: PASS（4 个新用例 + 原有 3 个用例）

- [ ] **Step 7: 运行全部测试**

Run: `npx vitest run`（工作目录 `D:\blog\worker`）
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add worker/src/db.ts worker/src/routes/public.ts worker/src/routes/admin.ts worker/src/site.test.ts
git commit -m "feat: 后端支持 footer_record 备案信息存取"
```

---

### Task 2: 前端类型与 client 支持 footer_record

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Consumes: Task 1 的 `GET/PUT /api/site` footer_record 字段。
- Produces: `SiteInfo.footer_record`、`SiteFooterRecord` 类型；`updateSite` 接受 `footer_record`。

- [ ] **Step 1: 修改 types.ts**

```ts
export interface SiteFooterRecord {
  text: string;
  link: string;
}

export interface SiteInfo {
  intro: string;
  site_name: string;
  avatar_url: string;
  footer_record: SiteFooterRecord | null;
}
```

- [ ] **Step 2: 修改 client.ts 的 updateSite 签名**

```ts
updateSite: (body: {
  intro?: string;
  site_name?: string;
  avatar_url?: string;
  footer_record?: { text: string; link: string } | null;
}) => request<{ ok: boolean }>("/site", { method: "PUT", body: JSON.stringify(body) }),
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`（工作目录 `D:\blog\frontend`）
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts
git commit -m "feat: 前端类型与 client 支持 footer_record"
```

---

### Task 3: App.vue 底部渲染备案信息

**Files:**
- Modify: `frontend/src/App.vue`

**Interfaces:**
- Consumes: `client.getSite()` 返回 `SiteInfo`（含 `footer_record`）。
- Produces: 底部 `footer.app-footer` 渲染（含/不含链接）。

- [ ] **Step 1: script 增加 footer_record 状态并在加载时获取**

在 `loadPaneTitle` 基础上扩展（原函数改为同时保存 footer_record）：

```ts
const footerRecord = ref<{ text: string; link: string } | null>(null);

async function loadSiteInfo(): Promise<void> {
  try {
    const site = await client.getSite();
    paneTitle.value = site.site_name.trim() || "个人博客";
    footerRecord.value = site.footer_record?.text ? site.footer_record : null;
  } catch {
    /* 保持默认标题 */
  }
}
```

将 `onMounted` 与 `watch(route.path)` 中的 `loadPaneTitle()` 改为 `loadSiteInfo()`，并删除旧的 `loadPaneTitle` 函数。

- [ ] **Step 2: 模板在 `.app-content` 底部追加 footer**

```html
<main class="app-content">
  <router-view />
  <footer v-if="footerRecord" class="app-footer">
    <a
      v-if="footerRecord.link"
      :href="footerRecord.link"
      target="_blank"
      rel="noopener noreferrer"
    >{{ footerRecord.text }}</a>
    <span v-else>{{ footerRecord.text }}</span>
  </footer>
</main>
```

- [ ] **Step 3: 样式追加**

```css
.app-footer {
  margin-top: 48px;
  padding-top: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  border-top: 1px solid var(--card-stroke);
}
.app-footer a {
  color: inherit;
  text-decoration: none;
}
.app-footer a:hover {
  color: var(--accent-base);
}
```

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`（工作目录 `D:\blog\frontend`）
Expected: PASS（build 输出到 `../worker/public/`）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/App.vue
git commit -m "feat: 首页底部渲染可配置备案信息"
```

---

### Task 4: AdminView 配置备案号与链接

**Files:**
- Modify: `frontend/src/views/AdminView.vue`

**Interfaces:**
- Consumes: Task 2 的 `updateSite` footer_record 参数、`SiteInfo` 类型。
- Produces: 「自我介绍」tab 增加备案号/备案链接两个 `WinTextBox`。

- [ ] **Step 1: script 初始化 siteForm 含 footer_record 并校验保存**

将 `siteForm` 初始值补 `footer_record`，`loadSiteForm` 的 fallback 同步，`saveSite` 加入校验与提交：

```ts
const siteForm = ref<SiteInfo>({ intro: "", site_name: "", avatar_url: "", footer_record: { text: "", link: "" } });
```

`loadSiteForm` catch 分支：

```ts
siteForm.value = { intro: "", site_name: "", avatar_url: "", footer_record: { text: "", link: "" } };
```

`saveSite`：

```ts
async function saveSite(): Promise<void> {
  error.value = "";
  const link = siteForm.value.footer_record?.link ?? "";
  if (link && !/^https?:\/\//.test(link)) {
    error.value = "备案链接必须以 http:// 或 https:// 开头";
    return;
  }
  try {
    await client.updateSite({
      intro: siteForm.value.intro,
      site_name: siteForm.value.site_name,
      avatar_url: siteForm.value.avatar_url,
      footer_record: siteForm.value.footer_record?.text
        ? { text: siteForm.value.footer_record.text, link }
        : null,
    });
  } catch (e) {
    error.value = (e as Error).message;
  }
}
```

- [ ] **Step 2: 模板在「自我介绍」tab 追加两个输入框（放在 intro 之前）**

```html
<WinTextBox
  v-model:Text="siteForm.footer_record!.text"
  PlaceholderText="如：京ICP备12345678号"
  Header="备案号"
/>
<WinTextBox
  v-model:Text="siteForm.footer_record!.link"
  PlaceholderText="如：https://beian.miit.gov.cn/"
  Header="备案链接"
/>
```

`footer_record` 可能为 null 导致 `!` 断言不优雅——改用 `footerRecord` 本地 ref 对象避免断言：

```ts
const footerRecord = ref({ text: "", link: "" });
async function loadSiteForm(): Promise<void> {
  try {
    const site = await client.getSite();
    siteForm.value = site;
    footerRecord.value = site.footer_record ?? { text: "", link: "" };
  } catch {
    siteForm.value = { intro: "", site_name: "", avatar_url: "", footer_record: null };
    footerRecord.value = { text: "", link: "" };
  }
}
```

模板绑定 `footerRecord.text` / `footerRecord.link`，`saveSite` 提交时用 `footerRecord.value`。

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`（工作目录 `D:\blog\frontend`）
Expected: PASS

- [ ] **Step 4: 构建并部署**

Run: `npm run build`（工作目录 `D:\blog\frontend`），随后 `npx wrangler deploy`（工作目录 `D:\blog`）
Expected: 部署成功，输出线上 URL

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/AdminView.vue
git commit -m "feat: 管理后台可配置备案号与链接"
```

---

### Task 5: 手动验证

- [ ] **Step 1: 后台配置**

线上打开管理页（`/admin`），登录（默认 `admin`），进入「自我介绍」tab，填入备案号与工信部链接，保存。

- [ ] **Step 2: 首页验证**

访问首页：底部显示备案号，鼠标悬停样式变化，点击在新标签页打开工信部站点。

- [ ] **Step 3: 清除验证**

后台清空备案号保存，首页底部不再显示备案信息。