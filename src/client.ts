import { Buffer } from 'node:buffer'
import type {
  EditImageRequest,
  FhlImageResult,
  FhlImagesClientOptions,
  GenerateImageRequest,
  FhlImageSource,
} from './types.js'

export const DEFAULT_FHL_IMAGES_BASE_URL = 'https://www.fhl.mom'
export const DEFAULT_FHL_IMAGE_MODEL = 'gpt-image-2'
export const DEFAULT_FHL_IMAGE_TIMEOUT_MS = 180_000
export const DEFAULT_FHL_IMAGE_MAX_RESPONSE_BYTES = 64 * 1024 * 1024

/** A provider error with a safe, bounded message and no credential material. */
export class FhlImagesError extends Error {
  readonly status?: number
  readonly code: 'http' | 'invalid-json' | 'invalid-image' | 'aborted' | 'response-too-large' | 'request'

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

function assertPrompt(prompt: string): void {
  if (prompt.trim().length === 0) throw new FhlImagesError('image prompt must be a non-empty string', 'request')
}

function assertApiKey(apiKey: string): void {
  if (apiKey.trim().length === 0) throw new FhlImagesError('FHL API key is not configured', 'request')
}

function assertCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > 9) {
    throw new FhlImagesError('image count must be an integer from 1 to 9', 'request')
  }
}

function assertSources(sources: readonly FhlImageSource[]): void {
  if (sources.length < 1 || sources.length > 10) {
    throw new FhlImagesError('image edit accepts 1 to 10 reference images', 'request')
  }
  for (const source of sources) {
    if (source.data.byteLength === 0) throw new FhlImagesError('reference image is empty', 'request')
  }
}

function safeErrorDetail(text: string, apiKey: string): string {
  const scrubbed = text.replaceAll(apiKey, '[redacted]')
  return scrubbed.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]').replace(/\s+/g, ' ').trim().slice(0, 512)
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  if (response.body === null) return response.text()
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new FhlImagesError('FHL Images API response exceeded the local safety limit', 'response-too-large')
      }
      chunks.push(decoder.decode(next.value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return chunks.join('')
  } finally {
    reader.releaseLock()
  }
}

function decodeImage(value: unknown, index: number): FhlImageResult {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new FhlImagesError(`FHL Images API returned no base64 image at index ${index}`, 'invalid-image')
  }
  const clean = value.replace(/^data:image\/[^;]+;base64,/i, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
    throw new FhlImagesError(`FHL Images API returned invalid base64 image at index ${index}`, 'invalid-image')
  }
  const data = new Uint8Array(Buffer.from(clean, 'base64'))
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
  const raw = await readResponseText(response, maxResponseBytes)
  if (!response.ok) {
    throw new FhlImagesError(`FHL Images API returned HTTP ${response.status}${raw ? `: ${safeErrorDetail(raw, apiKey)}` : ''}`, 'http', response.status)
  }
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
