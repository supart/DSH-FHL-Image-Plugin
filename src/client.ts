import { Buffer } from 'node:buffer'
import type {
  EditImageRequest,
  FhlImageResult,
  FhlImagesClientOptions,
  GenerateImageRequest,
  FhlImageSource,
} from './types.js'
import { MAX_EDIT_SOURCES, MAX_GENERATE_VARIATIONS } from './types.js'

export const DEFAULT_FHL_IMAGES_BASE_URL = 'https://www.fhl.mom'
export const DEFAULT_FHL_IMAGE_MODEL = 'gpt-image-2'
export const DEFAULT_FHL_IMAGE_TIMEOUT_MS = 180_000
export const DEFAULT_FHL_IMAGE_MAX_RESPONSE_BYTES = 64 * 1024 * 1024

/** A provider error with a safe, bounded message and no credential material. */
export class FhlImagesError extends Error {
  readonly status?: number
  readonly code: 'http' | 'invalid-json' | 'invalid-image' | 'aborted' | 'response-too-large' | 'request' | 'invalid-request'

  constructor(
    message: string,
    code: FhlImagesError['code'],
    status?: number,
  ) {
    super(message)
    this.name = 'FhlImagesError'
    this.code = code
    if (status !== undefined) this.status = status
  }
}

function endpoint(baseURL: string, path: string): string {
  const normalized = baseURL.trim().replace(/\/+$/, '')
  return normalized.endsWith('/v1') ? `${normalized}/${path}` : `${normalized}/v1/${path}`
}

// Local argument validation fails deterministically: retrying it on another
// worker cannot succeed, so it carries its own code instead of the transport's
// retryable 'request'. Before 0.2.1 a blank prompt was retried against every
// configured worker (up to 9 x 10 pointless, billable attempts per call).
function assertPrompt(prompt: string): void {
  if (prompt.trim().length === 0) throw new FhlImagesError('image prompt must be a non-empty string', 'invalid-request')
}

function assertApiKey(apiKey: string): void {
  if (apiKey.trim().length === 0) throw new FhlImagesError('FHL API key is not configured', 'invalid-request')
}

function assertCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATE_VARIATIONS) {
    throw new FhlImagesError(`image count must be an integer from 1 to ${String(MAX_GENERATE_VARIATIONS)}`, 'invalid-request')
  }
}

function assertSources(sources: readonly FhlImageSource[]): void {
  if (sources.length < 1 || sources.length > MAX_EDIT_SOURCES) {
    throw new FhlImagesError(`image edit accepts 1 to ${String(MAX_EDIT_SOURCES)} reference images`, 'invalid-request')
  }
  for (const source of sources) {
    if (source.data.byteLength === 0) throw new FhlImagesError('reference image is empty', 'invalid-request')
  }
}

function safeErrorDetail(text: string, apiKey: string): string {
  // Scrub the key exactly as supplied and its trimmed form: `assertApiKey` only
  // rejects a whitespace-only value, so a padded key would survive verbatim in
  // an upstream echo that spells it without the padding. An empty needle would
  // make `replaceAll` splice the replacement between every character.
  let scrubbed = text
  for (const secret of [apiKey, apiKey.trim()]) {
    if (secret.length > 0) scrubbed = scrubbed.replaceAll(secret, '[redacted]')
  }
  return scrubbed.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]').replace(/\s+/g, ' ').trim().slice(0, 512)
}

/**
 * How much of a failed response body is retained for the diagnostic message.
 * Only this prefix ever reaches `safeErrorDetail`, which truncates to 512
 * characters anyway.
 */
const ERROR_BODY_LIMIT_BYTES = 8 * 1024

/**
 * Read at most `maxBytes` of a response body, cancelling the stream as soon as
 * the cap is reached so an oversized or hostile body is never buffered whole.
 * 0.2.0 read the entire body first and only then compared it against the cap,
 * so one cached error response could allocate up to the 64 MiB limit per task
 * while contributing 512 characters to the message.
 */
