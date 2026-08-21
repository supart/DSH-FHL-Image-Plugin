# Upstream Compatibility

This project is an independent community plugin for DeepSeek Harness. It is
not a fork of the full DSH application and does not modify the local DSH or
FHL Harness workspaces.

## Target Compatibility

- DSH published package line: `0.1.1-rc.1`
- Cordis: `^4.0.1`
- Node.js: `^22.19.0` or `>=24.0.0`
- Distribution shape: npm package or prebuilt `.tgz` with a `dsh.bundle.patch`
  manifest

## Design References

- DeepSeek Harness plugin publishing guide and profile/bundle contract.
- `Lum1104/dsh-browser`, which demonstrates an independent repository combining
  a Cordis bundle with an external integration surface.

The official project is in developer preview. Every release must record the
DSH package line used for typecheck, build, and integration tests.
