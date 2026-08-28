<script setup lang="ts">
import { ref, onMounted } from "vue";
import { client } from "../api/client";
import type { ProjectSummary } from "../api/types";
import WinTextBlock from "../winui/components/WinTextBlock.vue";
import WinContextMenu from "../winui/components/WinContextMenu.vue";
import { useEntranceAnimation } from "../composables/useEntranceAnimation";

const projects = ref<ProjectSummary[]>([]);
const entrance = useEntranceAnimation();

async function loadProjects(): Promise<void> {
  try {
    const data = await client.listProjects();
    projects.value = data.projects;
    requestAnimationFrame(() => entrance.animateCards());
  } catch {
    projects.value = [];
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

onMounted(() => {
  loadProjects();
});
</script>

<template>
  <div class="works-view">
    <WinContextMenu>
      <div class="projects-grid">
        <div v-for="project in projects" :key="project.id" class="project-card anim-card">
          <div class="project-cover">
            <img
              v-if="project.cover_url"
              :src="project.cover_url"
              :alt="project.title"
              class="cover-img"
            />
            <div v-else class="cover-placeholder">
              <span class="cover-icon">&#xE77B;</span>
            </div>
          </div>
          <div class="project-info">
            <WinTextBlock class="project-title" FontSize="16" FontWeight="600" :Text="project.title" />
            <WinTextBlock v-if="project.description" class="project-desc" :Text="project.description" />
            <div class="project-tags">
              <span v-for="tag in project.tags" :key="tag" class="project-tag">{{ tag }}</span>
            </div>
            <div class="project-links">
              <a v-if="project.project_url" :href="project.project_url" target="_blank" class="project-link" title="GitHub">
                <span class="link-icon">&#xE77B;</span>
              </a>
              <a v-if="project.demo_url" :href="project.demo_url" target="_blank" class="project-link" title="Demo">
                <span class="link-icon">&#xE774;</span>
              </a>
            </div>
          </div>
        </div>
        <div v-if="projects.length === 0" class="hint">
          <WinTextBlock :Text="'暂无作品'" />
        </div>
      </div>
    </WinContextMenu>
  </div>
</template>

<style scoped>
.works-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.project-card {
  background: var(--subtle-secondary);
  border: 1px solid var(--card-stroke);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.project-card:hover {
  border-color: var(--accent-base);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

.project-card:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
}

.project-cover {
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: var(--subtle-tertiary);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.cover-icon {
  font-size: 48px;
  color: var(--text-tertiary);
  font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif;
}

.project-info {
  padding: 16px;
}

.project-title {
  margin-bottom: 8px;
  color: var(--text-primary);
  display: block;
}

.project-desc {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 12px;
  display: block;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.project-tag {
  padding: 2px 8px;
  background: var(--subtle-tertiary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.project-links {
  display: flex;
  gap: 8px;
}

.project-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: var(--subtle-tertiary);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.15s;
}

.project-link:hover {
  background: var(--subtle-secondary);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}

.link-icon {
  font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif;
  font-size: 16px;
}

.hint {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px 0;
}
</style>