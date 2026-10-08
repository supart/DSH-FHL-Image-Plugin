# 2026-08-21 GitHub README 实际使用插图

阶段：P6
状态：已完成
范围：standalone DSH plugin / GitHub presentation / release tarball

## 目标

把用户提供的两张 DSH 实际使用截图作为 GitHub 项目介绍插图，分别展示批量生图
和参考图编辑，并确保未来 `.tgz` 附件中的 README 也能加载这些图片。

## 改动

- 新增 `docs/assets/fhl-image-generate-example.png`。
- 新增 `docs/assets/fhl-image-edit-example.png`。
- 中英文 README 增加“真实使用示例”章节和相对路径图片引用。
- `package.json.files` 增加 `docs/assets`，保证 tarball 包含插图。
- 测试夹具中的模拟 Key 改为不带 `sk-` 前缀的 `worker-*-test-secret`，减少 GitHub
  Secret Scanning 误报；测试行为不变。

## 验证

- `pnpm typecheck`：通过。
- `pnpm test`：通过，6 个文件 / 9 个测试。
- `pnpm pack:check`：通过。
- tarball 内容确认包含两张 `docs/assets` PNG。
- 新 tarball SHA-256：
  `FB6AC375C32B73A9B2ABE75C584FB0D202E251E54C347A9F72A37D1EB66FC3E5`。
- 未发现真实 API Key、Authorization、DPAPI 密文或用户会话。

## 边界

插图来自用户提供的本机截图，只用于公开项目说明；没有把截图复制到聊天记录、
验证日志或私密归档。截图不作为真实 API 生图验收证据，真实聊天配置仍按之前的
用户确认记录处理。

## 回退

删除两个 `docs/assets` PNG、README 对应图片段落和 `package.json.files` 中的
`docs/assets`，然后重新运行 `pnpm pack:check` 并刷新哈希即可。
