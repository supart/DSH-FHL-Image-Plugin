# Changelog

## 0.2.2

Generated and edited images now render in the conversation. No changes to the
tool surface, the host half, or the stored credentials, so it is a drop-in
replacement for `0.2.1`.

### Added

- **A browser half that claims the image row for both image-bearing tools.** The
  image tools have always returned durable `image` content blocks, but the Tool
  client draws them only for the built-in `read_image` call
  (`imageCardModel` returns null for every other Tool name), so a settled
  `fhl_image_generate`/`fhl_image_edit` result appeared as
  "Generated 2 image(s) at 1152x2048" with no picture. The bundle now ships
  `exports["./ui"]` and declares `dsh.client`, registering a keyed
  `tool.call.toolview` entry for each of the two names; the row shows every
  durable image through the session-authorized `loadImage` loader and keeps the
  result envelope text beneath the gallery.
- `tests/ui-bundle.spec.ts`: five cases that load the *built* `lib/ui.js` behind
  a stubbed `window.__ModuleLoader__`, assert the registered id, the Cordis
  `apply`/`inject` surface, the two claimed keys, the absence of a child gallery
  declaration, and render the registered component through React to prove the
  gallery emits an `<img>` per reference with its envelope text.

### Changed

- `tsdown` now runs two passes: the existing Node host pass plus a browser pass
  that emits `lib/ui.js` as the `window.__ModuleLoader__.load({ id, factory })`
  factory the client module loader registers. React and the other platform-seed
  specifiers stay external, because the loader answers them from the host module
  table.
- `tsconfig.json` adds the `DOM` library, and `react`/`react-dom` are
  development dependencies used by the render test. Neither reaches the
  published package, and no `@deepseek-ai/dsh-client-ui-*` package is imported:
  the client contracts `src/ui.ts` compiles against are declared locally, and
  the value validation is runtime, so a contract drift degrades to the generic
  row rather than to a load failure.

### Notes

- `tool.call.images` is deliberately not declared as a child slot. The built-in
  read_image view already claims it and the slot registry permits exactly one
  declarer per child key, so a second declaration throws while the client loads.
- The client half requires a full application restart to load; the host half
  alone still works without one.

## 0.2.1

Correctness, credential-hygiene and release-engineering fixes on the desktop
`0.2.0-rc.2` line. No changes to the tool surface, so it is a drop-in
replacement for `0.2.0`.

### Fixed

- **`fhl_image_configure` now replaces the worker set.** It could previously
  only write, never remove, so configuring one key after ten left slots 2-10
  holding revoked keys that the pool still scheduled against, while the result
  reported a single configured worker. Slots above the supplied key count are
  now cleared. A reference the launching environment supplies read-only cannot
  be removed; that refusal is tolerated instead of failing the whole call.
- **A deterministic input error no longer fans out across the pool.** Local
  validation shared the transport's retryable `request` code, so a blank prompt
  was retried against every worker — up to 9 x 10 pointless requests per call —
  and ended as "all configured workers failed", hiding the real cause.
  Validation now raises its own non-retryable code.
- **Implicit edit sources use the newest image only.** Omitting `sources` fed
  the whole last produced set (up to nine variations) into one edit, while the
  prompt section and every document promised "the newest image".
- **Base64 decoding accepts real-world payloads**: padding-free, base64url and
  data-URI-prefixed values are decoded instead of rejected as `invalid-image`
  (which then triggered the retry storm above).
- **A failed response body is no longer buffered whole.** The body was read up
  to the 64 MiB image ceiling before being truncated to 512 characters for the
  message; only a bounded prefix is read now and the stream is cancelled.
- **Redaction reaches the last hop.** The `task-fatal` branch rethrew the
  original error verbatim, so a third-party fetch/undici message could carry a
  worker key to the model. That path now scrubs every key known to the pool,
  and the client scrubs both the raw and the trimmed spelling of its key.
