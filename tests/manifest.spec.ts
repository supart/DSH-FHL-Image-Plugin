import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { satisfies } from 'semver'
import { describe, expect, it } from 'vitest'

/**
 * The DSH runtime this bundle is built for: the version shipped by the official
 * desktop application the plugin is installed into. `evaluatePluginCompatibility`
 * in `@deepseek-ai/dsh-app-boot` semver-checks every `@deepseek-ai/dsh*` peer
 * against this value with `includePrerelease: true` and refuses installation and
 * startup on a mismatch, so the ranges are part of the install contract.
 */
const DSH_RUNTIME_VERSION = '0.2.0-rc.2'

interface Manifest {
  version?: string
  dsh?: { bundle?: { patch?: string } }
  engines?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function manifest(): { root: string; packageJson: Manifest } {
  const root = resolve(import.meta.dirname, '..')
  return { root, packageJson: JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as Manifest }
}

describe('standalone DSH bundle manifest', () => {
  it('declares an installable bundle patch', () => {
    const { root, packageJson } = manifest()
    expect(packageJson.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(packageJson.peerDependencies?.['@deepseek-ai/dsh-tools']).toBeTruthy()
    expect(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8')).toContain("@fhl-plugins/dsh-fhl-image")
  })

  it('targets the 0.2 desktop line', () => {
    const { packageJson } = manifest()
    // Pin the line, not the patch: every 0.2.x release must stay installable on
    // the desktop 0.2 runtime, while the exact patch number changes per release.
    expect(packageJson.version).toMatch(/^0\.2\.\d+$/)
    expect(satisfies(DSH_RUNTIME_VERSION, packageJson.engines?.dsh ?? '', { includePrerelease: true })).toBe(true)
  })

  it('keeps every dsh peer compatible with the running desktop runtime', () => {
    const { packageJson } = manifest()
    const peers = Object.entries(packageJson.peerDependencies ?? {})
      .filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
    expect(peers.length).toBeGreaterThan(0)
    for (const [name, range] of peers) {
      expect({ name, range, ok: satisfies(DSH_RUNTIME_VERSION, range, { includePrerelease: true }) })
        .toEqual({ name, range, ok: true })
    }
  })

  it('does not depend on a shell environment for its bundle config', () => {
    const { root } = manifest()
    expect(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8')).not.toContain('process.env')
  })
})
