import { create } from 'zustand'
import type { RunResult, TestCaseResult, ExecutionStatus, ScoringResult, TestCase, AggregateScore, MultiRunStats } from '@/types'

export interface ModelComparison {
  modelA: string
  modelB: string
  meanA: number
  meanB: number
  scoreDiff: number      // meanA - meanB
  pooledStdErr: number   // Standard error of the difference
  tStatistic: number     // t-statistic for significance test
  pValue: number         // Two-tailed p-value
  isSignificant: boolean // p < 0.05
  effectSize: number     // Cohen's d
}

interface ErrorInfo {
  errorCount: number
  errorSummary: string
}

interface RunState {
  runs: RunResult[]
  currentRunId: string | null

  // Run Actions
  createRun: (run: Omit<RunResult, 'id'>) => RunResult
  updateRunStatus: (runId: string, status: ExecutionStatus) => void
  completeRun: (runId: string, errorInfo?: ErrorInfo) => void
  deleteRun: (runId: string) => void
  clearAllRuns: () => void
  setCurrentRun: (runId: string | null) => void

  // Result Actions
  addResult: (runId: string, result: TestCaseResult) => void
  updateResult: (runId: string, testCaseId: string, modelId: string, updates: Partial<TestCaseResult>) => void
  updateStreamedContent: (runId: string, testCaseId: string, modelId: string, content: string) => void
  setResultScore: (runId: string, testCaseId: string, modelId: string, score: ScoringResult) => void

  // Getters
  getCurrentRun: () => RunResult | null
  getRunById: (runId: string) => RunResult | null
  getResultsForTestCase: (runId: string, testCaseId: string) => TestCaseResult[]
  getResultsForModel: (runId: string, modelId: string) => TestCaseResult[]
  getAggregateScores: (runId: string, testCases?: TestCase[]) => Map<string, number>
  getDetailedAggregateScores: (runId: string, testCases?: TestCase[]) => Map<string, AggregateScore>
  getAggregateCosts: (runId: string) => Map<string, number>
  getTotalCost: (runId: string) => number

  // Multi-run analysis
  getMultiRunStats: (runIds: string[], testCases?: TestCase[]) => Map<string, MultiRunStats>
  compareModels: (runIds: string[], modelA: string, modelB: string, testCases?: TestCase[]) => ModelComparison | null
  getRunsForTestSuite: (testSuiteId: string) => RunResult[]
}

