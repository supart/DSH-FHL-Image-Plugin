# DSH FHL Image 0.1.0

English | [中文](README.zh.md)

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
这是我的 FHL 生图 API Key：sk-...
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

Chinese user documentation: [README.zh.md](README.zh.md), [installation](docs/INSTALL.zh-CN.md), [chat configuration](docs/CONFIGURATION.zh-CN.md), [troubleshooting](docs/TROUBLESHOOTING.zh-CN.md), and [security](docs/SECURITY.zh-CN.md).
