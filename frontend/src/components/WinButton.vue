<script setup lang="ts">
const emit = defineEmits<{ (e: "click", ev: MouseEvent): void }>();

withDefaults(
  defineProps<{ variant?: "default" | "primary" | "danger"; disabled?: boolean }>(),
  { variant: "default", disabled: false }
);
</script>

<template>
  <button class="btn" :class="variant" :disabled="disabled" @click="emit('click', $event)">
    <slot />
  </button>
</template>
