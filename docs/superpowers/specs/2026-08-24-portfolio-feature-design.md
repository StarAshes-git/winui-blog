# 作品集功能设计文档

## 概述

为博客添加作品集功能，允许用户展示自己的项目作品。

## 功能需求

### 作品信息
- **标题**：作品名称（必填）
- **描述**：作品简介（可选）
- **封面图**：外部图片URL（可选）
- **项目链接**：GitHub 仓库地址（可选）
- **Demo 链接**：在线演示地址（可选）
- **技术栈标签**：项目使用的技术（可选）

### 展示方式
- 独立页面 `/works`
- 导航栏添加"作品"菜单项
- 卡片式展示，按创建时间倒序排列
- 封面图使用外部URL加载

### 管理功能
- 管理后台添加作品管理
- 支持创建、编辑、删除作品
- 图片使用URL保存，不存储在D1

## 数据模型

### D1 数据库表

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  project_url TEXT NOT NULL DEFAULT '',
  demo_url TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| title | TEXT | 作品标题 |
| description | TEXT | 作品描述 |
| cover_url | TEXT | 封面图外部URL |
| project_url | TEXT | 项目链接（GitHub等） |
| demo_url | TEXT | 在线演示链接 |
| tags | TEXT | 技术栈标签（JSON数组） |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

## API 设计

### 公开 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 获取作品列表（按时间倒序） |
| GET | `/api/projects/:id` | 获取单个作品详情 |

### 管理 API（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects` | 创建作品 |
| PUT | `/api/projects/:id` | 更新作品 |
| DELETE | `/api/projects/:id` | 删除作品 |

### 请求/响应格式

#### GET /api/projects
```json
{
  "projects": [
    {
      "id": 1,
      "title": "项目名称",
      "description": "项目描述",
      "cover_url": "https://example.com/image.jpg",
      "project_url": "https://github.com/user/repo",
      "demo_url": "https://demo.example.com",
      "tags": ["Vue", "TypeScript"],
      "created_at": 1692844800000,
      "updated_at": 1692844800000
    }
  ],
  "total": 1
}
```

#### POST /api/projects
```json
{
  "title": "项目名称",
  "description": "项目描述",
  "cover_url": "https://example.com/image.jpg",
  "project_url": "https://github.com/user/repo",
  "demo_url": "https://demo.example.com",
  "tags": ["Vue", "TypeScript"]
}
```

## 前端设计

### 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/works` | WorksView.vue | 作品列表页 |

### 导航菜单

菜单顺序：介绍, 文章, **作品**, 标签, 管理

### 作品卡片设计

```
┌─────────────────────────────┐
│ [封面图]                     │
│                             │
│ 项目名称                    │
│ 项目描述...                 │
│                             │
│ [Vue] [TypeScript]          │
│                             │
│ [GitHub] [Demo]             │
└─────────────────────────────┘
```

### 封面图处理
- 有封面图：显示 `<img :src="cover_url">`
- 无封面图：显示占位符（项目首字母或图标）

## 文件变更

### 后端文件
- `worker/src/db.ts`：添加作品相关数据库操作
- `worker/src/routes/public.ts`：添加公开 API
- `worker/src/routes/admin.ts`：添加管理 API
- `worker/src/migrate.ts`：添加数据库迁移

### 前端文件
- `frontend/src/views/WorksView.vue`：新作品列表页
- `frontend/src/views/AdminView.vue`：添加作品管理
- `frontend/src/router/index.ts`：添加路由
- `frontend/src/App.vue`：添加导航菜单项
- `frontend/src/api/types.ts`：添加类型定义
- `frontend/src/api/client.ts`：添加 API 方法

## 实施步骤

1. 创建数据库表
2. 实现后端 API
3. 实现前端页面
4. 添加管理功能
5. 测试和部署
