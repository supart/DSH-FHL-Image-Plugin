import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { AttachmentId, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentLimits, ImageAttachmentRef, SaveImageAttachment, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
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
  set(ref: CredentialRef, value: string): Promise<void> { this.values.set(ref, value); return Promise.resolve() }
  unset(ref: CredentialRef): Promise<void> { this.values.delete(ref); return Promise.resolve() }
  // The record half of the credential seam has nothing to do with image
  // workers; it exists only to satisfy the abstract base class.
  readRecord(): Promise<never> { return Promise.reject(new Error('credential records are not used by this fixture')) }
  describeRecord(): Promise<never> { return Promise.reject(new Error('credential records are not used by this fixture')) }
  listRecords(): Promise<never> { return Promise.reject(new Error('credential records are not used by this fixture')) }
  modifyRecord(): Promise<never> { return Promise.reject(new Error('credential records are not used by this fixture')) }
  deleteRecord(): Promise<never> { return Promise.reject(new Error('credential records are not used by this fixture')) }
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
  validateImage(_input: SaveImageAttachment): Promise<void> { return Promise.resolve() }
  async saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    const id = AttachmentId(`loader-memory-${String(this.values.size + 1)}`)
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
    if (stored === undefined) throw new Error('loader memory attachment not found')
    return stored
  }
}

let context: Context | undefined
let root: string | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('FHL image DSH Loader runtime', () => {
  it('loads the bundle through the official Loader and registers all three tools', async () => {
    root = await mkdtemp(join(tmpdir(), 'fhl-image-loader-runtime-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- id: system-prompt',
      "  name: 'test-system-prompt'",
      '- id: tools',
      "  name: 'test-tools'",
      '- id: credentials',
      "  name: 'test-credentials'",
      '- id: attachments',
      "  name: 'test-attachments'",
      '- id: fhl-image',
      "  name: '@fhl-plugins/dsh-fhl-image'",
      '  config:',
      '    baseURL: http://127.0.0.1:1',
      '    apiKeyEnv: FHL_IMAGE_API_KEY',
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['test-system-prompt', SystemPrompt],
      ['test-tools', ToolRuntime],
      ['test-credentials', MemoryCredentials],
      ['test-attachments', MemoryAttachments],
      ['@fhl-plugins/dsh-fhl-image', FhlImage],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        const module = modules.get(specifier)
        if (module === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
        return module
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    expect(context.tools.schemas().map(schema => schema.name)).toEqual([
      'fhl_image_configure',
      'fhl_image_generate',
      'fhl_image_edit',
    ])
  })
})
