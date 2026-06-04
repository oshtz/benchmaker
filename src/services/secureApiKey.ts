function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/tauri')
  return invoke<T>(command, args)
}

export async function loadStoredApiKey(): Promise<string> {
  if (!isTauriRuntime()) return ''

  return (await invokeTauri<string | null>('get_stored_api_key')) ?? ''
}

export async function saveStoredApiKey(apiKey: string): Promise<void> {
  if (!isTauriRuntime()) return

  await invokeTauri<void>('save_api_key', { apiKey })
}

export async function clearStoredApiKey(): Promise<void> {
  if (!isTauriRuntime()) return

  await invokeTauri<void>('clear_stored_api_key')
}
