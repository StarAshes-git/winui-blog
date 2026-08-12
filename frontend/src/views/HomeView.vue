<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { PagedPosts, SiteInfo } from "../api/types";
import PostCard from "../components/PostCard.vue";
import WinButton from "../winui/components/WinButton.vue";
import WinProgressRing from "../winui/components/WinProgressRing.vue";
import WinTextBlock from "../winui/components/WinTextBlock.vue";

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
    <section v-if="site.intro" class="intro-card">
      <WinTextBlock class="intro-title" FontWeight="600" :Text="'关于我'" />
      <WinTextBlock class="intro-body" :Text="site.intro" />
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
  padding: 22px 24px;
  margin-bottom: 20px;
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
}
.intro-title {
  font-size: 18px;
  margin-bottom: 8px;
  display: block;
}
.intro-body {
  white-space: pre-wrap;
  color: var(--text-secondary);
  line-height: 1.6;
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