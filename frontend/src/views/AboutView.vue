<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { SiteInfo, PostSummary } from "../api/types";
import PostCard from "../components/PostCard.vue";
import WinTextBlock from "../winui/components/WinTextBlock.vue";
import WinContextMenu from "../winui/components/WinContextMenu.vue";

const site = ref<SiteInfo>({ intro: "", site_name: "", avatar_url: "", footer_record: null, social_links: [] });
const avatarFailed = ref(false);
const recentPosts = ref<PostSummary[]>([]);

async function loadSite(): Promise<void> {
  try {
    site.value = await client.getSite();
    avatarFailed.value = false;
  } catch {
    site.value = { intro: "", site_name: "", avatar_url: "", footer_record: null, social_links: [] };
  }
}

async function loadRecentPosts(): Promise<void> {
  try {
    const data = await client.listPosts({ page: 1, limit: 5 });
    recentPosts.value = data.posts;
  } catch {
    recentPosts.value = [];
  }
}

const displayName = () => site.value.site_name.trim() || "个人博客";
const avatarInitial = () => displayName().charAt(0);
const showAvatarImage = () => site.value.avatar_url && !avatarFailed.value;

const socialIcons: Record<string, string> = {
  github: "\uE77B",
  bilibili: "\uE71A",
  twitter: "\uE72E",
  email: "\uE715",
  default: "\uE774",
};

function getSocialIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(socialIcons)) {
    if (lower.includes(key)) return icon;
  }
  return socialIcons.default;
}

onMounted(() => {
  loadSite();
  loadRecentPosts();
});
</script>

<template>
  <div class="about-view">
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

      <div v-if="site.social_links.length" class="social-links">
        <a
          v-for="link in site.social_links"
          :key="link.name"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="social-link"
          :title="link.name"
        >
          <span class="social-name">{{ link.name }}</span>
        </a>
      </div>
    </section>

    <section class="recent-posts">
      <h2 class="section-title">最近文章</h2>
      <WinContextMenu>
        <div class="posts-list">
          <PostCard v-for="p in recentPosts" :key="p.id" :post="p" />
          <div v-if="recentPosts.length === 0" class="hint">
            <WinTextBlock :Text="'暂无文章'" />
          </div>
        </div>
      </WinContextMenu>
    </section>
  </div>
</template>

<style scoped>
.about-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.intro-card {
  padding: 28px 24px;
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
  transition:
    transform 0.2s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.intro-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10);
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

.social-links {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--card-stroke);
}

.social-link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  background: var(--subtle-tertiary);
  border: 1px solid var(--card-stroke);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  transition: all 0.15s ease;
}

.social-link:hover {
  background: var(--subtle-secondary);
  color: var(--text-primary);
  border-color: var(--accent-base);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}

.social-link .m-icon {
  font-size: 14px;
  font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif;
}

.social-name {
  font-weight: 500;
}

.recent-posts {
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
  padding: 20px 24px;
  transition:
    transform 0.2s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.recent-posts:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.posts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px 0;
}
</style>
