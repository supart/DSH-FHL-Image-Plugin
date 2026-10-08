# FHL Image Gen DSH Plugin Current Context

## Current Breakpoint

2026-10-08: version `0.2.1` is released on the package line shipped by the
official DeepSeek Harness desktop application (`0.2.0-rc.2`). It is a hardening
release on top of the `0.2.0` desktop port: eight correctness defects were
fixed, credential redaction was extended to the last hop, the test suite grew
from 20 to 71 cases, `tests/` is now typechecked, and GitHub Actions runs the
whole gate sequence on Node 22.19 and 24.

The verified breakpoint is: offline typecheck/test/build/pack gates, tarball
safety scan, bundled-module resolution, a replicated `evaluatePluginCompatibility`
check against `0.2.0-rc.2`, and a real installation into the desktop profile
without a version exemption. Both 0.2.0 and 0.2.1 have now carried a **real**
FHL image request end to end: `fhl_image_generate` returned a 1088x1920 PNG that
the DSH attachment service persisted, and no key appeared in the tool result.

Publication is complete. `main` and `dsh-fhl-image/0.2.1-development` are pushed,
the annotated tag `v0.2.1` points at `3b7e6d2`, the Release
`DSH FHL Image 0.2.1` is the latest with the tarball attached, and CI passed on
both branches on its first run. `v0.1.0` was neither moved nor force-pushed.

## Identity

- Package: `@fhl-plugins/dsh-fhl-image`
- Version: `0.2.1`
- Plugin id: `fhl-image`
- Repository: `https://github.com/supart/DSH-FHL-Image-Plugin`
- Compatible DSH line: `0.2.0-rc.2` (peer ranges `>=0.2.0-rc.2 <0.3.0-0`)
- Runtime: Node.js `22.19+` (desktop ships Node 24); Cordis `~4.0.4`;
  Schemastery `3.18.4`
- License: MIT

## What The Standard Actually Requires

Verified against the shipped runtime inside
`/Applications/DeepSeek Harness.app/Contents/Resources/app.asar`, not against a
source checkout:

- The single required bundle field is `package.json` `dsh.bundle.patch`
  (a string or an ordered list); `bundleManifest()` returns `undefined` without
  it. This plugin declares `./cordis.patch.yml`.
- `evaluatePluginCompatibility()` (`dsh-app-boot`) semver-checks **only**
  `@deepseek-ai/dsh` and `@deepseek-ai/dsh-*` peers, with
  `includePrerelease: true`. `@deepseek-ai/cordis` and `@deepseek-ai/schemastery`
  are skipped entirely.
- `engines.dsh` is documented as optional and is **not enforced** by current
  installers or loaders. It is kept here as information only; the peer ranges
  are the real gate.
- A `.tgz` dependency skips the registry preflight, so the startup check is what
  actually refuses an incompatible bundle.
- `dsh.client` (`inject` + `platform`) is the browser-client plugin field. This
  plugin is server-side only and deliberately ships no client plugin.
- The packed asar contains no `.d.ts` files, so any standard claim resting on a
  shipped type declaration is unverifiable on this machine; claims above rest on
  shipped `.js`.

## Fixed In 0.2.1

- **Worker replacement.** `fhl_image_configure` could only write, never remove,
  so re-configuring with fewer keys left revoked keys live in slots 2-10 while
  still being scheduled against. It now clears slots above the supplied count.
- **Retry fan-out.** Local validation shared the retryable `request` code, so a
  blank prompt was retried across every worker (up to 9 x 10 requests) and ended
  as "all workers failed". Validation now carries `invalid-request`.
- **Implicit edit sources.** Omitting `sources` fed the whole last produced set
  into one edit; it now uses only the newest image, as the prompt always said.
- **Base64 tolerance.** Padding-free, base64url and data-URI-prefixed payloads
  decode instead of failing as `invalid-image`.
- **Bounded error bodies.** A failed response is read as a bounded prefix and
  the stream is cancelled, instead of buffering up to 64 MiB first.
- **Redaction to the last hop.** The `task-fatal` branch rethrew raw errors; it
  now scrubs every key known to the pool.

## Verified In This Batch

- `pnpm typecheck`: `tsconfig.test.json` now covers `src` **and** `tests`. Adding
  it immediately exposed four real type errors in the test fixtures, which were
  fixed rather than suppressed. `tsconfig.json` alone only covers `src` and must
  not be used as the type gate.
