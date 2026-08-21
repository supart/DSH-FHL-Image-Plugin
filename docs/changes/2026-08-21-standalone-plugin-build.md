# Standalone DSH Image Plugin Build Gate

## Scope

Continue the independent `@fhl-plugins/dsh-fhl-image` project. The original
DSH, whitecodex, Android project, installed EXE and existing data were not
modified.

## Changes

- Switched internal ESM imports to `.js` specifiers for NodeNext output.
- Adopted the published DSH `credentials/reference-updated` event type.
- Changed configuration tool output to a mutable schema-compatible array.
- Kept `lib/types` during tsdown so declaration staging remains available.
- Changed the invariant package identity to the standalone package name.
- Removed API-key prefix/suffix previews from tool results; status is now only
  `[configured]`.
- Credential-provider write failures are now normalized to a generic worker
  error so a backend exception cannot echo a raw key into an Agent response.
- Added standalone runtime-surface and credential redaction tests.
- Added `PROJECT_CONTEXT.md` and `DEVELOPMENT_LOG.md` for cross-computer handoff.
- Added `scripts/install-to-dsh.ps1`, which stages the tarball before invoking
  DSH so the current upstream Windows path-forwarding issue is isolated from
  the user's project path.

## Verification

- `pnpm exec tsc --noEmit --pretty false`: passed.
- `pnpm run build`: passed; emitted `lib/index.js`, `lib/client.js`,
  `lib/worker-pool.js`, and `lib/invariant.js`.
- `pnpm exec vitest run`: passed, 6 files / 9 tests, including official
  Loader/Include registration of `fhl_image_configure`,
  `fhl_image_generate`, and `fhl_image_edit`.
- `pnpm pack --dry-run`: package contents contain only built library files,
  manifests, README files, license and changelog.
- The produced tarball was installed in an isolated temporary DSH profile
  using a no-space temporary path. The profile manifest automatically added
  `@fhl-plugins/dsh-fhl-image` to `dsh.profile.bundles`, and `--dump-config`
  showed the `fhl-image` entry with the expected environment-backed config.
- The same install using the source path under `E:\AI\whitecodex Setup 0.2.0\...`
  failed before pnpm could read the tarball because the DSH Windows CLI
  forwards an absolute path through `shell:true` without quoting spaces. This
  is an upstream CLI portability issue, not a plugin build failure.
- Repeating the installation without `--ignore-scripts` also succeeded,
  confirming the prebuilt tarball does not require a Git checkout build step.
- Final clean-profile evidence was saved to
  `verification/2026-08-21-final-profile-install.md`; the latest tarball's
  profile manifest and composed dump both include the FHL bundle layer.
- The Windows install helper passed a PowerShell parser check; its live install
  path will be exercised with a real DSH executable in the next acceptance
  batch.
- Final development tarball: `artifacts/fhl-plugins-dsh-fhl-image-0.1.0-dev.0.tgz`.
  SHA-256: `419E7ECF7013CFCF624897013663334240D69B79DBFE69F46E0D7C775F2BC47C`.
- No real FHL API, image generation request or paid service was called.

## Remaining Risk

The package has not yet completed a full profile boot assertion that inspects
the registered tool catalog. The next gate should run that assertion from a
no-space temporary profile or after the upstream path-forwarding issue is
fixed.

## Rollback

Revert this batch's files only; do not reset or clean the workspace. The
previous standalone source remains independently recoverable from the files
under `src/` and the existing FHL Harness source remains untouched.
