# FHL Image Gen DSH Plugin Development Log

| Batch | Date | Status | Result |
| --- | --- | --- | --- |
| `P0-standalone-scaffold` | 2026-08-21 | Completed | Created an isolated MIT DSH bundle with FHL generation/edit clients, worker pool, chat configuration tool, attachment output and bundle patch. |
| `P1-build-and-security-gate` | 2026-08-21 | Completed | Fixed DSH credential typing, ESM output, declaration staging, package identity and key-preview leakage; offline build/test/pack gates passed. |
| `P2-clean-profile-install` | 2026-08-21 | Partially completed | Prebuilt tarball installation and `--dump-config` passed in a clean temporary profile. Windows paths containing spaces require the project helper because of the upstream CLI forwarding behavior. |
| `P3-standalone-security-followup` | 2026-08-21 | Completed | Credential-provider failures are sanitized and official Loader/Include smoke coverage confirms the three model-visible tools. |
| `P4-0.1.0-docs-and-local-baseline` | 2026-08-21 | Completed | Promoted package metadata to `0.1.0`, added Chinese installation/configuration/troubleshooting/security/development docs, built the release tarball, refreshed hashes and manifests, reinstalled into a clean temporary profile, and created the local Git baseline. Real chat/API acceptance remains pending user authorization. |
| `P5-chat-api-configuration` | 2026-08-21 | Completed (user-confirmed) | User confirmed successful FHL Worker API configuration in the DSH chat window through `fhl_image_configure`; the exact trigger prompt and a sanitized record are stored. Worker count and post-restart persistence were not supplied; no image generation/edit request is claimed. |
| `P6-github-readme-illustrations` | 2026-08-21 | Completed | Added two real-usage screenshots to the bilingual README and `docs/assets/`, included them in the tarball, replaced secret-scanner-looking test fixtures with synthetic names, rebuilt the package, and refreshed the SHA-256/manifests. |
| `P7-github-publication` | 2026-08-21 | Completed | Created the public repository, published `main`, development branch, baseline tag and `v0.1.0`, created the Release, uploaded five assets, verified the public tarball hash and installed it in a clean DSH profile. Git transport was unavailable, so GitHub Git Data API was used with the local credential manager; no real model or image API was called. |
| `P8-first-time-user-bundle` | 2026-08-21 | Completed | Added a Chinese first-time-user guide, a double-click Windows installer helper, clearer plugin-vs-DSH wording, and a user bundle. Rebuilt the tarball, passed the offline gates, fast-forwarded `main`, updated the development branch, refreshed the `v0.1.0` Release and verified public asset hashes. |
| `P9-github-readme-chinese-homepage` | 2026-08-22 | Completed locally | Made `README.md` the Chinese-first single homepage with same-page English anchors, reduced `README.zh.md` to a compatibility entry, and added a homepage link to the first-time guide. Typecheck, tests, build, pack, link checks and credential-style scan passed. Remote source sync remains the final step; no Release asset or tag changes. |
| `P10-desktop-0.2.0-port` | 2026-10-02 | Completed locally | Re-targeted the bundle to the official desktop line `0.2.0-rc.2`: peer ranges `>=0.2.0-rc.2 <0.3.0-0`, `Session.events` replaced by derived-message sourcing plus a bounded produced-image memory, deterministic bundle config, prompt section order 2500, no install-time build script, desktop-first docs. Typecheck, 20 tests, build, pack and sensitive scan passed; the tarball installed into the desktop profile through the plugin manager without a version exemption and registered all three tools live. Remote tag/Release and Windows desktop verification remain open. |
| `P11-0.2.1-hardening` | 2026-10-08 | Completed | Hardened the desktop line against the shipped runtime rather than a source checkout. Fixed five defects: worker reconfiguration now clears slots above the supplied keys instead of leaving revoked keys live; local validation no longer shares the retryable transport code (a blank prompt used to fan out across every worker); implicit edit sources use the newest image rather than the whole produced set; padding-free/base64url/data-URI payloads decode; a failed response body is read as a bounded prefix and cancelled instead of buffered to 64 MiB. Extended redaction to the `task-fatal` rethrow path and to padded key spellings. Test suite 20 -> 71 cases including a new worker-pool suite, tool-execution coverage, and a built-artifact entry test; `tsconfig.test.json` now typechecks `tests/` and immediately surfaced four real fixture type errors. Added GitHub Actions CI on Node 22.19 and 24 with a tarball scan and a bundled-module resolution check, `.gitattributes`, `publishConfig`/`homepage`/`bugs`, a relaxed `~4.0.4` cordis peer, a single product-limit constant table, and the six README-linked Chinese docs in the tarball. A real `fhl_image_generate` request succeeded end to end. Published as `v0.2.1`: `main` and the development branch pushed, tag created, Release asset attached, CI green. |
| `P12-client-image-row` | 2026-10-08 | Completed locally, browser acceptance pending | Added the browser half (`src/ui.ts`) that claims the keyed `tool.call.toolview` for `fhl_image_generate` and `fhl_image_edit`, so generated and edited images render in the conversation instead of a text-only row. Root cause read from the shipped client: the generic Tool card draws images only for `read_image` (`imageCardModel`), while a keyed toolview replaces that row. The registry permits exactly one declarer of the child `tool.call.images`, already owned by the read_image view, so the new entries claim their keys and render through the host-provided `loadImage` loader instead of declaring a child slot. The server pass gained a browser pass emitting `lib/ui.js` in the `window.__ModuleLoader__.load({ id, factory })` shape the client module loader registers, with React and the other platform seeds external; `tsconfig.test.json` typechecks the new source, and `tests/ui-bundle.spec.ts` loads the built bundle behind a stubbed loader and renders the registered component through React. Typecheck, 74 tests, build and pack pass; the browser row itself needs a desktop restart to observe and is not yet claimed. Version bumped to `0.2.2` because reinstalling an unchanged version reports `ambiguous-install`. |