- `pnpm test`: 9 files / 71 tests, up from 7 files / 20 tests. New:
  `tests/worker-pool.spec.ts` (23 cases for the previously untested concurrency
  core), tool-execution coverage inside `tests/plugin-registration.spec.ts`, and
  `tests/bundle-entry.spec.ts`, which loads the built `lib/index.js` so a
  bundling or export-map regression cannot ship unnoticed.
- `pnpm build` and `pnpm pack`:
  `artifacts/fhl-plugins-dsh-fhl-image-0.2.1.tgz`, SHA-256
  `d90bcebc5b430c00c28ba2e8b19acd307d54896eda6ba3e0ec83a437a8d113f4`, 42 files.
- The bundler now emits a content-hashed shared chunk (`lib/client-*.js`); the
  CI pack step walks every relative import in `lib/` to prove no chunk is left
  out of the tarball.
- Tarball scan: no key-like text, no absolute local paths, no `.env` or
  credentials. The six Chinese documents the README links to are now included
  (`files` previously shipped only `docs/assets`, so those links were dead once
  installed).
- Replicated `evaluatePluginCompatibility` against `0.2.0-rc.2`: 7 `dsh` peers
  checked, all satisfied with prereleases included.
- Desktop profile: upgraded in place to `0.2.1`; the installed copy is
  byte-identical to the tarball, `dsh-orb` and its dependencies are intact, the
  profile `cordis.patch.yml` is byte-identical (SHA-256
  `72434266835d0d86ac4d11777de6a097dd70d18668e62aacf79c419f72ca9b67`), and no
  `compatibility.json` was created.
- **Real image acceptance**: `fhl_image_generate` produced a real image through
  a configured worker, closing the "no real FHL image request was made" gap left
  open by 0.2.0. This exercised the desktop app's already-loaded `0.2.0` code;
  the profile now holds `0.2.1`, which takes effect on the next app start.

## Documentation Updated

- `CHANGELOG.md`, `README.md`, `README-FIRST.zh-CN.md`, `UPSTREAM.md`
- `docs/INSTALL.zh-CN.md`, `docs/CONFIGURATION.zh-CN.md`,
  `docs/TROUBLESHOOTING.zh-CN.md`, `docs/SECURITY.zh-CN.md`,
  `docs/DEVELOPMENT.zh-CN.md`, `docs/RELEASE_NOTES.zh-CN.md`
- `docs/changes/2026-10-08-0.2.1-hardening.md`

`docs/SECURITY.zh-CN.md` now names the second plaintext copy of a chat-configured
key explicitly: the `keys` parameter is a durable tool-call argument, so the host
writes it into the on-disk session record in addition to the user message.

## Local Git Boundary

- History was attached by cloning the public repository and moving its `.git`
  into this working copy. The GitHub transport that was previously blocked by the
  Xcode licence agreement now works; `gh` is authenticated as `supart`.
- Work is committed on `dsh-fhl-image/0.2.1-development`, then fast-forwarded
  into `main`.
- `v0.1.0` must not be moved or force-pushed. Tarballs stay git-ignored release
  attachments and are never committed.

## Safety Boundaries

- API keys, credentials, sessions, generated images, logs and build caches stay
  outside source control and release metadata.
- Chat configuration is allowed only after explicit user intent; its key may
  pass through the selected model, the durable session history, **and the
  persisted tool-call arguments**. The plugin stores keys only through the DSH
  credential provider and never echoes them.
- The plugin does not read arbitrary local paths, execute shell commands or
  download unknown remote plugins.
- The installation changed only the `desktop` profile's manifest, lockfile and
  `node_modules`; the original DSH application and all other product lines
  remain untouched.

## Resume Commands

The desktop runtime ships its own Node and pnpm under
`<DSH_HOME>/dsh-runtimes/dsh-primary-runtime/dependencies/`. Substitute the two
paths for your machine; the commands themselves are portable. Documentation in
this repository deliberately carries no absolute home-directory paths.

```sh
NODE=<DSH_HOME>/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node
PNPM=<DSH_HOME>/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs
"$NODE" "$PNPM" install --frozen-lockfile --ignore-scripts
"$NODE" "$PNPM" typecheck
"$NODE" "$PNPM" test          # pretest rebuilds lib/ for the bundle-entry test
"$NODE" "$PNPM" build
"$NODE" "$PNPM" pack --pack-destination artifacts
```

Remaining for the next acceptance: publish `v0.2.1` (push, tag, Release asset)
and, optionally, a Windows desktop verification. Keep all records free of keys
and private conversation text.
