<script setup lang="ts">
import { watch, ref } from "vue";

const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
  (e: "close", ev: Event): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (open) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  },
  { immediate: true }
);
</script>

<template>
  <dialog ref="dialogRef" class="win-dialog" @cancel="$emit('cancel')" @close="$emit('close', $event)">
    <div class="win-dialog-title">{{ title }}</div>
    <div class="win-dialog-body"><slot /></div>
    <div class="win-dialog-actions">
      <button class="btn" @click="emit('cancel')">取消</button>
      <button class="btn primary" @click="emit('confirm')">确定</button>
    </div>
  </dialog>
</template>

<style scoped>
.win-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 24px;
  background: var(--card-bg);
  color: var(--text);
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow);
  min-width: 320px;
}
.win-dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}
.win-dialog-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}
.win-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
