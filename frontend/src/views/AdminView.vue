<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { client, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { PagedPosts, SiteInfo, PostDetail } from "../api/types";
import WinButton from "../winui/components/WinButton.vue";
import WinTextBox from "../winui/components/WinTextBox.vue";
import WinPasswordBox from "../winui/components/WinPasswordBox.vue";
import WinContentDialog from "../winui/components/WinContentDialog.vue";
import WinTextBlock from "../winui/components/WinTextBlock.vue";

const loggedIn = ref(!!getToken());
const password = ref("");
const error = ref("");
const siteForm = ref<SiteInfo>({
  intro: "",
  site_name: "",
  avatar_url: "",
  footer_record: { text: "", link: "" },
});
const footerRecord = ref({ text: "", link: "" });
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
    const site = await client.getSite();
    siteForm.value = site;
    footerRecord.value = site.footer_record ?? { text: "", link: "" };
  } catch {
    siteForm.value = { intro: "", site_name: "", avatar_url: "", footer_record: null };
    footerRecord.value = { text: "", link: "" };
  }
}

async function saveSite(): Promise<void> {
  error.value = "";
  const link = footerRecord.value.link;
  if (link && !/^https?:\/\//.test(link)) {
    error.value = "备案链接必须以 http:// 或 https:// 开头";
    return;
  }
  try {
    await client.updateSite({
      intro: siteForm.value.intro,
      site_name: siteForm.value.site_name,
      avatar_url: siteForm.value.avatar_url,
      footer_record: footerRecord.value.text
        ? { text: footerRecord.value.text, link }
        : null,
    });
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

const tabItems: { k: "posts" | "site" | "password"; l: string }[] = [
  { k: "posts", l: "文章" },
  { k: "site", l: "自我介绍" },
  { k: "password", l: "修改密码" },
];
</script>

<template>
  <div class="admin">
    <div v-if="!loggedIn" class="login-card">
      <WinTextBlock class="admin-title" FontSize="22" FontWeight="600" :Text="'管理后台'" />
      <WinPasswordBox
        v-model:Password="password"
        PlaceholderText="输入密码"
        :IsEnabled="true"
      />
      <div class="row">
        <WinButton Content="登录" @Click="doLogin" />
      </div>
      <div v-if="error" class="err">{{ error }}</div>
    </div>

    <div v-else class="admin-main">
      <header class="admin-header">
        <WinTextBlock class="admin-title" FontSize="20" FontWeight="600" :Text="'内容管理'" />
        <WinButton Content="退出登录" @Click="doLogout" />
      </header>

      <nav class="tabs">
        <button
          v-for="t in tabItems"
          :key="t.k"
          class="tab"
          :class="{ active: tab === t.k }"
          @click="tab = t.k"
        >
          {{ t.l }}
        </button>
      </nav>

      <section v-if="tab === 'posts'">
        <div class="toolbar">
          <WinButton Content="发布新文章" @Click="newPost" />
        </div>
        <div v-if="editing" class="editor">
          <WinTextBox v-model:Text="postForm.title" PlaceholderText="文章标题" Header="标题" />
          <WinTextBox
            v-model:Text="postForm.content"
            PlaceholderText="Markdown 内容"
            Header="内容"
            AcceptsReturn
            TextWrapping="Wrap"
            :MinHeight="200"
          />
          <WinTextBox v-model:Text="postForm.tags" PlaceholderText="标签，用逗号分隔" Header="标签" />
          <div class="row">
            <WinButton Content="取消" @Click="editing = false" />
            <WinButton Content="保存" @Click="savePost" />
          </div>
        </div>
        <div v-else class="post-list">
          <div v-for="p in posts.posts" :key="p.id" class="post-row">
            <div class="post-row-info">
              <div class="post-row-title">{{ p.title }}</div>
              <div class="post-row-tags">
                <span v-for="t in p.tags" :key="t" class="tag-pill">{{ t }}</span>
              </div>
            </div>
            <div class="post-row-actions">
              <WinButton Content="编辑" @Click="editPost(p)" />
              <WinButton Content="删除" @Click="askDelete(p)" />
            </div>
          </div>
        </div>
      </section>

      <section v-if="tab === 'site'" class="editor">
        <WinTextBox
          v-model:Text="footerRecord.text"
          PlaceholderText="如：京ICP备12345678号"
          Header="备案号"
        />
        <WinTextBox
          v-model:Text="footerRecord.link"
          PlaceholderText="如：https://beian.miit.gov.cn/"
          Header="备案链接"
        />
        <WinTextBox
          v-model:Text="siteForm.site_name"
          PlaceholderText="网站名称"
          Header="名称"
        />
        <WinTextBox
          v-model:Text="siteForm.avatar_url"
          PlaceholderText="头像图片 URL"
          Header="头像 URL"
        />
        <WinTextBox
          v-model:Text="siteForm.intro"
          PlaceholderText="自我介绍内容"
          Header="自我介绍"
          AcceptsReturn
          TextWrapping="Wrap"
          :MinHeight="160"
        />
        <div class="row">
          <WinButton Content="保存自我介绍" @Click="saveSite" />
        </div>
      </section>

      <section v-if="tab === 'password'" class="editor">
        <WinPasswordBox v-model:Password="oldPassword" PlaceholderText="旧密码" Header="旧密码" />
        <WinPasswordBox
          v-model:Password="newPassword"
          PlaceholderText="新密码（至少 6 位）"
          Header="新密码"
        />
        <div class="row">
          <WinButton Content="修改密码" @Click="changePasswordSubmit" />
        </div>
      </section>

      <div v-if="error" class="err">{{ error }}</div>

      <WinContentDialog
        v-model:IsOpen="confirmDialogOpen"
        :Title="'确认删除'"
        PrimaryButtonText="删除"
        CloseButtonText="取消"
        @PrimaryButtonClick="confirmDelete"
        @CloseButtonClick="confirmDialogOpen = false"
      >
        <WinTextBlock :Text="'确定要删除这篇文章吗？此操作不可恢复。'" />
      </WinContentDialog>
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
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
}
.admin-title {
  display: block;
}
.row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
  border-radius: 8px;
  cursor: pointer;
}
.tab.active {
  background: var(--accent-base);
  color: #fff;
}
.toolbar {
  margin-bottom: 12px;
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
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
}
.post-row-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
}
.post-row-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag-pill {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--subtle-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--card-stroke);
}
.post-row-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>