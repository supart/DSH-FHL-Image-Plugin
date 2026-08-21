import { afterEach, describe, expect, it } from 'vitest'
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
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import * as FhlImage from '../src/index.ts'

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
  await context?.fiber.dispose()
  context = undefined
})

describe('FHL image plugin registration', () => {
  it('registers configuration, generation and edit tools only with attachments', async () => {
    context = new Context()
    await context.plugin(SystemPrompt)
    await context.plugin(ToolRuntime, { mode: 'native' })
    await context.plugin(MemoryCredentials)
    await context.plugin(MemoryAttachments)
    await context.plugin(FhlImage, { baseURL: 'http://127.0.0.1:1' })

    expect(context.tools.schemas().map(schema => schema.name)).toEqual([
      'fhl_image_configure',
      'fhl_image_generate',
      'fhl_image_edit',
    ])
  })
})
