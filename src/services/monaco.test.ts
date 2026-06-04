import { describe, expect, it, vi } from 'vitest'

import { configureMonacoLoader } from './monaco'

describe('configureMonacoLoader', () => {
  it('points the Monaco React loader at the bundled editor package', () => {
    const loader = { config: vi.fn() }
    const monaco = { editor: {} }

    configureMonacoLoader(loader, monaco)

    expect(loader.config).toHaveBeenCalledWith({ monaco })
  })
})
