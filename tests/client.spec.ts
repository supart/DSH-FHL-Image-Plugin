import { describe, expect, it } from 'vitest'
import { FhlImagesClient } from '../src/client.ts'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

describe('FHL Images client', () => {
  it('builds a generation request without exposing the key in errors', async () => {
    let request: Request | undefined
    const client = new FhlImagesClient({
      baseURL: 'https://example.test',
      fetch: async (input, init) => {
        request = new Request(input, init)
        return new Response(JSON.stringify({ data: [{ b64_json: PNG_BASE64 }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
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
    const client = new FhlImagesClient({
      baseURL: 'https://example.test',
      fetch: async () => new Response('Bearer secret-key-value was rejected', { status: 503 }),
    })

    await expect(client.generate({
      apiKey: 'secret-key-value',
      prompt: 'a small red house',
      size: '1024x1024',
    })).rejects.toThrow('Bearer [redacted]')
  })
})
