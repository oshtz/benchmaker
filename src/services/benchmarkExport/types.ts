import type {
  ExecutionStatus,
  ModelParameters,
  RunResult,
  ScoringMethod,
  ScoringResult,
  TestCase,
  TestSuite,
  TestSuiteSnapshot,
} from '@/types'

export type ExportMode = 'scientific' | 'share-image'
export type ShareImagePreset = 'square' | 'portrait' | 'story' | 'wide'
export type ShareImageTemplate = 'classic' | 'social-card'
export type ShareImageVariant = 'leaderboard' | 'bars' | 'hero' | 'h2h'
export type ShareImageTheme = 'dark' | 'light'

export interface BenchmarkExportOptions {
  mode: ExportMode
  imagePreset: ShareImagePreset
  imageTemplate: ShareImageTemplate
  imageVariant: ShareImageVariant
  imageTheme: ShareImageTheme
  includeRawResponses: boolean
  includeExpectedOutputs: boolean
  includeSystemPrompt: boolean
  includeJudgePrompt: boolean
  includeScoringNotes: boolean
  includeCostTokens: boolean
  includeMultiRunAnalysis: boolean
  anonymizeModelIds: boolean
}

export interface BenchmarkExportContext {
  run: RunResult
  testSuites: TestSuite[]
  allRuns: RunResult[]
  options: BenchmarkExportOptions
  generatedAt?: number
  appVersion?: string
}

export interface SuiteExportData {
  source: 'run-snapshot' | 'current-suite' | 'missing'
  name: string
  description?: string
  systemPrompt?: string
  judgeSystemPrompt?: string
  testCases: TestCase[]
}

export interface RunExportData {
  id: string
  testSuiteId: string
  testSuiteName: string
  status: ExecutionStatus
  startedAt: number
  completedAt?: number
  durationMs?: number
  judgeModel?: string
  parameters: ModelParameters
  models: string[]
  resultCount: number
  expectedResultCount: number
  errorCount: number
  errorSummary?: string
}

export interface ModelExportRow {
  rank: number
  modelId: string
  displayName: string
  fullDisplayName: string
  effectiveScore: number
  scoredMean: number | null
  coverage: number
  successRate: number
  scoredCount: number
  completedCount: number
  failedCount: number
  missingCount: number
  unscoredCount: number
  totalExpected: number
  stdDev: number | null
  minScore: number | null
  maxScore: number | null
  confidence95: [number, number] | null
  totalCost: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  meanLatencyMs: number | null
  medianLatencyMs: number | null
}

export interface TestCaseResultExportCell {
  modelId: string
  displayName: string
  status: ExecutionStatus
  response: string
  score?: ScoringResult
  latencyMs?: number
  promptTokens?: number
  completionTokens?: number
  cost?: number
  error?: string
  scoringNotes?: string
}

export interface TestCaseExportRow {
  index: number
  testCaseId: string
  prompt: string
  expectedOutput?: string
  scoringMethod: ScoringMethod
  weight: number
  category?: string
  difficulty?: string
  tags: string[]
  cells: TestCaseResultExportCell[]
}

export interface BenchmarkSummary {
  topModel: ModelExportRow | null
  modelCount: number
  testCaseCount: number
  expectedResultCount: number
  completedCount: number
  failedCount: number
  scoredCount: number
  coverage: number
  totalCost: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  durationMs?: number
  scoringMethodCounts: Record<ScoringMethod, number>
}

export interface MultiRunModelStats {
  modelId: string
  displayName: string
  runIds: string[]
  scores: number[]
  mean: number
  stdDev: number
  min: number
  max: number
  confidence95: [number, number]
}

export interface PairwiseComparisonExport {
  modelA: string
  modelB: string
  displayNameA: string
  displayNameB: string
  meanA: number
  meanB: number
  scoreDiff: number
  tStatistic: number
  pValue: number
  effectSize: number
  isSignificant: boolean
  approximation: 'normal'
}

export interface MultiRunExportSummary {
  relatedRunCount: number
  modelStats: MultiRunModelStats[]
  topComparison: PairwiseComparisonExport | null
}

export interface BenchmarkExportDocument {
  exportVersion: number
  generatedAt: number
  appVersion?: string
  options: BenchmarkExportOptions
  run: RunExportData
  suite: SuiteExportData
  summary: BenchmarkSummary
  modelRows: ModelExportRow[]
  testRows: TestCaseExportRow[]
  multiRun?: MultiRunExportSummary
  caveats: string[]
}

export function snapshotToSuiteExport(
  run: RunResult,
  testSuites: TestSuite[],
): SuiteExportData {
  const snapshot: TestSuiteSnapshot | undefined = run.testSuiteSnapshot
  if (snapshot) {
    return {
      source: 'run-snapshot',
      name: snapshot.name,
      description: snapshot.description,
      systemPrompt: snapshot.systemPrompt,
      judgeSystemPrompt: snapshot.judgeSystemPrompt,
      testCases: snapshot.testCases,
    }
  }

  const currentSuite = testSuites.find((suite) => suite.id === run.testSuiteId)
  if (currentSuite) {
    return {
      source: 'current-suite',
      name: currentSuite.name,
      description: currentSuite.description,
      systemPrompt: currentSuite.systemPrompt,
      judgeSystemPrompt: currentSuite.judgeSystemPrompt,
      testCases: currentSuite.testCases,
    }
  }

  return {
    source: 'missing',
    name: run.testSuiteName,
    testCases: [],
  }
}
