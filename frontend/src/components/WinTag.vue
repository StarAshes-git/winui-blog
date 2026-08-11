<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<template>
  <span class="tag-pill">{{ name }}</span>
</template>
