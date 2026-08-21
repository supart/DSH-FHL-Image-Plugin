import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'

export const MAX_CONFIGURED_WORKERS = 10

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

/** Store chat-supplied worker keys and return only masked state. */
export async function configureWorkers(
  credentials: Pick<CredentialProvider, 'set'>,
  request: ConfigureWorkersRequest,
): Promise<ConfigureWorkersResult> {
  const keys = normalizeKeys(request.keys).slice(0, MAX_CONFIGURED_WORKERS)
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
  return {
    configured: workers.length,
    skipped: Math.max(0, normalizeKeys(request.keys).length - workers.length),
    workers,
  }
}
