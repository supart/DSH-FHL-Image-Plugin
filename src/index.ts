import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { FhlImagesClient } from './client.js'
import { configureWorkers } from './configure.js'
import { FhlImageWorkerPool } from './worker-pool.js'
import type { FhlImageSource, FhlImageToolOutput, FhlImageToolRef } from './types.js'

export { FhlImagesClient, FhlImagesError } from './client.js'
export * from './configure.js'
export * from './types.js'

export const name = 'fhl-image'
export const inject = ['tools', 'credentials', 'systemPrompt']

export interface Config {
  baseURL?: string
  apiKeyEnv?: string
  timeoutMs?: number
  maxResponseBytes?: number
  workerCooldownMs?: number
}

export const Config: z<Config> = z.object({
  baseURL: z.string().default('https://www.fhl.mom'),
  apiKeyEnv: z.string().default('FHL_IMAGE_API_KEY'),
  timeoutMs: z.number().step(1).min(1).default(180_000),
  maxResponseBytes: z.number().step(1).min(1).default(64 * 1024 * 1024),
  workerCooldownMs: z.number().step(1).min(0).default(60_000),
})

type ToolRefArg = Omit<FhlImageToolRef, 'attachmentId'> & { attachmentId: string }
type SessionEventLike = { readonly type: string; readonly data?: unknown }
type ImageToolExecution = {
  readonly agent?: { readonly session: { readonly events: readonly SessionEventLike[] } }
}

function refArg(ref: ToolRefArg): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(ref.attachmentId),
    mediaType: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...ref.name === undefined ? {} : { name: ref.name },
  }
}

function renderOutput(value: FhlImageToolOutput): ContentBlock[] {
  const action = value.operation === 'generate' ? 'Generated' : 'Edited'
  const completion = value.failed === 0
    ? `${value.images.length} image(s)`
    : `${value.images.length} of ${value.requested} image(s); ${value.failed} task(s) failed`
  const text = `${action} ${completion} at ${value.size}.\nPrompt: ${value.prompt}`
  return [
    { type: 'text', text },
    ...value.images.map(image => ({
      type: 'image' as const,
      attachment: {
        attachmentId: AttachmentId(image.attachmentId),
        mediaType: image.mediaType,
        bytes: image.bytes,
        width: image.width,
        height: image.height,
        ...image.name === undefined ? {} : { name: image.name },
      },
    })),
  ]
}

function outputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      operation: { type: 'string', required: true, enum: ['generate', 'edit'] },
      prompt: { type: 'string', required: true },
      size: { type: 'string', required: true },
      requested: { type: 'integer', required: true },
      failed: { type: 'integer', required: true },
      images: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            attachmentId: { type: 'string', required: true },
            mediaType: { type: 'string', required: true, enum: ['image/png', 'image/jpeg', 'image/webp'] },
            bytes: { type: 'integer', required: true },
            width: { type: 'integer', required: true },
            height: { type: 'integer', required: true },
            name: { type: 'string' },
          },
        },
      },
    },
  } as const
}

function toolRefSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      attachmentId: { type: 'string', required: true },
      mediaType: { type: 'string', required: true, enum: ['image/png', 'image/jpeg', 'image/webp'] },
      bytes: { type: 'integer', required: true },
      width: { type: 'integer', required: true },
      height: { type: 'integer', required: true },
      name: { type: 'string' },
    },
  } as const
}

function configureOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      configured: { type: 'integer', required: true },
      skipped: { type: 'integer', required: true },
      workers: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            slot: { type: 'integer', required: true },
            ref: { type: 'string', required: true },
            configured: { type: 'boolean', required: true },
            preview: { type: 'string', required: true },
          },
        },
      },
    },
  } as const
}

function assertSize(size: string): void {
  if (!/^\d+x\d+$/.test(size)) throw new Error('size must use WIDTHxHEIGHT format')
}

function requestedCount(count: number | undefined, maximum: number): number {
  const value = count ?? 1
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`count must be an integer from 1 to ${String(maximum)}`)
  }
  return value
}

/**
 * Resolve images attached to the direct user prompt that owns the current
 * agent turn. The model can see these images, but it cannot reliably know the
 * opaque attachment id needed by the image tool, so the tool owns this
 * session-scoped lookup instead of accepting a filesystem path or URL.
 */
function currentTurnUserImages(exec: ImageToolExecution): ImageAttachmentRef[] {
  const events = exec.agent?.session.events
  if (events === undefined) return []
  let turnStart = -1
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'turn/start') {
      turnStart = index
      break
    }
  }
  for (let index = events.length - 1; index > turnStart; index -= 1) {
    const event = events[index]
    if (event?.type !== 'user/message' || typeof event.data !== 'object' || event.data === null) continue
    const content = (event.data as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    const images = content.flatMap(block => {
      if (typeof block !== 'object' || block === null || (block as { type?: unknown }).type !== 'image') return []
      const attachment = (block as { attachment?: unknown }).attachment
      return attachment === undefined ? [] : [attachment as ImageAttachmentRef]
    })
    if (images.length > 0) return images
  }
  return []
}

