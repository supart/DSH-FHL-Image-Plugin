import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const BUNDLE = resolve(import.meta.dirname, '..', 'lib', 'ui.js')

/** One registration the module loader captured from the bundle's factory. */
interface LoadedModule {
  id: string
  factory: (require: (specifier: string) => unknown) => unknown
}

/** The client surface the loader reads back out of a factory. */
interface ClientSurface {
  apply?: (ctx: unknown) => void
  inject?: unknown
}

/** One captured factory invocation: the module the bundle registered plus what it required. */
interface Loaded {
  id: string
  surface: ClientSurface
  requested: string[]
}

/**
 * The browser half is served as a classic script that hands its factory to
 * `window.__ModuleLoader__.load`, so the bundle can only be exercised with that
 * facade present. Installing it before the dynamic import is what makes these
 * specs run the *published* artifact instead of a copy of its source: the
 * `./ui` export, the factory wrapper and the `apply`/`inject` surface are all
 * asserted here, so a tsdown or export-map regression fails the suite.
 * @returns every module the bundle registered, with the specifiers it required.
 */
async function loadClientBundle(): Promise<Loaded[]> {
  if (!existsSync(BUNDLE)) {
    throw new Error('lib/ui.js is missing; run `pnpm build` first (the `pretest` script does it for you)')
  }
  const captured: LoadedModule[] = []
  Object.assign(globalThis, {
    window: { __ModuleLoader__: { load: (entry: LoadedModule) => captured.push(entry) } },
  })

  // A unique query keeps each spec's import fresh; the module cache would
  // otherwise hand a later spec the registrations of the first one.
  await import(`${pathToFileURL(BUNDLE).href}?spec=${String(Date.now())}-${String(Math.random())}`)

  return captured.map((entry) => {
    const requested: string[] = []
    const surface = entry.factory((specifier) => {
      requested.push(specifier)
      if (specifier === 'react') return React
      throw new Error(`the client half required "${specifier}", which is not in the host module table`)
    }) as ClientSurface
    return { id: entry.id, surface, requested }
  })
}

/** A slot service that records every registration, mirroring `dsh-client-ui-slots`. */
function recordingSlots() {
  const injected: string[] = []
  const registrations: Record<string, unknown>[] = []
  const components = new Map<string, (props: never) => React.ReactNode>()
  return {
    injected,
    registrations,
    components,
    service: {
      inject(key: string, register: () => unknown) {
        injected.push(key)
        return register()
      },
      register(options: Record<string, unknown>, component: (props: never) => React.ReactNode) {
        registrations.push(options)
        components.set(String(options.key), component)
        return () => {}
      },
    },
  }
}

describe('built client half', () => {
  it('registers itself under the package id and exposes the Cordis surface', async () => {
    const loaded = await loadClientBundle()

    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.id).toBe('@fhl-plugins/dsh-fhl-image')
    expect(typeof loaded[0]?.surface.apply).toBe('function')
    // Cordis reads `inject` off the registered module; the entry reads only the
    // slot service.
    expect(loaded[0]?.surface.inject).toEqual(['slots'])
    // The loader's synchronous require answers `react` from the host module
    // table: bundling it would pin a second React inside the plugin and break
    // the host's hook dispatcher.
    expect(loaded[0]?.requested).toContain('react')
  })

  it('claims a keyed toolview for both image-bearing tool names', async () => {
    const loaded = await loadClientBundle()
    const slots = recordingSlots()

    loaded[0]?.surface.apply?.({ slots: slots.service })

    expect(slots.injected).toEqual(['tool.call.toolview', 'tool.call.toolview'])
    expect(slots.registrations).toEqual([
      { name: 'tool.call.toolview', key: 'fhl_image_generate' },
      { name: 'tool.call.toolview', key: 'fhl_image_edit' },
    ])
  })

  it('declares no child gallery slot, which the built-in view already owns', async () => {
    // `tool.call.images` has exactly one declarer (the read_image view) and a
    // second declaration throws while the client loads, so the registration
    // must stay a bare keyed claim. This is asserted at runtime rather than by
    // scanning the artifact, which legitimately names that slot in the comment
    // explaining the omission.
    const loaded = await loadClientBundle()
    const slots = recordingSlots()

    loaded[0]?.surface.apply?.({ slots: slots.service })

    expect(slots.registrations).toHaveLength(2)
    for (const options of slots.registrations) {
      expect(Object.keys(options).sort()).toEqual(['key', 'name'])
      expect(options.children).toBeUndefined()
    }
  })

  it('renders every durable image with its envelope text', async () => {
    // The real proof that the claimed row replaces the text-only one: the
    // registered component is rendered through React itself, so a hook
    // violation, a broken element tree, or a gallery that never reaches an
    // <img> all fail here rather than in the browser.
    const loaded = await loadClientBundle()
    const slots = recordingSlots()
    loaded[0]?.surface.apply?.({ slots: slots.service })

    const references = ['a'.repeat(64), 'b'.repeat(64)].map((attachmentId, index) => ({
      attachmentId,
      mediaType: 'image/png' as const,
      bytes: 1024 + index,
      width: 1152,
      height: 2048,
      name: `fhl-generated-${String(index + 1)}.png`,
    }))
    // `loadImage.peek` is the loader's synchronous cache read; answering it makes
    // the gallery paint on the first render, which is what the session-authorized
    // loader does once an image is in the transcript.
    const loadImage = Object.assign(
      async () => await Promise.resolve('about:blank'),
      { peek: (attachment: { attachmentId: string }) => `dsh-resource://file/${attachment.attachmentId}` },
    )

    const component = slots.components.get('fhl_image_generate')
    expect(component).toBeDefined()

    const html = renderToStaticMarkup(React.createElement(component as never, {
      phase: 'result',
      toolName: 'fhl_image_generate',
      callId: 'call-1',
      loadImage,
      block: {
        content: [
          { type: 'text', text: 'Generated 2 image(s) at 1152x2048.\nPrompt: 一只柯基' },
          ...references.map(attachment => ({ type: 'image', attachment })),
        ],
        isError: false,
      },
    } as never))

    expect(html.match(/<img/gu)).toHaveLength(2)
    expect(html).toContain(`src="dsh-resource://file/${references[0]?.attachmentId ?? ''}"`)
    expect(html).toContain('Generated 2 image(s) at 1152x2048.')
    expect(html).toContain('一只柯基')
    // Inline presentation, since this entry injects no stylesheet.
    expect(html).toContain('flex-wrap:wrap')
  })

  it('renders nothing before the result phase', async () => {
    const loaded = await loadClientBundle()
    const slots = recordingSlots()
    loaded[0]?.surface.apply?.({ slots: slots.service })

    const component = slots.components.get('fhl_image_edit')
    const html = renderToStaticMarkup(React.createElement(component as never, {
      phase: 'start',
      toolName: 'fhl_image_edit',
      callId: 'call-2',
      loadImage: async () => await Promise.resolve('about:blank'),
      block: { arguments: '{}' },
    } as never))

    // A running call has no images yet; the generic row owns that presentation.
    expect(html).toBe('')
  })
})
