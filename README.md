# DSH FHL Image 0.1.0

[中文](#fhl-zh) · [English](#fhl-en)

<a id="fhl-zh"></a>

## 中文

### 这是什么

`DSH FHL Image` 是一个独立、MIT 许可的 DeepSeek Harness 社区插件，为 DSH
增加 FHL Images 生图、图片编辑、多参考图和 Worker 池能力。

> 这是社区项目，不是官方 DeepSeek 或 FHL 产品，也不是完整的 DSH 软件。
> 使用前必须先安装并能启动 DSH。

### 第一次使用

如果你从未使用过 DSH，推荐在 GitHub Release 页面下载：

```text
DSH-FHL-Image-Plugin-0.1.0-Windows-User-Bundle.zip
```

解压后，双击目录根部的：

```text
install-fhl-image-plugin.cmd
```

用户包包含插件 tarball、中文说明、Windows 安装脚本和安全文档。`.tgz` 是插件包，
不能双击运行。

使用前确认 PowerShell 中可以运行：

```powershell
dsh --help
node --version
pnpm --version
```

如果 Windows 阻止双击脚本，可以在解压目录中打开 PowerShell，运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 `
  -Profile fhl-image -TarballPath .\dsh-fhl-image-plugin-0.1.0.tgz
```

安装后检查插件是否加载：

```powershell
dsh --profile fhl-image --dump-config
```

输出中应能看到：

```text
@fhl-plugins/dsh-fhl-image
fhl-image
```

然后启动 DSH：

```powershell
dsh --profile fhl-image
```

### 聊天配置生图 API

新建 DSH 会话，先确认工具列表中有：

- `fhl_image_configure`
- `fhl_image_generate`
- `fhl_image_edit`

发送这条提示词：

```text
我想配置 FHL 生图专用 API。请使用 fhl_image_configure 工具，并先告诉我需要如何提供一个或多个 Worker Key；不要调用生图工具。
```

Agent 询问后，把一个或多个 Worker Key 粘贴到聊天框中，每个 Key 一行。配置阶段只应
调用 `fhl_image_configure`，不应调用生图工具。成功后只根据脱敏的 Worker 数量确认配置。

聊天配置有一个重要边界：原始 Key 会随用户消息经过当前模型，并可能保留在 DSH 会话
历史中。不能接受这种传输方式的凭据，请改用 DSH 宿主凭据机制或环境变量。不要把 Key
发到 GitHub、Codex 主对话、截图、日志或 Issue。

### 第一次生图和编辑

配置成功后，可以发送：

```text
请使用 FHL 生图工具生成一张极简现代建筑的全彩效果图，生成 1 张，比例 16:9，2K。
```

有参考图时，把图片拖入聊天框，然后发送：

```text
请使用这张参考图进行编辑，保留主体特征，生成一张全彩效果图。
```

结果通过 DSH 附件服务回到对话中。

### 已实现的工具

- `fhl_image_configure`：用户明确要求时配置最多十个 Worker。
- `fhl_image_generate`：生成一至九张图。
- `fhl_image_edit`：使用一至十张有序参考图进行编辑或组合。

插件不会启动时探测 API，不会把 Key 写入工具结果、普通诊断、图片附件或源码，也不会
下载或执行任意远程插件。

### GitHub 页面示例图

下面两张图来自本项目的实际使用界面：

![FHL 生图工具实际运行示例](docs/assets/fhl-image-generate-example.png)

![FHL 参考图编辑实际运行示例](docs/assets/fhl-image-edit-example.png)

### 没有工具怎么办

1. 完全关闭旧的 DSH Host。
2. 确认启动的是 `fhl-image` profile。
3. 重新运行 `dsh --profile fhl-image`。
4. 刷新浏览器并新建会话。

旧 Host 可能仍然使用旧工具目录；修改插件或重新安装后必须重启 Host。

### 详细文档

- [第一次使用说明](README-FIRST.zh-CN.md)
- [Windows 安装说明](docs/INSTALL.zh-CN.md)
- [聊天配置 API](docs/CONFIGURATION.zh-CN.md)
- [没有工具/启动失败排查](docs/TROUBLESHOOTING.zh-CN.md)
- [安全与凭据边界](docs/SECURITY.zh-CN.md)
- [源码开发者说明](docs/DEVELOPMENT.zh-CN.md)
- [0.1.0 发布说明](docs/RELEASE_NOTES.zh-CN.md)

### 许可证与上游关系

本项目使用 MIT 许可证，是独立社区分发，不是官方 DeepSeek 产品。上游 DSH 源码、
whitecodex、FHL Harness 桌面版、Android 项目、已安装 EXE 和旧数据均保持在项目外，
本项目不会自动修改它们。

<a id="fhl-en"></a>

## English

[Back to 中文](#fhl-zh)

Independent MIT-licensed DeepSeek Harness community bundle for FHL Images.
It adds image generation, multi-reference editing, a bounded worker pool, and
an Agent tool that can configure image workers from keys the user supplies in
chat.

> This is an independent community plugin. It is not an official DeepSeek or
> FHL product. DeepSeek Harness is in developer preview and plugin APIs may
> change between releases.

## Features

- `fhl_image_generate`: one to nine image variations through FHL Images API.
- `fhl_image_edit`: one to ten ordered reference images, with one to four
  independent edit variations.
- Up to ten managed image workers using `FHL_IMAGE_API_KEY` through
  `FHL_IMAGE_API_KEY_10`.
- Retryable worker cooldown, per-worker authentication isolation, cancellation,
  bounded responses, and credential redaction.
- Durable DSH attachment output so generated images appear in the conversation.
- `fhl_image_configure`: configure one or more workers from a chat message.

New to DSH? Read [README-FIRST.zh-CN.md](README-FIRST.zh-CN.md) before installing.
The `.tgz` is a plugin package, not a standalone application. The GitHub Release
also provides a Windows user bundle containing the package, installer helper, and
Chinese quick-start guide.

## Real Usage Examples

The screenshots below show the model selecting `fhl_image_generate` for a
multi-image request and `fhl_image_edit` for a reference-image edit. They are
included as documentation illustrations only; no credentials or private
session data are included.

![FHL image generation example](docs/assets/fhl-image-generate-example.png)

![FHL reference-image edit example](docs/assets/fhl-image-edit-example.png)

## Chat Configuration

The intended non-programmer flow is:

```text
I want to configure FHL image workers. Use fhl_image_configure first; do not call image tools.
```

For multiple workers, send one key per line and explicitly ask DSH to add them
to the image worker pool. The Agent should call `fhl_image_configure`, which
stores the keys through the DSH credential provider and returns only a masked
worker count.

This mode is intentionally chat-based, so it has an important limitation:
the original key is part of the user message sent to the selected model and
may be retained in the DSH session history. Do not use this mode for a key that
must never be transmitted to the model provider. For that case, configure the
credential outside chat using the host's credential mechanism or environment:

```text
FHL_IMAGE_API_KEY=your-key
FHL_IMAGE_API_KEY_2=another-key
```

The plugin never includes key values in tool results, image artifacts, normal
diagnostics, or its own error messages. It cannot retract a key already sent
through the chat model request.

## Install A Prebuilt Package

The first release is distributed as a prebuilt `.tgz` so users do not need to
authorize a Git `prepare` script:

```sh
dsh plugin --profile fhl-image add ./artifacts/dsh-fhl-image-plugin-0.1.0.tgz
dsh --profile fhl-image --dump-config
dsh --profile fhl-image
```

The `dsh plugin` command adds the package to the profile and activates its
`cordis.patch.yml` bundle layer. Restart DSH after changing installed bundles.

On Windows, the current DSH CLI can split an absolute tarball path when the
source directory contains spaces. From this checkout, use the helper instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 -Profile fhl-image
```

The helper stages the tarball in the system temporary directory before calling
`dsh`; it does not copy credentials or user data and does not call an API.

## Install From A Checkout

```sh
git clone https://github.com/supart/DSH-FHL-Image-Plugin.git
cd DSH-FHL-Image-Plugin
pnpm install
pnpm build
dsh plugin --profile fhl-image add .
```

When installing from GitHub, pnpm may require an explicit `allowBuilds` entry
for the package's `prepare` script. Read the exact package key printed by pnpm,
review the source, and add only that package to the profile workspace policy.

## Development

Requirements: Node.js `^22.19.0` or `>=24.0.0`, pnpm, and a DSH release whose
published packages are on the `0.1.1-rc.1` compatibility line.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

All tests use local mocks. They do not call FHL or another paid service.

## API Defaults

- Base URL: `https://www.fhl.mom`
- Image model: `gpt-image-2`
- Generation route: `/v1/images/generations`
- Edit route: `/v1/images/edits`
- Output: PNG `b64_json`
- Default quality policy: tested 2K matrix; 4K must be an explicit tool request

The DSH Agent chooses the tool. The plugin does not call the image API on
startup and does not retry a completed successful image request.

## Scope And Limitations

- The first standalone release is a Host/Cordis bundle and does not ship a
  custom DSH settings-card UI.
- API key configuration is model-mediated chat configuration plus environment
  or host-credential fallback.
- The plugin does not download or execute arbitrary remote plugins.
- APIMart workers, nail-try-on presets, and large workflow batch orchestration
  remain separate follow-up packages; the core generation/edit contract is
  kept portable for DSH users.

## License

MIT. See [LICENSE](LICENSE).

Chinese user documentation is in the [中文区](#fhl-zh), with detailed [installation](docs/INSTALL.zh-CN.md), [chat configuration](docs/CONFIGURATION.zh-CN.md), [troubleshooting](docs/TROUBLESHOOTING.zh-CN.md), and [security](docs/SECURITY.zh-CN.md) guides.
