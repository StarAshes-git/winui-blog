<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { TagCount, PagedPosts } from "../api/types";
import PostCard from "../components/PostCard.vue";
import WinTag from "../components/WinTag.vue";

const tags = ref<TagCount[]>([]);
const selected = ref("");
const posts = ref<PagedPosts>({ posts: [], total: 0 });
const loading = ref(false);

async function loadTags(): Promise<void> {
  try {
    tags.value = await client.getTags();
  } catch {
    tags.value = [];
  }
}

async function loadPosts(): Promise<void> {
  loading.value = true;
  try {
    posts.value = await client.listPosts({ tag: selected.value || undefined, limit: 50 });
  } finally {
    loading.value = false;
  }
}

function pick(name: string): void {
  selected.value = selected.value === name ? "" : name;
  loadPosts();
}

onMounted(() => {
  loadTags();
  loadPosts();
});
</script>

<template>
  <div class="tags-view">
    <section class="tags-bar card">
      <WinTag :name="'全部'" />
      <button class="tag-btn" :class="{ active: selected === '' }" @click="pick('')">全部</button>
      <button
        v-for="t in tags"
        :key="t.name"
        class="tag-btn"
        :class="{ active: selected === t.name }"
        @click="pick(t.name)"
      >
        {{ t.name }} ({{ t.count }})
      </button>
    </section>

    <section class="posts">
      <div v-if="loading" class="hint">加载中…</div>
      <PostCard v-for="p in posts.posts" :key="p.id" :post="p" />
      <div v-if="!loading && posts.posts.length === 0" class="hint">该标签下暂无文章。</div>
    </section>
  </div>
</template>

<style scoped>
.tags-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  align-items: center;
}
.tag-btn {
  border: none;
  background: rgba(128, 128, 128, 0.18);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}
.tag-btn.active {
  background: var(--accent);
  color: #fff;
}
.posts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 32px 0;
}
</style>
