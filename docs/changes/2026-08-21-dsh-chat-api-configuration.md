# 2026-08-21 DSH 聊天窗口配置 FHL Worker API

阶段：P5
状态：已完成（用户确认）
范围：standalone DSH plugin / real chat configuration record

## 结果

用户确认已在本机 DSH 聊天窗口完成 FHL Worker API 配置。配置意图经过
`fhl_image_configure`，没有要求插件在配置阶段调用生图或编辑工具。

## 脱敏记录

- 插件版本：`0.1.0`
- 配置方式：DSH 聊天窗口
- 工具：`fhl_image_configure`
- 实际触发提示词：`我想配置 FHL 生图专用 API。请使用 fhl_image_configure 工具，并先告诉我需要如何提供一个或多个 Worker Key；不要调用生图工具。`
- Worker 数量：本轮消息未提供，不记录猜测值
- DSH profile：本轮消息未提供，不记录猜测值
- 是否调用 `fhl_image_generate`：用户未报告调用，按未调用记录
- 是否调用 `fhl_image_edit`：用户未报告调用，按未调用记录
- 是否产生图片 API 请求：未报告；本次仅记录配置，不宣称生图成功
- 是否重启后保持：尚未单独复核
- 是否上传 GitHub 或 push：否

## 凭据边界

本记录不包含 API Key、Key 前缀或后缀、Authorization、完整聊天原文、请求体、
响应体、图片 base64、截图或用户会话。用户输入的 Key 不复制到项目文件。

## 验收解释

“配置成功”只表示用户在 DSH 聊天窗口确认了凭据配置链路成功；它不等同于真实
生图或编辑请求成功。若要关闭完整验收门槛，还需在同一个 profile 重启后确认
Worker 状态仍为 `configured=true`，并由用户另行请求一次图片任务。

## 回退

如果用户发现配置错误，应在 DSH credential provider 中删除或替换对应 Worker，
不要把旧 Key 重新发送到公开聊天、GitHub、日志或问题截图中。此记录本身无需
包含任何可恢复凭据。
