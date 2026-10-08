import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { describe, expect, it } from 'vitest'
import { configureWorkers } from '../src/configure.ts'
import { MAX_FHL_IMAGE_WORKERS } from '../src/types.ts'

const ENV = 'FHL_IMAGE_API_KEY'

function slotRef(slot: number): string {
  return slot === 1 ? ENV : `${ENV}_${String(slot)}`
}

/**
 * A minimal credential provider. `refuseUnset` reproduces `credentials-local`,
 * which refuses to remove a reference the launching environment supplies.
 */
function memoryCredentials(options: { refuseUnset?: boolean } = {}): {
  values: Map<string, string>
  set: (ref: CredentialRef, value: string) => Promise<void>
  unset: (ref: CredentialRef) => Promise<void>
} {
  const values = new Map<string, string>()
  return {
    values,
    set: (ref, value) => {
      values.set(String(ref), value)
      return Promise.resolve()
    },
    unset: (ref) => {
      if (options.refuseUnset === true) {
        return Promise.reject(new Error(`credentials-local: "${String(ref)}" is supplied read-only by the launching environment`))
      }
      values.delete(String(ref))
      return Promise.resolve()
    },
  }
}

describe('chat worker configuration', () => {
  it('deduplicates keys, stores at most ten workers, and returns masked state', async () => {
    const credentials = memoryCredentials()
    const result = await configureWorkers(credentials, {
      apiKeyEnv: ENV,
      keys: ['worker-first-test-secret', 'worker-first-test-secret', 'worker-second-test-secret'],
    })

    expect(result.configured).toBe(2)
    // The repeated key is reported as skipped, matching the result wording.
    expect(result.skipped).toBe(1)
    expect(credentials.values).toEqual(new Map([
      [ENV, 'worker-first-test-secret'],
      [`${ENV}_2`, 'worker-second-test-secret'],
    ]))
    expect(result.workers.map(worker => worker.preview)).toEqual(['[configured]', '[configured]'])
    expect(JSON.stringify(result)).not.toContain('worker-first-test-secret')
    expect(JSON.stringify(result)).not.toContain('worker-second-test-secret')
  })

  it('reports excess keys without writing more than ten slots', async () => {
    const credentials = memoryCredentials()
    const keys = Array.from({ length: 12 }, (_, index) => `key-${String(index + 1)}`)
    const result = await configureWorkers(credentials, { apiKeyEnv: ENV, keys })

    expect(result.configured).toBe(MAX_FHL_IMAGE_WORKERS)
    expect(result.skipped).toBe(2)
    expect([...credentials.values.keys()]).toHaveLength(MAX_FHL_IMAGE_WORKERS)
    expect([...credentials.values.keys()].at(-1)).toBe(slotRef(MAX_FHL_IMAGE_WORKERS))
  })

  it('replaces the worker set so slots above the supplied keys are cleared', async () => {
    const credentials = memoryCredentials()
    await configureWorkers(credentials, { apiKeyEnv: ENV, keys: ['first-a', 'first-b', 'first-c'] })
    expect([...credentials.values.keys()]).toEqual([slotRef(1), slotRef(2), slotRef(3)])

    const second = await configureWorkers(credentials, { apiKeyEnv: ENV, keys: ['second-only'] })

    expect(second.configured).toBe(1)
    expect([...credentials.values.entries()]).toEqual([[slotRef(1), 'second-only']])
  })

  it('clears every slot when no key is supplied', async () => {
    const credentials = memoryCredentials()
    await configureWorkers(credentials, { apiKeyEnv: ENV, keys: ['first-a', 'first-b'] })

    const cleared = await configureWorkers(credentials, { apiKeyEnv: ENV, keys: ['  ', ''] })

    expect(cleared.configured).toBe(0)
    expect(cleared.skipped).toBe(0)
    expect(credentials.values.size).toBe(0)
  })

  it('keeps the stored keys when the provider refuses to clear a shadowed slot', async () => {
    const credentials = memoryCredentials({ refuseUnset: true })

    const result = await configureWorkers(credentials, { apiKeyEnv: ENV, keys: ['stored-test-key'] })

    expect(result.configured).toBe(1)
    expect(credentials.values.get(ENV)).toBe('stored-test-key')
  })

  it('does not expose any part of a key when credential storage fails', async () => {
    const secret = 'worker-a-sensitive-test-key'
    const failure = configureWorkers({
      set: () => { throw new Error(`storage failed for ${secret}`) },
      unset: () => Promise.resolve(),
    }, {
      apiKeyEnv: ENV,
      keys: [secret],
    })
    await expect(failure).rejects.toThrow('FHL image worker 1 could not be configured')
    await expect(failure).rejects.not.toThrow(secret)
  })
})
