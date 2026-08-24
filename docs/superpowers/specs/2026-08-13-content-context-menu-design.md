# 阅读内容右键复制菜单

## 背景

网站已有 WinUI 风格的右键菜单（WinTextBox/WinTextBlock 中的复制/全选命令）。目前仅在密码输入框和标题文本块中使用。用户希望所有阅读内容（文章正文、简介、标签列表）都使用这个自定义右键菜单，而不是浏览器默认菜单。

## 目标

在所有阅读内容区域添加 WinUI 风格的右键菜单，支持"复制"和"全选"命令。

## 方案

创建 `WinContextMenu.vue` 组件（复用 WinMenuFlyout），包裹阅读内容区域：

1. 创建 `frontend/src/winui/components/WinContextMenu.vue`：检测选中文本，显示复制/全选菜单
2. `PostView.vue`：用 `<WinContextMenu>` 包裹 MarkdownView
3. `HomeView.vue`：用 `<WinContextMenu>` 包裹简介和文章列表
4. `TagsView.vue`：用 `<WinContextMenu>` 包裹标签列表
5. `App.vue`：用 `<WinContextMenu>` 包裹侧栏内容（自我介绍、页脚）

## 涉及文件

- 新建：`frontend/src/winui/components/WinContextMenu.vue`
- 修改：`PostView.vue`、`HomeView.vue`、`TagsView.vue`、`App.vue`
