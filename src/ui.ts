/**
 * Browser half of the bundle: render this plugin's generated images inside the
 * conversation instead of leaving them in a text-only Tool row.
 *
 * Why this file exists
 * --------------------
 * The Tool client dispatches a keyed `tool.call.toolview` entry by the wire
 * Tool name and falls back to a generic row for any unclaimed key. That generic
 * row draws images only when the call is the built-in `read_image`
 * (`imageCardModel` returns null for every other name), so before this file a
 * settled `fhl_image_generate`/`fhl_image_edit` result showed as
 * "Generated 2 image(s) at 1152x2048" with the durable images reachable only as
 * attachments. Claiming the two keys is the supported fix and needs no change
 * to the host half.
 *
 * Why the import is a namespace and the types are local
 * -----------------------------------------------------
 * The client module loader answers `react` from the host module table (the
 * platform seed) and rolls its namespace through an interop shim, so reading
 * `React.useState` off the namespace is the shape the host's own client bundles
 * rely on; destructured named imports are what that shim can copy out from
 * under a component. For the same reason there is no import of any
 * `@deepseek-ai/dsh-client-ui-*` package: those are not `peerDependencies`, so
 * the published package cannot resolve them, and a type-only import would still
 * be a dependency the install contract does not admit. The declarations below
 * mirror the contracts this entry touches, and {@link toAttachmentRef}
 * validates at runtime rather than trusting a cast, so a drift degrades to the
 * generic row instead of a broken frame.
 */
import * as React from 'react'

/** The two Tool names that carry durable images and therefore claim a view. */
const TOOL_VIEW_KEYS = ['fhl_image_generate', 'fhl_image_edit'] as const

/**
 * Inline styles, not a stylesheet: this entry injects no CSS, so every rule the
 * gallery needs travels with the element. The host's own image card frames its
 * gallery the same way, which keeps a claimed row visually consistent with the
 * `read_image` row it borrows its presentation from.
 */
const ROW_STYLE = { display: 'flex', flexDirection: 'column', gap: '8px' } as const
const GALLERY_STYLE = { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' } as const
const IMAGE_STYLE = {
  display: 'block',
  width: 'auto',
  height: 'auto',
  maxWidth: 'min(100%, 320px)',
  maxHeight: '320px',
  borderRadius: '8px',
  objectFit: 'contain',
} as const
const ENVELOPE_STYLE = { whiteSpace: 'pre-wrap' } as const

/** Durable reference to one normalized image, as the Tool result carries it. */
interface ImageAttachmentRef {
  attachmentId: string
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  bytes: number
  width: number
  height: number
  name?: string
}

/** Session-authorized loader: resolves a durable reference to a display URL. */
type MessageImageLoader = ((attachment: ImageAttachmentRef) => Promise<string>) & {
  peek?: (attachment: ImageAttachmentRef) => string | undefined
}

/** One block of a settled Tool result; only `text` and `image` are drawn here. */
type ToolContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; attachment: ImageAttachmentRef }
  | { type: string; [key: string]: unknown }

/** Phase-discriminated props the Tool tree hands to a registered view. */
type ToolCallViewProps =
  | { phase: 'preparing'; block: { arguments?: string } }
  | { phase: 'start'; block: { arguments?: string } }
  | { phase: 'result'; block: { content: readonly ToolContentBlock[]; isError?: boolean } }

/** The subset of the slots service this entry uses. */
interface SlotRegistration {
  name: string
  key: string
}

interface SlotService {
  inject(key: string, register: () => unknown): unknown
  register(options: SlotRegistration, component: (props: never) => React.ReactNode): unknown
}

interface ClientContext {
  slots: SlotService
}

const IMAGE_MEDIA_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Narrow one result block to a durable image reference, mirroring the Tool
 * layer's own admission check so a malformed block is skipped rather than
 * rendered as a broken frame.
 * @param value - one block of the settled Tool result.
 * @returns the reference, or undefined when the block is not one.
 */
function toAttachmentRef(value: unknown): ImageAttachmentRef | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const block = value as { type?: unknown; attachment?: unknown }
  if (block.type !== 'image') return undefined
  if (typeof block.attachment !== 'object' || block.attachment === null) return undefined
  const ref = block.attachment as Record<string, unknown>
  if (typeof ref.attachmentId !== 'string' || ref.attachmentId.length === 0) return undefined
  if (typeof ref.mediaType !== 'string' || !IMAGE_MEDIA_TYPES.includes(ref.mediaType)) return undefined
  if (!positiveInteger(ref.bytes) || !positiveInteger(ref.width) || !positiveInteger(ref.height)) return undefined
  return {
    attachmentId: ref.attachmentId,
    mediaType: ref.mediaType as ImageAttachmentRef['mediaType'],
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...ref.name === undefined ? {} : { name: String(ref.name) },
  }
}

