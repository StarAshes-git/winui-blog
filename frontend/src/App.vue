<script setup lang="ts">
import NavBar from "./components/NavBar.vue";
</script>

<template>
  <div class="app-shell">
    <NavBar />
    <main class="page-body">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
.page-body {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 16px;
}
</style>
