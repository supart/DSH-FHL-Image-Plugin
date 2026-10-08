import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { AttachmentId, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type {
  ImageAttachmentLimits,
  ImageAttachmentRef,
  SaveImageAttachment,
  StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { CredentialInfo, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials'
import type { Message } from '@deepseek-ai/dsh-llm'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import * as FhlImage from '../src/index.ts'
import type { FhlImageToolOutput } from '../src/types.ts'

class MemoryCredentials extends CredentialProvider {
  readonly values = new Map<string, string>()

  resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    const value = this.values.get(ref)
    return Promise.resolve(value === undefined ? undefined : { value, source: 'memory' })
  }

  describe(ref: CredentialRef): Promise<CredentialInfo> {
    return Promise.resolve(this.values.has(ref)
      ? { configured: true, source: 'memory', writable: true }
      : { configured: false, writable: true })
  }

  set(ref: CredentialRef, value: string): Promise<void> {
    this.values.set(ref, value)
    this.notifyUpdated(ref)
    return Promise.resolve()
  }

  unset(ref: CredentialRef): Promise<void> {
    this.values.delete(ref)
    this.notifyUpdated(ref)
    return Promise.resolve()
  }

  // The record half of the credential seam has nothing to do with image
  // workers; it exists only to satisfy the abstract base class.
  readRecord(): Promise<never> {
    return Promise.reject(new Error('credential records are not used by this fixture'))
  }

  describeRecord(): Promise<never> {
    return Promise.reject(new Error('credential records are not used by this fixture'))
  }

  listRecords(): Promise<never> {
    return Promise.reject(new Error('credential records are not used by this fixture'))
  }

  modifyRecord(): Promise<never> {
    return Promise.reject(new Error('credential records are not used by this fixture'))
  }

  deleteRecord(): Promise<never> {
    return Promise.reject(new Error('credential records are not used by this fixture'))
  }
}

class MemoryAttachments extends AttachmentStore {
  readonly imageLimits: ImageAttachmentLimits = {
    maxImageBytes: 10 * 1024 * 1024,
    maxImagesPerMessage: 10,
    maxMessageImageBytes: 20 * 1024 * 1024,
    maxImagePixels: 100_000_000,
    maxImageDimension: 20_000,
    mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  }
  readonly values = new Map<string, { ref: ImageAttachmentRef; data: Uint8Array }>()

  validateImage(_input: SaveImageAttachment): Promise<void> {
    return Promise.resolve()
  }

  async saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    const id = AttachmentId(`memory-${String(this.values.size + 1)}`)
    const ref: ImageAttachmentRef = {
      attachmentId: id,
      mediaType: input.mediaType,
      bytes: input.data.byteLength,
      width: 1,
      height: 1,
      ...input.name === undefined ? {} : { name: input.name },
    }
    this.values.set(String(id), { ref, data: input.data })
    return ref
  }

  async readImage(ref: ImageAttachmentRef): Promise<StoredImageAttachment> {
    const stored = this.values.get(String(ref.attachmentId))
    if (stored === undefined) throw new Error('memory attachment not found')
    return stored
  }
}

let context: Context | undefined

afterEach(async () => {
  vi.unstubAllGlobals()
  await context?.fiber.dispose()
  context = undefined
})

const ENV = 'FHL_IMAGE_API_KEY'
const WORKER_KEY = 'test-worker-key-not-a-real-credential'
/** Any non-empty base64 payload is enough: the fixture store does not decode. */
const PNG_BASE64 = Buffer.from('stand-in-png-bytes').toString('base64')

async function mount(options: { attachments?: boolean } = {}): Promise<Context> {
  const mounted = new Context()
  await mounted.plugin(SystemPrompt)
  await mounted.plugin(ToolRuntime, { mode: 'native' })
  await mounted.plugin(MemoryCredentials)
  if (options.attachments !== false) await mounted.plugin(MemoryAttachments)
  await mounted.plugin(FhlImage, { baseURL: 'http://127.0.0.1:1' })
  context = mounted
  return mounted
}

/** Answer every request with the same JSON body. */
function stubJson(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const spy = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })))
  vi.stubGlobal('fetch', spy)
  return spy
}

/** A tool-run context shaped the way the tool bodies read it. */
function runContext(messages: readonly Message[] = []): ToolRunContext {
  return {
    signal: new AbortController().signal,
    agent: { id: 'test-session', session: { deriveMessages: () => [...messages] } },
    deferContext: () => {},
    concludeTurn: () => {},
  } as unknown as ToolRunContext
}

async function callTool(name: string, args: unknown, exec: ToolRunContext = runContext()): Promise<unknown> {
  const definition = context?.tools.get(name)
  if (definition === undefined) throw new Error(`tool ${name} is not registered`)
  return definition.execute(args, exec)
}

async function configureWorker(): Promise<void> {
  await callTool('fhl_image_configure', { keys: [WORKER_KEY] })
}

