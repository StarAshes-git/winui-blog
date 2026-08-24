# winui-blog

部署在 Cloudflare Workers 的个人博客，UI 仿 Windows 11 WinUI 风格。

## 本地开发

```bash
npm --prefix worker install
npm --prefix frontend install
npm run build:frontend   # 前端产物输出到 worker/public
npm --prefix worker run dev
```

默认管理员密码：`admin`（首次登录后请及时在后台修改）。

> 注意：本地开发依赖 workerd 运行时。若本机 Windows 环境遇到 workerd 启动崩溃（access violation），请直接在远程环境部署验证。

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
