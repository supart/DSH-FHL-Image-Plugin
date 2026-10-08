import { describe, expect, it } from 'vitest'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { Message } from '@deepseek-ai/dsh-llm'
import {
  PRODUCED_IMAGE_SESSION_LIMIT,
  ProducedImageMemory,
  latestUserUploadedImages,
} from '../src/session-images.ts'
import type { SessionImageExecution } from '../src/session-images.ts'

function imageRef(id: string, name?: string): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(id),
    mediaType: 'image/png',
    bytes: 3,
    width: 1,
    height: 1,
    ...name === undefined ? {} : { name },
  }
}

function imageBlock(ref: ImageAttachmentRef): { type: 'image'; attachment: ImageAttachmentRef } {
  return { type: 'image', attachment: ref }
}

/**
 * Build one derived message. Producers other than the person (goals, notices,
 * relays) also emit user-role messages with their own `source.kind`, which is
 * exactly what the resolver has to skip.
 */
function message(role: 'user' | 'assistant' | 'tool', content: readonly unknown[], kind?: string): Message {
  const source = kind === undefined ? undefined : { kind }
  return { role, content, source } as unknown as Message
}

function execution(messages: readonly Message[], sessionId: string | undefined = 'session-1'): SessionImageExecution {
  if (sessionId === undefined) return {}
  return { agent: { id: sessionId, session: { deriveMessages: () => [...messages] } } }
}

describe('session-scoped edit sources', () => {
  it('prefers the newest user message that carries images', () => {
    const older = imageRef('older-image')
    const newer = imageRef('newer-image')
    const exec = execution([
      message('user', [imageBlock(older)], 'user'),
      message('assistant', [{ type: 'text', text: 'ok' }], 'model'),
      message('user', [{ type: 'text', text: 'make it warmer' }], 'user'),
      message('user', [imageBlock(newer)], 'user'),
    ])
    expect(latestUserUploadedImages(exec).map(ref => String(ref.attachmentId))).toEqual(['newer-image'])
  })

  it('reuses the latest earlier upload for a text-only follow-up', () => {
    const earlier = imageRef('earlier-image')
    const exec = execution([
      message('user', [imageBlock(earlier)], 'user'),
      message('user', [{ type: 'text', text: 'now edit it' }], 'user'),
    ])
    expect(latestUserUploadedImages(exec).map(ref => String(ref.attachmentId))).toEqual(['earlier-image'])
  })

  it('ignores injected user-role context and non-user roles', () => {
    const exec = execution([
      message('user', [imageBlock(imageRef('injected-context-image'))], 'notice'),
      message('tool', [imageBlock(imageRef('tool-image'))], 'tool'),
      message('assistant', [imageBlock(imageRef('model-image'))], 'model'),
    ])
    expect(latestUserUploadedImages(exec)).toEqual([])
  })

  it('deduplicates repeated attachment ids inside one message', () => {
    const ref = imageRef('repeated-image')
    const exec = execution([message('user', [imageBlock(ref), imageBlock(ref)], 'user')])
    expect(latestUserUploadedImages(exec)).toHaveLength(1)
  })

  it('contributes no uploads when the session is missing or unreadable', () => {
    expect(latestUserUploadedImages({})).toEqual([])
    const unreadable: SessionImageExecution = {
      agent: { id: 'session-broken', session: { deriveMessages: () => { throw new Error('detached') } } },
    }
    expect(latestUserUploadedImages(unreadable)).toEqual([])
  })
})

describe('produced-image memory', () => {
  it('returns the newest produced image for the same session only', () => {
    const memory = new ProducedImageMemory()
    const first = execution([], 'session-a')
    const second = execution([], 'session-b')
    memory.remember(first, [{ attachmentId: 'generated-1', mediaType: 'image/png', bytes: 1, width: 1, height: 1 }])
    memory.remember(second, [{ attachmentId: 'generated-2', mediaType: 'image/png', bytes: 1, width: 1, height: 1 }])
    memory.remember(first, [{ attachmentId: 'generated-3', mediaType: 'image/png', bytes: 1, width: 1, height: 1 }])

    expect(memory.recall(first).map(ref => String(ref.attachmentId))).toEqual(['generated-3'])
    expect(memory.recall(second).map(ref => String(ref.attachmentId))).toEqual(['generated-2'])
    expect(memory.recall(execution([], 'session-unknown'))).toEqual([])
    expect(memory.recall({})).toEqual([])
  })

  it('ignores empty results and keeps the recalled set independent', () => {
    const memory = new ProducedImageMemory()
    const exec = execution([], 'session-a')
    memory.remember(exec, [])
    expect(memory.recall(exec)).toEqual([])

    memory.remember(exec, [{ attachmentId: 'generated-1', mediaType: 'image/png', bytes: 1, width: 1, height: 1 }])
    const recalled = memory.recall(exec)
    recalled.push(imageRef('mutated'))
    expect(memory.recall(exec).map(ref => String(ref.attachmentId))).toEqual(['generated-1'])
  })

  it('recalls only the newest image when one call produced several variations', () => {
    const memory = new ProducedImageMemory()
    const exec = execution([], 'session-a')
    // A generation call's outputs are alternatives, not references. Returning
    // the whole set made an implicit edit combine unrelated variations, so only
    // the newest one may be handed back — the contract the prompt promises.
    memory.remember(exec, [
      { attachmentId: 'variation-1', mediaType: 'image/png', bytes: 1, width: 1, height: 1 },
      { attachmentId: 'variation-2', mediaType: 'image/png', bytes: 1, width: 1, height: 1 },
      { attachmentId: 'variation-3', mediaType: 'image/png', bytes: 1, width: 1, height: 1 },
    ])
    expect(memory.recall(exec).map(ref => String(ref.attachmentId))).toEqual(['variation-3'])
  })

  it('drops the oldest sessions once the bound is reached', () => {
    const memory = new ProducedImageMemory()
    for (let index = 0; index <= PRODUCED_IMAGE_SESSION_LIMIT + 1; index += 1) {
      memory.remember(execution([], `session-${String(index)}`), [
        { attachmentId: `generated-${String(index)}`, mediaType: 'image/png', bytes: 1, width: 1, height: 1 },
      ])
    }
    expect(memory.recall(execution([], 'session-0'))).toEqual([])
    expect(memory.recall(execution([], 'session-1'))).toEqual([])
    expect(memory.recall(execution([], `session-${String(PRODUCED_IMAGE_SESSION_LIMIT + 1)}`)))
      .toHaveLength(1)
  })
})
