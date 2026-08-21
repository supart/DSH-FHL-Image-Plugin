import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { FhlImagesError } from './client.js'

/** The maximum number of independent image workers supported by the product. */
export const MAX_FHL_IMAGE_WORKERS = 10
export const DEFAULT_FHL_IMAGE_WORKER_COOLDOWN_MS = 60_000

export interface FhlImageWorker {
  readonly slot: number
  readonly ref: string
  readonly apiKey: string
}

interface WorkerHealth {
  disabled: boolean
  cooldownUntil: number
}

interface WorkerLease {
  readonly worker: FhlImageWorker
  readonly release: () => void
}

export interface FhlImageWorkerPoolOptions {
  readonly credentials: CredentialProvider
  readonly apiKeyEnv: string
  readonly cooldownMs?: number
  readonly now?: () => number
}

export interface FhlImageBatchResult<T> {
  readonly values: readonly T[]
  readonly failed: number
}

/** A bounded error that never includes a worker reference or credential value. */
export class FhlImageWorkersError extends Error {
  readonly code = 'workers-unavailable' as const

  constructor(message = 'No healthy FHL image workers are available') {
    super(message)
    this.name = 'FhlImageWorkersError'
  }
}

function safeWorkerErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : typeof error === 'string'
        ? error
        : 'Unknown FHL Images API failure'
  return message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').replace(/\s+/g, ' ').trim().slice(0, 512)
}

export function workerCredentialRefs(apiKeyEnv: string): readonly string[] {
  const refs = [apiKeyEnv]
  for (let slot = 2; slot <= MAX_FHL_IMAGE_WORKERS; slot += 1) refs.push(`${apiKeyEnv}_${String(slot)}`)
  return refs
}

function isFhlError(error: unknown): error is FhlImagesError {
  return error instanceof FhlImagesError
}

function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504 || status === 524
}

/** Classify errors using the same worker/task distinction as the Codex image plugin. */
export function classifyWorkerError(error: unknown, signal: AbortSignal): 'retryable' | 'worker-fatal' | 'task-fatal' | 'cancelled' {
  if (signal.aborted) return 'cancelled'
  if (!isFhlError(error)) return 'task-fatal'
  if (error.code === 'aborted' || error.code === 'request' || error.code === 'invalid-json' || error.code === 'invalid-image') return 'retryable'
  if (error.code === 'http') {
    if (error.status === 401 || error.status === 403) return 'worker-fatal'
    if (isRetryableStatus(error.status)) return 'retryable'
    return 'task-fatal'
  }
  return 'task-fatal'
}

function abortError(): FhlImagesError {
  return new FhlImagesError('FHL image task was cancelled', 'aborted')
}

function waitForChange(signal: AbortSignal, delayMs?: number, wake?: Promise<void>): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<void>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (): void => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    const onAbort = (): void => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(abortError())
    }
    timer = delayMs === undefined ? undefined : setTimeout(finish, Math.max(0, delayMs))
    signal.addEventListener('abort', onAbort, { once: true })
    void wake?.then(finish, finish)
  })
}

/**
 * Resolves credentials for each operation and schedules one independent API
 * request per task. Keys are held only by the operation-local worker object.
 */
export class FhlImageWorkerPool {
  private readonly health = new Map<string, WorkerHealth>()
  private readonly busy = new Set<string>()
  private readonly waiters = new Set<() => void>()
  private cursor = 0
  private readonly cooldownMs: number
  private readonly now: () => number

  constructor(private readonly options: FhlImageWorkerPoolOptions) {
    this.cooldownMs = options.cooldownMs ?? DEFAULT_FHL_IMAGE_WORKER_COOLDOWN_MS
    this.now = options.now ?? Date.now
    if (!Number.isInteger(this.cooldownMs) || this.cooldownMs < 0) throw new TypeError('cooldownMs must be a non-negative integer')
  }

  reset(ref: string): void {
    this.health.delete(ref)
    this.wake()
  }

  resetAll(): void {
    this.health.clear()
    this.wake()
  }

