import { create } from 'zustand'
import type { ModelParameters, ExecutionStatus, CodeArenaOutput, ScoringResult } from '@/types'
import { DEFAULT_FRONTEND_SYSTEM_PROMPT } from '@/services/codeExtractor'

interface CodeArenaState {
  // Prompt state
  prompt: string
  systemPrompt: string
  
  // Model selection (reuses modelStore for available models)
  selectedModelIds: string[]
  
  // Parameters
  parameters: ModelParameters
  
  // Judge settings
  judgeEnabled: boolean
  judgeModelId: string | null
  
  // Execution state
  executionStatus: ExecutionStatus
  currentRunId: string | null
  abortController: AbortController | null
  
  // Model outputs (keyed by modelId)
  outputs: Map<string, CodeArenaOutput>
  
  // View state (keyed by modelId) - true = preview, false = code
  viewModes: Map<string, boolean>
  
  // Actions
  setPrompt: (prompt: string) => void
  setSystemPrompt: (systemPrompt: string) => void
  resetSystemPrompt: () => void
  
  setSelectedModelIds: (modelIds: string[]) => void
  toggleModelSelection: (modelId: string) => void
  
  setParameters: (params: Partial<ModelParameters>) => void
  
  setJudgeEnabled: (enabled: boolean) => void
  setJudgeModelId: (modelId: string | null) => void
  
  setExecutionStatus: (status: ExecutionStatus) => void
  setCurrentRunId: (runId: string | null) => void
  setAbortController: (controller: AbortController | null) => void
  
  initializeOutputs: (modelIds: string[]) => void
  updateOutput: (modelId: string, updates: Partial<CodeArenaOutput>) => void
  setOutputScore: (modelId: string, score: ScoringResult) => void
  clearOutputs: () => void
  
  setViewMode: (modelId: string, isPreview: boolean) => void
  toggleViewMode: (modelId: string) => void
  setAllViewModes: (isPreview: boolean) => void
  
  reset: () => void
}

const defaultParameters: ModelParameters = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

export const useCodeArenaStore = create<CodeArenaState>()((set, get) => ({
  // Initial state
  prompt: '',
  systemPrompt: DEFAULT_FRONTEND_SYSTEM_PROMPT,
  selectedModelIds: [],
  parameters: defaultParameters,
  judgeEnabled: false,
  judgeModelId: null,
  executionStatus: 'idle',
  currentRunId: null,
  abortController: null,
  outputs: new Map(),
  viewModes: new Map(),
  
  // Prompt actions
  setPrompt: (prompt) => set({ prompt }),
  
  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
  
  resetSystemPrompt: () => set({ systemPrompt: DEFAULT_FRONTEND_SYSTEM_PROMPT }),
  
  // Model selection actions
  setSelectedModelIds: (modelIds) => set({ selectedModelIds: modelIds }),
  
  toggleModelSelection: (modelId) => {
    const { selectedModelIds } = get()
    if (selectedModelIds.includes(modelId)) {
      set({ selectedModelIds: selectedModelIds.filter((id) => id !== modelId) })
    } else {
      set({ selectedModelIds: [...selectedModelIds, modelId] })
    }
  },
  
  // Parameter actions
  setParameters: (params) => {
    set((state) => ({
      parameters: { ...state.parameters, ...params },
    }))
  },
  
  // Judge actions
  setJudgeEnabled: (enabled) => set({ judgeEnabled: enabled }),
  
  setJudgeModelId: (modelId) => set({ judgeModelId: modelId }),
  
  // Execution actions
  setExecutionStatus: (status) => set({ executionStatus: status }),
  
  setCurrentRunId: (runId) => set({ currentRunId: runId }),
  
  setAbortController: (controller) => set({ abortController: controller }),
  
  // Output actions
  initializeOutputs: (modelIds) => {
    const outputs = new Map<string, CodeArenaOutput>()
    const viewModes = new Map<string, boolean>()
    
    for (const modelId of modelIds) {
      outputs.set(modelId, {
        modelId,
        rawResponse: '',
        extractedCode: '',
        status: 'idle',
        streamedContent: '',
      })
      viewModes.set(modelId, true) // Default to preview mode
    }
    
    set({ outputs, viewModes })
  },
  
  updateOutput: (modelId, updates) => {
    set((state) => {
      const outputs = new Map(state.outputs)
      const existing = outputs.get(modelId)
      if (existing) {
        outputs.set(modelId, { ...existing, ...updates })
      }
      return { outputs }
    })
  },
  
  setOutputScore: (modelId, score) => {
    set((state) => {
      const outputs = new Map(state.outputs)
      const existing = outputs.get(modelId)
      if (existing) {
        outputs.set(modelId, { ...existing, score })
      }
      return { outputs }
    })
  },
  
  clearOutputs: () => {
    set({ outputs: new Map(), viewModes: new Map() })
  },
  
  // View mode actions
  setViewMode: (modelId, isPreview) => {
    set((state) => {
      const viewModes = new Map(state.viewModes)
      viewModes.set(modelId, isPreview)
      return { viewModes }
    })
  },
  
  toggleViewMode: (modelId) => {
    set((state) => {
      const viewModes = new Map(state.viewModes)
      const current = viewModes.get(modelId) ?? true
      viewModes.set(modelId, !current)
      return { viewModes }
    })
  },
  
  setAllViewModes: (isPreview) => {
    set((state) => {
      const viewModes = new Map(state.viewModes)
      for (const modelId of viewModes.keys()) {
        viewModes.set(modelId, isPreview)
      }
      return { viewModes }
    })
  },
  
  // Reset action
  reset: () => {
    const { abortController } = get()
    if (abortController) {
      abortController.abort()
    }
    
    set({
      prompt: '',
      systemPrompt: DEFAULT_FRONTEND_SYSTEM_PROMPT,
      selectedModelIds: [],
      parameters: defaultParameters,
      judgeEnabled: false,
      judgeModelId: null,
      executionStatus: 'idle',
      currentRunId: null,
      abortController: null,
      outputs: new Map(),
      viewModes: new Map(),
    })
  },
}))
