import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('standalone DSH bundle manifest', () => {
  it('declares an installable bundle patch', () => {
    const root = resolve(import.meta.dirname, '..')
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
      peerDependencies?: Record<string, string>
    }
    expect(packageJson.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(packageJson.peerDependencies?.['@deepseek-ai/dsh-tools']).toBeTruthy()
    expect(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8')).toContain("@fhl-plugins/dsh-fhl-image")
  })
})
