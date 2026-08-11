<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { client } from "../api/client";
import type { PostDetail } from "../api/types";
import MarkdownView from "../components/MarkdownView.vue";
import WinTag from "../components/WinTag.vue";

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
  <article v-if="post" class="post-view card">
    <h1 class="post-title">{{ post.title }}</h1>
    <div class="post-meta">
      <span>{{ formatTime(post.created_at) }}</span>
      <span>·</span>
      <span>{{ post.views }} 阅读</span>
    </div>
    <div class="post-tags">
      <WinTag v-for="t in post.tags" :key="t" :name="t" />
    </div>
    <MarkdownView :source="post.content" />
  </article>
  <div v-else-if="error" class="hint">{{ error }}</div>
</template>

<style scoped>
.post-view {
  padding: 28px 32px;
}
.post-title {
  font-size: 26px;
  margin-bottom: 10px;
}
.post-meta {
  display: flex;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}
.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px 0;
}
</style>
