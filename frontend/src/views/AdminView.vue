<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { client, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { PagedPosts, SiteInfo, PostDetail } from "../api/types";
import WinButton from "../components/WinButton.vue";
import WinDialog from "../components/WinDialog.vue";
import WinInput from "../components/WinInput.vue";
import WinTag from "../components/WinTag.vue";

const loggedIn = ref(!!getToken());
const password = ref("");
const error = ref("");
const siteForm = ref<SiteInfo>({ intro: "" });
const postForm = ref({ id: 0, title: "", content: "", tags: "" });
const editing = ref(false);
const posts = ref<PagedPosts>({ posts: [], total: 0 });
const tab = ref<"posts" | "site" | "password">("posts");
const oldPassword = ref("");
const newPassword = ref("");
const confirmDialogOpen = ref(false);
const pendingDeleteId = ref(0);

let unsub: (() => void) | undefined;

onMounted(() => {
  unsub = setupListener();
  if (loggedIn.value) {
    refreshPosts();
    loadSiteForm();
  }
});

onUnmounted(() => unsub?.());

function setupListener() {
  setUnauthorizedHandler(() => {
    loggedIn.value = false;
  });
  return () => setUnauthorizedHandler(() => {});
}

async function doLogin(): Promise<void> {
  error.value = "";
  try {
    const { token } = await client.login(password.value);
    setToken(token);
    loggedIn.value = true;
    password.value = "";
    refreshPosts();
    loadSiteForm();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function doLogout(): Promise<void> {
  try {
    await client.logout();
  } finally {
    setToken(null);
    loggedIn.value = false;
  }
}

async function loadSiteForm(): Promise<void> {
  try {
    siteForm.value = await client.getSite();
  } catch {
    siteForm.value = { intro: "" };
  }
}

async function saveSite(): Promise<void> {
  error.value = "";
  try {
    await client.updateSite(siteForm.value.intro);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function refreshPosts(): Promise<void> {
  try {
    posts.value = await client.listPosts({ limit: 50 });
  } catch {
    posts.value = { posts: [], total: 0 };
  }
}

function newPost(): void {
  postForm.value = { id: 0, title: "", content: "", tags: "" };
  editing.value = true;
}

function editPost(p: PostSummaryLike): void {
  postForm.value = { id: p.id, title: p.title, content: "", tags: p.tags.join(",") };
  editing.value = true;
  loadContent(p.id);
}

async function loadContent(id: number): Promise<void> {
  try {
    const detail = (await client.getPost(id)) as PostDetail;
    postForm.value = {
      id,
      title: detail.title,
      content: detail.content,
      tags: detail.tags.join(","),
    };
  } catch {
    /* 忽略加载失败，保持空 content */
  }
}

async function savePost(): Promise<void> {
  error.value = "";
  const tagsArr = postForm.value.tags.split(",").map((s) => s.trim());
  try {
    if (postForm.value.id) {
      await client.updatePost(postForm.value.id, {
        title: postForm.value.title,
        content: postForm.value.content,
        tags: tagsArr,
      });
    } else {
      await client.createPost({
        title: postForm.value.title,
        content: postForm.value.content,
        tags: tagsArr,
      });
    }
    editing.value = false;
    refreshPosts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function askDelete(p: PostSummaryLike): void {
  pendingDeleteId.value = p.id;
  confirmDialogOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  confirmDialogOpen.value = false;
  try {
    await client.deletePost(pendingDeleteId.value);
    refreshPosts();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function changePasswordSubmit(): Promise<void> {
  error.value = "";
  try {
    await client.changePassword(oldPassword.value, newPassword.value);
    oldPassword.value = "";
    newPassword.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  }
}

interface PostSummaryLike {
  id: number;
  title: string;
  tags: string[];
}
</script>

<template>
  <div class="admin">
    <div v-if="!loggedIn" class="login-card card">
      <h1 class="admin-title">管理后台</h1>
      <WinInput v-model="password" type="password" placeholder="输入密码" @keyup.enter="doLogin" />
      <WinButton variant="primary" class="login-btn" @click="doLogin">登录</WinButton>
      <div v-if="error" class="err">{{ error }}</div>
    </div>

    <div v-else class="admin-main">
      <header class="admin-header">
        <span class="admin-title">内容管理</span>
        <WinButton @click="doLogout">退出登录</WinButton>
      </header>

      <nav class="tabs">
        <button class="tab" :class="{ active: tab === 'posts' }" @click="tab = 'posts'">文章</button>
        <button class="tab" :class="{ active: tab === 'site' }" @click="tab = 'site'">自我介绍</button>
        <button class="tab" :class="{ active: tab === 'password' }" @click="tab = 'password'">修改密码</button>
      </nav>

      <section v-if="tab === 'posts'">
        <div class="toolbar">
          <WinButton variant="primary" @click="newPost">发布新文章</WinButton>
        </div>
        <div v-if="editing" class="editor card">
          <WinInput v-model="postForm.title" placeholder="文章标题" />
          <WinInput v-model="postForm.content" type="textarea" placeholder="Markdown 内容" />
          <WinInput v-model="postForm.tags" placeholder="标签，用逗号分隔" />
          <div class="editor-actions">
            <WinButton @click="editing = false">取消</WinButton>
            <WinButton variant="primary" @click="savePost">保存</WinButton>
          </div>
        </div>
        <div v-else class="post-list">
          <div v-for="p in posts.posts" :key="p.id" class="post-row card">
            <div class="post-row-info">
              <div class="post-row-title">{{ p.title }}</div>
              <div class="post-row-tags">
                <WinTag v-for="t in p.tags" :key="t" :name="t" />
              </div>
            </div>
            <div class="post-row-actions">
              <WinButton @click="editPost(p)">编辑</WinButton>
              <WinButton variant="danger" @click="askDelete(p)">删除</WinButton>
            </div>
          </div>
        </div>
      </section>

      <section v-if="tab === 'site'" class="editor card">
        <WinInput v-model="siteForm.intro" type="textarea" placeholder="自我介绍内容" />
        <WinButton variant="primary" @click="saveSite">保存自我介绍</WinButton>
      </section>

      <section v-if="tab === 'password'" class="editor card">
        <WinInput v-model="oldPassword" type="password" placeholder="旧密码" />
        <WinInput v-model="newPassword" type="password" placeholder="新密码（至少 6 位）" />
        <WinButton variant="primary" @click="changePasswordSubmit">修改密码</WinButton>
      </section>

      <div v-if="error" class="err">{{ error }}</div>

      <WinDialog
        :open="confirmDialogOpen"
        title="确认删除"
        @confirm="confirmDelete"
        @cancel="confirmDialogOpen = false"
      >
        确定要删除这篇文章吗？此操作不可恢复。
      </WinDialog>
    </div>
  </div>
</template>

<style scoped>
.login-card,
.editor {
  max-width: 640px;
  margin: 0 auto;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.admin-title {
  font-size: 22px;
}
.login-btn {
  align-self: flex-start;
}
.err {
  color: #e33030;
  font-size: 13px;
}
.admin-main {
  max-width: 820px;
  margin: 0 auto;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tab {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 6px 14px;
  border-radius: var(--radius);
  cursor: pointer;
}
.tab.active {
  background: var(--card-bg);
  color: var(--accent);
  box-shadow: var(--shadow);
}
.toolbar {
  margin-bottom: 12px;
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.post-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.post-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}
.post-row-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.post-row-tags {
  display: flex;
  gap: 6px;
}
.post-row-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
