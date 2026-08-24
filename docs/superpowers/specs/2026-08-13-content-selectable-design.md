# 页面内容可复制

## 背景

当前 theme.css 全局 `*, *::before, *::after` 设置 `user-select: none`，禁止所有文本选择。这是 WinUI 桌面风格，但博客阅读内容（文章正文、自我介绍等）应可复制。

## 目标

所有阅读内容（文章正文、自我介绍、标签名、页脚备案信息等）可选择复制。控件（按钮、导航栏、输入框等）保持不可选择。

## 方案

1. `frontend/src/winui/styles/theme.css`：移除 `*, *::before, *::after` 的 `user-select: none`（line 592）
2. `frontend/src/winui/components/WinButton.vue`：按钮根元素加 `user-select: none`
3. `frontend/src/winui/components/WinNavigationView.vue`：导航项加 `user-select: none`
4. 其他控件（WinTextBox 等）已有选中行为，不需要额外处理

**只做一行 CSS 改动 + 两处控件补充 `user-select: none`，其余页面内容自动获得选择能力。**

## 涉及文件

- `frontend/src/winui/styles/theme.css`：删除 `user-select: none` 全局规则
- `frontend/src/winui/components/WinButton.vue`：按钮加 `user-select: none`
- `frontend/src/winui/components/WinNavigationView.vue`：导航项加 `user-select: none`
