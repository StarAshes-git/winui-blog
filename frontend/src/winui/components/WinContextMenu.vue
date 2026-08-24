<!--
  Copyright (C) 2026 wyf2012

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.

  Based on WinUIonWeb by Furry-Xiyi (https://github.com/Furry-Xiyi/WinUIonWeb)
  Licensed under GNU General Public License v3.0
-->
<template>
  <div
    ref="rootRef"
    class="win-context-menu"
    :class="attrs.class"
    :style="attrs.style"
    @contextmenu="onContextMenu"
    @copy="onCopyingToClipboard">
    <slot />
  </div>

  <WinMenuFlyout
    :Open="contextMenuOpen"
    :AnchorRect="contextMenuAnchor"
    :Items="contextMenuItems"
    :MinWidth="160"
    Placement="Right"
    @Close="closeContextMenu"
    @Select="onContextMenuSelect" />
</template>

<script setup>
import { computed, onBeforeUnmount, ref, useAttrs } from 'vue';
import WinMenuFlyout from './WinMenuFlyout.vue';
import { useI18n } from './i18n/index';

const { t } = useI18n();

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const rootRef = ref(null);
const contextMenuOpen = ref(false);
const contextMenuAnchor = ref(null);
const contextSelection = ref('');

const contextMenuItems = computed(() => {
  const hasText = rootRef.value?.textContent?.length > 0;
  const items = [];
  if (contextSelection.value) {
    items.push({ Text: t('text.copy'), Icon: '\uE8C8', Value: 'copy' });
  }
  if (hasText) {
    items.push({ Text: t('text.select-all'), Icon: '\uE8B3', Value: 'selectAll' });
  }
  return items;
});

const selectionTextInBlock = () => {
  const root = rootRef.value;
  if (!root) return '';
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return '';
  const range = selection.getRangeAt(0);
  const startsInside = root.contains(range.startContainer);
  const endsInside = root.contains(range.endContainer);
  return startsInside && endsInside ? selection.toString() : '';
};

const onCopyingToClipboard = (event) => {
  const text = selectionTextInBlock();
  if (!text) return;
  event.clipboardData?.setData('text/plain', text);
  event.preventDefault();
};

const onContextMenu = (event) => {
  event.preventDefault();
  contextMenuOpen.value = false;
  contextSelection.value = selectionTextInBlock();
  if (!contextMenuItems.value.length) return;
  const x = event.clientX;
  const y = event.clientY;
  contextMenuAnchor.value = { x, y, top: y, bottom: y, left: x, right: x, width: 0, height: 0 };
  contextMenuOpen.value = true;
};

const closeContextMenu = () => {
  contextMenuOpen.value = false;
};

const copySelectionToClipboard = () => {
  const text = contextSelection.value || selectionTextInBlock();
  if (text) void navigator.clipboard?.writeText(text);
};

const selectAll = () => {
  const root = rootRef.value;
  if (!root) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  const selection = window.getSelection?.();
  selection?.removeAllRanges();
  selection?.addRange(range);
  contextSelection.value = root.textContent ?? '';
};

const onContextMenuSelect = (item) => {
  if (!item.Value) return;
  closeContextMenu();
  if (item.Value === 'copy') copySelectionToClipboard();
  if (item.Value === 'selectAll') selectAll();
};

onBeforeUnmount(() => {
  contextMenuOpen.value = false;
});
</script>

<style>
.win-context-menu {
  user-select: text;
}
</style>
