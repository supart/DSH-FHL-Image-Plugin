import type { CredentialProvider, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials'
import { describe, expect, it } from 'vitest'
import { FhlImagesError } from '../src/client.ts'
import { MAX_FHL_IMAGE_WORKERS } from '../src/types.ts'
import {
  FhlImageWorkerPool,
  FhlImageWorkersError,
  classifyWorkerError,
  workerCredentialRefs,
  type FhlImageWorker,
} from '../src/worker-pool.ts'

const ENV = 'FHL_IMAGE_API_KEY'

function slotRef(slot: number): string {
  return slot === 1 ? ENV : `${ENV}_${String(slot)}`
}

/** A credential provider backed by a fixed slot -> key map. */
function pool(
  keys: readonly string[],
  options: { cooldownMs?: number; now?: () => number } = {},
): FhlImageWorkerPool {
  const byRef = new Map(keys.map((key, index) => [slotRef(index + 1), key]))
  const credentials = {
    resolve: (ref: CredentialRef): Promise<ResolvedCredential | undefined> => {
      const value = byRef.get(String(ref))
      return Promise.resolve(value === undefined ? undefined : { value, source: 'memory' })
    },
  }
  return new FhlImageWorkerPool({
    credentials: credentials as unknown as CredentialProvider,
    apiKeyEnv: ENV,
    ...options,
  })
}

const signal = new AbortController().signal

describe('workerCredentialRefs', () => {
  it('exposes the base reference plus one numbered slot per worker', () => {
    const refs = workerCredentialRefs(ENV)
    expect(refs).toHaveLength(MAX_FHL_IMAGE_WORKERS)
    expect(refs[0]).toBe(ENV)
    expect(refs[1]).toBe(`${ENV}_2`)
    expect(refs.at(-1)).toBe(`${ENV}_${String(MAX_FHL_IMAGE_WORKERS)}`)
  })
})

describe('classifyWorkerError', () => {
  it('reports cancellation when the caller already aborted', () => {
    const controller = new AbortController()
    controller.abort()
    expect(classifyWorkerError(new Error('anything'), controller.signal)).toBe('cancelled')
  })

  it('treats transport faults as retryable', () => {
    for (const code of ['request', 'invalid-json', 'invalid-image', 'aborted'] as const) {
      expect(classifyWorkerError(new FhlImagesError('boom', code), signal)).toBe('retryable')
    }
  })

  it('never retries a deterministic local failure', () => {
    // A blank prompt or an oversized response cannot succeed on another worker;
    // retrying it used to burn the whole pool on a guaranteed failure.
    expect(classifyWorkerError(new FhlImagesError('blank prompt', 'invalid-request'), signal)).toBe('task-fatal')
    expect(classifyWorkerError(new FhlImagesError('too large', 'response-too-large'), signal)).toBe('task-fatal')
  })

  it('disables the worker on an authentication failure but not on other 4xx', () => {
    expect(classifyWorkerError(new FhlImagesError('unauthorized', 'http', 401), signal)).toBe('worker-fatal')
    expect(classifyWorkerError(new FhlImagesError('forbidden', 'http', 403), signal)).toBe('worker-fatal')
    expect(classifyWorkerError(new FhlImagesError('bad request', 'http', 400), signal)).toBe('task-fatal')
  })

  it('retries the rate-limit and upstream-gateway statuses', () => {
    for (const status of [429, 502, 503, 504, 524]) {
      expect(classifyWorkerError(new FhlImagesError('busy', 'http', status), signal)).toBe('retryable')
    }
  })

  it('treats an unknown error as fatal for the task', () => {
    expect(classifyWorkerError(new Error('nope'), signal)).toBe('task-fatal')
    expect(classifyWorkerError('nope', signal)).toBe('task-fatal')
  })
})

describe('FhlImageWorkerPool scheduling', () => {
  it('refuses to run when no worker credential is configured', async () => {
    await expect(pool([]).runMany(1, signal, async () => 'ok'))
      .rejects.toThrow('No FHL image worker credentials are configured')
  })

  it('ignores a stored value that is only whitespace', async () => {
    await expect(pool(['   ']).runMany(1, signal, async () => 'ok'))
      .rejects.toBeInstanceOf(FhlImageWorkersError)
  })

  it('runs every requested task and preserves the total order of the results', async () => {
    const result = await pool(['a', 'b', 'c']).runMany(3, signal, async (_worker, index) => index)
    expect([...result.values]).toEqual([0, 1, 2])
    expect(result.failed).toBe(0)
  })

  it('reports a non-positive task count instead of running nothing', async () => {
    await expect(pool(['a']).runMany(0, signal, async () => 'ok'))
      .rejects.toBeInstanceOf(FhlImageWorkersError)
  })

  it('never runs more tasks at once than there are workers', async () => {
    let active = 0
    let peak = 0
    await pool(['a']).runMany(3, signal, async () => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      return 'ok'
    })
    expect(peak).toBe(1)
  })

  it('spreads independent tasks across the configured workers', async () => {
    const used = new Set<string>()
    await pool(['a', 'b']).runMany(4, signal, async (worker) => {
      used.add(worker.ref)
      return 'ok'
    })
    expect([...used].sort()).toEqual([ENV, `${ENV}_2`])
  })

  it('counts partial failures without discarding the successful images', async () => {
    const result = await pool(['a', 'b']).runMany(2, signal, async (worker) => {
      if (worker.slot === 2) throw new FhlImagesError('blank prompt', 'invalid-request')
      return worker.ref
    })
    expect([...result.values]).toEqual([ENV])
    expect(result.failed).toBe(1)
  })
})

