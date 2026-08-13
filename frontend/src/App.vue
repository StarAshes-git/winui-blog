<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { client } from "./api/client";
import WinNavigationView from "./winui/components/WinNavigationView.vue";
import WinThemeWrapper from "./winui/components/WinThemeWrapper.vue";

const route = useRoute();
const router = useRouter();

const theme = ref<"light" | "dark">("light");

function applyTheme() {
  const html = document.documentElement;
  html.classList.remove("theme-light", "theme-dark");
  html.classList.add(`theme-${theme.value}`);
}

function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
  applyTheme();
}

onMounted(() => {
  loadPaneTitle();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  theme.value = prefersDark ? "dark" : "light";
  applyTheme();
});

watch(
  () => route.path,
  () => {
    loadPaneTitle();
  }
);

const selectedKey = computed(() => {
  const p = route.path;
  if (p.startsWith("/post")) return "posts";
  if (p.startsWith("/tags")) return "tags";
  if (p.startsWith("/admin")) return "admin";
  return "home";
});

const menuItems = ref([
  { Content: "首页", Icon: "\uE80F", Tag: "home" },
  { Content: "标签", Icon: "\uE8A5", Tag: "tags" },
  { Content: "管理", Icon: "\uE713", Tag: "admin" },
]);

const paneTitle = ref("个人博客");

async function loadPaneTitle(): Promise<void> {
  try {
    const site = await client.getSite();
    paneTitle.value = site.site_name.trim() || "个人博客";
  } catch {
    /* 保持默认标题 */
  }
}

const footerMenuItems = computed(() => [
  {
    Content: theme.value === "light" ? "深色" : "浅色",
    Icon: theme.value === "light" ? "\uE706" : "\uE708",
    Tag: "theme",
  },
]);

const headerText = computed(() => {
  const map: Record<string, string> = {
    home: "博客",
    posts: "文章",
    tags: "标签",
    admin: "管理",
  };
  return map[selectedKey.value] ?? "博客";
});

const canGoBack = computed(() => window.history.length > 1 && route.path !== "/");

const isPaneOpen = ref(false);

function onBackRequested(): void {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

function onItemInvoked(e: { InvokedItem: unknown; IsSettingsInvoked: boolean; InvokedItemContainer: { Tag?: unknown } }) {
  const tag = e.InvokedItemContainer?.Tag;
  if (tag === "theme") {
    toggleTheme();
    return;
  }
  const pathMap: Record<string, string> = { home: "/", tags: "/tags", admin: "/admin", posts: "/" };
  if (tag && pathMap[String(tag)]) {
    router.push(pathMap[String(tag)]);
  }
}
</script>

<template>
  <WinThemeWrapper :theme="theme">
    <WinNavigationView
      PaneDisplayMode="LeftCompact"
      v-model:IsPaneOpen="isPaneOpen"
      ExpandOnHover
      :MenuItems="menuItems"
      :FooterMenuItems="footerMenuItems"
      :SelectedItem="selectedKey"
      :PaneTitle="paneTitle"
      :Header="headerText"
      :IsSettingsVisible="false"
      :IsBackEnabled="canGoBack"
      @BackRequested="onBackRequested"
      @ItemInvoked="onItemInvoked"
      class="app-nav"
    >
      <main class="app-content">
        <router-view />
      </main>
    </WinNavigationView>
  </WinThemeWrapper>
</template>

<style scoped>
.app-nav {
  min-height: 100vh;
}
.app-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 20px 60px;
}
</style>
