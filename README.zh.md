# DSH FHL Image 0.1.0

[English](README.md) | 中文

独立、MIT 许可的 DeepSeek Harness 社区插件，为 DSH 增加 FHL Images 生图、
图片编辑、多参考图和 Worker 池能力。项目不是 DeepSeek 或 FHL 官方产品，
也不会修改上游 DSH。

## 给普通用户的最短路径

如果你从来没有使用过 DSH，请先阅读[第一次使用说明](README-FIRST.zh-CN.md)。
Release 页面中的 `.tgz` 是插件包，不是可以双击启动的完整软件；推荐下载
`DSH-FHL-Image-Plugin-0.1.0-Windows-User-Bundle.zip`。

1. 准备 DSH、Node.js 22.19+（或 Node 24+）和 pnpm。
2. 下载发布附件 `dsh-fhl-image-plugin-0.1.0.tgz`，并与本项目的
   `scripts/install-to-dsh.ps1` 放在同一项目目录。
3. 在项目目录运行 Windows 辅助安装脚本：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 -Profile fhl-image
   ```

4. 检查 profile 是否真的加载插件：

   ```powershell
   dsh --profile fhl-image --dump-config
   ```

5. 看到 `@fhl-plugins/dsh-fhl-image`、`fhl-image` bundle 和脱敏配置后启动：

   ```powershell
   dsh --profile fhl-image
   ```

6. 新建会话，确认三个工具已出现，再在聊天框明确请求配置 Worker API。
7. 只根据脱敏结果确认配置成功，然后再请求生图或编辑。

推荐触发提示词：

```text
我想配置 FHL 生图专用 API。请使用 fhl_image_configure 工具，并先告诉我需要如何提供一个或多个 Worker Key；不要调用生图工具。
```

完整步骤见：

- [Windows 安装说明](docs/INSTALL.zh-CN.md)
- [聊天配置 API](docs/CONFIGURATION.zh-CN.md)
- [没有工具/启动失败排查](docs/TROUBLESHOOTING.zh-CN.md)
- [安全与凭据边界](docs/SECURITY.zh-CN.md)
- [源码开发者说明](docs/DEVELOPMENT.zh-CN.md)
- [0.1.0 发布说明](docs/RELEASE_NOTES.zh-CN.md)

## 已实现的工具

- `fhl_image_configure`：用户明确要求时，通过聊天配置最多十个 Worker。
- `fhl_image_generate`：生成一至九张图。
- `fhl_image_edit`：使用一至十张有序参考图进行编辑或组合。

结果通过 DSH 附件服务回到对话中。插件不会启动时探测 API，也不会把 Key
写入工具结果、普通诊断、图片附件或源码。

## GitHub 页面示例图

下面两张图来自本项目的实际使用界面：第一张展示 Agent 自动调用
`fhl_image_generate` 批量生成图片，第二张展示使用参考图调用
`fhl_image_edit`。图片只作为项目说明插图，不包含凭据或私密聊天内容。

![FHL 生图工具实际运行示例](docs/assets/fhl-image-generate-example.png)

![FHL 参考图编辑实际运行示例](docs/assets/fhl-image-edit-example.png)

## 重要的聊天配置提醒

聊天配置意味着原始 Key 会随用户消息经过当前模型，并可能留在 DSH 会话历史。
不能接受这种传输风险的凭据，不要粘贴到聊天框，改用宿主凭据机制或环境变量。
不要把 Key 发给 GitHub、Codex 主对话、截图、日志或问题报告。

用户已在本机 DSH 聊天窗口确认 FHL Worker API 配置成功。此次确认只代表
`fhl_image_configure` 配置链路成功，不代表已经发起生图请求；重启后的持久化
复核请按[配置成功判据](docs/CONFIGURATION.zh-CN.md)单独检查。

## 许可证与上游关系

本项目使用 MIT 许可证，是独立社区分发，不是官方 DeepSeek 产品。上游 DSH
源码、whitecodex、FHL Harness 桌面版、Android 项目、已安装 EXE 和旧数据均
保持在项目外并按只读边界处理。
