# Upstream Compatibility

This project is an independent community plugin for DeepSeek Harness. It is
not a fork of the full DSH application and does not modify the local DSH or
FHL Harness workspaces.

## Target Compatibility

- DSH published package line: `0.2.0-rc.2` (the line shipped by the official
  desktop application; plugin version `0.2.1`)
- Cordis: `4.0.4`
- Schemastery: `3.18.4`
- Node.js: `>=22.19.0` (the desktop runtime ships Node 24)
- Distribution shape: prebuilt `.tgz` (or npm package) with a
  `dsh.bundle.patch` manifest, installed into a DSH profile
- Install surface: the official desktop application's plugin manager / GUI, or
  `dsh plugin --profile <name> add <absolute .tgz path>` for CLI profiles

## Install Compatibility Gate

DSH 0.2 evaluates `evaluatePluginCompatibility()` from
`@deepseek-ai/dsh-app-boot` before installation and again at startup: every
`peerDependencies` entry named `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*` must
satisfy the running DSH version with `includePrerelease: true`. An unsatisfied
range is a hard `incompatible-version` failure (installation is refused;
startup skips the bundle). `engines.dsh` is declarative only and is not
enforced, so the peer ranges are the real contract.

This plugin therefore declares every DSH peer as `>=0.2.0-rc.2 <0.3.0-0`, and
`tests/manifest.spec.ts` asserts those ranges against the target runtime so a
version bump cannot silently break installation.

## API Notes for This Line

- `Session.events` was removed in 0.2. Edit-source resolution reads the derived
  message history (`Session.deriveMessages()`) and keeps a bounded per-session
  memory of produced images instead of scanning raw session events.
- `defineTool` parameter/output/render shapes, the credentials seam
  (`credentialRef`/`set`/`resolve` plus `credentials/reference-updated`), the
  attachment seam (`AttachmentId`/`saveImage`/`readImage`), and
  `ctx.systemPrompt.section` are unchanged from 0.1.x.
- Prompt sections were centralized into `SECTION_ORDERS` in 0.2; this plugin
  registers its tool guidance at order `2500` inside the tool band (the 0.1
  value `119` would fall in the persona/policy band).

## Design References

- DeepSeek Harness plugin publishing guide and profile/bundle contract.
- `Lum1104/dsh-browser`, which demonstrates an independent repository combining
  a Cordis bundle with an external integration surface.

The official project is in developer preview. Every release must record the
DSH package line used for typecheck, build, and integration tests.
