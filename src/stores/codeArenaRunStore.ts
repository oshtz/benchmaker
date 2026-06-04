import { create } from 'zustand'
import type { CodeArenaRun, CodeArenaOutput, ScoringResult } from '@/types'

interface CodeArenaRunState {
  runs: CodeArenaRun[]
  currentRunId: string | null
  
  // Actions
  addRun: (run: CodeArenaRun) => void
  updateRun: (runId: string, updates: Partial<CodeArenaRun>) => void
  deleteRun: (runId: string) => void
  
  setCurrentRun: (runId: string | null) => void
  getCurrentRun: () => CodeArenaRun | null
  
  addOutput: (runId: string, output: CodeArenaOutput) => void
  updateOutput: (runId: string, modelId: string, updates: Partial<CodeArenaOutput>) => void
  setOutputScore: (runId: string, modelId: string, score: ScoringResult) => void
  
  completeRun: (runId: string) => void
  
  // Bulk operations
  setRuns: (runs: CodeArenaRun[]) => void
  clearRuns: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useCodeArenaRunStore = create<CodeArenaRunState>()((set, get) => ({
  runs: [],
  currentRunId: null,
  
  addRun: (run) => {
    set((state) => ({
      runs: [run, ...state.runs],
      currentRunId: run.id,
    }))
  },
  
  updateRun: (runId, updates) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId ? { ...run, ...updates } : run
      ),
    }))
  },
  
  deleteRun: (runId) => {
    set((state) => ({
      runs: state.runs.filter((run) => run.id !== runId),
      currentRunId: state.currentRunId === runId ? null : state.currentRunId,
    }))
  },
  
  setCurrentRun: (runId) => {
    set({ currentRunId: runId })
  },
  
  getCurrentRun: () => {
    const state = get()
    return state.runs.find((run) => run.id === state.currentRunId) || null
  },
  
  addOutput: (runId, output) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? { ...run, outputs: [...run.outputs, output] }
          : run
      ),
    }))
  },
  
  updateOutput: (runId, modelId, updates) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              outputs: run.outputs.map((output) =>
                output.modelId === modelId
                  ? { ...output, ...updates }
                  : output
              ),
            }
          : run
      ),
    }))
  },
  
  setOutputScore: (runId, modelId, score) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              outputs: run.outputs.map((output) =>
                output.modelId === modelId
                  ? { ...output, score }
                  : output
              ),
            }
          : run
      ),
    }))
  },
  
  completeRun: (runId) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? { ...run, status: 'completed', completedAt: Date.now() }
          : run
      ),
    }))
  },
  
  setRuns: (runs) => {
    set({ runs })
  },
  
  clearRuns: () => {
    set({ runs: [], currentRunId: null })
  },
}))

// Helper function to create a new run
export function createCodeArenaRun(
  prompt: string,
  systemPrompt: string,
  modelIds: string[],
  parameters: CodeArenaRun['parameters'],
  judgeModelId?: string
): CodeArenaRun {
  return {
    id: generateId(),
    type: 'code-arena',
    prompt,
    systemPrompt,
    models: modelIds,
    parameters,
    outputs: [],
    status: 'idle',
    startedAt: Date.now(),
    judgeModelId,
  }
}
