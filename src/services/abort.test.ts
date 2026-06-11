import { afterEach, describe, expect, it, vi } from 'vitest'
import { delay, withAbortableTimeout } from './abort'

describe('abort helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('aborts the wrapped operation when the timeout expires', async () => {
    vi.useFakeTimers()
    const parent = new AbortController()
    const requestSignals: AbortSignal[] = []

    const result = withAbortableTimeout(
      (signal) => {
        requestSignals.push(signal)
        return new Promise<string>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      },
      parent.signal,
      100,
      'Request timed out'
    )
    const assertion = expect(result).rejects.toThrow('Request timed out')

    await vi.advanceTimersByTimeAsync(100)

    await assertion
    expect(requestSignals[0].aborted).toBe(true)
    expect(requestSignals[0].reason).toBeInstanceOf(DOMException)
    expect(requestSignals[0].reason.name).toBe('TimeoutError')
  })

  it('cancels delays when the parent signal aborts', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const waiting = delay(1_000, controller.signal)
    const assertion = expect(waiting).rejects.toThrow('Stopped')

    controller.abort(new DOMException('Stopped', 'AbortError'))
    await vi.advanceTimersByTimeAsync(1_000)

    await assertion
  })
})
