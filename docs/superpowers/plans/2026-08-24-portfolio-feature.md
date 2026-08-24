# 作品集功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为博客添加作品集功能，允许用户展示自己的项目作品

**Architecture:** 在 D1 数据库中创建 projects 表，实现后端 API 和前端页面，支持作品的 CRUD 操作

**Tech Stack:** Vue 3, Hono, Cloudflare Workers, D1, TypeScript

## Global Constraints

- 使用现有的 WinUIonWeb 风格组件
- 图片使用 URL 保存，不存储在 D1
- 作品按创建时间倒序排列
- 管理功能需要登录认证

---

## 文件结构

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

---

## Task 1: 创建数据库表

**Files:**
- Modify: `worker/src/migrate.ts`

**Interfaces:**
- Produces: `projects` 表

- [ ] **Step 1: 添加数据库迁移**

在 `worker/src/migrate.ts` 中添加 projects 表创建语句：

```typescript
// 在 MIGRATIONS 数组末尾添加
{
  version: 3,
  name: "create_projects",
  sql: `CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    project_url TEXT NOT NULL DEFAULT '',
    demo_url TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`
}
```

- [ ] **Step 2: 测试数据库迁移**

运行 wrangler dev 后检查 D1 数据库是否创建了 projects 表

---

## Task 2: 实现后端数据库操作

**Files:**
- Modify: `worker/src/db.ts`

**Interfaces:**
- Produces: `getProjects()`, `getProject()`, `createProject()`, `updateProject()`, `deleteProject()`

- [ ] **Step 1: 添加类型定义**

在 `worker/src/db.ts` 顶部添加：

```typescript
export interface Project {
  id: number;
  title: string;
  description: string;
  cover_url: string;
  project_url: string;
  demo_url: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface ProjectSummary {
  id: number;
  title: string;
  description: string;
  cover_url: string;
  project_url: string;
  demo_url: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}
```

- [ ] **Step 2: 添加 getProjects 函数**

```typescript
export async function getProjects(env: Env): Promise<ProjectSummary[]> {
  const rows = await env.DB.prepare(
    "SELECT id, title, description, cover_url, project_url, demo_url, tags, created_at, updated_at FROM projects ORDER BY created_at DESC"
  ).all<{
    id: number;
    title: string;
    description: string;
    cover_url: string;
    project_url: string;
    demo_url: string;
    tags: string;
    created_at: number;
    updated_at: number;
  }>();
  
  return rows.results.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || "[]")
  }));
}
```

- [ ] **Step 3: 添加 getProject 函数**

```typescript
export async function getProject(env: Env, id: number): Promise<Project | null> {
  const row = await env.DB.prepare(
    "SELECT id, title, description, cover_url, project_url, demo_url, tags, created_at, updated_at FROM projects WHERE id = ?"
  ).bind(id).first<{
    id: number;
    title: string;
    description: string;
    cover_url: string;
    project_url: string;
    demo_url: string;
    tags: string;
    created_at: number;
    updated_at: number;
  }>();
  
  if (!row) return null;
  
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]")
  };
}
```

- [ ] **Step 4: 添加 createProject 函数**

```typescript
export async function createProject(
  env: Env,
  data: { title: string; description: string; cover_url: string; project_url: string; demo_url: string; tags: string[] }
): Promise<number> {
  const now = Date.now();
  const res = await env.DB.prepare(
    "INSERT INTO projects (title, description, cover_url, project_url, demo_url, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(data.title, data.description, data.cover_url, data.project_url, data.demo_url, JSON.stringify(data.tags), now, now)
    .run();
  return res.meta.last_row_id;
}
```

- [ ] **Step 5: 添加 updateProject 函数**

```typescript
export async function updateProject(
  env: Env,
  id: number,
  data: { title: string; description: string; cover_url: string; project_url: string; demo_url: string; tags: string[] }
): Promise<boolean> {
  const res = await env.DB.prepare(
    "UPDATE projects SET title = ?, description = ?, cover_url = ?, project_url = ?, demo_url = ?, tags = ?, updated_at = ? WHERE id = ?"
  )
    .bind(data.title, data.description, data.cover_url, data.project_url, data.demo_url, JSON.stringify(data.tags), Date.now(), id)
    .run();
  return res.meta.changes > 0;
}
```

- [ ] **Step 6: 添加 deleteProject 函数**

```typescript
export async function deleteProject(env: Env, id: number): Promise<boolean> {
  const res = await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
  return res.meta.changes > 0;
}
```

---

## Task 3: 实现后端 API

**Files:**
- Modify: `worker/src/routes/public.ts`
- Modify: `worker/src/routes/admin.ts`

**Interfaces:**
- Consumes: `getProjects()`, `getProject()`, `createProject()`, `updateProject()`, `deleteProject()`

