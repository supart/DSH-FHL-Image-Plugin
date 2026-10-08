import { describe, expect, it } from 'vitest'
import { FhlImagesClient, type FhlImagesError } from '../src/client.ts'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
/** A payload whose base64 spelling carries padding, so it can be stripped. */
const PADDED_BASE64 = Buffer.from('stand-in-png-bytes!').toString('base64')

function clientReturning(fetch: typeof globalThis.fetch, options: { maxResponseBytes?: number } = {}): FhlImagesClient {
  return new FhlImagesClient({ baseURL: 'https://example.test', fetch, ...options })
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('FHL Images client', () => {
  it('builds a generation request without exposing the key in errors', async () => {
    let request: Request | undefined
    const client = clientReturning(async (input, init) => {
      request = new Request(input, init)
      return okResponse({ data: [{ b64_json: PNG_BASE64 }] })
    })

    const result = await client.generate({
      apiKey: 'secret-key-value',
      prompt: 'a small red house',
      size: '1024x1024',
    })

    expect(request?.url).toBe('https://example.test/v1/images/generations')
    expect(request?.headers.get('authorization')).toBe('Bearer secret-key-value')
    expect(await request?.json()).toMatchObject({ model: 'gpt-image-2', prompt: 'a small red house', n: 1, size: '1024x1024' })
    expect(result).toHaveLength(1)
    expect(result[0]?.mediaType).toBe('image/png')
  })

  it('redacts a bearer key in upstream error text', async () => {
    const client = clientReturning(async () => new Response('Bearer secret-key-value was rejected', { status: 503 }))

    await expect(client.generate({
      apiKey: 'secret-key-value',
      prompt: 'a small red house',
      size: '1024x1024',
    })).rejects.toThrow('Bearer [redacted]')
  })

  it('redacts the key itself, including when it was supplied with padding', async () => {
    const client = clientReturning(async () => new Response('rejected sk-padded-secret for this account', { status: 503 }))

    const failure = client.generate({ apiKey: '  sk-padded-secret  ', prompt: 'a cat', size: '1024x1024' })

    await expect(failure).rejects.toThrow('HTTP 503')
    await expect(failure).rejects.not.toThrow('sk-padded-secret')
  })

  it('marks a local validation failure as non-retryable', async () => {
    const client = clientReturning(async () => {
      throw new Error('the transport must not be reached')
    })

    // A retryable classification made the worker pool re-send a deterministic
    // argument error to every configured worker.
    await expect(client.generate({ apiKey: 'secret-key-value', prompt: '   ', size: '1024x1024' }))
      .rejects.toMatchObject({ code: 'invalid-request' })
    await expect(client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024', count: 10 }))
      .rejects.toMatchObject({ code: 'invalid-request' })
  })

  it('accepts padding-free, base64url and data-URI payloads', async () => {
    expect(PADDED_BASE64.endsWith('=')).toBe(true)
    const withoutPadding = PADDED_BASE64.replace(/=+$/, '')
    const variants = [
      withoutPadding,
      `${withoutPadding.slice(0, 4)}\n${withoutPadding.slice(4)}`,
      `data:image/png;base64,${PADDED_BASE64}`,
      PADDED_BASE64.replace(/\+/g, '-').replace(/\//g, '_'),
    ]

    for (const variant of variants) {
      const client = clientReturning(async () => okResponse({ data: [{ b64_json: variant }] }))
      const result = await client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024' })
      expect(result[0]?.data.byteLength).toBeGreaterThan(0)
    }
  })

  it('rejects a payload that is not base64 at all', async () => {
    const client = clientReturning(async () => okResponse({ data: [{ b64_json: 'not base64 !!' }] }))

    await expect(client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024' }))
      .rejects.toMatchObject({ code: 'invalid-image' })
  })

  it('explains a URL-only response instead of reporting a missing image', async () => {
    const client = clientReturning(async () => okResponse({ data: [{ url: 'https://example.test/a.png' }] }))

    await expect(client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024' }))
      .rejects.toThrow('returned URLs instead of base64 images')
  })

  it('rejects a successful response above the configured ceiling', async () => {
    const client = clientReturning(async () => okResponse({ data: [{ b64_json: PNG_BASE64 }] }), { maxResponseBytes: 32 })

    await expect(client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024' }))
      .rejects.toMatchObject({ code: 'response-too-large' })
  })

  it('cancels an oversized error body instead of buffering it whole', async () => {
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (pulls > 100) {
          controller.close()
          return
        }
        controller.enqueue(new Uint8Array(4096).fill(120))
      },
    })
    const client = clientReturning(async () => new Response(stream, { status: 500 }))

    await expect(client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024' }))
      .rejects.toThrow('HTTP 500')
    // 0.2.0 buffered the whole body (up to 64 MiB) before truncating to 512
    // characters; the reader must stop after the first bounded slice.
    expect(pulls).toBeLessThan(10)
  })

  it('reports cancellation as an aborted error', async () => {
    const controller = new AbortController()
    const client = clientReturning(async () => {
      controller.abort()
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })

    await expect(client.generate({
      apiKey: 'secret-key-value',
      prompt: 'a cat',
      size: '1024x1024',
      signal: controller.signal,
    })).rejects.toMatchObject({ code: 'aborted' })
  })

  it('sends references as multipart parts alongside the prompt', async () => {
    let request: Request | undefined
    const client = clientReturning(async (input, init) => {
      request = new Request(input, init)
      return okResponse({ data: [{ b64_json: PNG_BASE64 }] })
    })

    await client.edit({
      apiKey: 'secret-key-value',
      prompt: 'combine these',
      size: '1024x1024',
      sources: [
        { data: new Uint8Array([1, 2, 3]), mediaType: 'image/png', name: 'a.png' },
        { data: new Uint8Array([4, 5, 6]), mediaType: 'image/webp', name: 'b.webp' },
      ],
    })

    expect(request?.url).toBe('https://example.test/v1/images/edits')
    const form = await request?.formData()
    expect(form?.get('prompt')).toBe('combine these')
    expect(form?.get('n')).toBe('1')
    expect(form?.get('output_format')).toBe('png')
    // Pins the shipped wire shape: the first reference uses `image` and the
    // rest use `image[]`. Any change here is a protocol change and must be
    // verified against the live endpoint.
    expect(form?.getAll('image')).toHaveLength(1)
    expect(form?.getAll('image[]')).toHaveLength(1)
  })

  it('refuses an edit without references', async () => {
    const client = clientReturning(async () => okResponse({ data: [{ b64_json: PNG_BASE64 }] }))

    await expect(client.edit({
      apiKey: 'secret-key-value',
      prompt: 'combine these',
      size: '1024x1024',
      sources: [],
    })).rejects.toMatchObject({ code: 'invalid-request' })
  })

  it('never leaks the key through a thrown request error', async () => {
    const client = clientReturning(async () => {
      throw new TypeError('fetch failed for Authorization: Bearer secret-key-value')
    })

    const failure = client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024' })

    await expect(failure).rejects.toThrow('FHL Images API request failed')
    await expect(failure).rejects.not.toThrow('secret-key-value')
  })

  it('exposes a typed error for callers that branch on the code', async () => {
    const client = clientReturning(async () => new Response('nope', { status: 401 }))

    await expect(client.generate({ apiKey: 'secret-key-value', prompt: 'a cat', size: '1024x1024' }))
      .rejects.toMatchObject({ name: 'FhlImagesError', code: 'http', status: 401 } satisfies Partial<FhlImagesError>)
  })
})
