# 个人介绍与文章拆分 + Giscus 评论

## 背景

当前首页同时显示个人介绍和文章列表。用户希望：
1. 拆分成两个独立页面：个人介绍页 + 文章列表页
2. 左侧栏可以切换这两个页面
3. 文章界面添加 Giscus 评论功能

## 目标

### 1. 社交链接功能
- 后端：settings 表新增 `social_links` 字段（JSON 数组：`[{ name: string, url: string }]`）
- 前端：SiteInfo 类型新增 `social_links` 字段
- 管理后台：添加社交链接编辑界面（支持添加/删除/排序）

### 2. 个人介绍页面（新路由 `/about`）
- 头像 + 网站名 + 简介（原有）
- 社交链接（新功能）
- 最近文章列表（新功能，显示最新 5 篇）

### 3. 文章列表页面（路由 `/`）
- 只显示文章列表 + 分页
- 移除个人介绍部分

### 4. Giscus 评论
- 在 PostView 底部添加 Giscus 评论组件
- 需要用户配置 Giscus 参数（repo、repoId、category、categoryId）

### 5. 左侧栏菜单调整
- 新增"介绍"菜单项
- "首页"改为"文章"

## 技术方案

### 后端改动
1. `worker/src/db.ts`：新增 `getSocialLinks`、`setSocialLinks` 函数
2. `worker/src/routes/public.ts`：GET /api/site 返回 social_links
3. `worker/src/routes/admin.ts`：PUT /api/site 支持 social_links

### 前端改动
1. `frontend/src/api/types.ts`：SiteInfo 新增 social_links
2. 新建 `frontend/src/views/AboutView.vue`：个人介绍页面
3. 修改 `frontend/src/views/HomeView.vue`：移除个人介绍，只保留文章列表
4. 修改 `frontend/src/router/index.ts`：新增 /about 路由
5. 修改 `frontend/src/App.vue`：菜单项调整
6. 修改 `frontend/src/views/PostView.vue`：添加 Giscus 评论
7. 修改 `frontend/src/views/AdminView.vue`：添加社交链接编辑

### Giscus 配置
需要用户提供：
- repo（GitHub 仓库）
- repoId
- category
- categoryId

## 涉及文件

### 新建
- `frontend/src/views/AboutView.vue`

### 修改
- `worker/src/db.ts`
- `worker/src/routes/public.ts`
- `worker/src/routes/admin.ts`
- `frontend/src/api/types.ts`
- `frontend/src/views/HomeView.vue`
- `frontend/src/views/PostView.vue`
- `frontend/src/views/AdminView.vue`
- `frontend/src/router/index.ts`
- `frontend/src/App.vue`
