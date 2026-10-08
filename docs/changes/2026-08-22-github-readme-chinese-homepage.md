# 2026-08-22 GitHub README 中文主页面

阶段：P9
状态：已完成并已同步 GitHub 源码分支
范围：GitHub 首页文案 / 同页语言导航 / README 兼容入口

## 改动

- 根目录 `README.md` 改为中文优先的单一主页来源。
- 中文区包含第一次使用、Windows 安装、聊天配置、生图编辑、工具、排障、安全和详细文档入口。
- 英文完整内容保留在同一份 README 的下方。
- 顶部增加 `#fhl-zh` 和 `#fhl-en` 稳定锚点，语言切换不打开另一份 README。
- `README.zh.md` 改为兼容入口，指向 `README.md#fhl-zh`。
- `README-FIRST.zh-CN.md` 增加返回中文主页的入口。
- 移除公开 README 中的 `sk-` 形式示例，避免被误认为真实凭据。

## 验证

- `git diff --check`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：通过，6 个文件 / 9 个测试。
- `pnpm build`：通过。
- `pnpm pack:check`：通过；tarball 仍包含三份 README 和两张插图。
- README 本地链接检查：通过，21 个链接。
- README 凭据样式扫描：通过。
- 未调用真实模型、图片 API 或计费服务。

## 发布边界

- 不修改插件代码、API、版本号或正式标签。
- 不移动 `v0.1.0`，不创建新 Release。
- 源码 `main` 与开发分支已同步到同一远程提交；Release tarball 未刷新。

## 回退

使用本批次 Conventional Commit 的 `git revert` 回退文档改动，不使用 reset 或强制推送。