- [ ] **Step 1: 添加公开 API**

在 `worker/src/routes/public.ts` 中添加：

```typescript
// 获取作品列表
public.get("/api/projects", async (c) => {
  const projects = await getProjects(c.env);
  return c.json({ projects, total: projects.length });
});

// 获取单个作品
public.get("/api/projects/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const project = await getProject(c.env, id);
  if (!project) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(project);
});
```

- [ ] **Step 2: 添加管理 API**

在 `worker/src/routes/admin.ts` 中添加：

```typescript
// 创建作品
admin.post("/api/projects", async (c) => {
  const body = await c.req.json<{
    title?: string;
    description?: string;
    cover_url?: string;
    project_url?: string;
    demo_url?: string;
    tags?: string[];
  }>();
  
  if (!body.title || !body.title.trim()) {
    return c.json({ error: "title is required" }, 400);
  }
  
  const id = await createProject(c.env, {
    title: body.title.trim(),
    description: body.description?.trim() || "",
    cover_url: body.cover_url?.trim() || "",
    project_url: body.project_url?.trim() || "",
    demo_url: body.demo_url?.trim() || "",
    tags: body.tags || []
  });
  
  return c.json({ id }, 201);
});

// 更新作品
admin.put("/api/projects/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  
  const body = await c.req.json<{
    title?: string;
    description?: string;
    cover_url?: string;
    project_url?: string;
    demo_url?: string;
    tags?: string[];
  }>();
  
  if (!body.title || !body.title.trim()) {
    return c.json({ error: "title is required" }, 400);
  }
  
  const ok = await updateProject(c.env, id, {
    title: body.title.trim(),
    description: body.description?.trim() || "",
    cover_url: body.cover_url?.trim() || "",
    project_url: body.project_url?.trim() || "",
    demo_url: body.demo_url?.trim() || "",
    tags: body.tags || []
  });
  
  if (!ok) {
    return c.json({ error: "Not found" }, 404);
  }
  
  return c.json({ ok: true });
});

// 删除作品
admin.delete("/api/projects/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  
  const ok = await deleteProject(c.env, id);
  if (!ok) {
    return c.json({ error: "Not found" }, 404);
  }
  
  return c.json({ ok: true });
});
```

---

## Task 4: 添加前端类型定义

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `Project`, `ProjectSummary`, API 方法

- [ ] **Step 1: 添加类型定义**

在 `frontend/src/api/types.ts` 中添加：

```typescript
export interface ProjectSummary {
  id: number;
  title: string;
  description: string;
  cover_url: string;
  project_url: string;
  demo_url: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface Project extends ProjectSummary {}
```

- [ ] **Step 2: 添加 API 方法**

在 `frontend/src/api/client.ts` 中添加：

```typescript
async listProjects(): Promise<{ projects: ProjectSummary[]; total: number }> {
  const res = await this.request<{ projects: ProjectSummary[]; total: number }>("/api/projects");
  return res;
}

async getProject(id: number): Promise<Project> {
  return this.request<Project>(`/api/projects/${id}`);
}

async createProject(data: {
  title: string;
  description?: string;
  cover_url?: string;
  project_url?: string;
  demo_url?: string;
  tags?: string[];
}): Promise<{ id: number }> {
  return this.request<{ id: number }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async updateProject(
  id: number,
  data: {
    title: string;
    description?: string;
    cover_url?: string;
    project_url?: string;
    demo_url?: string;
    tags?: string[];
  }
): Promise<{ ok: boolean }> {
  return this.request<{ ok: boolean }>(`/api/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async deleteProject(id: number): Promise<{ ok: boolean }> {
  return this.request<{ ok: boolean }>(`/api/projects/${id}`, {
    method: "DELETE",
  });
}
```

---

## Task 5: 创建作品列表页面

**Files:**
- Create: `frontend/src/views/WorksView.vue`

**Interfaces:**
- Consumes: `client.listProjects()`

- [ ] **Step 1: 创建 WorksView.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { ProjectSummary } from "../api/types";
import WinTextBlock from "../winui/components/WinTextBlock.vue";
import WinContextMenu from "../winui/components/WinContextMenu.vue";

const projects = ref<ProjectSummary[]>([]);

async function loadProjects(): Promise<void> {
  try {
    const data = await client.listProjects();
    projects.value = data.projects;
  } catch {
    projects.value = [];
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

onMounted(() => {
  loadProjects();
});
</script>

<template>
  <div class="works-view">
    <WinContextMenu>
      <div class="projects-grid">
        <div v-for="project in projects" :key="project.id" class="project-card">
          <div class="project-cover">
            <img
              v-if="project.cover_url"
              :src="project.cover_url"
              :alt="project.title"
              class="cover-img"
            />
            <div v-else class="cover-placeholder">
              <span class="cover-icon">&#xE77B;</span>
            </div>
          </div>
          <div class="project-info">
            <WinTextBlock class="project-title" FontSize="16" FontWeight="600" :Text="project.title" />
            <WinTextBlock v-if="project.description" class="project-desc" :Text="project.description" />
            <div class="project-tags">
              <span v-for="tag in project.tags" :key="tag" class="project-tag">{{ tag }}</span>
            </div>
            <div class="project-links">
              <a v-if="project.project_url" :href="project.project_url" target="_blank" class="project-link" title="GitHub">
                <span class="link-icon">&#xE77B;</span>
              </a>
              <a v-if="project.demo_url" :href="project.demo_url" target="_blank" class="project-link" title="Demo">
                <span class="link-icon">&#xE774;</span>
              </a>
            </div>
          </div>
        </div>
        <div v-if="projects.length === 0" class="hint">
          <WinTextBlock :Text="'暂无作品'" />
        </div>
      </div>
    </WinContextMenu>
  </div>
</template>

<style scoped>
.works-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.project-card {
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.15s;
}

.project-card:hover {
  border-color: var(--accent-base);
}

.project-cover {
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: var(--subtle-tertiary);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.cover-icon {
  font-size: 48px;
  color: var(--text-tertiary);
  font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif;
}

.project-info {
  padding: 16px;
}

.project-title {
  margin-bottom: 8px;
  color: var(--text-primary);
  display: block;
}

.project-desc {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 12px;
  display: block;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.project-tag {
  padding: 2px 8px;
  background: var(--subtle-tertiary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.project-links {
  display: flex;
  gap: 8px;
}

.project-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: var(--subtle-tertiary);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.15s;
}

.project-link:hover {
  background: var(--subtle-secondary);
  color: var(--text-primary);
}

.link-icon {
  font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif;
  font-size: 16px;
}

.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px 0;
}
</style>
```

