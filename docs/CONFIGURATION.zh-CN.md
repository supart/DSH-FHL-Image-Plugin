# 在聊天窗口配置 FHL 生图 API

## 先了解风险

`fhl_image_configure` 只应在用户明确要求配置 API 时调用。聊天配置的原始
Key 会随用户消息经过当前 DSH 模型，并可能保留在会话历史中。它适合用户明确
接受这条链路的 Worker Key；不能经过模型服务的高敏感凭据，应改用宿主凭据机制
或环境变量。

不要把 Key 发给 Codex 主对话、GitHub、截图、日志、Issue 或诊断导出。本文和
项目记录不保存任何真实 Key。

## 实际流程

1. 启动已安装插件的 `fhl-image` profile。
2. 新建 DSH 会话。
3. 先确认工具目录包含：

   - `fhl_image_configure`
   - `fhl_image_generate`
   - `fhl_image_edit`

4. 发送下面这条明确触发提示词，不要直接让 Agent 猜测：

   ```text
   我想配置 FHL 生图专用 API。请使用 fhl_image_configure 工具，并先告诉我需要如何提供一个或多个 Worker Key；不要调用生图工具。
   ```

5. Agent 请求 Worker Key 后，把 Key 直接粘贴到 DSH 聊天输入框并发送。
6. 多个 Worker 可以一行一个：

   ```text
   Key 1
   Key 2
   Key 3
   ```

7. Agent 应只调用 `fhl_image_configure`，不要同时调用生成或编辑工具。
8. 只检查脱敏结果，例如：

   ```text
   Configured 1 FHL image worker(s).
   ```

## 配置成功判据

真实验收必须同时满足：

- 工具调用名称为 `fhl_image_configure`。
- 本轮没有调用 `fhl_image_generate` 或 `fhl_image_edit`。
- 结果只显示配置数量、跳过数量或 `[configured]` 状态。
- credential provider 对对应 Worker 槽位返回 `configured=true`。
- 完全重启同一个 `fhl-image` profile 后，配置状态仍然存在。
- 没有发起图片请求，也没有产生图片 API 费用。

2026-08-21，用户已在本机 DSH 聊天窗口确认 FHL Worker API 配置成功。当前脱敏
记录见 [`docs/changes/2026-08-21-dsh-chat-api-configuration.md`](changes/2026-08-21-dsh-chat-api-configuration.md)。
该确认只覆盖配置工具链；重启后的持久化状态和 Worker 数量若需要对外发布，仍应
补充到同一记录中。

## 多 Worker 规则

- 最多十个 Worker。
- 空行会被忽略。
- 重复 Key 会去重。
- 超过十个会被截断，并在结果中显示跳过数量。
- 每个 Worker 有独立冷却和鉴权状态。
- 配置结果不显示 Key 的前缀、后缀或完整值。

## 配置后再生图

确认配置状态持久化后，另发一条用户请求，例如：

```text
请生成一张极简现代建筑的全彩效果图，先使用 fhl_image_generate，生成一张即可。
```

图片请求是可能计费的网络操作。配置阶段和生图阶段应分开，避免 Agent 在配置
Key 的同一轮意外发起图片请求。

## 不希望 Key 经过模型时

改用 DSH 宿主凭据机制或环境变量：

```text
FHL_IMAGE_API_KEY=your-key
FHL_IMAGE_API_KEY_2=another-key
```

环境变量示例只用于说明变量名，不要把真实值提交到 Git 或写入文档。
