# 底部备案信息功能设计

日期：2026-08-13
状态：已批准

## 目标

在博客底部显示可配置的备案号文字，点击备案号跳转到配置的链接。备案信息（备案号 + 跳转链接）可在管理后台配置。未配置备案信息时底部不显示任何备案内容。

## 需求确认

- 一个备案号字段 + 一个跳转链接字段（工信部链接等标准做法）。
- 链接作用在备案号文字上：点击备案号文字跳转。
- 后台未配置时，底部不显示备案信息。
- 配置入口在管理后台。

## 数据模型

复用现有 `settings` key-value 表。

| key | value |
| --- | --- |
| `footer_record` | JSON 字符串 `{"text": "...", "link": "..."}` |

- 未配置时该 key 不存在，读取返回 `null`。
- `text` 为备案号文字（如「京ICP备12345678号」）。
- `link` 为跳转链接（如 `https://beian.miit.gov.cn/`），必须 `http://` 或 `https://` 开头，否则拒绝保存。

## 后端接口

### `GET /api/site`

响应新增 `footer_record` 字段：

```json
{
  "intro": "...",
  "site_name": "...",
  "avatar_url": "...",
  "footer_record": { "text": "...", "link": "..." }
}
```

未配置时为 `null`。

### `PUT /api/site`

请求体可包含 `footer_record`：

```json
{
  "footer_record": { "text": "...", "link": "..." }
}
```

- 仅当 `text` 非空字符串时写入；`text` 为空表示清除（可传 `null` 清除，或空串表示清除）。
- `link` 若非空，必须通过 `http(s)` 校验，否则返回 400。
- 其余字段（intro/site_name/avatar_url）行为不变。

## 前端

### `SiteInfo` 类型

```ts
export interface SiteFooterRecord {
  text: string;
  link: string;
}

export interface SiteInfo {
  intro: string;
  site_name: string;
  avatar_url: string;
  footer_record: SiteFooterRecord | null;
}
```

### App.vue 底部渲染

- 在 `.app-content` 内部底部追加 `<footer class="app-footer">`。
- 页面加载时随 `loadPaneTitle()` 一起获取 site 信息，保存 `footer_record`。
- 渲染规则：
  - `footer_record` 为空或 `text` 为空 → 不渲染 footer。
  - `text` 非空且 `link` 有效（http/https）→ 渲染 `<a :href="link" target="_blank" rel="noopener noreferrer">{{ text }}</a>`。
  - `text` 非空但 `link` 为空 → 渲染纯文本 `{{ text }}`。
- 样式：居中、小字号、次要色，与内容区底部保持间距。

### AdminView.vue 配置

在「自我介绍」tab（site 表单）中增加两个输入框：

- 备案号（`WinTextBox`，绑定 `siteForm.footer_record.text`）
- 备案链接（`WinTextBox`，绑定 `siteForm.footer_record.link`）

- `siteForm` 初始化时 `footer_record` 默认为 `{ text: "", link: "" }`。
- `saveSite` 时随其他字段一起提交；保存前对 link 做 http(s) 校验，非法则提示错误不提交。

## 错误处理

- 后端 `PUT /api/site` 收到非法 link（非 http/https 前缀）→ 400 `{ error: "备案链接必须以 http:// 或 https:// 开头" }`。
- 前端展示该错误到现有 `.err` 区域。

## 测试

- worker 侧：`site.test.ts` 增加用例
  - `PUT` 写入 `footer_record` 后 `GET` 能读回。
  - 非法 link（如 `javascript:alert(1)`）返回 400。
  - 空 text 清除 `footer_record`。
- 前端不做单独单测（无现成测试框架），由 typecheck + 手动验证覆盖。

## 验证

1. `npm run typecheck`（frontend）。
2. `npm run build`（frontend，输出到 worker/public）。
3. `npx vitest run`（worker 目录）。
4. `npx wrangler deploy` 部署。
5. 手动验证：后台配置备案号后首页底部显示、点击可跳转；清空后不显示。