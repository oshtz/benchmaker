import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OpenRouterModel, ModelParameters } from '@/types'

interface ModelState {
  availableModels: OpenRouterModel[]
  selectedModelIds: string[]
  judgeModelId: string | null
  parameters: ModelParameters
  isLoadingModels: boolean
  modelsError: string | null
  lastFetchedAt: number | null

  // Model List Actions
  setAvailableModels: (models: OpenRouterModel[]) => void
  setIsLoadingModels: (loading: boolean) => void
  setModelsError: (error: string | null) => void
  setLastFetchedAt: (timestamp: number) => void

  // Selection Actions
  toggleModelSelection: (modelId: string) => void
  selectModels: (modelIds: string[]) => void
  clearSelectedModels: () => void
  setJudgeModel: (modelId: string | null) => void

  // Parameter Actions
  setParameters: (params: Partial<ModelParameters>) => void
  resetParameters: () => void
  toggleBenchmarkMode: () => void
  getEffectiveParameters: () => ModelParameters

  // Getters
  getSelectedModels: () => OpenRouterModel[]
  getJudgeModel: () => OpenRouterModel | null
}

const defaultParameters: ModelParameters = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 2048,
  frequencyPenalty: 0,
  presencePenalty: 0,
  benchmarkMode: false,
}

// Benchmark mode uses temp=0 for reproducibility
const benchmarkModeParameters: Partial<ModelParameters> = {
  temperature: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      availableModels: [],
      selectedModelIds: [],
      judgeModelId: null,
      parameters: { ...defaultParameters },
      isLoadingModels: false,
      modelsError: null,
      lastFetchedAt: null,

      setAvailableModels: (models) => set({ availableModels: models }),
      setIsLoadingModels: (isLoadingModels) => set({ isLoadingModels }),
      setModelsError: (modelsError) => set({ modelsError }),
      setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),

      toggleModelSelection: (modelId) => {
        set((state) => ({
          selectedModelIds: state.selectedModelIds.includes(modelId)
            ? state.selectedModelIds.filter((id) => id !== modelId)
            : [...state.selectedModelIds, modelId],
        }))
      },

      selectModels: (modelIds) => set({ selectedModelIds: modelIds }),

      clearSelectedModels: () => set({ selectedModelIds: [] }),

      setJudgeModel: (judgeModelId) => set({ judgeModelId }),

      setParameters: (params) =>
        set((state) => ({
          parameters: { ...state.parameters, ...params },
        })),

      resetParameters: () => set({ parameters: { ...defaultParameters } }),

      getSelectedModels: () => {
        const state = get()
        return state.availableModels.filter((m) =>
          state.selectedModelIds.includes(m.id)
        )
      },

      getJudgeModel: () => {
        const state = get()
        return state.availableModels.find((m) => m.id === state.judgeModelId) || null
      },

      toggleBenchmarkMode: () => {
        set((state) => {
          const newBenchmarkMode = !state.parameters.benchmarkMode
          if (newBenchmarkMode) {
            // Enable benchmark mode: apply benchmark parameters
            return {
              parameters: {
                ...state.parameters,
                ...benchmarkModeParameters,
                benchmarkMode: true,
              },
            }
          } else {
            // Disable benchmark mode: restore defaults but keep maxTokens and topP
            return {
              parameters: {
                ...state.parameters,
                temperature: defaultParameters.temperature,
                frequencyPenalty: defaultParameters.frequencyPenalty,
                presencePenalty: defaultParameters.presencePenalty,
                benchmarkMode: false,
              },
            }
          }
        })
      },

      getEffectiveParameters: () => {
        const state = get()
        if (state.parameters.benchmarkMode) {
          return {
            ...state.parameters,
            temperature: 0, // Always 0 in benchmark mode
            frequencyPenalty: 0,
            presencePenalty: 0,
          }
        }
        return state.parameters
      },
    }),
    {
      name: 'benchmaker-models',
      partialize: (state) => ({
        selectedModelIds: state.selectedModelIds,
        judgeModelId: state.judgeModelId,
        parameters: state.parameters,
      }),
    }
  )
)
