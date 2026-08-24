# winui-blog

一个使用 Vue 3 + Hono + Cloudflare Workers 构建的个人博客。

## 功能

- 个人介绍页面（头像、简介、社交链接、最近文章）
- 文章页面（Markdown 渲染、Giscus 评论）
- 标签筛选
- 管理后台（文章管理、社交链接、备案信息）

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Hono + Cloudflare Workers + D1 + KV
- **UI**: WinUIonWeb 风格组件
- **评论**: Giscus (GitHub Discussions)

## 许可证

本项目使用 [GNU General Public License v3.0](LICENSE) 许可证。

### 致谢

本项目的 UI 组件基于 [WinUIonWeb](https://github.com/Furry-Xiyi/WinUIonWeb) 项目，该项目使用 GPLv3 许可证。

---

## Fork 部署指南

如果你想 Fork 这个项目并部署自己的博客，请按以下步骤操作：

### 第一步：创建 Cloudflare 资源

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 创建 D1 数据库：
   ```bash
   npx wrangler d1 create blog-db
   ```
   记录返回的数据库 ID。

3. 创建 KV 命名空间：
   ```bash
   npx wrangler kv namespace create SESSIONS
   ```
   记录返回的 KV ID。

4. 修改 `worker/wrangler.jsonc`，将数据库 ID 和 KV ID 替换为你自己的：
   ```jsonc
   {
     "binding": "DB",
     "database_id": "你的 D1 数据库 ID"
   },
   {
     "binding": "SESSIONS",
     "id": "你的 KV ID"
   }
   ```

### 第二步：配置 Giscus 评论

1. 确保你的 GitHub 仓库已启用 Discussions
2. 安装 [Giscus GitHub App](https://github.com/apps/giscus)
3. 打开 https://giscus.app/zh-CN
4. 输入你的仓库地址（如 `你的用户名/你的仓库名`）
5. 选择 "Announcements" 分类
6. 复制生成的配置参数

7. 编辑 `frontend/src/views/PostView.vue`，修改 `GISCUS_CONFIG`：
   ```typescript
   const GISCUS_CONFIG = {
     repo: "你的用户名/你的仓库名" as `${string}/${string}`,
     repoId: "你的 repoId",
     category: "Announcements",
     categoryId: "你的 categoryId",
   };
   ```

### 第三步：构建和部署

```bash
# 克隆你的 Fork
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名

# 安装依赖
cd frontend && npm install

# 构建前端
npm run build

# 部署到 Cloudflare Workers
cd .. && npx wrangler deploy
```

### 第四步：初始化数据库

部署成功后，访问你的网站，使用默认密码 `admin` 登录管理后台，然后：
1. 修改密码
2. 设置网站名称、头像、简介
3. 发布第一篇文章

---

## 本地开发

```bash
# 安装依赖
cd frontend && npm install

# 启动开发服务器
npm run dev

# 类型检查
npx vue-tsc --noEmit
```

## 测试

```bash
cd worker && npm test
```