async function readBoundedBody(response: Response, maxBytes: number): Promise<{ text: string; exceeded: boolean }> {
  if (response.body === null) {
    const text = await response.text()
    return text.length > maxBytes ? { text: text.slice(0, maxBytes), exceeded: true } : { text, exceeded: false }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      const remaining = maxBytes - total
      if (next.value.byteLength > remaining) {
        text += decoder.decode(next.value.subarray(0, Math.max(0, remaining)), { stream: true })
        await reader.cancel()
        return { text: `${text}${decoder.decode()}`, exceeded: true }
      }
      total += next.value.byteLength
      text += decoder.decode(next.value, { stream: true })
    }
    return { text: `${text}${decoder.decode()}`, exceeded: false }
  } finally {
    reader.releaseLock()
  }
}

function decodeImage(value: unknown, index: number): FhlImageResult {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new FhlImagesError(`FHL Images API returned no base64 image at index ${index}`, 'invalid-image')
  }
  // Accept the shapes real upstreams return: an optional data-URI prefix,
  // embedded line breaks, base64url alphabet and omitted padding. 0.2.0
  // required exact padded standard base64, so a decodable payload was rejected
  // as `invalid-image` and then retried against every configured worker.
  const normalized = value
    .replace(/^data:image\/[^;]+;base64,/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/=+$/, '')
  // A remainder of one character cannot be a base64 quantum; every other
  // remainder is completed with padding below.
  if (!/^[A-Za-z0-9+/]*$/.test(normalized) || normalized.length % 4 === 1) {
    throw new FhlImagesError(`FHL Images API returned invalid base64 image at index ${index}`, 'invalid-image')
  }
  const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=')
  const data = new Uint8Array(Buffer.from(padded, 'base64'))
  if (data.byteLength === 0) throw new FhlImagesError(`FHL Images API returned an empty image at index ${index}`, 'invalid-image')
  return { data, mediaType: 'image/png', name: `fhl-image-${index + 1}.png` }
}

function extractImages(payload: unknown): FhlImageResult[] {
  const items = (payload as { data?: unknown } | null)?.data
  if (!Array.isArray(items)) throw new FhlImagesError('FHL Images API response did not contain a data array', 'invalid-json')
  const results: FhlImageResult[] = []
  let sawUrl = false
  for (const [index, item] of items.entries()) {
    if (typeof item === 'object' && item !== null && typeof (item as { url?: unknown }).url === 'string') sawUrl = true
    const candidate = typeof item === 'object' && item !== null
      ? (item as { b64_json?: unknown; base64?: unknown; image?: { b64_json?: unknown } }).b64_json
        ?? (item as { base64?: unknown }).base64
        ?? (item as { image?: { b64_json?: unknown } }).image?.b64_json
      : undefined
    if (candidate !== undefined) results.push(decodeImage(candidate, index))
  }
  if (results.length === 0) {
    throw new FhlImagesError(sawUrl ? 'FHL Images API returned URLs instead of base64 images' : 'FHL Images API returned no base64 images', 'invalid-image')
  }
  return results
}

