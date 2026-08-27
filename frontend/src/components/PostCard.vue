<script setup lang="ts">
import type { PostSummary } from "../api/types";

defineProps<{ post: PostSummary }>();

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
</script>

<template>
  <router-link :to="`/post/${post.id}`" class="post-card">
    <div class="post-title">{{ post.title }}</div>
    <div class="post-meta">
      <span class="m-views">&#xE8EF;</span>
      <span>{{ post.views }} 阅读</span>
      <span class="m-dot">·</span>
      <span>{{ formatTime(post.created_at) }}</span>
    </div>
    <div v-if="post.tags.length" class="post-tags">
      <span v-for="t in post.tags" :key="t" class="tag-pill">{{ t }}</span>
    </div>
  </router-link>
</template>

<style scoped>
.post-card {
  display: block;
  padding: 18px 22px;
  text-decoration: none;
  color: var(--text-primary);
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.2s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.post-card:hover {
  background: var(--subtle-tertiary);
  border-color: var(--accent-base);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}
.post-card:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
}
.post-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}
.post-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 10px;
}
.m-views {
  color: var(--accent-base);
}
.m-dot {
  opacity: 0.5;
}
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
</style>
