import { create } from 'zustand'
import { checkForUpdate, downloadUpdate, installUpdate, type UpdateInfo } from '@/services/updater'

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'disabled'
  | 'error'

interface UpdateState {
  currentVersion: string | null
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  updatePath: string | null
  error: string | null
  lastCheckedAt: number | null
  loadCurrentVersion: () => Promise<void>
  checkNow: () => Promise<UpdateInfo | null>
  downloadNow: (info?: UpdateInfo | null) => Promise<string | null>
  installNow: () => Promise<void>
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function readCurrentVersion(): Promise<string | null> {
  if (!isTauriRuntime()) return null
  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion()
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    try {
      return JSON.stringify(error)
    } catch {
      // Fall through
    }
  }
  return 'Update request failed.'
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  currentVersion: null,
  status: 'idle',
  updateInfo: null,
  updatePath: null,
  error: null,
  lastCheckedAt: null,

  loadCurrentVersion: async () => {
    if (get().currentVersion) return
    const version = await readCurrentVersion()
    if (version) {
      set({ currentVersion: version })
    }
  },

  checkNow: async () => {
    if (!isTauriRuntime()) {
      set({
        status: 'disabled',
        error: 'Updates are only available in the desktop app.',
        lastCheckedAt: Date.now(),
      })
      return null
    }

    if (import.meta.env.DEV) {
      set({
        status: 'disabled',
        error: 'Updates are disabled in development builds.',
        lastCheckedAt: Date.now(),
      })
      return null
    }

    set({ status: 'checking', error: null })
    await get().loadCurrentVersion()

    try {
      const info = await checkForUpdate()
      if (!info) {
        set({
          status: 'up-to-date',
          updateInfo: null,
          updatePath: null,
          lastCheckedAt: Date.now(),
        })
        return null
      }

      set({
        status: 'available',
        updateInfo: info,
        updatePath: null,
        lastCheckedAt: Date.now(),
      })
      return info
    } catch (error) {
      set({
        status: 'error',
        error: formatError(error),
        lastCheckedAt: Date.now(),
      })
      return null
    }
  },

  downloadNow: async (info) => {
    const updateInfo = info ?? get().updateInfo
    if (!updateInfo) return null

    if (get().status === 'ready' && get().updatePath) {
      return get().updatePath
    }

    set({ status: 'downloading', error: null, updateInfo })
    try {
      const path = await downloadUpdate(updateInfo)
      set({ status: 'ready', updatePath: path, updateInfo })
      return path
    } catch (error) {
      set({ status: 'error', error: formatError(error) })
      return null
    }
  },

  installNow: async () => {
    const updatePath = get().updatePath
    if (!updatePath) {
      set({ status: 'error', error: 'Update package not downloaded yet.' })
      return
    }

    set({ status: 'installing', error: null })
    try {
      await installUpdate(updatePath)
    } catch (error) {
      set({ status: 'ready', error: formatError(error) })
    }
  },
}))
