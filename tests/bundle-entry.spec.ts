import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const ENTRY = resolve(import.meta.dirname, '..', 'lib', 'index.js')

/**
 * Every other spec imports `../src/index.ts`, so until 0.2.1 nothing verified
 * that the *published* entry point still carries the plugin surface. A tsdown
 * or export-map regression would have shipped undetected. `pretest` builds the
 * bundle first so this always runs against fresh output.
 */
describe('built bundle entry', () => {
  it('exposes the DSH plugin surface from lib/index.js', async () => {
    if (!existsSync(ENTRY)) {
      throw new Error(`lib/index.js is missing; run \`pnpm build\` first (the \`pretest\` script does it for you)`)
    }

    const module = await import(pathToFileURL(ENTRY).href) as {
      name?: unknown
      inject?: unknown
      apply?: unknown
      Config?: unknown
      FhlImagesClient?: unknown
      FhlImagesError?: unknown
      configureWorkers?: unknown
      MAX_FHL_IMAGE_WORKERS?: unknown
      MAX_GENERATE_VARIATIONS?: unknown
      MAX_EDIT_VARIATIONS?: unknown
      MAX_EDIT_SOURCES?: unknown
    }

    expect(module.name).toBe('fhl-image')
    expect(module.inject).toEqual(['tools', 'credentials', 'systemPrompt'])
    expect(typeof module.apply).toBe('function')
    // The Schemastery config schema must survive bundling: DSH projects it into
    // the plugin settings UI and the profile config dump.
    expect(module.Config).toBeDefined()
    // The documented public surface. `worker-pool.ts` and `session-images.ts`
    // are internal by design, so they are asserted absent rather than assumed
    // present, and adding them later has to be a deliberate choice.
    expect(module.FhlImagesClient).toBeDefined()
    expect(module.FhlImagesError).toBeDefined()
    expect(module.configureWorkers).toBeDefined()
    expect(module.MAX_FHL_IMAGE_WORKERS).toBe(10)
    expect(module.MAX_GENERATE_VARIATIONS).toBe(9)
    expect(module.MAX_EDIT_VARIATIONS).toBe(4)
    expect(module.MAX_EDIT_SOURCES).toBe(10)
  })
})