Detailed evidence:

- [`2026-10-08-0.2.2-client-image-row.md`](docs/changes/2026-10-08-0.2.2-client-image-row.md)
- [`2026-10-08-0.2.1-hardening.md`](docs/changes/2026-10-08-0.2.1-hardening.md)
- [`2026-10-02-desktop-0.2.0-port.md`](docs/changes/2026-10-02-desktop-0.2.0-port.md)
- [`2026-08-21-standalone-plugin-build.md`](docs/changes/2026-08-21-standalone-plugin-build.md)
- [`2026-08-21-0.1.0-release-preparation.md`](docs/changes/2026-08-21-0.1.0-release-preparation.md)
- [`2026-08-21-0.1.0-profile-install.md`](verification/2026-08-21-0.1.0-profile-install.md)
- [`artifacts/VERIFICATION_REPORT.md`](artifacts/VERIFICATION_REPORT.md)

## Current Boundary

The source package is publicly available at
`https://github.com/supart/DSH-FHL-Image-Plugin`. Version `0.2.1` targets the
official desktop line `0.2.0-rc.2`, is installed and exercised in a local
`desktop` profile without a version exemption, and is published: `main` and
`dsh-fhl-image/0.2.1-development` are pushed, tag `v0.2.1` points at `3b7e6d2`,
the Release carries the tarball, and CI is green on both branches. A real image
request succeeded, which closes the last verification gap `0.2.0` left open.

Version `0.2.2` adds the browser half that renders generated and edited images
in the conversation. It is committed and pushed on `main`; it has no tag and no
Release asset, so the published tarball still lacks the browser half until a
release is cut, and the browser row itself has not yet been observed in a
running desktop application (the client half loads only at startup, so
acceptance needs a full quit, reopen and new session).

Still open: post-restart implicit-edit persistence is intentionally not claimed;
Windows desktop verification has no record; the `0.2.2` browser row has no
observed acceptance record; and the multipart reference field naming (`image`
for the first reference, `image[]` for the rest) is pinned by a test rather than
changed, because altering it is a protocol change that needs a live endpoint
check. Do not rewrite or force-push `v0.1.0`.