/** Resolve the latest user-uploaded image set for a text-only follow-up turn. */
function latestUserImages(exec: ImageToolExecution): ImageAttachmentRef[] {
  const events = exec.agent?.session.events
  if (events === undefined) return []
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'user/message' || typeof event.data !== 'object' || event.data === null) continue
    const content = (event.data as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    const images = content.flatMap((block) => {
      if (typeof block !== 'object' || block === null || (block as { type?: unknown }).type !== 'image') return []
      const attachment = (block as { attachment?: unknown }).attachment
      return attachment === undefined ? [] : [attachment as ImageAttachmentRef]
    })
    if (images.length > 0) return images
  }
  return []
}

function imageRefs(value: unknown): ImageAttachmentRef[] {
  if (!Array.isArray(value)) return []
  const images: ImageAttachmentRef[] = []
  for (const block of value) {
    if (typeof block !== 'object' || block === null) continue
    const record = block as { type?: unknown; attachment?: unknown; content?: unknown; isError?: unknown }
    if (record.type === 'image' && typeof record.attachment === 'object' && record.attachment !== null) {
      images.push(record.attachment as ImageAttachmentRef)
      continue
    }
    if (record.type === 'tool-result' && record.isError !== true) images.push(...imageRefs(record.content))
  }
  return images
}

/** Resolve the latest successful image output produced inside this session. */
function latestFhlToolImages(exec: ImageToolExecution): ImageAttachmentRef[] {
  const events = exec.agent?.session.events
  if (events === undefined) return []
  const imageCallIds = new Set<string>()
  for (const event of events) {
    if (event.type !== 'tool/call' || typeof event.data !== 'object' || event.data === null) continue
    const data = event.data as { callId?: unknown; name?: unknown }
    if ((data.name === 'fhl_image_generate' || data.name === 'fhl_image_edit') && typeof data.callId === 'string') {
      imageCallIds.add(data.callId)
    }
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'tool/result' || typeof event.data !== 'object' || event.data === null) continue
    const message = (event.data as { message?: unknown }).message
    if (typeof message !== 'object' || message === null) continue
    const record = message as { source?: unknown; content?: unknown }
    const source = typeof record.source === 'object' && record.source !== null
      ? record.source as { callId?: unknown }
      : undefined
    if (typeof source?.callId !== 'string' || !imageCallIds.has(source.callId)) continue
    const refs = imageRefs(record.content)
    if (refs.length === 0) continue
    const unique = new Map(refs.map(ref => [ref.attachmentId, ref]))
    return [...unique.values()]
  }
  return []
}

