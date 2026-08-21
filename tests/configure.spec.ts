import { describe, expect, it } from 'vitest'
import { configureWorkers } from '../src/configure.ts'

describe('chat worker configuration', () => {
  it('deduplicates keys, stores at most ten workers, and returns masked state', async () => {
    const values = new Map<string, string>()
    const result = await configureWorkers({
      set: async (ref, value) => { values.set(String(ref), value) },
    }, {
      apiKeyEnv: 'FHL_IMAGE_API_KEY',
      keys: ['worker-first-test-secret', 'worker-first-test-secret', 'worker-second-test-secret'],
    })

    expect(result.configured).toBe(2)
    expect(result.skipped).toBe(0)
    expect(values).toEqual(new Map([
      ['FHL_IMAGE_API_KEY', 'worker-first-test-secret'],
      ['FHL_IMAGE_API_KEY_2', 'worker-second-test-secret'],
    ]))
    expect(result.workers.map(worker => worker.preview)).toEqual(['[configured]', '[configured]'])
    expect(JSON.stringify(result)).not.toContain('worker-first-test-secret')
    expect(JSON.stringify(result)).not.toContain('worker-second-test-secret')
  })

  it('reports excess keys without writing more than ten slots', async () => {
    const refs: string[] = []
    const keys = Array.from({ length: 12 }, (_, index) => `key-${index + 1}`)
    const result = await configureWorkers({
      set: async ref => { refs.push(String(ref)) },
    }, { apiKeyEnv: 'FHL_IMAGE_API_KEY', keys })

    expect(result.configured).toBe(10)
    expect(result.skipped).toBe(2)
    expect(refs).toHaveLength(10)
    expect(refs.at(-1)).toBe('FHL_IMAGE_API_KEY_10')
  })

  it('does not expose any part of a key when credential storage fails', async () => {
    const secret = 'worker-a-sensitive-test-key'
    const failure = configureWorkers({
      set: async () => { throw new Error(`storage failed for ${secret}`) },
    }, {
      apiKeyEnv: 'FHL_IMAGE_API_KEY',
      keys: [secret],
    })
    await expect(failure).rejects.toThrow('FHL image worker 1 could not be configured')
    await expect(failure).rejects.not.toThrow(secret)
  })
})