  async runMany<T>(count: number, signal: AbortSignal, operation: (worker: FhlImageWorker, index: number) => Promise<T>): Promise<FhlImageBatchResult<Awaited<T>>> {
    if (!Number.isInteger(count) || count < 1) throw new FhlImageWorkersError('Image task count must be a positive integer')
    const tasks = Array.from({ length: count }, (_, index) => this.runOne(signal, index, operation))
    const settled = await Promise.allSettled(tasks)
    const values: Awaited<T>[] = []
    let lastError: unknown
    for (const entry of settled) {
      if (entry.status === 'fulfilled') values.push(entry.value as Awaited<T>)
      else lastError = entry.reason
    }
    const failures = settled.length - values.length
    if (values.length === 0) {
      if (lastError !== undefined) throw lastError
      throw new FhlImageWorkersError()
    }
    return { values, failed: failures }
  }

  private async resolveWorkers(): Promise<readonly FhlImageWorker[]> {
    const refs = workerCredentialRefs(this.options.apiKeyEnv)
    const resolved = await Promise.all(refs.map(async (ref, index) => {
      const value = await this.options.credentials.resolve(credentialRef(ref))
      return value === undefined || value.value.trim().length === 0
        ? undefined
        : { slot: index + 1, ref, apiKey: value.value }
    }))
    return resolved.filter((worker): worker is FhlImageWorker => worker !== undefined)
  }

  private async runOne<T>(signal: AbortSignal, index: number, operation: (worker: FhlImageWorker, index: number) => Promise<T>): Promise<T> {
    const workers = await this.resolveWorkers()
    if (workers.length === 0) throw new FhlImageWorkersError('No FHL image worker credentials are configured')
    const excluded = new Set<string>()
    while (true) {
      const lease = await this.acquire(workers, excluded, signal)
      try {
        return await operation(lease.worker, index)
      } catch (error) {
        const disposition = classifyWorkerError(error, signal)
        if (disposition === 'cancelled' || disposition === 'task-fatal') throw error
        const health = this.health.get(lease.worker.ref) ?? { disabled: false, cooldownUntil: 0 }
        if (disposition === 'worker-fatal') health.disabled = true
        else health.cooldownUntil = this.now() + this.cooldownMs
        this.health.set(lease.worker.ref, health)
        excluded.add(lease.worker.ref)
        if (workers.every(worker => excluded.has(worker.ref) || this.health.get(worker.ref)?.disabled === true)) {
          throw new FhlImageWorkersError(`All configured FHL image workers failed for this task. Last error: ${safeWorkerErrorMessage(error)}`)
        }
      } finally {
        lease.release()
      }
    }
  }

  private async acquire(workers: readonly FhlImageWorker[], excluded: ReadonlySet<string>, signal: AbortSignal): Promise<WorkerLease> {
    while (true) {
      if (signal.aborted) throw abortError()
      const now = this.now()
      for (let offset = 0; offset < workers.length; offset += 1) {
        const index = (this.cursor + offset) % workers.length
        const worker = workers[index]
        if (worker === undefined || excluded.has(worker.ref) || this.busy.has(worker.ref)) continue
        const health = this.health.get(worker.ref)
        if (health?.disabled === true || (health?.cooldownUntil ?? 0) > now) continue
        this.cursor = (index + 1) % workers.length
        this.busy.add(worker.ref)
        return { worker, release: () => { this.busy.delete(worker.ref); this.wake() } }
      }
      const viable = workers.filter(worker => !excluded.has(worker.ref) && this.health.get(worker.ref)?.disabled !== true)
      if (viable.length === 0) throw new FhlImageWorkersError()
      const nextCooldown = Math.min(...viable.map(worker => this.health.get(worker.ref)?.cooldownUntil ?? 0).filter(deadline => deadline > now))
      let waiter: (() => void) | undefined
      const wake = new Promise<void>(resolve => {
        waiter = resolve
        this.waiters.add(resolve)
      })
      try {
        await waitForChange(signal, Number.isFinite(nextCooldown) ? nextCooldown - now : undefined, wake)
      } finally {
        if (waiter !== undefined) this.waiters.delete(waiter)
      }
    }
  }

  private wake(): void {
    const waiters = [...this.waiters]
    this.waiters.clear()
    for (const resolve of waiters) resolve()
  }
}
