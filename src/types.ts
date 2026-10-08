import type { ImageMediaType } from '@deepseek-ai/dsh-attachment'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials/types'

// The published DSH credential seam uses this event name. Importing the
// client-safe type surface also brings its Cordis event augmentation into the
// plugin's compilation context.
export type { CredentialRef }

export type FhlImageSize = string

// Product limits live here so the tool layer (`index.ts`), the API adapter
// (`client.ts`), the worker pool and the credential tool all read one value.
// Before 0.2.1 the same numbers were repeated as literals in four files.
/** The maximum number of independent image workers a user may configure. */
export const MAX_FHL_IMAGE_WORKERS = 10
/** The most variations one `fhl_image_generate` call may request. */
export const MAX_GENERATE_VARIATIONS = 9
/** The most variations one `fhl_image_edit` call may request. */
export const MAX_EDIT_VARIATIONS = 4
/** The most reference images one `fhl_image_edit` call may accept. */
export const MAX_EDIT_SOURCES = 10

export interface FhlImageSource {
  readonly data: Uint8Array
  readonly mediaType: Extract<ImageMediaType, 'image/png' | 'image/jpeg' | 'image/webp'>
  readonly name?: string
}

export interface FhlImageResult {
  readonly data: Uint8Array
  readonly mediaType: 'image/png'
  readonly name: string
}

export interface GenerateImageRequest {
  readonly apiKey: string
  readonly prompt: string
  readonly size: FhlImageSize
  readonly count?: number
  readonly signal?: AbortSignal
}

export interface EditImageRequest {
  readonly apiKey: string
  readonly prompt: string
  readonly size: FhlImageSize
  readonly sources: readonly FhlImageSource[]
  readonly signal?: AbortSignal
}

export interface FhlImagesClientOptions {
  readonly baseURL?: string
  readonly fetch?: typeof globalThis.fetch
  readonly timeoutMs?: number
  readonly maxResponseBytes?: number
}

export interface FhlImageToolRef {
  readonly attachmentId: string
  readonly mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
  readonly bytes: number
  readonly width: number
  readonly height: number
  readonly name?: string
}

export interface FhlImageToolOutput {
  readonly operation: 'generate' | 'edit'
  readonly prompt: string
  readonly size: string
  readonly requested: number
  readonly failed: number
  readonly images: readonly FhlImageToolRef[]
}
