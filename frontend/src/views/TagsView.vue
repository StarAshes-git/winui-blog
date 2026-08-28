<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { TagCount, PagedPosts } from "../api/types";
import PostCard from "../components/PostCard.vue";
import WinProgressRing from "../winui/components/WinProgressRing.vue";
import WinTextBlock from "../winui/components/WinTextBlock.vue";
import WinContextMenu from "../winui/components/WinContextMenu.vue";
import { useEntranceAnimation } from "../composables/useEntranceAnimation";

const tags = ref<TagCount[]>([]);
const selected = ref("");
const posts = ref<PagedPosts>({ posts: [], total: 0 });
const loading = ref(false);
const entrance = useEntranceAnimation();

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
    requestAnimationFrame(() => entrance.animateCards());
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
    <WinContextMenu>
      <section class="tags-bar">
      <button class="tag-btn" :class="{ active: selected === '' }" @click="pick('')">
        全部
      </button>
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
    </WinContextMenu>

    <WinContextMenu>
      <section class="posts">
      <div v-if="loading" class="loading">
        <WinProgressRing IsActive :IsIndeterminate="true" />
        <WinTextBlock class="hint" :Text="'加载中…'" />
      </div>
      <template v-else>
        <PostCard v-for="p in posts.posts" :key="p.id" :post="p" class="anim-card" />
        <div v-if="posts.posts.length === 0" class="hint">
          <WinTextBlock :Text="'该标签下暂无文章。'" />
        </div>
      </template>
      </section>
    </WinContextMenu>
  </div>
</template>

<style scoped>
.tags-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px 18px;
  margin-bottom: 18px;
  align-items: center;
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
}
.tag-btn {
  border: 1px solid var(--card-stroke);
  background: var(--subtle-tertiary);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s,
    transform 0.15s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.15s;
}
.tag-btn:hover {
  background: var(--subtle-secondary);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}
.tag-btn.active {
  background: var(--accent-base);
  border-color: var(--accent-base);
  color: #fff;
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
  padding: 32px 0;
  display: block;
}
</style>