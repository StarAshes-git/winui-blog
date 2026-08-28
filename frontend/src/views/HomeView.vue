<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { PagedPosts } from "../api/types";
import PostCard from "../components/PostCard.vue";
import WinButton from "../winui/components/WinButton.vue";
import WinProgressRing from "../winui/components/WinProgressRing.vue";
import WinTextBlock from "../winui/components/WinTextBlock.vue";
import WinContextMenu from "../winui/components/WinContextMenu.vue";
import { useEntranceAnimation } from "../composables/useEntranceAnimation";
import { waitSiteReady } from "../composables/siteReady";

const paged = ref<PagedPosts>({ posts: [], total: 0 });
const page = ref(1);
const loading = ref(false);
const entrance = useEntranceAnimation();

async function loadPosts(): Promise<void> {
  loading.value = true;
  try {
    paged.value = await client.listPosts({ page: page.value, limit: 10 });
    waitSiteReady().then(() => requestAnimationFrame(() => entrance.animateCards()));
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
  loadPosts();
});
</script>

<template>
  <div class="home">
    <WinContextMenu>
      <section class="posts">
        <div v-if="loading" class="loading">
          <WinProgressRing IsActive :IsIndeterminate="true" />
          <WinTextBlock class="hint" :Text="'加载中…'" />
        </div>
        <template v-else>
          <PostCard v-for="p in paged.posts" :key="p.id" :post="p" class="anim-card" />
          <div v-if="paged.posts.length === 0" class="hint">
            <WinTextBlock :Text="'还没有文章，去后台发布第一篇吧。'" />
          </div>
        </template>
      </section>
    </WinContextMenu>

    <nav v-if="totalPages() > 1" class="pager">
      <WinButton :Content="'上一页'" :IsEnabled="page > 1" @Click="go(page - 1)" />
      <WinTextBlock class="page-info" :Text="`${page} / ${totalPages()}`" />
      <WinButton :Content="'下一页'" :IsEnabled="page < totalPages()" @Click="go(page + 1)" />
    </nav>
  </div>
</template>

<style scoped>
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
