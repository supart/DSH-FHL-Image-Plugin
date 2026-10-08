import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['lib/types/index.js', 'lib/types/client.js', 'lib/types/worker-pool.js', 'lib/types/session-images.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  // `tsc` emits the declaration/runtime staging files under lib/types; the
  // bundle pass must preserve them because package exports point at those
  // declarations. This mirrors the DSH package build layout.
  clean: false,
})
