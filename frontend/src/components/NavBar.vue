<script setup lang="ts">
</script>

<template>
  <nav class="navbar">
    <router-link to="/" class="nav-title">博客</router-link>
    <div class="nav-links">
      <router-link to="/" class="nav-link">首页</router-link>
      <router-link to="/tags" class="nav-link">标签</router-link>
      <router-link to="/admin" class="nav-link">管理</router-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--nav-height);
  padding: 0 16px;
  background: rgba(128, 128, 128, 0.2);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}
.nav-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--text);
  text-decoration: none;
}
.nav-links {
  display: flex;
  gap: 12px;
}
.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: var(--radius);
}
.nav-link:hover {
  background: rgba(128, 128, 128, 0.24);
  color: var(--text);
}
.nav-link.router-link-active {
  color: var(--accent);
}
</style>
