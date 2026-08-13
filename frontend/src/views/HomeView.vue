<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { PagedPosts, SiteInfo } from "../api/types";
import PostCard from "../components/PostCard.vue";
import WinButton from "../winui/components/WinButton.vue";
import WinProgressRing from "../winui/components/WinProgressRing.vue";
import WinTextBlock from "../winui/components/WinTextBlock.vue";

const site = ref<SiteInfo>({ intro: "", site_name: "", avatar_url: "", footer_record: null });
const avatarFailed = ref(false);
const paged = ref<PagedPosts>({ posts: [], total: 0 });
const page = ref(1);
const loading = ref(false);

async function loadSite(): Promise<void> {
  try {
    site.value = await client.getSite();
    avatarFailed.value = false;
  } catch {
    site.value = { intro: "", site_name: "", avatar_url: "", footer_record: null };
  }
}

const displayName = () => site.value.site_name.trim() || "个人博客";
const avatarInitial = () => displayName().charAt(0);
const showAvatarImage = () => site.value.avatar_url && !avatarFailed.value;

async function loadPosts(): Promise<void> {
  loading.value = true;
  try {
    paged.value = await client.listPosts({ page: page.value, limit: 10 });
  } finally {
    loading.value = false;
  }
}

const totalPages = () => Math.max(1, Math.ceil(paged.value.total / 10));

function go(n: number): void {
  if (n < 1 || n > totalPages()) return;
  page.value = n;
  loadPosts();
}

onMounted(() => {
  loadSite();
  loadPosts();
});
</script>

<template>
  <div class="home">
    <section class="intro-card">
      <div class="profile">
        <div class="avatar">
          <img
            v-if="showAvatarImage()"
            :src="site.avatar_url"
            alt="头像"
            class="avatar-img"
            @error="avatarFailed = true"
          />
          <span v-else class="avatar-fallback">{{ avatarInitial() }}</span>
        </div>
        <WinTextBlock class="profile-name" FontSize="20" FontWeight="600" :Text="displayName()" />
        <WinTextBlock v-if="site.intro" class="intro-body" :Text="site.intro" />
      </div>
    </section>

    <section class="posts">
      <div v-if="loading" class="loading">
        <WinProgressRing IsActive :IsIndeterminate="true" />
        <WinTextBlock class="hint" :Text="'加载中…'" />
      </div>
      <template v-else>
        <PostCard v-for="p in paged.posts" :key="p.id" :post="p" />
        <div v-if="paged.posts.length === 0" class="hint">
          <WinTextBlock :Text="'还没有文章，去后台发布第一篇吧。'" />
        </div>
      </template>
    </section>

    <nav v-if="totalPages() > 1" class="pager">
      <WinButton :Content="'上一页'" :IsEnabled="page > 1" @Click="go(page - 1)" />
      <WinTextBlock class="page-info" :Text="`${page} / ${totalPages()}`" />
      <WinButton :Content="'下一页'" :IsEnabled="page < totalPages()" @Click="go(page + 1)" />
    </nav>
  </div>
</template>

<style scoped>
.intro-card {
  padding: 28px 24px;
  margin-bottom: 20px;
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
}
.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 12px;
  border: 1px solid var(--card-stroke);
  background: var(--subtle-tertiary);
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 36px;
  font-weight: 600;
  color: var(--accent-base);
}
.profile-name {
  margin-bottom: 8px;
  color: var(--text-primary);
  display: block;
}
.intro-body {
  white-space: pre-wrap;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 640px;
  display: block;
}
.posts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
  gap: 12px;
}
.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px 0;
  display: block;
}
.pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  margin-top: 24px;
}
.page-info {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>