function generateId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useRunStore = create<RunState>()((set, get) => ({
  runs: [],
  currentRunId: null,

  createRun: (runData) => {
    const newRun: RunResult = {
      id: generateId(),
      ...runData,
    }
    set((state) => ({
      runs: [newRun, ...state.runs],
      currentRunId: newRun.id,
    }))
    return newRun
  },

  updateRunStatus: (runId, status) => {
    set((state) => ({
      runs: state.runs.map((run) => (run.id === runId ? { ...run, status } : run)),
    }))
  },

  completeRun: (runId, errorInfo) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? { 
              ...run, 
              status: 'completed' as ExecutionStatus, 
              completedAt: Date.now(),
              ...(errorInfo && { errorCount: errorInfo.errorCount, errorSummary: errorInfo.errorSummary })
            }
          : run
      ),
    }))
  },

  deleteRun: (runId) => {
    set((state) => ({
      runs: state.runs.filter((run) => run.id !== runId),
      currentRunId: state.currentRunId === runId ? null : state.currentRunId,
    }))
  },

  clearAllRuns: () => {
    set({ runs: [], currentRunId: null })
  },

  setCurrentRun: (runId) => set({ currentRunId: runId }),

  addResult: (runId, result) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId ? { ...run, results: [...run.results, result] } : run
      ),
    }))
  },

  updateResult: (runId, testCaseId, modelId, updates) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              results: run.results.map((r) =>
                r.testCaseId === testCaseId && r.modelId === modelId
                  ? { ...r, ...updates }
                  : r
              ),
            }
          : run
      ),
    }))
  },

  updateStreamedContent: (runId, testCaseId, modelId, content) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              results: run.results.map((r) =>
                r.testCaseId === testCaseId && r.modelId === modelId
                  ? { ...r, streamedContent: content }
                  : r
              ),
            }
          : run
      ),
    }))
  },

  setResultScore: (runId, testCaseId, modelId, score) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              results: run.results.map((r) =>
                r.testCaseId === testCaseId && r.modelId === modelId
                  ? { ...r, score }
                  : r
              ),
            }
          : run
      ),
    }))
  },

  getCurrentRun: () => {
    const state = get()
    return state.runs.find((r) => r.id === state.currentRunId) || null
  },

  getRunById: (runId) => {
    return get().runs.find((r) => r.id === runId) || null
  },

  getResultsForTestCase: (runId, testCaseId) => {
    const run = get().runs.find((r) => r.id === runId)
    return run?.results.filter((r) => r.testCaseId === testCaseId) || []
  },

  getResultsForModel: (runId, modelId) => {
    const run = get().runs.find((r) => r.id === runId)
    return run?.results.filter((r) => r.modelId === modelId) || []
  },

  getAggregateScores: (runId, testCases) => {
    const run = get().runs.find((r) => r.id === runId)
    const scores = new Map<string, number>()

    if (!run) return scores

    // Build weight map from test cases
    const weightMap = new Map<string, number>()
    if (testCases) {
      for (const tc of testCases) {
        weightMap.set(tc.id, tc.weight || 1)
      }
    }

    const modelScores = new Map<string, { weightedTotal: number; totalWeight: number }>()

    for (const result of run.results) {
      if (result.score) {
        const weight = weightMap.get(result.testCaseId) || 1
        const existing = modelScores.get(result.modelId) || { weightedTotal: 0, totalWeight: 0 }
        modelScores.set(result.modelId, {
          weightedTotal: existing.weightedTotal + (result.score.score * weight),
          totalWeight: existing.totalWeight + weight,
        })
      }
    }

    for (const [modelId, { weightedTotal, totalWeight }] of modelScores) {
      scores.set(modelId, totalWeight > 0 ? weightedTotal / totalWeight : 0)
    }

    return scores
  },

  getDetailedAggregateScores: (runId, testCases) => {
    const run = get().runs.find((r) => r.id === runId)
    const scores = new Map<string, AggregateScore>()

    if (!run) return scores

    // Build weight map from test cases
    const weightMap = new Map<string, number>()
    if (testCases) {
      for (const tc of testCases) {
        weightMap.set(tc.id, tc.weight || 1)
      }
    }

    // Group results by model with weights
    const modelResults = new Map<string, Array<{ score: number; weight: number }>>()

    for (const result of run.results) {
      if (result.score) {
        const weight = weightMap.get(result.testCaseId) || 1
        const existing = modelResults.get(result.modelId) || []
        existing.push({ score: result.score.score, weight })
        modelResults.set(result.modelId, existing)
      }
    }

    // Calculate detailed statistics for each model
    for (const [modelId, results] of modelResults) {
      if (results.length === 0) continue

      const totalWeight = results.reduce((sum, r) => sum + r.weight, 0)
      const weightedMean = results.reduce((sum, r) => sum + r.score * r.weight, 0) / totalWeight

      // Calculate weighted standard deviation
      const weightedVariance = results.reduce((sum, r) => {
        return sum + r.weight * Math.pow(r.score - weightedMean, 2)
      }, 0) / totalWeight
      const stdDev = Math.sqrt(weightedVariance)

      const scoreValues = results.map(r => r.score)
      const min = Math.min(...scoreValues)
      const max = Math.max(...scoreValues)

      // 95% confidence interval (assuming normal distribution)
      // CI = mean ± (1.96 * stdDev / sqrt(n))
      const marginOfError = results.length > 1 ? (1.96 * stdDev) / Math.sqrt(results.length) : 0
      const confidence95: [number, number] = [
        Math.max(0, weightedMean - marginOfError),
        Math.min(1, weightedMean + marginOfError)
      ]

      scores.set(modelId, {
        mean: weightedMean,
        stdDev,
        min,
        max,
        count: results.length,
        totalWeight,
        confidence95,
      })
    }

    return scores
  },

  getAggregateCosts: (runId) => {
    const run = get().runs.find((r) => r.id === runId)
    const costs = new Map<string, number>()

    if (!run) return costs

    for (const result of run.results) {
      if (result.cost !== undefined) {
        const existing = costs.get(result.modelId) || 0
        costs.set(result.modelId, existing + result.cost)
      }
    }

    return costs
  },

  getTotalCost: (runId) => {
    const run = get().runs.find((r) => r.id === runId)
    if (!run) return 0

    return run.results.reduce((total, result) => {
      return total + (result.cost || 0)
    }, 0)
  },

  getRunsForTestSuite: (testSuiteId) => {
    return get().runs.filter((r) => r.testSuiteId === testSuiteId && r.status === 'completed')
  },

  getMultiRunStats: (runIds, testCases) => {
    const stats = new Map<string, MultiRunStats>()
    const state = get()

    // Get all runs
    const runs = runIds
      .map((id) => state.runs.find((r) => r.id === id))
      .filter((r): r is RunResult => r !== undefined && r.status === 'completed')

    if (runs.length === 0) return stats

    // Collect all models across runs
    const allModels = new Set<string>()
    for (const run of runs) {
      for (const modelId of run.models) {
        allModels.add(modelId)
      }
    }

    // Calculate stats for each model
    for (const modelId of allModels) {
      const scores: number[] = []
      const validRunIds: string[] = []

      for (const run of runs) {
        // Get aggregate score for this model in this run
        const aggregateScores = state.getAggregateScores(run.id, testCases)
        const score = aggregateScores.get(modelId)
        if (score !== undefined) {
          scores.push(score)
          validRunIds.push(run.id)
        }
      }

      if (scores.length === 0) continue

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
      const stdDev = Math.sqrt(variance)
      const min = Math.min(...scores)
      const max = Math.max(...scores)

      // 95% CI = mean ± (1.96 * stdDev / sqrt(n))
      const marginOfError = scores.length > 1 ? (1.96 * stdDev) / Math.sqrt(scores.length) : 0
      const confidence95: [number, number] = [
        Math.max(0, mean - marginOfError),
        Math.min(1, mean + marginOfError)
      ]

      stats.set(modelId, {
        runIds: validRunIds,
        modelId,
        scores,
        mean,
        stdDev,
        min,
        max,
        confidence95,
      })
    }

    return stats
  },

  compareModels: (runIds, modelA, modelB, testCases) => {
    const state = get()
    const multiRunStats = state.getMultiRunStats(runIds, testCases)

    const statsA = multiRunStats.get(modelA)
    const statsB = multiRunStats.get(modelB)

    if (!statsA || !statsB) return null
    if (statsA.scores.length < 2 || statsB.scores.length < 2) return null

    const nA = statsA.scores.length
    const nB = statsB.scores.length
    const meanA = statsA.mean
    const meanB = statsB.mean

    // Calculate pooled standard error
    const varA = statsA.scores.reduce((sum, s) => sum + Math.pow(s - meanA, 2), 0) / (nA - 1)
    const varB = statsB.scores.reduce((sum, s) => sum + Math.pow(s - meanB, 2), 0) / (nB - 1)
    
    // Pooled variance for two-sample t-test
    const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2)
    const pooledStdErr = Math.sqrt(pooledVar * (1/nA + 1/nB))

    // t-statistic
    const tStatistic = pooledStdErr > 0 ? (meanA - meanB) / pooledStdErr : 0

    // Approximate p-value using normal distribution (good for n > 30, acceptable for smaller)
    // For a more accurate p-value, we'd need a t-distribution table or library
    const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)))

    // Cohen's d effect size
    const pooledStdDev = Math.sqrt(pooledVar)
    const effectSize = pooledStdDev > 0 ? (meanA - meanB) / pooledStdDev : 0

    return {
      modelA,
      modelB,
      meanA,
      meanB,
      scoreDiff: meanA - meanB,
      pooledStdErr,
      tStatistic,
      pValue,
      isSignificant: pValue < 0.05,
      effectSize,
    }
  },
}))

// Helper function for normal CDF approximation
function normalCDF(x: number): number {
  // Approximation of the cumulative distribution function for standard normal
  const a1 =  0.254829592
  const a2 = -0.284496736
  const a3 =  1.421413741
  const a4 = -1.453152027
  const a5 =  1.061405429
  const p  =  0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return 0.5 * (1.0 + sign * y)
}
