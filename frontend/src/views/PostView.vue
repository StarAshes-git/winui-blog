<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { client } from "../api/client";
import type { PostDetail } from "../api/types";
import MarkdownView from "../components/MarkdownView.vue";
import WinContextMenu from "../winui/components/WinContextMenu.vue";
import { useEntranceAnimation } from "../composables/useEntranceAnimation";

const route = useRoute();
const post = ref<PostDetail | null>(null);
const error = ref("");
const entrance = useEntranceAnimation();

const GISCUS_CONFIG = {
  repo: "wyf2012/winui-blog" as `${string}/${string}`,
  repoId: "R_kgDOUBrlUg",
  category: "Announcements",
  categoryId: "DIC_kwDOUBrlUs4DEBZO",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function loadGiscus(): void {
  const existing = document.querySelector("script.giscus-script");
  if (existing) existing.remove();
  const existingIframe = document.querySelector("iframe.giscus-frame");
  if (existingIframe) existingIframe.remove();

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.setAttribute("data-repo", GISCUS_CONFIG.repo);
  script.setAttribute("data-repo-id", GISCUS_CONFIG.repoId);
  script.setAttribute("data-category", GISCUS_CONFIG.category);
  script.setAttribute("data-category-id", GISCUS_CONFIG.categoryId);
  script.setAttribute("data-mapping", "specific");
  script.setAttribute("data-term", `/post/${route.params.id}`);
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", "light");
  script.setAttribute("data-lang", "zh-CN");
  script.setAttribute("crossorigin", "anonymous");
  script.async = true;
  script.classList.add("giscus-script");

  const giscusContainer = document.getElementById("giscus-container");
  if (giscusContainer) {
    giscusContainer.appendChild(script);
  }
}

async function loadPost(): Promise<void> {
  const id = Number(route.params.id);
  if (!Number.isInteger(id)) {
    error.value = "文章不存在";
    return;
  }
  try {
    post.value = await client.getPost(id);
    requestAnimationFrame(() => entrance.animateCards());
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(() => {
  loadPost().then(() => {
    if (post.value) loadGiscus();
  });
});

watch(
  () => route.params.id,
  () => {
    loadPost().then(() => {
      if (post.value) loadGiscus();
    });
  }
);
</script>

<template>
  <article v-if="post" class="post-view anim-card">
    <h1 class="post-title">{{ post.title }}</h1>
    <div class="post-meta">
      <span class="m-icon">&#xE8EF;</span>
      <span>{{ post.views }} 阅读</span>
      <span class="m-dot">·</span>
      <span>{{ formatTime(post.created_at) }}</span>
    </div>
    <div v-if="post.tags.length" class="post-tags">
      <span v-for="t in post.tags" :key="t" class="tag-pill">{{ t }}</span>
    </div>
    <WinContextMenu>
      <MarkdownView :source="post.content" />
    </WinContextMenu>

    <section class="giscus-section">
      <h2 class="comment-title">评论</h2>
      <div id="giscus-container" />
    </section>
  </article>
  <div v-else-if="error" class="hint">{{ error }}</div>
</template>

<style scoped>
.post-view {
  padding: 28px 32px;
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
}

.post-title {
  font-size: 26px;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 14px;
}

.m-icon {
  color: var(--accent-base);
}

.m-dot {
  opacity: 0.5;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}

.tag-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--subtle-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--card-stroke);
}

.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px 0;
}

.giscus-section {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--card-stroke);
}

.comment-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}
</style>
