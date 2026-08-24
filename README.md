# Personal Blog

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

## 部署

1. 克隆仓库
2. 安装依赖：`cd frontend && npm install`
3. 构建：`npm run build`
4. 部署到 Cloudflare Workers：`npx wrangler deploy`

## 环境变量

需要在 Cloudflare Workers 中配置以下环境变量：

- `DB`: D1 数据库绑定
- `SESSIONS`: KV 命名空间绑定

## 开发

```bash
# 安装依赖
cd frontend && npm install

# 开发服务器
npm run dev

# 类型检查
npx vue-tsc --noEmit

# 构建
npm run build
```

## 测试

```bash
cd worker && npm test
```
