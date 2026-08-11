<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: "default" | "primary" | "danger"; disabled?: boolean }>(),
  { variant: "default", disabled: false }
);
</script>

<template>
  <button class="btn" :class="variant" :disabled="disabled" @click="$emit('click', $event)">
    <slot />
  </button>
</template>
