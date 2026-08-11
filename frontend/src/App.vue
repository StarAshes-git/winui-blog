<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
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
  padding: 16px;
}
</style>
