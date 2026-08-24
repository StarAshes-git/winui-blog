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
  <div class="win-password-box" :style="rootStyle">
    <WinTextBox
      ref="textBoxRef"
      class="win-password-textbox"
      :Text="visibleText"
      :Header="Header"
      :Description="Description"
      :PlaceholderText="PlaceholderText"
      :MaxLength="MaxLength"
      :IsEnabled="IsEnabled"
      :InputScope="InputScope"
      :SelectionHighlightColor="SelectionHighlightColor"
      :PreventKeyboardDisplayOnProgrammaticFocus="PreventKeyboardDisplayOnProgrammaticFocus"
      @update:Text="onVisibleTextChanged"
      @GotFocus="emit('GotFocus')"
      @LostFocus="emit('LostFocus')"
      @Paste="onPaste">
      <template #actions>
        <button
          v-if="showRevealButton"
          class="win-textbox-action-button win-password-reveal"
          type="button"
          :disabled="!IsEnabled"
          :aria-label="t('text.reveal-password')"
          v-bind="{ 'tooltipservice.tooltip': t('text.reveal-password') }"
          @pointerdown.prevent="peekPassword"
          @pointerup.prevent="hidePeek"
          @pointerleave="hidePeek"
          @click="toggleVisible">
          <span></span>
        </button>
      </template>
    </WinTextBox>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from './i18n/index';

const { t } = useI18n();
import type { CSSProperties } from 'vue';
import WinTextBox from './WinTextBox.vue';

type PasswordRevealMode = 'Peek' | 'Hidden' | 'Visible';

const props = withDefaults(defineProps<{
  Password?: string;
  Header?: string;
  HeaderTemplate?: unknown | null;
  Description?: string;
  PlaceholderText?: string;
  PasswordChar?: string;
  PasswordRevealMode?: PasswordRevealMode;
  MaxLength?: number;
  IsEnabled?: boolean;
  CanPasteClipboardContent?: boolean;
  InputScope?: string;
  SelectionFlyout?: unknown | null;
  SelectionHighlightColor?: string;
  TextReadingOrder?: string;
  PreventKeyboardDisplayOnProgrammaticFocus?: boolean;
  Width?: number | string;
}>(), {
  Password: '',
  Header: '',
  HeaderTemplate: undefined,
  Description: '',
  PlaceholderText: '',
  PasswordChar: '\u25CF',
  PasswordRevealMode: 'Peek',
  MaxLength: 0,
  IsEnabled: true,
  CanPasteClipboardContent: true,
  InputScope: 'Password',
  SelectionFlyout: undefined,
  SelectionHighlightColor: '',
  TextReadingOrder: 'Default',
  PreventKeyboardDisplayOnProgrammaticFocus: false,
  Width: ''
});

const emit = defineEmits<{
  'update:Password': [value: string];
  PasswordChanging: [args: { IsContentChanging: boolean }];
  PasswordChanged: [];
  GotFocus: [];
  LostFocus: [];
}>();

const password = ref(props.Password);
const isPeeking = ref(false);
const isToggledVisible = ref(false);

const rootStyle = computed<CSSProperties>(() => ({
  width: props.Width === '' ? undefined : typeof props.Width === 'number' ? `${props.Width}px` : props.Width
}));
const showRevealButton = computed(() => props.PasswordRevealMode !== 'Hidden' && password.value.length > 0);
const isPasswordVisible = computed(() => props.PasswordRevealMode === 'Visible' || isPeeking.value || isToggledVisible.value);
const visibleText = computed(() => isPasswordVisible.value ? password.value : props.PasswordChar.repeat(password.value.length));

const applyPassword = (value: string) => {
  const next = props.MaxLength > 0 ? value.slice(0, props.MaxLength) : value;
  emit('PasswordChanging', { IsContentChanging: next !== password.value });
  password.value = next;
  emit('update:Password', next);
  emit('PasswordChanged');
};

let lastVisibleValue = '';
const onVisibleTextChanged = (value: string) => {
  if (isPasswordVisible.value) {
    lastVisibleValue = '';
    applyPassword(value);
    return;
  }

  // 屏蔽事件重放（移动端受控 input 回写圆点串时会重复触发相同的 input 事件）
  if (value === lastVisibleValue) return;
  lastVisibleValue = value;

  const maskedLen = password.value.length;
  if (value.length < maskedLen) {
    applyPassword(password.value.slice(0, value.length));
    return;
  }

  // 提取遮罩之外的真正新增字符（只保留非 PasswordChar 的输入）
  const realAdded = value.slice(maskedLen).replaceAll(props.PasswordChar, '');
  if (!realAdded) return;
  applyPassword(password.value + realAdded);
};

const onPaste = (args: { Handled: boolean }) => {
  if (!props.CanPasteClipboardContent) {
    args.Handled = true;
  }
};

const peekPassword = () => {
  if (props.PasswordRevealMode === 'Peek') isPeeking.value = true;
};

const hidePeek = () => {
  if (props.PasswordRevealMode === 'Peek') isPeeking.value = false;
};

const toggleVisible = () => {
  if (props.PasswordRevealMode === 'Visible') return;
  if (props.PasswordRevealMode === 'Peek') return;
  isToggledVisible.value = !isToggledVisible.value;
};

watch(() => props.Password, (value) => {
  password.value = value ?? '';
});
</script>

<style scoped>
.win-password-box {
  display: inline-flex;
  min-width: 64px;
}

.win-password-textbox {
  width: 100%;
}

.win-password-reveal {
  display: grid;
  place-items: center;
}

.win-password-reveal span {
  font-size: 12px;
}
</style>