---

## Task 6: 添加路由和导航

**Files:**
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/App.vue`

**Interfaces:**
- Consumes: WorksView.vue

- [ ] **Step 1: 添加路由**

在 `frontend/src/router/index.ts` 中添加：

```typescript
{ path: "/works", name: "works", component: () => import("../views/WorksView.vue") },
```

- [ ] **Step 2: 更新导航菜单**

在 `frontend/src/App.vue` 中更新 `menuItems`：

```typescript
const menuItems = ref([
  { Content: "介绍", Icon: "\uE77B", Tag: "home" },
  { Content: "文章", Icon: "\uE8A5", Tag: "posts" },
  { Content: "作品", Icon: "\uE774", Tag: "works" },
  { Content: "标签", Icon: "\uE8B4", Tag: "tags" },
  { Content: "管理", Icon: "\uE713", Tag: "admin" },
]);
```

- [ ] **Step 3: 更新路由映射**

在 `frontend/src/App.vue` 中更新 `selectedKey` 和 `pathMap`：

```typescript
const selectedKey = computed(() => {
  const p = route.path;
  if (p.startsWith("/post")) return "posts";
  if (p.startsWith("/tags")) return "tags";
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/works")) return "works";
  return "home";
});

const pathMap: Record<string, string> = { home: "/", posts: "/posts", works: "/works", tags: "/tags", admin: "/admin" };
```

- [ ] **Step 4: 更新 headerText**

```typescript
const headerText = computed(() => {
  const map: Record<string, string> = {
    home: "介绍",
    posts: "文章",
    works: "作品",
    tags: "标签",
    admin: "管理",
  };
  return map[selectedKey.value] ?? "介绍";
});
```

---

## Task 7: 添加管理后台功能

**Files:**
- Modify: `frontend/src/views/AdminView.vue`

**Interfaces:**
- Consumes: `client.createProject()`, `client.updateProject()`, `client.deleteProject()`, `client.listProjects()`

- [ ] **Step 1: 添加作品管理界面**

在 `AdminView.vue` 中添加作品管理部分，包括：
- 作品列表显示
- 添加作品表单
- 编辑作品功能
- 删除作品功能

具体实现参考现有的文章管理功能。

---

## Task 8: 测试和部署

**Files:**
- Test: 所有新增功能

**Interfaces:**
- Consumes: 所有 Task 的产出

- [ ] **Step 1: 本地测试**

运行 `npm run dev` 测试所有功能：
- 作品列表页面显示
- 作品详情查看
- 管理后台 CRUD 操作

- [ ] **Step 2: 构建和部署**

```bash
cd frontend && npm run build
cd .. && npx wrangler deploy
```

- [ ] **Step 3: 提交代码**

```bash
git add -A
git commit -m "feat: 添加作品集功能"
git push origin main
```
