import { describe, expect, it } from 'vitest'
import * as bundle from '../src/index.ts'

describe('standalone bundle runtime surface', () => {
  it('exports a DSH plugin entry with the standalone identity', () => {
    expect(bundle.name).toBe('fhl-image')
    expect(bundle.inject).toEqual(['tools', 'credentials', 'systemPrompt'])
    expect(typeof bundle.apply).toBe('function')
    expect(bundle.Config).toBeDefined()
  })
})
