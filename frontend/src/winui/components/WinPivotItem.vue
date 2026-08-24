/*
 * Copyright (C) 2026 wyf2012
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Based on WinUIonWeb by Furry-Xiyi (https://github.com/Furry-Xiyi/WinUIonWeb)
 * Licensed under GNU General Public License v3.0
 */
<template>
  <div
    class="win-pivot-item"
    :aria-disabled="IsEnabled ? undefined : 'true'">
    <slot />
  </div>
</template>

<script setup>
defineOptions({
  name: 'WinPivotItem'
});

const props = defineProps({
  Header: { type: [String, Number, Object], default: '' },
  IsEnabled: { type: Boolean, default: true }
});

defineExpose({
  get Header() {
    return props.Header;
  },
  get IsEnabled() {
    return props.IsEnabled;
  }
});
</script>

<style scoped>
.win-pivot-item {
  display: contents;
}
</style>
