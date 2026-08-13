# 网站名称同步到标签页与搜索引擎标题

## 背景

站点名称 `site_name` 已支持在管理后台配置，当前仅用于导航栏标题（App.vue 的 paneTitle）。
浏览器标签页 title 与搜索引擎抓取的 `<title>` 仍是静态写死的「个人博客」。

## 目标

- 浏览器标签页标题与网站名称同步
- 搜索引擎抓取的 HTML `<title>` 与网站名称同步（SEO）
- `site_name` 未配置（为空）时回退到默认「个人博客」

## 非目标

- 不加 meta description（本次只同步名称）
- 不做服务端缓存优化（站点规模小，每次 HTML 请求直接读 D1）
- 不引入路由级标题（所有页面统一为网站名称）

## 方案

### 1. worker 端：动态改写 HTML `<title>`

在 `worker/src/index.ts` 中，拦截所有最终会返回 index.html 的请求（根路径 `/` 与 SPA fallback 路径），
读取 `site_name`，改写静态 HTML 中的 `<title>` 后返回。

- 使用 `getSiteName(env)`（已存在，`worker/src/db.ts:36`）
- `site_name.trim()` 为空时保留默认「个人博客」
- 实现方式：
  - 新增内部函数 `renderIndexHtml(env)`：从 ASSETS 获取 index.html 文本，将 `<title>…</title>` 替换为 `<title>{site_name || '个人博客'}</title>`，返回 `Content-Type: text/html` 响应
  - 拦截 `GET /`（hash 路由下所有页面都请求根路径）：命中后返回改写后的 HTML
  - `notFound` 的 SPA fallback 分支（非 `/api/` 且未被静态资源命中）：也返回改写后的 HTML
  - 静态资源（如 `/assets/x.js`）由 ASSETS 直接命中，不经过改写逻辑

### 2. 客户端：标签页即时同步

`frontend/src/App.vue` 的 `loadSiteInfo()` 成功后，设置 `document.title = site_name.trim() || '个人博客'`。
与 paneTitle 默认逻辑保持一致（App.vue:59）。

### 3. 测试

`worker/src/index.test.ts`（或新增用例）：
- `GET /` 返回的 HTML 含 `<title>小明博客</title>`（site_name 已配置）
- `site_name` 为空时返回 `<title>个人博客</title>`
- 静态资源（如 `/assets/x.js`）仍正常由 ASSETS 处理，不被改写逻辑干扰

## 数据流

```
浏览器访问 / (或 SPA fallback)
  → worker 拦截 HTML 请求
  → getSiteName(env) 读 D1
  → 改写 <title>{site_name}</title>
  → 返回 HTML（搜索引擎与首次加载正确）
浏览器 SPA 运行
  → loadSiteInfo() 同步 document.title（标签页即时更新）
```

## 涉及文件

- `worker/src/index.ts`：新增 HTML title 改写路由
- `frontend/src/App.vue`：`loadSiteInfo` 内同步 `document.title`
- `worker/src/index.test.ts`：新增测试
