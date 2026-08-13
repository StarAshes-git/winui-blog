# 网站名称同步到标签页与搜索引擎标题 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让浏览器标签页 title 与搜索引擎抓取的 HTML `<title>` 同步为后台配置的网站名称（空值回退「个人博客」）。

**Architecture:** worker 端拦截返回 index.html 的请求（根路径与 SPA fallback），从 D1 读 site_name 动态改写 `<title>`；客户端 App.vue 在加载站点信息后同步 `document.title`，保证标签页即时更新。

**Tech Stack:** Hono（worker）、Cloudflare Assets、Vue 3、Vitest

## Global Constraints

- `site_name.trim()` 为空时标题回退为「个人博客」
- 标题为纯网站名称，不加页面后缀
- 不改 `<meta name="description">`（本次只同步名称）
- API 请求（`/api/*`）不被改写逻辑干扰，仍返回 JSON
- 静态资源（`/assets/*`）由 ASSETS 直接命中，不经过改写

---

### Task 1: worker 端动态改写 HTML `<title>`

**Files:**
- Modify: `worker/src/index.ts:16-31`
- Test: `worker/src/index.test.ts`

**Interfaces:**
- Consumes: `getSiteName(env)`（`worker/src/db.ts:36`，返回 `Promise<string>`，空串表示未配置）
- Produces: `worker/src/index.ts` 内私有函数 `renderIndexHtml(env)`：从 `c.env.ASSETS` 取 index.html 文本，替换 `<title>`，返回 `Response`（`Content-Type: text/html; charset=utf-8`）。`GET /` 命中时调用。

- [ ] **Step 1: 写失败测试**

编辑 `worker/src/index.test.ts`，将 ASSETS mock 改为返回带 `<title>` 的 index.html，并新增两个用例：

```ts
import { describe, it, expect } from "vitest";
import worker from "./index";

function makeEnv(siteName?: string) {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async (col: string) => (col === "value" ? siteName ?? null : null),
        }),
      }),
    } as unknown as D1Database,
    SESSIONS: {} as unknown as KVNamespace,
    ASSETS: {
      fetch: () =>
        new Response("<!doctype html><html><head><title>个人博客</title></head><body></body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    } as unknown as Fetcher,
  };
}

describe("worker fetch", () => {
  it("GET / 使用已配置站点名作为 title", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/", { headers: { Accept: "text/html" } }),
      makeEnv("小明博客"),
      {} as ExecutionContext
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>小明博客</title>");
    expect(html).not.toContain("<title>个人博客</title>");
  });

  it("site_name 为空时回退默认个人博客", async () => {
    const res = await worker.fetch(
      new Request("https://example.com/", { headers: { Accept: "text/html" } }),
      makeEnv(""),
      {} as ExecutionContext
    );
    const html = await res.text();
    expect(html).toContain("<title>个人博客</title>");
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

注意：原「转发非 api 请求到 ASSETS」用例的 ASSETS mock 返回 `"asset-mock"`（非 HTML），与本新逻辑冲突，需删除或改造。推荐改为 `GET /` 用例（上面第一个）覆盖该行为。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/index.test.ts`
Expected: FAIL —— `GET /` 用例断言 `<title>小明博客</title>` 失败（当前返回 "asset-mock" 或原文案未替换）

- [ ] **Step 3: 实现改写逻辑**

编辑 `worker/src/index.ts`：

```ts
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
  return renderIndexHtml(c);
});

export default {
  fetch: app.fetch,
};
```

说明：
- `app.get("/")` 放在 `/api` 路由之后、notFound 之前，拦截根路径
- `notFound` 分支（SPA fallback）同样改写，覆盖 deep link
- 站点名经 HTML 转义，防止注入

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/index.test.ts`
Expected: 全部 PASS（3 个用例）

- [ ] **Step 5: 运行全量测试**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add worker/src/index.ts worker/src/index.test.ts
git commit -m "feat: worker 动态改写 HTML title 为站点名称"
```

---

### Task 2: 客户端同步标签页 title

**Files:**
- Modify: `frontend/src/App.vue:56-64`

**Interfaces:**
- Consumes: `client.getSite()` 返回的 `SiteInfo`（含 `site_name: string`）
- Produces: 无（仅副作用：设置 `document.title`）

- [ ] **Step 1: 实现 document.title 同步**

编辑 `frontend/src/App.vue` 的 `loadSiteInfo`：

```ts
async function loadSiteInfo(): Promise<void> {
  try {
    const site = await client.getSite();
    const title = site.site_name.trim() || "个人博客";
    paneTitle.value = title;
    document.title = title;
    footerRecord.value = site.footer_record?.text ? site.footer_record : null;
  } catch {
    /* 保持默认标题 */
  }
}
```

- [ ] **Step 2: typecheck 验证**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功，产物输出到 `../worker/public/`

- [ ] **Step 4: 提交**

```bash
git add frontend/src/App.vue
git commit -m "feat: 标签页 title 与站点名称同步"
```

---

### Task 3: 集成验证与部署

**Files:**
- 无代码改动

**Interfaces:**
- Consumes: Task 1 与 Task 2 的产物（worker 改写 + 客户端同步）

- [ ] **Step 1: 全量测试确认**

Run: `npx vitest run`（worker 目录）
Expected: 全部 PASS

- [ ] **Step 2: 本地联调验证**

Run: `npx wrangler dev`（工作目录 `D:\blog`）
Expected: 访问 `http://localhost:8787/`，页面源码含 `<title>小明博客</title>`（site_name 已配置为「小明博客」）；标签页标题为「小明博客」

- [ ] **Step 3: 部署**

```bash
npx wrangler deploy
```

Expected: 部署成功，输出 Version ID 与 URL

- [ ] **Step 4: 线上验证**

访问 `https://personal-blog.bixie45.workers.dev/`：
- 浏览器标签页标题为「小明博客」
- 查看页面源代码，`<title>` 为「小明博客」

---

### 自审记录

- **Spec coverage**: spec 的「worker 改写」「客户端同步」「空值回退」「不加 description」均有对应任务（Task 1、Task 2、全局约束）
- **占位符**: 无 TBD/TODO
- **类型一致性**: `getSiteName` 签名与现有 db.ts 一致；`renderIndexHtml` 在 Task 1 定义并被同任务使用，Task 3 仅作集成验证不引用其签名