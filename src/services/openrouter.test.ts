import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenRouterClient } from './openrouter'

describe('OpenRouterClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes abort signals to non-streaming chat requests', async () => {
    const controller = new AbortController()
    let requestInit: RequestInit | undefined

    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      requestInit = init
      return new Response(JSON.stringify({
        id: 'completion-1',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
      }), { status: 200 })
    }))

    const client = new OpenRouterClient('test-key')
    await client.createChatCompletion(
      {
        model: 'provider/model',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      { signal: controller.signal }
    )

    expect(requestInit?.signal).toBe(controller.signal)
  })
})