- `skipped` counts duplicates as well as excess keys, matching the result text.
- `pnpm typecheck` now covers `tests/` as well as `src/`, which immediately
  surfaced four previously invisible type errors in the test fixtures.

### Added

- Worker-pool test suite (23 cases) covering worker rotation, retry and fatal
  classification, cooldown expiry, exhaustion, partial failure, cancellation and
  credential redaction. The pool previously had no tests at all.
- Tool-execution tests for `fhl_image_configure`, `fhl_image_generate` and
  `fhl_image_edit`, plus negative registration coverage.
- `tests/bundle-entry.spec.ts`, which loads the built `lib/index.js` so a
  bundling or export-map regression cannot ship unnoticed.
- Client tests for base64 variants, multipart edits, bounded error bodies,
  oversized successful responses, cancellation and key redaction.
- GitHub Actions CI: typecheck, test, build and pack on Node 22.19 and 24, with
  a tarball scan for key-like material, absolute local paths, and unresolved
  relative module imports.
- `.gitattributes` pinning LF in the repository.
- The six Chinese documents the README links to are now shipped in the tarball;
  previously only `docs/assets` was, so those links were dead once installed.
- `publishConfig`, `homepage` and `bugs` manifest metadata.

### Changed

- `@deepseek-ai/cordis` peer relaxed from the exact `4.0.4` to `~4.0.4`,
  matching how DSH's own packages declare it.
- Product limits (10 workers, 9 generate variations, 4 edit variations, 10 edit
  references) now live in one exported constant table, and the tool descriptions
  are generated from it.

## 0.2.0

- Re-targeted the plugin from the DSH `0.1.1-rc.1` line to the official desktop
  line `0.2.0-rc.2`, so it installs through the desktop application's plugin
  manager without a version exemption.
- Declared every `@deepseek-ai/dsh*` peer as `>=0.2.0-rc.2 <0.3.0-0`; DSH 0.2
  semver-checks those ranges and refuses installation or startup otherwise.
  Added a manifest regression test that asserts the ranges against the target
  runtime.
- Removed the `Session.events` scans. Edit sources now come from the derived
  message history (`Session.deriveMessages()`) plus a bounded, plugin-owned,
  per-session memory of produced images, because DSH 0.2 removed that getter
  and deprecates synchronous session-event reads.
- Made the bundle config deterministic: `cordis.patch.yml` no longer evaluates
  `process.env`, which a GUI-launched desktop application cannot be assumed to
  provide. Values are overridable from a profile patch layer instead.
- Moved the prompt section into the 0.2 tool band (order `2500`, between
  `TOOL_GOAL` and `TOOL_WORKFLOW`) instead of the pre-0.2 value `119`.
- Dropped the `prepare` script so the published `.tgz` never requires a build
  authorization during installation, and dropped the unused
  `@deepseek-ai/dsh-agent` peer.
- Rewrote the installation, configuration, and troubleshooting documents
  desktop-first, with the CLI profile flow kept as the advanced path.

## 0.1.0

- Promoted the standalone DSH plugin from the development snapshot to the
  first documented `0.1.0` release candidate package identity.
- Added Chinese installation, chat configuration, troubleshooting, security,
  development, and release-note documentation based on the verified Windows
  installation path.
- Set the independent repository URL to
  `https://github.com/supart/DSH-FHL-Image-Plugin`.
- Prepared a clean local Git baseline; no remote push or GitHub Release is
  created by this batch.

## 0.1.0-dev.0

- Initial independent DSH bundle scaffold.
- Added FHL Images generation and edit tools.
- Added up to ten credential-backed image workers.
- Added chat-mediated worker credential configuration with masked output.
- Added English and Chinese installation and security documentation.
- Verified the standalone bundle surface with strict TypeScript, tsdown,
  eight offline tests, tarball scanning, and an isolated DSH profile dump.
- Added a Windows install helper for source paths containing spaces.