/**
 * Stub the API, then mount, then store a key. The client captures
 * `globalThis.fetch` when the plugin is applied, so the stub must be installed
 * before mounting or the real fetch is used.
 */
async function mountWithApi(status: number, body: unknown): Promise<ReturnType<typeof vi.fn>> {
  const fetchSpy = stubJson(status, body)
  await mount()
  await configureWorker()
  return fetchSpy
}

describe('FHL image plugin registration', () => {
  it('registers configuration, generation and edit tools only with attachments', async () => {
    const mounted = await mount()
    expect(mounted.tools.schemas().map(schema => schema.name)).toEqual([
      'fhl_image_configure',
      'fhl_image_generate',
      'fhl_image_edit',
    ])
  })

  it('registers nothing when no attachment store is mounted', async () => {
    const mounted = await mount({ attachments: false })
    expect(mounted.tools.schemas().map(schema => schema.name)).toEqual([])
  })
})

describe('fhl_image_generate execution', () => {
  it('persists a produced image and reports it as an attachment', async () => {
    const fetchSpy = await mountWithApi(200, { data: [{ b64_json: PNG_BASE64 }] })

    const result = await callTool('fhl_image_generate', { prompt: 'a fishing kitten', size: '1024x1024' }) as FhlImageToolOutput

    expect(result.operation).toBe('generate')
    expect(result.requested).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.images).toHaveLength(1)
    expect(result.images[0]?.bytes).toBeGreaterThan(0)
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/v1/images/generations')
  })

  it('sends the configured key as a bearer credential and never echoes it', async () => {
    const fetchSpy = await mountWithApi(200, { data: [{ b64_json: PNG_BASE64 }] })

    const result = await callTool('fhl_image_generate', { prompt: 'a cat', size: '512x512' })

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${WORKER_KEY}`)
    expect(JSON.stringify(result)).not.toContain(WORKER_KEY)
  })

  it('rejects a size that is not WIDTHxHEIGHT before any request', async () => {
    const fetchSpy = await mountWithApi(200, { data: [{ b64_json: PNG_BASE64 }] })

    await expect(callTool('fhl_image_generate', { prompt: 'a cat', size: 'huge' }))
      .rejects.toThrow('size must use WIDTHxHEIGHT format')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range variation count before any request', async () => {
    const fetchSpy = await mountWithApi(200, { data: [{ b64_json: PNG_BASE64 }] })

    await expect(callTool('fhl_image_generate', { prompt: 'a cat', size: '512x512', count: 10 }))
      .rejects.toThrow('count must be an integer from 1 to 9')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('surfaces a deterministic input error instead of blaming the worker pool', async () => {
    const fetchSpy = await mountWithApi(200, { data: [{ b64_json: PNG_BASE64 }] })

    // 0.2.0 classified this transport-retryable, so a blank prompt fanned out
    // across every worker and reported "all workers failed".
    const failure = callTool('fhl_image_generate', { prompt: '   ', size: '512x512' })

    await expect(failure).rejects.toThrow('image prompt must be a non-empty string')
    await expect(failure).rejects.not.toThrow('All configured FHL image workers failed')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails with a bounded message when the API returns an error status', async () => {
    const fetchSpy = await mountWithApi(400, { error: { message: 'bad prompt' } })

    await expect(callTool('fhl_image_generate', { prompt: 'a cat', size: '512x512' }))
      .rejects.toThrow('FHL Images API returned HTTP 400')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('refuses to run without a configured worker', async () => {
    const fetchSpy = stubJson(200, { data: [{ b64_json: PNG_BASE64 }] })
    await mount()

    await expect(callTool('fhl_image_generate', { prompt: 'a cat', size: '512x512' }))
      .rejects.toThrow('No FHL image worker credentials are configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reports the configured worker count without echoing any key', async () => {
    await mount()

    const result = await callTool('fhl_image_configure', { keys: [WORKER_KEY, WORKER_KEY, 'second-test-key'] })

    expect(result).toEqual({
      configured: 2,
      skipped: 1,
      workers: [
        { slot: 1, ref: ENV, configured: true, preview: '[configured]' },
        { slot: 2, ref: `${ENV}_2`, configured: true, preview: '[configured]' },
      ],
    })
  })
})

describe('fhl_image_edit execution', () => {
  it('asks for explicit sources when the session has no image to reuse', async () => {
    await mount()
    await configureWorker()

    await expect(callTool('fhl_image_edit', { prompt: 'make it night', size: '512x512' }))
      .rejects.toThrow('provide sources explicitly')
  })

  it('rejects more references than the tool accepts', async () => {
    await mount()
    await configureWorker()
    const sources = Array.from({ length: 11 }, (_, index) => ({
      attachmentId: `missing-${String(index)}`,
      mediaType: 'image/png' as const,
      bytes: 1,
      width: 1,
      height: 1,
    }))

    await expect(callTool('fhl_image_edit', { prompt: 'combine', size: '512x512', sources }))
      .rejects.toThrow('at most 10 are supported')
  })
})
