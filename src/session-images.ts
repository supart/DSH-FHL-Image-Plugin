import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { Message } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'

/**
 * Session-scoped image sourcing for the edit tool.
 *
 * DSH 0.2 removed the `Session.events` getter and deprecates synchronous event
 * reads (`snapshotEvents`/`eventAt`/`ownEvents`), so this module replaces the
 * 0.1 raw-event scans with two sanctioned reads:
 *
 * - uploads come from the derived message history (`Session.deriveMessages()`);
 * - images this plugin produced are remembered in a small bounded, per-session,
 *   in-memory cache owned by the plugin.
 *
 * The cache is intentionally not durable. After a host restart an edit without
 * explicit `sources` reports the usual "provide sources explicitly" error
 * instead of guessing at a reference.
 */

/** How many sessions keep a produced-image memory before the oldest is dropped. */
export const PRODUCED_IMAGE_SESSION_LIMIT = 8

/** The execution surface this module reads: caller identity and derived messages. */
export interface SessionImageExecution {
  readonly agent?: {
    readonly id: unknown
    readonly session: Pick<Session, 'deriveMessages'>
  }
}

/** The durable-reference fields carried by a tool-facing image reference. */
export interface AttachmentRefInput {
  readonly attachmentId: string
  readonly mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
  readonly bytes: number
  readonly width: number
  readonly height: number
  readonly name?: string
}

/** Build one durable attachment reference from a tool-facing image reference. */
export function attachmentRef(input: AttachmentRefInput): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(input.attachmentId),
    mediaType: input.mediaType,
    bytes: input.bytes,
    width: input.width,
    height: input.height,
    ...input.name === undefined ? {} : { name: input.name },
  }
}

/** Identity of the session a tool call runs in, when the caller supplied one. */
function sessionKey(exec: SessionImageExecution): string | undefined {
  const id = exec.agent?.id
  return id === undefined || id === null ? undefined : String(id)
}

/**
 * Image blocks carried by one derived message, deduplicated by attachment id.
 * Injected context (goals, notices, relays) also arrives in user-role messages,
 * so only a producer-declared user source counts as the person's own input.
 */
export function messageImages(message: Message): ImageAttachmentRef[] {
  if (message.role !== 'user' || message.source.kind !== 'user') return []
  const images = new Map<string, ImageAttachmentRef>()
  for (const block of message.content) {
    if (block.type !== 'image') continue
    images.set(String(block.attachment.attachmentId), block.attachment)
  }
  return [...images.values()]
}

/**
 * Resolve user-uploaded images for an edit, newest message first. A fresh
 * upload in the current turn wins; a text-only follow-up reuses the latest
 * earlier upload. That is the 0.1 behavior expressed on the 0.2 derived-message
 * history instead of the raw session event log.
 */
export function latestUserUploadedImages(exec: SessionImageExecution): ImageAttachmentRef[] {
  const session = exec.agent?.session
  if (session === undefined) return []
  let messages: readonly Message[]
  try {
    messages = session.deriveMessages()
  } catch {
    // A session without a readable surface contributes no uploads; the caller
    // still falls back to produced-image memory and then to an explicit error.
    return []
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message === undefined) continue
    const images = messageImages(message)
    if (images.length > 0) return images
  }
  return []
}

/** Bounded, plugin-owned memory of the images produced most recently per session. */
export class ProducedImageMemory {
  private readonly sessions = new Map<string, readonly ImageAttachmentRef[]>()

  remember(exec: SessionImageExecution, refs: readonly AttachmentRefInput[]): void {
    const key = sessionKey(exec)
    if (key === undefined || refs.length === 0) return
    this.sessions.delete(key)
    this.sessions.set(key, refs.map(ref => attachmentRef(ref)))
    while (this.sessions.size > PRODUCED_IMAGE_SESSION_LIMIT) {
      const oldest = this.sessions.keys().next()
      if (oldest.done === true) break
      this.sessions.delete(oldest.value)
    }
  }

  /**
   * The newest image this plugin produced in the session, as a single-element
   * list, or an empty list when the session produced nothing.
   *
   * A generation call returns *alternatives*, not references, so the whole
   * remembered set is the wrong answer for an implicit edit: it combined nine
   * unrelated variations into one request. The prompt section and the
   * documentation have always promised "the newest image", so 0.2.1 makes the
   * code match that contract.
   */
  recall(exec: SessionImageExecution): ImageAttachmentRef[] {
    const key = sessionKey(exec)
    if (key === undefined) return []
    const refs = this.sessions.get(key)
    const newest = refs === undefined ? undefined : refs[refs.length - 1]
    return newest === undefined ? [] : [newest]
  }
}
