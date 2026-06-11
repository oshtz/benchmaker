import { describe, expect, it, vi } from 'vitest'

import { configureMonacoEnvironment, configureMonacoLoader, type MonacoWorkers } from './monaco'

describe('configureMonacoLoader', () => {
  it('points the Monaco React loader at the bundled editor package', () => {
    const loader = { config: vi.fn() }
    const monaco = { editor: {} }

    configureMonacoLoader(loader, monaco)

    expect(loader.config).toHaveBeenCalledWith({ monaco })
  })
})

describe('configureMonacoEnvironment', () => {
  it('routes Monaco worker labels to bundled worker constructors', () => {
    class EditorWorker {}
    class JsonWorker {}
    class CssWorker {}
    class HtmlWorker {}
    class TypeScriptWorker {}

    configureMonacoEnvironment({
      editor: EditorWorker,
      json: JsonWorker,
      css: CssWorker,
      html: HtmlWorker,
      typescript: TypeScriptWorker,
    } as unknown as MonacoWorkers)

    const environment = (globalThis as typeof globalThis & {
      MonacoEnvironment: { getWorker: (_moduleId: string, label: string) => Worker }
    }).MonacoEnvironment

    expect(environment.getWorker('', 'json')).toBeInstanceOf(JsonWorker)
    expect(environment.getWorker('', 'scss')).toBeInstanceOf(CssWorker)
    expect(environment.getWorker('', 'handlebars')).toBeInstanceOf(HtmlWorker)
    expect(environment.getWorker('', 'javascript')).toBeInstanceOf(TypeScriptWorker)
    expect(environment.getWorker('', 'markdown')).toBeInstanceOf(EditorWorker)
  })
})
