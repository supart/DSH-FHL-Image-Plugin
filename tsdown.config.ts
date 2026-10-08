import { defineConfig } from 'tsdown'

/**
 * Specifiers the DSH client module loader answers itself. They must stay
 * unbundled because the loader's synchronous `require` resolves them from the
 * host module table (the platform seed), not from this package.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** The package id the client module loader registers this entry under. */
const CLIENT_ID = '@fhl-plugins/dsh-fhl-image'

/**
 * The DSH client does not load a client half as an ES module. It loads a
 * classic script that calls `window.__ModuleLoader__.load({ id, factory })`,
 * and the loader hands that factory the synchronous `require` used for every
 * external (see `dsh-client-modules`). A bare CJS bundle therefore never runs:
 * its top-level `require`/`exports` are browser globals that do not exist. This
 * wrapper supplies the factory scope the loader expects and returns the module
 * exports Cordis reads `apply` and `inject` from.
 *
 * Both passes pin their emitted name: the browser pass is served under the
 * `./ui` export the manifest declares, and `fixedExtension: false` alone would
 * spell a CJS chunk `ui.cjs`.
 */
function clientModuleWrapper(id: string) {
  return {
    name: 'dsh-client-module-wrapper',
    outputOptions(options: { format?: string; entryFileNames?: unknown; banner?: unknown; footer?: unknown }) {
      if (options.format !== 'cjs') return
      return {
        ...options,
        entryFileNames: 'ui.js',
        banner: `window.__ModuleLoader__.load({\n\tid: ${JSON.stringify(id)},\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;`,
        footer: '\t\treturn module.exports;\n\t}\n});',
      }
    },
  }
}

export default defineConfig([
  {
    // Host half. `tsc` emits the declaration/runtime staging files under
    // lib/types; this pass must preserve them because package exports point at
    // those declarations, so `clean` stays off.
    entry: ['lib/types/index.js', 'lib/types/client.js', 'lib/types/worker-pool.js', 'lib/types/session-images.js', 'lib/types/invariant.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    // Browser half: `lib/types/ui.js` is the staged tsc output for src/ui.ts,
    // and the published `./ui` export points at the factory this entry
    // produces.
    entry: ['lib/types/ui.js'],
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    deps: { neverBundle: CLIENT_EXTERNALS },
    plugins: [clientModuleWrapper(CLIENT_ID)],
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])
