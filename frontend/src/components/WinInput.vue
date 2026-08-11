<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    type?: "text" | "password" | "textarea";
    placeholder?: string;
    rows?: number;
  }>(),
  { type: "text", placeholder: "", rows: 6 }
);

const emit = defineEmits<{ (e: "update:modelValue", v: string): void }>();

function onInput(e: Event): void {
  emit("update:modelValue", (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

const isTextarea = computed(() => props.type === "textarea");
</script>

<template>
  <textarea
    v-if="isTextarea"
    class="input"
    :rows="rows"
    :placeholder="placeholder"
    :value="modelValue"
    @input="onInput"
  />
  <input
    v-else
    class="input"
    :type="type"
    :placeholder="placeholder"
    :value="modelValue"
    @input="onInput"
  />
</template>
