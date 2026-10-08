import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { MAX_FHL_IMAGE_WORKERS } from './types.js'

/** Kept for callers that used the 0.2.0 name; the value now lives in one place. */
export { MAX_FHL_IMAGE_WORKERS as MAX_CONFIGURED_WORKERS }

export interface ConfigureWorkersRequest {
  readonly keys: readonly string[]
  readonly apiKeyEnv: string
}

export interface ConfiguredWorkerSummary {
  readonly slot: number
  readonly ref: string
  readonly configured: boolean
  readonly preview: string
}

export interface ConfigureWorkersResult {
  readonly configured: number
  readonly skipped: number
  readonly workers: ConfiguredWorkerSummary[]
}

function previewKey(_value: string): string {
  // Do not expose even a prefix/suffix to the model through the tool result.
  // The durable credential provider is the only place that retains the value.
  return '[configured]'
}

function workerRef(apiKeyEnv: string, slot: number): string {
  return slot === 1 ? apiKeyEnv : `${apiKeyEnv}_${String(slot)}`
}

function normalizeKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of keys) {
    const key = value.trim()
    if (key.length === 0 || seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

/**
 * Store chat-supplied worker keys and return only masked state.
 *
 * Configuration is a *replacement*, not a merge: slots above the supplied key
 * count are cleared. 0.2.0 could only write, never remove, so configuring one
 * key after ten left nine revoked keys live and still scheduled against, while
 * the result claimed only one worker was configured.
 *
 * A provider may refuse to unset a reference the launching environment
 * supplies read-only; that refusal is tolerated because such a value outranks
 * anything stored here anyway, and it must not fail the keys that were stored.
 */
export async function configureWorkers(
  credentials: Pick<CredentialProvider, 'set' | 'unset'>,
  request: ConfigureWorkersRequest,
): Promise<ConfigureWorkersResult> {
  const supplied = request.keys.filter(value => value.trim().length > 0).length
  const keys = normalizeKeys(request.keys).slice(0, MAX_FHL_IMAGE_WORKERS)
  const workers: ConfiguredWorkerSummary[] = []
  for (const [index, key] of keys.entries()) {
    const slot = index + 1
    const ref = credentialRef(workerRef(request.apiKeyEnv, slot))
    try {
      await credentials.set(ref, key)
    } catch {
      // Never forward a provider exception verbatim: a misbehaving credential
      // backend could include the value it was asked to store.
      throw new Error(`FHL image worker ${String(slot)} could not be configured`)
    }
    workers.push({ slot, ref, configured: true, preview: previewKey(key) })
  }
  for (let slot = keys.length + 1; slot <= MAX_FHL_IMAGE_WORKERS; slot += 1) {
    try {
      await credentials.unset(credentialRef(workerRef(request.apiKeyEnv, slot)))
    } catch {
      // See the doc comment: environment-supplied references are not ours to remove.
    }
  }
  return {
    configured: workers.length,
    // Duplicates collapse in `normalizeKeys`, so this counts both the
    // repeated keys and the ones beyond the ten-slot ceiling.
    skipped: Math.max(0, supplied - workers.length),
    workers,
  }
}
