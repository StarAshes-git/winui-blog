<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { PagedPosts, SiteInfo } from "../api/types";
import PostCard from "../components/PostCard.vue";

const site = ref<SiteInfo>({ intro: "" });
const paged = ref<PagedPosts>({ posts: [], total: 0 });
const page = ref(1);
const loading = ref(false);

async function loadSite(): Promise<void> {
  try {
    site.value = await client.getSite();
  } catch {
    site.value = { intro: "" };
  }
}

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
    <section v-if="site.intro" class="intro-card card">
      <div class="intro-title">关于我</div>
      <div class="intro-body">{{ site.intro }}</div>
    </section>

    <section class="posts">
      <div v-if="loading" class="hint">加载中…</div>
      <PostCard v-for="p in paged.posts" :key="p.id" :post="p" />
      <div v-if="!loading && paged.posts.length === 0" class="hint">还没有文章，去后台发布第一篇吧。</div>
    </section>

    <nav v-if="totalPages() > 1" class="pager">
      <button class="btn" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages() }}</span>
      <button class="btn" :disabled="page >= totalPages()" @click="go(page + 1)">下一页</button>
    </nav>
  </div>
</template>

<style scoped>
.intro-card {
  padding: 20px 24px;
  margin-bottom: 16px;
}
.intro-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}
.intro-body {
  white-space: pre-wrap;
  color: var(--text);
  line-height: 1.6;
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
.pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}
.page-info {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
