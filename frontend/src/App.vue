<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { client } from "./api/client";
import WinNavigationView from "./winui/components/WinNavigationView.vue";
import WinThemeWrapper from "./winui/components/WinThemeWrapper.vue";
import WinContextMenu from "./winui/components/WinContextMenu.vue";
import { useEntranceAnimation } from "./composables/useEntranceAnimation";

const route = useRoute();
const router = useRouter();

const theme = ref<"light" | "dark">("light");

function preloadImage(url: string): void {
  const img = new Image();
  img.src = url;
}

function applyTheme() {
  const html = document.documentElement;
  html.classList.remove("theme-light", "theme-dark");
  html.classList.add(`theme-${theme.value}`);
}

function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
  applyTheme();
}

const entrance = useEntranceAnimation();

onMounted(async () => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  theme.value = prefersDark ? "dark" : "light";
  applyTheme();
  loadSiteInfo();
  await router.isReady();
  requestAnimationFrame(() => {
    entrance.animateSidebar();
  });
});

watch(
  () => route.path,
  () => {
    loadSiteInfo();
    requestAnimationFrame(() => {
      entrance.animateCards(document);
    });
  }
);

const selectedKey = computed(() => {
  const p = route.path;
  if (p.startsWith("/post")) return "posts";
  if (p.startsWith("/tags")) return "tags";
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/works")) return "works";
  return "home";
});

const menuItems = ref([
  { Content: "介绍", Icon: "\uE77B", Tag: "home" },
  { Content: "文章", Icon: "\uE8A5", Tag: "posts" },
  { Content: "作品", Icon: "\uE774", Tag: "works" },
  { Content: "标签", Icon: "\uE8B4", Tag: "tags" },
  { Content: "管理", Icon: "\uE713", Tag: "admin" },
]);

const paneTitle = ref("个人博客");

const footerRecord = ref<{ text: string; link: string } | null>(null);

async function loadSiteInfo(): Promise<void> {
  try {
    const site = await client.getSite();
    const title = site.site_name.trim() || "个人博客";
    paneTitle.value = title;
    document.title = title;
    footerRecord.value = site.footer_record?.text ? site.footer_record : null;
    if (site.background_url) {
      preloadImage(site.background_url);
      document.documentElement.classList.add("has-user-bg");
      document.documentElement.style.setProperty("--user-bg", `url(${site.background_url})`);
      document.documentElement.style.setProperty("--user-bg-size", "cover");
      document.documentElement.style.setProperty("--user-bg-position", "center");
      document.documentElement.style.setProperty("--user-bg-attachment", "fixed");
    } else {
      document.documentElement.classList.remove("has-user-bg");
    }
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
    home: "介绍",
    posts: "文章",
    works: "作品",
    tags: "标签",
    admin: "管理",
  };
  return map[selectedKey.value] ?? "介绍";
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
  const pathMap: Record<string, string> = { home: "/", posts: "/posts", works: "/works", tags: "/tags", admin: "/admin" };
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
        <Transition name="page" mode="out-in">
          <router-view :key="route.path" />
        </Transition>
        <WinContextMenu>
          <footer v-if="footerRecord" class="app-footer">
          <a
            v-if="footerRecord.link"
            :href="footerRecord.link"
            target="_blank"
            rel="noopener noreferrer"
          >{{ footerRecord.text }}</a>
          <span v-else>{{ footerRecord.text }}</span>
          </footer>
        </WinContextMenu>
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
.app-footer {
  margin-top: 48px;
  padding-top: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  border-top: 1px solid var(--card-stroke);
}
.app-footer a {
  color: inherit;
  text-decoration: none;
}
.app-footer a:hover {
  color: var(--accent-base);
}
.page-enter-active {
  transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.page-leave-active {
  transition: opacity 0.16s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