describe('FhlImageWorkerPool recovery', () => {
  it('retries a retryable failure on the next worker without failing the task', async () => {
    const result = await pool(['a', 'b']).runMany(1, signal, async (worker) => {
      if (worker.slot === 1) throw new FhlImagesError('rate limited', 'http', 429)
      return 'ok'
    })
    expect([...result.values]).toEqual(['ok'])
    expect(result.failed).toBe(0)
  })

  it('skips a worker that returned an authentication failure', async () => {
    const workers = pool(['a', 'b'])
    const visited: number[] = []
    const operation = async (worker: FhlImageWorker): Promise<string> => {
      visited.push(worker.slot)
      if (worker.slot === 1) throw new FhlImagesError('unauthorized', 'http', 401)
      return 'ok'
    }

    await workers.runMany(1, signal, operation)
    expect(visited).toEqual([1, 2])

    visited.length = 0
    await workers.runMany(1, signal, operation)
    expect(visited).toEqual([2])
  })

  it('fails the task once every worker has failed', async () => {
    const failure = pool(['a', 'b']).runMany(1, signal, async () => {
      throw new FhlImagesError('unauthorized', 'http', 401)
    })
    await expect(failure).rejects.toBeInstanceOf(FhlImageWorkersError)
    await expect(failure).rejects.toThrow('All configured FHL image workers failed')
  })

  it('cools a rate-limited worker down until the window elapses', async () => {
    let clock = 0
    let slotOneFails = true
    const workers = pool(['a', 'b'], { cooldownMs: 1000, now: () => clock })
    const visited: number[] = []
    const operation = async (worker: FhlImageWorker): Promise<string> => {
      visited.push(worker.slot)
      if (worker.slot === 1 && slotOneFails) throw new FhlImagesError('rate limited', 'http', 429)
      return 'ok'
    }

    await workers.runMany(1, signal, operation)
    expect(visited).toEqual([1, 2])

    // Still inside the cooldown window: the rate-limited worker is skipped.
    visited.length = 0
    await workers.runMany(1, signal, operation)
    expect(visited).toEqual([2])

    // Past the deadline the worker is eligible again.
    clock = 1000
    slotOneFails = false
    visited.length = 0
    await workers.runMany(1, signal, operation)
    expect(visited).toEqual([1])
  })

  it('resumes a disabled worker after the pool is reset', async () => {
    const workers = pool(['a', 'b'])
    const visited: number[] = []
    await workers.runMany(1, signal, async (worker) => {
      visited.push(worker.slot)
      if (worker.slot === 1) throw new FhlImagesError('unauthorized', 'http', 401)
      return 'ok'
    })
    expect(visited).toEqual([1, 2])

    workers.resetAll()
    visited.length = 0
    await workers.runMany(1, signal, async (worker) => {
      visited.push(worker.slot)
      return 'ok'
    })
    expect(visited).toEqual([1])
  })
})

describe('FhlImageWorkerPool credential hygiene', () => {
  it('never echoes a worker key inside the aggregate failure message', async () => {
    const first = 'sk-live-supersecretvalue0123456789abcdef'
    const second = 'sk-live-othersecretvalue9876543210zyxwvuts'
    const failure = pool([first, second]).runMany(1, signal, async () => {
      throw new FhlImagesError(`upstream rejected the request for ${first}`, 'http', 429)
    })

    await expect(failure).rejects.toThrow('All configured FHL image workers failed')
    await expect(failure).rejects.not.toThrow(first)
    await expect(failure).rejects.not.toThrow(second)
  })

  it('scrubs a raw third-party error that carries a key', async () => {
    // A non-FhlImagesError is task-fatal and was rethrown verbatim, so this is
    // the one path where an undici/fetch message could reach the model intact.
    const secret = 'sk-live-thirdpartysecret0123456789abcdef'
    const failure = pool([secret]).runMany(1, signal, async () => {
      throw new TypeError(`fetch failed for Authorization ${secret}`)
    })

    await expect(failure).rejects.not.toThrow(secret)
    await expect(failure).rejects.toThrow('[redacted]')
  })
})

describe('FhlImageWorkerPool cancellation', () => {
  it('refuses to start a task when the caller already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(pool(['a']).runMany(1, controller.signal, async () => 'ok'))
      .rejects.toThrow('FHL image task was cancelled')
  })

  it('releases a task that is parked on a busy worker when the caller aborts', async () => {
    const controller = new AbortController()
    const workers = pool(['a'])
    let openGate: (() => void) | undefined
    const gate = new Promise<void>(resolve => { openGate = resolve })

    const holder = workers.runMany(1, controller.signal, async () => {
      await gate
      return 'holder'
    })
    const parked = workers.runMany(1, controller.signal, async () => 'parked')

    // Let `parked` reach `acquire` and find the only worker busy.
    await new Promise(resolve => setTimeout(resolve, 10))
    controller.abort()

    await expect(parked).rejects.toThrow('FHL image task was cancelled')
    openGate?.()
    await expect(holder).resolves.toEqual({ values: ['holder'], failed: 0 })
  })
})
