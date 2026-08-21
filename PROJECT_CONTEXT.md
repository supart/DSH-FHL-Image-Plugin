# FHL Image Gen DSH Plugin Current Context

## Current Breakpoint

2026-08-21: The independent DSH plugin is documented and locally packaged as
version `0.1.0`. The source remains isolated from the original DSH, whitecodex,
FHL Harness desktop project, Android project, installed EXE and existing user
data.

The current verified breakpoint is offline build/test, tarball safety, clean
temporary profile installation, `--dump-config` bundle loading, a
user-confirmed DSH chat configuration and completed public GitHub publication.
The exact trigger prompt is recorded in `docs/CONFIGURATION.zh-CN.md`. Worker
count and post-restart persistence were not supplied in the confirmation, and
no real image generation/edit request is claimed by this batch.

## Identity

- Package: `@fhl-plugins/dsh-fhl-image`
- Version: `0.1.0`
- Plugin id: `fhl-image`
- Future repository: `https://github.com/supart/DSH-FHL-Image-Plugin`
- Compatible DSH line: `0.1.1-rc.1`
- Runtime: Node.js `22.19+` or `24+`
- License: MIT

## Verified In This Batch

- `pnpm typecheck`: passed.
- `pnpm test`: passed, 6 files / 9 tests.
- `pnpm build`: passed.
- `pnpm pack:check`: passed.
- Tarball contents and sensitive-pattern scan: passed.
- `dsh-fhl-image-plugin-0.1.0.tgz` SHA-256:
  `FB6AC375C32B73A9B2ABE75C584FB0D202E251E54C347A9F72A37D1EB66FC3E5`.
- Direct DSH source CLI installed the package into a temporary
  `fhl-image-0.1.0` profile and `--dump-config` showed the FHL bundle layer.
- The official Loader/Include registration tests cover:
  `fhl_image_configure`, `fhl_image_generate`, and `fhl_image_edit`.

Evidence files:

- `verification/2026-08-21-0.1.0-profile-install.md`
- `artifacts/VERIFICATION_REPORT.md`
- `artifacts/RELEASE_MANIFEST.json`

## Documentation Added

- `README.zh.md`
- `docs/INSTALL.zh-CN.md`
- `docs/CONFIGURATION.zh-CN.md`
- `docs/TROUBLESHOOTING.zh-CN.md`
- `docs/SECURITY.zh-CN.md`
- `docs/DEVELOPMENT.zh-CN.md`
- `docs/RELEASE_NOTES.zh-CN.md`
- `docs/assets/fhl-image-generate-example.png`
- `docs/assets/fhl-image-edit-example.png`
- `docs/changes/2026-08-21-github-publication.md`

The documents and README illustrations record the Windows path-with-spaces workaround, the exact
chat-mediated `fhl_image_configure` trigger prompt, the “no tools” restart
sequence and the credential boundary. The user has confirmed chat
configuration success; post-restart persistence and real image generation
remain separate checks.

## Local Git Boundary

- This directory has its own local Git repository.
- Main branch: `main`.
- Development branch: `dsh-fhl-image/0.1.0-development`.
- Baseline tag: `dsh-fhl-image-0.1.0-dev.0`.
- Latest local commit: `3939374 docs(release): record GitHub publication`.
- Public remote: `https://github.com/supart/DSH-FHL-Image-Plugin`.
- GitHub `main`, development branch, baseline tag, `v0.1.0` and Release are published.
- Tarballs remain ignored release attachments and are not committed.

## Safety Boundaries

- API keys, credentials, sessions, generated images, logs and build caches stay
  outside source control and release metadata.
- Chat configuration is allowed only after explicit user intent; its key may
  pass through the selected model and DSH session history. The user-confirmed
  result is recorded without copying the key.
- The plugin does not read arbitrary local paths, execute shell commands or
  download unknown remote plugins.
- The original DSH source and all other product lines remain untouched.

## Resume Commands

```powershell
pnpm install --ignore-scripts
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

For the next acceptance, optionally restart the same `fhl-image` profile and
confirm persistence, then request a separately authorized image task. Keep all
records free of keys and private conversation text. Do not rewrite or force-push
the published `v0.1.0` tag.