function formSourceField(index: number): string {
  return index === 0 ? 'image' : 'image[]'
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const abort = (): void => controller.abort(signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'))
  const timer = setTimeout(() => controller.abort(new DOMException('The operation timed out', 'AbortError')), timeoutMs)
  const dispose = (): void => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  return { signal: controller.signal, dispose }
}

async function requestJson(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  apiKey: string,
  maxResponseBytes: number,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(url, init)
  } catch (error: unknown) {
    if (init.signal?.aborted === true || (error as { name?: string }).name === 'AbortError') {
      throw new FhlImagesError('FHL Images API request was cancelled or timed out', 'aborted')
    }
    throw new FhlImagesError(`FHL Images API request failed: ${safeErrorDetail(String(error), apiKey)}`, 'request')
  }
  if (!response.ok) {
    // A failed response contributes at most a bounded diagnostic prefix; the
    // stream is cancelled rather than buffered to the image-size ceiling.
    const { text } = await readBoundedBody(response, ERROR_BODY_LIMIT_BYTES)
    throw new FhlImagesError(`FHL Images API returned HTTP ${response.status}${text ? `: ${safeErrorDetail(text, apiKey)}` : ''}`, 'http', response.status)
  }
  const { text: raw, exceeded } = await readBoundedBody(response, maxResponseBytes)
  if (exceeded) throw new FhlImagesError('FHL Images API response exceeded the local safety limit', 'response-too-large')
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new FhlImagesError('FHL Images API returned invalid JSON', 'invalid-json', response.status)
  }
}

/** Minimal FHL Images API adapter. It never persists keys or image bytes. */
export class FhlImagesClient {
  readonly baseURL: string
  readonly timeoutMs: number
  readonly maxResponseBytes: number
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(options: FhlImagesClientOptions = {}) {
    this.baseURL = options.baseURL ?? DEFAULT_FHL_IMAGES_BASE_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_FHL_IMAGE_TIMEOUT_MS
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_FHL_IMAGE_MAX_RESPONSE_BYTES
    this.fetchImpl = options.fetch ?? globalThis.fetch
    if (typeof this.fetchImpl !== 'function') throw new TypeError('a fetch implementation is required')
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1) throw new TypeError('timeoutMs must be a positive integer')
    if (!Number.isInteger(this.maxResponseBytes) || this.maxResponseBytes < 1) throw new TypeError('maxResponseBytes must be a positive integer')
  }

  async generate(request: GenerateImageRequest): Promise<readonly FhlImageResult[]> {
    assertApiKey(request.apiKey)
    assertPrompt(request.prompt)
    const count = request.count ?? 1
    assertCount(count)
    const deadline = withTimeout(request.signal, this.timeoutMs)
    try {
      const payload = await requestJson(this.fetchImpl, endpoint(this.baseURL, 'images/generations'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_FHL_IMAGE_MODEL,
          prompt: request.prompt,
          n: count,
          size: request.size,
          quality: 'auto',
          output_format: 'png',
          response_format: 'b64_json',
        }),
        signal: deadline.signal,
      }, request.apiKey, this.maxResponseBytes)
      return extractImages(payload)
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'AbortError') throw new FhlImagesError('FHL Images API request was cancelled or timed out', 'aborted')
      throw error
    } finally {
      deadline.dispose()
    }
  }

  async edit(request: EditImageRequest): Promise<readonly FhlImageResult[]> {
    assertApiKey(request.apiKey)
    assertPrompt(request.prompt)
    assertSources(request.sources)
    const form = new FormData()
    request.sources.forEach((source, index) => {
      const bytes = source.data.buffer.slice(source.data.byteOffset, source.data.byteOffset + source.data.byteLength) as ArrayBuffer
      form.append(formSourceField(index), new Blob([bytes], { type: source.mediaType }), source.name ?? `reference-${index + 1}`)
    })
    form.append('prompt', request.prompt)
    form.append('model', DEFAULT_FHL_IMAGE_MODEL)
    form.append('n', '1')
    form.append('size', request.size)
    form.append('quality', 'auto')
    form.append('output_format', 'png')
    form.append('response_format', 'b64_json')
    const deadline = withTimeout(request.signal, this.timeoutMs)
    try {
      const payload = await requestJson(this.fetchImpl, endpoint(this.baseURL, 'images/edits'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
        },
        body: form,
        signal: deadline.signal,
      }, request.apiKey, this.maxResponseBytes)
      return extractImages(payload)
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'AbortError') throw new FhlImagesError('FHL Images API request was cancelled or timed out', 'aborted')
      throw error
    } finally {
      deadline.dispose()
    }
  }
}
