import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Settings } from '@/types'

interface SettingsState extends Settings {
  setApiKey: (apiKey: string) => void
  setDefaultTemperature: (temperature: number) => void
  setDefaultTopP: (topP: number) => void
  setDefaultMaxTokens: (maxTokens: number) => void
  setMaxRunCostUsd: (maxRunCostUsd: number) => void
  setConcurrencyLimit: (concurrencyLimit: number) => void
  setTheme: (theme: Settings['theme']) => void
  clearApiKey: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      defaultTemperature: 0.7,
      defaultTopP: 1,
      defaultMaxTokens: 2048,
      maxRunCostUsd: 0,
      concurrencyLimit: 5,
      theme: 'system',

      setApiKey: (apiKey) => set({ apiKey }),
      setDefaultTemperature: (defaultTemperature) => set({ defaultTemperature }),
      setDefaultTopP: (defaultTopP) => set({ defaultTopP }),
      setDefaultMaxTokens: (defaultMaxTokens) => set({ defaultMaxTokens }),
      setMaxRunCostUsd: (maxRunCostUsd) => set({ maxRunCostUsd: Math.max(0, maxRunCostUsd) }),
      setConcurrencyLimit: (concurrencyLimit) =>
        set({ concurrencyLimit: Math.min(20, Math.max(1, Math.round(concurrencyLimit))) }),
      setTheme: (theme) => set({ theme }),
      clearApiKey: () => set({ apiKey: '' }),
    }),
    {
      name: 'benchmaker-settings',
      version: 2,
      partialize: (state) => ({
        defaultTemperature: state.defaultTemperature,
        defaultTopP: state.defaultTopP,
        defaultMaxTokens: state.defaultMaxTokens,
        maxRunCostUsd: state.maxRunCostUsd,
        concurrencyLimit: state.concurrencyLimit,
        theme: state.theme,
      }),
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState
        }

        return {
          ...(persistedState as Partial<Settings>),
          apiKey: '',
        }
      },
    }
  )
)
