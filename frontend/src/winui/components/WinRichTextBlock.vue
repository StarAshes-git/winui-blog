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
    v-bind="richTextBlockAttrs"
    class="win-rich-text-block"
    :class="[attrs.class, { 'is-selectable': IsTextSelectionEnabled }]"
    :style="richTextBlockStyle">
    <slot>{{ Text }}</slot>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue';

defineOptions({
  inheritAttrs: false
});

const props = defineProps({
  Text: { type: [String, Number], default: '' },
  FontFamily: { type: String, default: '' },
  FontSize: { type: [String, Number], default: '' },
  FontStyle: { type: String, default: '' },
  FontWeight: { type: [String, Number], default: '' },
  Foreground: { type: String, default: '' },
  IsTextSelectionEnabled: { type: Boolean, default: false },
  LineHeight: { type: [String, Number], default: '' },
  MaxLines: { type: [String, Number], default: '' },
  TextAlignment: { type: String, default: '' },
  TextTrimming: { type: String, default: '' },
  TextWrapping: { type: String, default: 'Wrap' }
});

const attrs = useAttrs();

const richTextBlockAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});

const cssLength = (value) => {
  if (value === '' || value === undefined || value === null) return '';
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value.trim()))) {
    return `${Number(value.trim())}px`;
  }
  return typeof value === 'number' ? `${value}px` : value;
};

const richTextBlockStyle = computed(() => {
  const style = {};

  if (props.FontFamily) style.fontFamily = props.FontFamily;
  if (props.FontSize !== '') style.fontSize = cssLength(props.FontSize);
  if (props.FontStyle) style.fontStyle = props.FontStyle.toLowerCase();
  if (props.FontWeight !== '') style.fontWeight = props.FontWeight;
  if (props.Foreground) style.color = props.Foreground;
  if (props.LineHeight !== '') style.lineHeight = cssLength(props.LineHeight);
  if (props.TextAlignment) style.textAlign = props.TextAlignment.toLowerCase();
  if (props.TextWrapping === 'NoWrap') style.whiteSpace = 'nowrap';
  if (props.TextWrapping === 'Wrap' || props.TextWrapping === 'WrapWholeWords') style.whiteSpace = 'normal';

  if (props.TextTrimming && props.TextTrimming !== 'None') {
    style.overflow = 'hidden';
    style.textOverflow = 'ellipsis';
    style.whiteSpace = 'nowrap';
  }

  if (props.MaxLines !== '') {
    style.display = '-webkit-box';
    style.overflow = 'hidden';
    style.WebkitLineClamp = String(props.MaxLines);
    style.WebkitBoxOrient = 'vertical';
  }

  return [attrs.style, style];
});
</script>

<style>
.win-rich-text-block {
  display: block;
  min-width: 0;
  margin: 0;
  color: var(--TextFillColorPrimaryBrush, var(--text-primary));
  font-family: var(--ContentControlThemeFontFamily, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif);
  font-size: var(--ControlContentThemeFontSize, 14px);
  line-height: 20px;
  overflow-wrap: normal;
  user-select: none;
}

.win-rich-text-block.is-selectable {
  cursor: text;
  user-select: text;
}

.win-rich-text-block p {
  margin: 0 0 12px 0;
}

.win-rich-text-block p:last-child {
  margin-bottom: 0;
}

.win-rich-text-block a,
.win-rich-text-block .hyperlink {
  color: var(--accent-text-fill-color-primary);
  text-decoration: none;
}

.win-rich-text-block a:hover,
.win-rich-text-block .hyperlink:hover {
  color: var(--accent-text-fill-color-primary);
  text-decoration: none;
}

.win-rich-text-block::selection,
.win-rich-text-block *::selection {
  background-color: var(--TextBlockSelectionHighlightColor, Highlight);
  color: HighlightText;
}
</style>
