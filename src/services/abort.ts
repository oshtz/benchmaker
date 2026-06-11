export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

export function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return

  if (signal.reason instanceof DOMException) {
    throw signal.reason
  }

  throw new DOMException('Aborted', 'AbortError')
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
  }

  throwIfAborted(signal)

  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)

    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId)
      reject(signal.reason instanceof DOMException
        ? signal.reason
        : new DOMException('Aborted', 'AbortError'))
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

export async function withAbortableTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal: AbortSignal,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  throwIfAborted(parentSignal)

  const controller = new AbortController()
  let timedOut = false

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException(timeoutMessage, 'TimeoutError'))
  }, timeoutMs)

  const handleParentAbort = () => {
    controller.abort(parentSignal.reason instanceof DOMException
      ? parentSignal.reason
      : new DOMException('Aborted', 'AbortError'))
  }

  parentSignal.addEventListener('abort', handleParentAbort, { once: true })

  try {
    return await operation(controller.signal)
  } catch (error) {
    if (timedOut && isAbortError(error)) {
      throw new Error(timeoutMessage)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
    parentSignal.removeEventListener('abort', handleParentAbort)
  }
}
