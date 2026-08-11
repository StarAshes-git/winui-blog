<script setup lang="ts">
import type { PostSummary } from "../api/types";
import WinTag from "./WinTag.vue";

defineProps<{ post: PostSummary }>();

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
</script>

<template>
  <router-link :to="`/post/${post.id}`" class="post-card card">
    <div class="post-title">{{ post.title }}</div>
    <div class="post-meta">
      <span>{{ formatTime(post.created_at) }}</span>
      <span>·</span>
      <span>{{ post.views }} 阅读</span>
    </div>
    <div class="post-tags">
      <WinTag v-for="t in post.tags" :key="t" :name="t" />
    </div>
  </router-link>
</template>

<style scoped>
.post-card {
  display: block;
  padding: 16px 20px;
  text-decoration: none;
  color: var(--text);
  transition: transform 0.15s, box-shadow 0.15s;
}
.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
.post-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 6px;
}
.post-meta {
  display: flex;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
