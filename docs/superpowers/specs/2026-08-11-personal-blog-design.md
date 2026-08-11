# 个人博客网站设计文档

日期：2026-08-11

## 概述

一个部署在 Cloudflare Workers 上的个人博客网站，UI 仿照 [WinUIonWeb](https://furry-xiyi.github.io/WinUIonWeb/#/home) 的 Windows 11 WinUI 风格。包含自我介绍展示、文章发布/编辑/删除、标签分类、浏览量统计功能。管理员通过密码登录管理后台。

## 技术栈

- 前端：Vue 3 + Vite + vue-router，WinUI 风格自研组件
- 后端：Cloudflare Worker（TypeScript），处理 `/api/*` 请求
- 存储：D1（文章、标签、设置、密码哈希）+ KV（会话 token）
- 文章格式：Markdown（`marked` 渲染 + `DOMPurify` 防 XSS + `highlight.js` 代码高亮）
- 构建：Vite 前端产物输出到 Worker 的 assets 目录，单次 `wrangler deploy` 部署

## 架构

```
D:\blog\（项目根目录）
├── frontend/          Vue 3 + Vite 前端源码
│   └── src/           components / views / router / api
├── worker/            Cloudflare Worker（TypeScript）
│   └── src/index.ts   路由 + D1 + KV 逻辑
│   └── public/        Vite 构建产物（静态资源）
├── wrangler.jsonc     Worker 配置（assets 绑定 + D1 + KV）
├── schema.sql         D1 建表脚本
└── package.json       根工作区脚本
```

请求路由：
- URL 以 `/api/` 开头 → Worker 业务逻辑
- 其余请求 → `env.ASSETS.fetch(request)` 提供静态资源
- SPA 路由回退：`not_found_handling: "single-page-application"`，前端用 vue-router 管理页面路由

## 数据模型

### D1 表结构

```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,          -- Markdown 原文
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,           -- 'intro' | 'password_hash' | 'password_salt'
  value TEXT NOT NULL
);
```

### KV（会话存储）

- Key：`session:<token>`，Token 为 128 位随机字符串
- Value：JSON `{ createdAt: number }`
- TTL：7 天（`expirationTtl: 604800`）
- 前端通过 `Authorization: Bearer <token>` 头访问管理接口

### 密码存储

- 初始默认密码：`admin`
- 存储：使用 Web Crypto API PBKDF2(HMAC-SHA256) + 随机盐（每个用户独立）生成密码哈希
- 修改密码接口需验证旧密码
- 修改后的密码哈希+新盐写回 `settings` 表

## API 设计

所有接口返回 JSON，错误统一 `{ error: string }`。管理接口需 Bearer token。

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/site` | 自我介绍 + 站点信息 |
| GET | `/api/posts` | 文章列表，支持 `?tag=`、`?page=`、`?limit=` |
| GET | `/api/posts/:id` | 单篇文章详情（自动 views +1） |
| GET | `/api/tags` | 全部标签及文章数 |

### 管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 密码登录，返回 token（公开） |
| POST | `/api/logout` | 注销，删除 KV 会话 |
| PUT | `/api/site` | 修改自我介绍 |
| POST | `/api/posts` | 发布文章（含标签，逗号分隔） |
| PUT | `/api/posts/:id` | 编辑文章（含标签，逗号分隔） |
| DELETE | `/api/posts/:id` | 删除文章 |
| PUT | `/api/password` | 修改密码（需旧密码） |

## UI 设计

仿照 WinUIonWeb 的 Windows 11 风格：

- **布局**：顶栏（站名 + 导航），Mica 亚克力半透明质感背景，圆角卡片，Fluent 设计细节
- **主题**：跟随系统深色/浅色（`prefers-color-scheme`），Windows 11 强调色（accent blue 默认）
- **主页** `/`：自我介绍卡片（头像/昵称/简介）+ 文章列表（卡片式，显示标签、时间、浏览量）
- **文章页** `/post/:id`：Markdown 渲染 + 代码高亮
- **标签页** `/tags`：所有标签及文章数，点击筛选文章
- **管理后台** `/admin`：WinUI 风格表单（圆角输入框、Fluent 按钮、删除确认对话框）
- 管理入口：主页右下角小齿轮图标或 `/admin` 直接访问

## 安全

- 文章内容经 `DOMPurify` 消毒后渲染，防 XSS
- D1 查询全部使用 prepared statements（`.bind()`），防 SQL 注入
- 密码不存明文，PBKDF2 哈希 + 随机盐
- 会话 token 存 KV 且有过期时间；注消后立即删除
- 管理接口统一 Bearer token 鉴权，`session:<token>` 不存在或过期返回 401

## 标签处理约定

- 前端发文/编辑表单输入逗号分隔的标签字符串，服务端按 `,` 拆分并去空白
- 服务端负责：新标签自动创建，`post_tags` 关联更新（先删除该文章旧关联，再插入新关联）
- 空标签字符串表示文章无标签

## 非目标（YAGNI）

- 无 R2 存储 / 图片上传
- 无访客评论系统
- 无多作者、搜索、订阅（RSS）
- 无文章在线预览的富文本编辑器（Markdown 文本框即可）