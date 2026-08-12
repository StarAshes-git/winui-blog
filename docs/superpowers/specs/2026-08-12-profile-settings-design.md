# 主页头像、名称与可配置网站名设计

日期：2026-08-12

## 目标

- 主页自我介绍卡片顶部居中显示头像（通过 URL 加载）和名称
- 头像、名称、网站名均可由管理员在后台修改
- 头像下方名称与网站名是同一个配置项，同时用于导航栏标题

## 现状

- `settings` 表以 key-value 存储，现有 key：`intro`、`password_hash`
- `GET /api/site` 返回 `{ intro }`；`PUT /api/site` 仅接受 `intro`
- 前端 `SiteInfo` 仅含 `intro`；导航栏 `PaneTitle="个人博客"` 硬编码在 App.vue
- 主页自我介绍卡片在 HomeView，管理后台「自我介绍」tab 在 AdminView

## 数据设计

`settings` 表新增两个 key：

| key | 含义 | 未设置时默认值 |
|---|---|---|
| `site_name` | 名称 / 网站名 | 前端兜底「个人博客」 |
| `avatar_url` | 头像图片 URL | 前端占位：名称首字圆环 |

## API 变更

### GET /api/site

返回：

```json
{ "intro": "", "site_name": "", "avatar_url": "" }
```

三个字段均为字符串，未设置时返回空串。

### PUT /api/site

请求体三个字段全部可选，仅保存传入字段：

```json
{ "intro": "...", "site_name": "...", "avatar_url": "..." }
```

## 前端变更

### types.ts

`SiteInfo` 扩展为 `{ intro: string; site_name: string; avatar_url: string }`。

### client.ts

`updateSite` 参数改为 `{ intro?: string; site_name?: string; avatar_url?: string }`，
请求体只包含非 undefined 字段。

### HomeView.vue

自我介绍卡片重构为：

- 顶部居中头像：URL 加载成功显示圆形图片；加载失败或为空显示占位圆环（内含名称首字）
- 头像下方居中显示名称（默认「个人博客」）
- 名称下方为现有自我介绍文本

### App.vue

- `PaneTitle` 由硬编码改为响应式变量
- `onMounted` 时请求 `/api/site`，用 `site_name`（为空则「个人博客」）作为 `PaneTitle`

### AdminView.vue

「自我介绍」tab 增加两个输入框：

- 名称（`site_name`）
- 头像 URL（`avatar_url`）

保存时连同 `intro` 一并调用 `updateSite` 提交。

## 错误处理

- 头像图片加载失败（`onerror`）时显示占位圆环，不中断页面
- `site_name` 为空串时前端兜底显示「个人博客」

## 测试

- 后端：`GET /api/site` 返回新增字段；`PUT /api/site` 部分字段更新正确（现有 vitest 测试补充）
- 前端：`vue-tsc` 类型检查通过
- 构建与部署后手工验证登录、修改名称/头像、主页与导航栏显示
