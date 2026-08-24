<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { client, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { PagedPosts, SiteInfo, PostDetail, SocialLink, ProjectSummary } from "../api/types";
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
  social_links: [],
});
const footerRecord = ref({ text: "", link: "" });
const socialLinks = ref<SocialLink[]>([]);
const newSocialName = ref("");
const newSocialUrl = ref("");
const postForm = ref({ id: 0, title: "", content: "", tags: "" });
const editing = ref(false);
const posts = ref<PagedPosts>({ posts: [], total: 0 });
const tab = ref<"posts" | "site" | "password" | "projects">("posts");
const oldPassword = ref("");
const newPassword = ref("");
const confirmDialogOpen = ref(false);
const pendingDeleteId = ref(0);
const projects = ref<ProjectSummary[]>([]);
const projectForm = ref({
  id: 0,
  title: "",
  description: "",
  cover_url: "",
  project_url: "",
  demo_url: "",
  tags: "",
  editMode: false,
});
const projectEditing = ref(false);
const pendingDeleteProjectId = ref(0);
const projectConfirmDialogOpen = ref(false);

let unsub: (() => void) | undefined;

onMounted(() => {
  unsub = setupListener();
  if (loggedIn.value) {
    refreshPosts();
    loadSiteForm();
    loadProjects();
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
    loadProjects();
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
    socialLinks.value = site.social_links ?? [];
  } catch {
    siteForm.value = { intro: "", site_name: "", avatar_url: "", footer_record: null, social_links: [] };
    footerRecord.value = { text: "", link: "" };
    socialLinks.value = [];
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
      social_links: socialLinks.value,
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

async function loadProjects(): Promise<void> {
  try {
    const data = await client.listProjects();
    projects.value = data.projects;
  } catch {
    projects.value = [];
  }
}

async function saveProject(): Promise<void> {
  error.value = "";
  const tagsArr = projectForm.value.tags.split(",").map((s) => s.trim());
  try {
    if (projectForm.value.editMode && projectForm.value.id) {
      await client.updateProject(projectForm.value.id, {
        title: projectForm.value.title,
        description: projectForm.value.description,
        cover_url: projectForm.value.cover_url,
        project_url: projectForm.value.project_url,
        demo_url: projectForm.value.demo_url,
        tags: tagsArr,
      });
    } else {
      await client.createProject({
        title: projectForm.value.title,
        description: projectForm.value.description,
        cover_url: projectForm.value.cover_url,
        project_url: projectForm.value.project_url,
        demo_url: projectForm.value.demo_url,
        tags: tagsArr,
      });
    }
    resetProjectForm();
    await loadProjects();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function editProject(project: ProjectSummary): void {
  projectForm.value = {
    id: project.id,
    title: project.title,
    description: project.description,
    cover_url: project.cover_url,
    project_url: project.project_url,
    demo_url: project.demo_url,
    tags: project.tags.join(","),
    editMode: true,
  };
  projectEditing.value = true;
}

function askDeleteProject(id: number): void {
  pendingDeleteProjectId.value = id;
  projectConfirmDialogOpen.value = true;
}

async function confirmDeleteProject(): Promise<void> {
  projectConfirmDialogOpen.value = false;
  try {
    await client.deleteProject(pendingDeleteProjectId.value);
    await loadProjects();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function resetProjectForm(): void {
  projectForm.value = {
    id: 0,
    title: "",
    description: "",
    cover_url: "",
    project_url: "",
    demo_url: "",
    tags: "",
    editMode: false,
  };
  projectEditing.value = false;
}

function newProject(): void {
  resetProjectForm();
  projectEditing.value = true;
}

function addSocialLink(): void {
  if (!newSocialName.value.trim() || !newSocialUrl.value.trim()) return;
  socialLinks.value.push({ name: newSocialName.value.trim(), url: newSocialUrl.value.trim() });
  newSocialName.value = "";
  newSocialUrl.value = "";
}

function removeSocialLink(index: number): void {
  socialLinks.value.splice(index, 1);
}

interface PostSummaryLike {
  id: number;
  title: string;
  tags: string[];
}

const tabItems: { k: "posts" | "site" | "password" | "projects"; l: string }[] = [
  { k: "posts", l: "文章" },
  { k: "projects", l: "作品" },
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

      <section v-if="tab === 'projects'">
        <div class="toolbar">
          <WinButton Content="添加新作品" @Click="newProject" />
        </div>
        <div v-if="projectEditing" class="editor">
          <WinTextBox v-model:Text="projectForm.title" PlaceholderText="作品标题" Header="标题" />
          <WinTextBox
            v-model:Text="projectForm.description"
            PlaceholderText="作品描述"
            Header="描述"
            AcceptsReturn
            TextWrapping="Wrap"
            :MinHeight="100"
          />
          <WinTextBox v-model:Text="projectForm.cover_url" PlaceholderText="封面图片 URL" Header="封面 URL" />
          <WinTextBox v-model:Text="projectForm.project_url" PlaceholderText="项目链接" Header="项目 URL" />
          <WinTextBox v-model:Text="projectForm.demo_url" PlaceholderText="演示链接" Header="演示 URL" />
          <WinTextBox 
            v-model:Text="projectForm.tags" 
            PlaceholderText="标签，用逗号分隔" 
            Header="标签" 
          />
          <div class="row">
            <WinButton Content="取消" @Click="resetProjectForm" />
            <WinButton Content="保存" @Click="saveProject" />
          </div>
        </div>
        <div v-else class="post-list">
          <div v-for="p in projects" :key="p.id" class="post-row">
            <div class="post-row-info">
              <div class="post-row-title">{{ p.title }}</div>
              <div class="post-row-tags">
                <span v-for="t in p.tags" :key="t" class="tag-pill">{{ t }}</span>
              </div>
              <div class="post-row-description" v-if="p.description">{{ p.description }}</div>
            </div>
            <div class="post-row-actions">
              <WinButton Content="编辑" @Click="editProject(p)" />
              <WinButton Content="删除" @Click="askDeleteProject(p.id)" />
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

        <div class="social-links-section">
          <WinTextBlock FontSize="14" FontWeight="600" :Text="'社交链接'" />
          <div v-for="(link, index) in socialLinks" :key="index" class="social-link-row">
            <WinTextBox v-model:Text="link.name" PlaceholderText="名称" Header="" />
            <WinTextBox v-model:Text="link.url" PlaceholderText="URL" Header="" />
            <WinButton Content="删除" @Click="removeSocialLink(index)" />
          </div>
          <div class="add-social-link">
            <WinTextBox v-model:Text="newSocialName" PlaceholderText="名称（如 GitHub）" Header="" />
            <WinTextBox v-model:Text="newSocialUrl" PlaceholderText="URL" Header="" />
            <WinButton Content="添加" @Click="addSocialLink" />
          </div>
        </div>

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

      <WinContentDialog
        v-model:IsOpen="projectConfirmDialogOpen"
        :Title="'确认删除'"
        PrimaryButtonText="删除"
        CloseButtonText="取消"
        @PrimaryButtonClick="confirmDeleteProject"
        @CloseButtonClick="projectConfirmDialogOpen = false"
      >
        <WinTextBlock :Text="'确定要删除这个作品吗？此操作不可恢复。'" />
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
.post-row-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
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

.social-links-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--card-stroke);
}

.social-link-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.social-link-row > :first-child {
  flex: 1;
}

.social-link-row > :nth-child(2) {
  flex: 2;
}

.add-social-link {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.add-social-link > :first-child {
  flex: 1;
}

.add-social-link > :nth-child(2) {
  flex: 2;
}
</style>