/** Register the FHL Images tools when a durable attachment store is mounted. */
export function apply(ctx: Context, config: Config): void {
  const client = new FhlImagesClient(config)
  ctx.systemPrompt.section({
    name: 'tool:fhl-image',
    order: 119,
    text: 'Use fhl_image_configure when the user supplies one or more FHL image API keys in chat and asks to configure image generation. Extract only the keys the user intentionally supplied, pass them as the keys array, and never repeat them in your reply or tool output. This chat-configured mode sends the user message to the selected model, so warn the user once that the key may be present in the model request and durable session history. The tool stores keys in the DSH credential provider and returns only masked status. Use fhl_image_generate for a new image. Use fhl_image_edit to modify or combine one to ten images. One to five references are the normal production range; six to ten are a heavier multi-reference request and should remain a single low-concurrency edit. Each requested variation is an independent Images API task scheduled across the configured worker pool. Omit sources to use images uploaded in the current user message, the latest earlier user-uploaded image set for a text-only follow-up, or otherwise the latest successful FHL image tool result in this session. Pass sources only when selecting explicit attachment references. Image requests are billable network operations; do not call them until the user has clearly requested the image task.',
  })
  ctx.inject(['attachments'], imageCtx => {
    const credentials = imageCtx.credentials
    const attachments = imageCtx.attachments
    const apiKeyEnv = config.apiKeyEnv ?? 'FHL_IMAGE_API_KEY'
    credentialRef(apiKeyEnv)
    const workers = new FhlImageWorkerPool({
      credentials,
      apiKeyEnv,
      ...config.workerCooldownMs === undefined ? {} : { cooldownMs: config.workerCooldownMs },
    })
    imageCtx.on('credentials/reference-updated', ref => { workers.reset(String(ref)) })
    const persist = async (data: Uint8Array, name: string): Promise<FhlImageToolRef> => {
      const ref = await attachments.saveImage({ data, mediaType: 'image/png', name })
      return { attachmentId: ref.attachmentId, mediaType: 'image/png' as const, bytes: ref.bytes, width: ref.width, height: ref.height, ...ref.name === undefined ? {} : { name: ref.name } }
    }

    imageCtx.tools.register(defineTool({
      name: 'fhl_image_configure',
      description: 'Store one or more user-supplied FHL image API keys as up to ten managed image workers. Never include key values in the result or in a follow-up message. Use only when the user explicitly asks to configure or add image API keys.',
      parameters: {
        keys: { type: 'array', required: true, items: { type: 'string' }, description: 'The API keys intentionally supplied by the user in the current request. Do not invent, transform, or echo them.' },
      },
      output: { schema: configureOutputSchema(), render: (_args, value) => [{ type: 'text' as const, text: `Configured ${String(value.configured)} FHL image worker(s).${value.skipped > 0 ? ` Skipped ${String(value.skipped)} duplicate or excess key(s).` : ''}` }] },
      async execute(args: { keys: string[] }) {
        const result = await configureWorkers(credentials, {
          keys: args.keys,
          apiKeyEnv,
        })
        workers.resetAll()
        return result
      },
    }))

    imageCtx.tools.register(defineTool({
      name: 'fhl_image_generate',
      description: 'Generate one or more PNG images with the configured FHL Images API.',
      parameters: {
        prompt: { type: 'string', required: true, description: 'The exact visual brief to send to the image model.' },
        size: { type: 'string', required: true, description: 'Output size such as 2048x1152.' },
        count: { type: 'integer', description: 'Number of variations from 1 to 9; defaults to 1.' },
      },
      output: { schema: outputSchema(), render: (_args, value) => renderOutput(value) },
      async execute(args: { prompt: string; size: string; count?: number }, exec) {
        assertSize(args.size)
        const count = requestedCount(args.count, 9)
        const batch = await workers.runMany(count, exec.signal, async worker => {
          const images = await client.generate({
            apiKey: worker.apiKey,
            prompt: args.prompt,
            size: args.size,
            count: 1,
            signal: exec.signal,
          })
          const image = images[0]
          if (image === undefined) throw new Error('FHL Images API returned no image')
          return image
        })
        const refs: FhlImageToolRef[] = []
        for (const [index, image] of batch.values.entries()) {
          refs.push(await persist(image.data, `fhl-generated-${String(index + 1)}.png`))
        }
        return { operation: 'generate' as const, prompt: args.prompt, size: args.size, requested: count, failed: batch.failed, images: refs }
      },
    }))

    imageCtx.tools.register(defineTool({
      name: 'fhl_image_edit',
      description: 'Edit or combine one to ten uploaded or previously returned FHL image attachments. One to five references are recommended; six to ten are supported as a heavier single request.',
      parameters: {
        prompt: { type: 'string', required: true, description: 'The exact edit instruction.' },
        size: { type: 'string', required: true, description: 'Output size such as 2048x1152.' },
        count: { type: 'integer', description: 'Number of independent edit variations from 1 to 4; defaults to 1.' },
        sources: { type: 'array', items: toolRefSchema(), description: 'Optional. One to ten explicit image attachment references. Omit this field to use current-turn uploads, the latest earlier user-uploaded image set, or the latest successful FHL image tool result in this session.' },
      },
      output: { schema: outputSchema(), render: (_args, value) => renderOutput(value) },
      async execute(args: { prompt: string; size: string; count?: number; sources?: ToolRefArg[] }, exec) {
        assertSize(args.size)
        const count = requestedCount(args.count, 4)
        const sourceArgs = args.sources
        const sources = sourceArgs?.length
          ? sourceArgs.map(refArg)
          : (() => {
            const current = currentTurnUserImages(exec)
            if (current.length > 0) return current
            const earlier = latestUserImages(exec)
            return earlier.length > 0 ? earlier : latestFhlToolImages(exec)
          })()
        if (sources.length < 1) {
          throw new Error('no image was uploaded in the current user message and no prior successful FHL image result was found; provide sources explicitly')
        }
        if (sources.length > 10) {
          throw new Error(`image edit received ${String(sources.length)} references; at most 10 are supported`)
        }
        const sourceImages: FhlImageSource[] = []
        for (const source of sources) {
          const stored = await attachments.readImage(source, exec.signal)
          if (stored.ref.mediaType === 'image/gif') throw new Error('FHL image edit does not accept GIF references')
          sourceImages.push({
            data: stored.data,
            mediaType: stored.ref.mediaType,
            ...stored.ref.name === undefined ? {} : { name: stored.ref.name },
          })
        }
        const batch = await workers.runMany(count, exec.signal, async worker => {
          const images = await client.edit({ apiKey: worker.apiKey, prompt: args.prompt, size: args.size, sources: sourceImages, signal: exec.signal })
          const image = images[0]
          if (image === undefined) throw new Error('FHL Images API returned no image')
          return image
        })
        const refs: FhlImageToolRef[] = []
        for (const [index, image] of batch.values.entries()) {
          refs.push(await persist(image.data, `fhl-edited-${String(index + 1)}.png`))
        }
        return { operation: 'edit' as const, prompt: args.prompt, size: args.size, requested: count, failed: batch.failed, images: refs }
      },
    }))
  })
}