/**
 * Result text this gallery keeps beneath the images. The generic row showed the
 * envelope (`Generated 2 image(s) at 1152x2048`) plus the prompt; a claimed view
 * replaces that row entirely, so the same lines are re-emitted here rather than
 * silently dropped.
 * @param content - the settled result's blocks.
 * @returns the text lines, in result order.
 */
function readTexts(content: readonly ToolContentBlock[]): string[] {
  const texts: string[] = []
  for (const block of content) {
    const text = (block as { text?: unknown }).text
    if (block.type === 'text' && typeof text === 'string') texts.push(text)
  }
  return texts
}

/**
 * Resolve every reference to a display URL. `peek` is consulted first because
 * the loader exposes a synchronous cache read: a re-render or a scroll back
 * into the transcript then paints without a second round trip.
 * @param props - durable references in result order, plus the session loader.
 * @returns the gallery, or a placeholder while any reference is still loading.
 */
function ImageGallery(props: { attachments: readonly ImageAttachmentRef[]; loadImage: MessageImageLoader }): React.ReactNode {
  const { attachments, loadImage } = props
  const [urls, setUrls] = React.useState<readonly string[] | null>(() => {
    const cached = attachments.map(attachment => loadImage.peek?.(attachment))
    return cached.every((url): url is string => typeof url === 'string') ? cached : null
  })

  React.useEffect(() => {
    let cancelled = false
    const cached = attachments.map(attachment => loadImage.peek?.(attachment))
    if (cached.every((url): url is string => typeof url === 'string')) {
      setUrls(cached)
      return () => {
        cancelled = true
      }
    }
    void Promise.all(attachments.map(async attachment => await loadImage(attachment)))
      .then((resolved) => {
        if (!cancelled) setUrls(resolved)
      })
      .catch(() => {
        if (!cancelled) setUrls(null)
      })
    return () => {
      cancelled = true
    }
  }, [attachments, loadImage])

  if (urls === null) {
    return React.createElement('div', {}, `${String(attachments.length)} image(s) loading…`)
  }

  return React.createElement(
    'div',
    { style: GALLERY_STYLE },
    ...urls.map((url, index) => React.createElement('img', {
      key: attachments[index]?.attachmentId ?? String(index),
      style: IMAGE_STYLE,
      src: url,
      alt: attachments[index]?.name ?? `fhl-image-${String(index + 1)}`,
    })),
  )
}

/**
 * The claimed row for one settled image-bearing call: every durable image, then
 * the result envelope text. Nothing renders before the result phase, because a
 * running call carries no images yet and the generic row already owns that
 * presentation.
 * @param props - phase-discriminated props from the Tool tree.
 * @returns the row body, or null while no image is available.
 */
function FhlImageToolView(props: ToolCallViewProps): React.ReactNode {
  // Narrowing happens through `props.phase` rather than a destructured `block`,
  // whose union would make `content` unreachable without a cast.
  const content = props.phase === 'result' ? props.block.content : undefined
  const loadImage = (props as { loadImage?: MessageImageLoader }).loadImage ?? null
  const attachments = React.useMemo(
    () => (content ?? []).map(toAttachmentRef).filter((ref): ref is ImageAttachmentRef => ref !== undefined),
    [content],
  )

  if (content === undefined || attachments.length === 0 || loadImage === null) return null

  return React.createElement(
    'div',
    { style: ROW_STYLE },
    React.createElement(ImageGallery, { attachments, loadImage }),
    ...readTexts(content).map((text, index) => React.createElement('div', {
      key: `text-${String(index)}`,
      style: ENVELOPE_STYLE,
    }, text)),
  )
}

/** Services this client entry reads. */
export const inject = ['slots']

/**
 * Claim the view for both image-bearing Tool names.
 *
 * The keys are claimed rather than a child gallery slot declared: `tool.call.images`
 * is already declared by the built-in read_image view and the registry permits
 * exactly one declarer per child key, so declaring it here would throw at load.
 * No `locale` is declared because this view renders no translated string, and
 * declaring a namespace demands an installed dictionary face.
 * @param ctx - client root context carrying the slot service.
 */
export function apply(ctx: ClientContext): void {
  for (const key of TOOL_VIEW_KEYS) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key },
      FhlImageToolView as (props: never) => React.ReactNode,
    ))
  }
}
