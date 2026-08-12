<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { client } from "../api/client";
import type { PostDetail } from "../api/types";
import MarkdownView from "../components/MarkdownView.vue";

const route = useRoute();
const post = ref<PostDetail | null>(null);
const error = ref("");

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(async () => {
  const id = Number(route.params.id);
  if (!Number.isInteger(id)) {
    error.value = "文章不存在";
    return;
  }
  try {
    post.value = await client.getPost(id);
  } catch (e) {
    error.value = (e as Error).message;
  }
});
</script>

<template>
  <article v-if="post" class="post-view">
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
    <MarkdownView :source="post.content" />
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
</style>