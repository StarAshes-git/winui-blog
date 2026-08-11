<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  })
);

const props = defineProps<{ source: string }>();

const rendered = computed(() => {
  const raw = marked.parse(props.source) as string;
  return DOMPurify.sanitize(raw);
});
</script>

<template>
  <div class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body {
  line-height: 1.7;
  word-break: break-word;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 1em 0 0.5em;
}
.markdown-body :deep(p) {
  margin: 0.6em 0;
}
.markdown-body :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  border-radius: var(--radius);
  padding: 12px 16px;
  overflow-x: auto;
}
.markdown-body :deep(code) {
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 13px;
}
.markdown-body :deep(:not(pre) > code) {
  background: rgba(128, 128, 128, 0.22);
  padding: 2px 6px;
  border-radius: 4px;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 12px;
  color: var(--text-secondary);
  margin: 0.6em 0;
}
.markdown-body :deep(a) {
  color: var(--accent);
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius);
}
</style>
