# FHL Image Gen DSH Plugin Current Context

## Current Breakpoint

2026-08-21: The independent DSH plugin is documented and locally packaged as
version `0.1.0`. The source remains isolated from the original DSH, whitecodex,
FHL Harness desktop project, Android project, installed EXE and existing user
data.

The current verified breakpoint is offline build/test, tarball safety, clean
temporary profile installation, `--dump-config` bundle loading, a
user-confirmed DSH chat configuration and completed public GitHub publication.
The first-time-user guide and Windows bundle are published; the existing
`v0.1.0` Release now contains the refreshed tarball and user bundle.
The GitHub homepage has now been reorganized as a Chinese-first single README
with same-page English anchors; the source change is ready for remote sync.
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
- Fresh `dsh-fhl-image-plugin-0.1.0.tgz` SHA-256:
  `56FC6EB8B3C4228388BDDFD98B5EE7EF8AC09BAD6F0082D64E5128340F8B5B1D`.
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
- `README-FIRST.zh-CN.md`
- `install-fhl-image-plugin.cmd`
- `scripts/install-fhl-image-plugin.cmd`
- `docs/changes/2026-08-21-first-time-user-bundle.md`
- `docs/changes/2026-08-22-github-readme-chinese-homepage.md`

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
- Local `main` and development branches are fast-forwarded through this completed batch.
- Public remote: `https://github.com/supart/DSH-FHL-Image-Plugin`.
- GitHub `main` and development branch contain this completed documentation
  batch; baseline tag and `v0.1.0` remain unchanged, and the Release has six
  verified assets. The exact remote commit is recorded in the release manifest.
- Tarballs remain ignored release attachments and are not committed.
- The Windows first-time-user bundle is also an ignored Release attachment.
- This README-only batch does not move `v0.1.0` or refresh Release assets.

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
