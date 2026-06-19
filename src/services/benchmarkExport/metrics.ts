import type { ExecutionStatus, RunResult, ScoringMethod, TestCase, TestCaseResult } from '@/types'
import {
  type BenchmarkExportContext,
  type BenchmarkExportDocument,
  type BenchmarkSummary,
  type ModelExportRow,
  type MultiRunExportSummary,
  type MultiRunModelStats,
  type PairwiseComparisonExport,
  type TestCaseExportRow,
  snapshotToSuiteExport,
} from './types'
import { shortModelName } from './formatters'

const SCORING_METHODS: ScoringMethod[] = [
  'exact-match',
  'regex-match',
  'numeric-tolerance',
  'boolean',
  'llm-judge',
]

function scoreValuesStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function confidence95(mean: number, stdDev: number, count: number): [number, number] {
  const margin = count > 1 ? (1.96 * stdDev) / Math.sqrt(count) : 0
  return [Math.max(0, mean - margin), Math.min(1, mean + margin)]
}

function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + p * abs)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs)
  return 0.5 * (1 + sign * y)
}

function getWeightMap(testCases: TestCase[]): Map<string, number> {
  return new Map(testCases.map((testCase) => [testCase.id, testCase.weight || 1]))
}

function expectedWeight(testCases: TestCase[]): number {
  return testCases.reduce((sum, testCase) => sum + (testCase.weight || 1), 0)
}

function resultKey(testCaseId: string, modelId: string): string {
  return `${testCaseId}\u0000${modelId}`
}

function getResultMap(results: TestCaseResult[]): Map<string, TestCaseResult> {
  return new Map(results.map((result) => [resultKey(result.testCaseId, result.modelId), result]))
}

function displayNameFor(modelId: string, modelIndex: Map<string, number>, anonymize: boolean): string {
  if (anonymize) return `Model ${modelIndex.get(modelId) ?? '?'}`
  return shortModelName(modelId)
}

function fullDisplayNameFor(modelId: string, modelIndex: Map<string, number>, anonymize: boolean): string {
  if (anonymize) return `Model ${modelIndex.get(modelId) ?? '?'}`
  return modelId
}

function coerceStatus(status: string | undefined): ExecutionStatus {
  if (
    status === 'idle' ||
    status === 'running' ||
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled'
  ) {
    return status
  }
  return 'idle'
}

export function calculateModelRows(
  run: RunResult,
  testCases: TestCase[],
  anonymizeModelIds: boolean,
): ModelExportRow[] {
  const resultMap = getResultMap(run.results)
  const weightMap = getWeightMap(testCases)
  const totalExpectedWeight = expectedWeight(testCases)
  const modelIndex = new Map(run.models.map((modelId, index) => [modelId, index + 1]))

  const rows = run.models.map((modelId): ModelExportRow => {
    let weightedScore = 0
    let scoredWeight = 0
    let completedCount = 0
    let failedCount = 0
    let missingCount = 0
    let unscoredCount = 0
    let totalCost = 0
    let promptTokens = 0
    let completionTokens = 0
    const scores: number[] = []
    const latencies: number[] = []

    for (const testCase of testCases) {
      const result = resultMap.get(resultKey(testCase.id, modelId))
      const status = coerceStatus(result?.status)
      const weight = weightMap.get(testCase.id) ?? 1

      if (!result) {
        missingCount += 1
        continue
      }

      if (status === 'completed') completedCount += 1
      if (status === 'failed' || status === 'cancelled') failedCount += 1

      if (result.score) {
        weightedScore += result.score.score * weight
        scoredWeight += weight
        scores.push(result.score.score)
      } else {
        unscoredCount += 1
      }

      if (result.cost) totalCost += result.cost
      if (result.promptTokens) promptTokens += result.promptTokens
      if (result.completionTokens) completionTokens += result.completionTokens
      if (result.tokenCount && !result.promptTokens && !result.completionTokens) {
        completionTokens += result.tokenCount
      }
      if (result.latencyMs) latencies.push(result.latencyMs)
    }

    const scoredMean = scoredWeight > 0 ? weightedScore / scoredWeight : null
    const effectiveScore = totalExpectedWeight > 0 ? weightedScore / totalExpectedWeight : 0
    const stdDev = scoredMean !== null && scores.length > 0 ? scoreValuesStdDev(scores, scoredMean) : null
    const minScore = scores.length > 0 ? Math.min(...scores) : null
    const maxScore = scores.length > 0 ? Math.max(...scores) : null
    const meanLatencyMs = latencies.length > 0
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : null

    return {
      rank: 0,
      modelId,
      displayName: displayNameFor(modelId, modelIndex, anonymizeModelIds),
      fullDisplayName: fullDisplayNameFor(modelId, modelIndex, anonymizeModelIds),
      effectiveScore,
      scoredMean,
      coverage: testCases.length > 0 ? scores.length / testCases.length : 0,
      successRate: testCases.length > 0 ? completedCount / testCases.length : 0,
      scoredCount: scores.length,
      completedCount,
      failedCount,
      missingCount,
      unscoredCount,
      totalExpected: testCases.length,
      stdDev,
      minScore,
      maxScore,
      confidence95: scoredMean !== null && stdDev !== null ? confidence95(scoredMean, stdDev, scores.length) : null,
      totalCost,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      meanLatencyMs,
      medianLatencyMs: median(latencies),
    }
  })

  return rows
    .sort((left, right) => right.effectiveScore - left.effectiveScore || right.coverage - left.coverage)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

function calculateTestRows(
  run: RunResult,
  testCases: TestCase[],
  anonymizeModelIds: boolean,
): TestCaseExportRow[] {
  const resultMap = getResultMap(run.results)
  const modelIndex = new Map(run.models.map((modelId, index) => [modelId, index + 1]))

  return testCases.map((testCase, index) => ({
    index: index + 1,
    testCaseId: testCase.id,
    prompt: testCase.prompt,
    expectedOutput: testCase.expectedOutput,
    scoringMethod: testCase.scoringMethod,
    weight: testCase.weight || 1,
    category: testCase.metadata.category,
    difficulty: testCase.metadata.difficulty,
    tags: testCase.metadata.tags,
    cells: run.models.map((modelId) => {
      const result = resultMap.get(resultKey(testCase.id, modelId))
      return {
        modelId,
        displayName: displayNameFor(modelId, modelIndex, anonymizeModelIds),
        status: coerceStatus(result?.status),
        response: result?.response || result?.streamedContent || '',
        score: result?.score,
        latencyMs: result?.latencyMs,
        promptTokens: result?.promptTokens,
        completionTokens: result?.completionTokens,
        cost: result?.cost,
        error: result?.error,
        scoringNotes: result?.score?.notes,
      }
    }),
  }))
}

function calculateSummary(
  run: RunResult,
  testCases: TestCase[],
  modelRows: ModelExportRow[],
): BenchmarkSummary {
  const completedCount = run.results.filter((result) => result.status === 'completed').length
  const failedCount = run.results.filter((result) => result.status === 'failed' || result.status === 'cancelled').length
  const scoredCount = run.results.filter((result) => result.score).length
  const expectedResultCount = run.models.length * testCases.length
  const scoringMethodCounts = SCORING_METHODS.reduce((counts, method) => {
    counts[method] = 0
    return counts
  }, {} as Record<ScoringMethod, number>)

  for (const testCase of testCases) {
    scoringMethodCounts[testCase.scoringMethod] += 1
  }

  return {
    topModel: modelRows[0] ?? null,
    modelCount: run.models.length,
    testCaseCount: testCases.length,
    expectedResultCount,
    completedCount,
    failedCount,
    scoredCount,
    coverage: expectedResultCount > 0 ? scoredCount / expectedResultCount : 0,
    totalCost: modelRows.reduce((sum, row) => sum + row.totalCost, 0),
    totalPromptTokens: modelRows.reduce((sum, row) => sum + row.promptTokens, 0),
    totalCompletionTokens: modelRows.reduce((sum, row) => sum + row.completionTokens, 0),
    totalTokens: modelRows.reduce((sum, row) => sum + row.totalTokens, 0),
    durationMs: run.completedAt ? run.completedAt - run.startedAt : undefined,
    scoringMethodCounts,
  }
}

function aggregateRunScores(run: RunResult, testCases: TestCase[]): Map<string, number> {
  const scores = new Map<string, { weightedScore: number; totalWeight: number }>()
  const weightMap = getWeightMap(testCases)

  for (const result of run.results) {
    if (!result.score) continue
    const weight = weightMap.get(result.testCaseId) ?? 1
    const existing = scores.get(result.modelId) ?? { weightedScore: 0, totalWeight: 0 }
    scores.set(result.modelId, {
      weightedScore: existing.weightedScore + result.score.score * weight,
      totalWeight: existing.totalWeight + weight,
    })
  }

  return new Map(
    [...scores.entries()].map(([modelId, score]) => [
      modelId,
      score.totalWeight > 0 ? score.weightedScore / score.totalWeight : 0,
    ]),
  )
}

function compareTopModels(stats: MultiRunModelStats[]): PairwiseComparisonExport | null {
  if (stats.length < 2) return null
  const [statsA, statsB] = stats
  if (statsA.scores.length < 2 || statsB.scores.length < 2) return null

  const nA = statsA.scores.length
  const nB = statsB.scores.length
  const varA = statsA.scores.reduce((sum, score) => sum + Math.pow(score - statsA.mean, 2), 0) / (nA - 1)
  const varB = statsB.scores.reduce((sum, score) => sum + Math.pow(score - statsB.mean, 2), 0) / (nB - 1)
  const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2)
  const pooledStdErr = Math.sqrt(pooledVar * (1 / nA + 1 / nB))
  const tStatistic = pooledStdErr > 0 ? (statsA.mean - statsB.mean) / pooledStdErr : 0
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)))
  const pooledStdDev = Math.sqrt(pooledVar)

  return {
    modelA: statsA.modelId,
    modelB: statsB.modelId,
    displayNameA: statsA.displayName,
    displayNameB: statsB.displayName,
    meanA: statsA.mean,
    meanB: statsB.mean,
    scoreDiff: statsA.mean - statsB.mean,
    tStatistic,
    pValue,
    effectSize: pooledStdDev > 0 ? (statsA.mean - statsB.mean) / pooledStdDev : 0,
    isSignificant: pValue < 0.05,
    approximation: 'normal',
  }
}

function buildMultiRunSummary(
  currentRun: RunResult,
  allRuns: RunResult[],
  testCases: TestCase[],
  modelRows: ModelExportRow[],
): MultiRunExportSummary | undefined {
  const relatedRuns = allRuns.filter(
    (run) => run.testSuiteId === currentRun.testSuiteId && run.status === 'completed',
  )
  if (relatedRuns.length < 2) return undefined

  const displayNames = new Map(modelRows.map((row) => [row.modelId, row.displayName]))
  const scoresByModel = new Map<string, { runIds: string[]; scores: number[] }>()

  for (const run of relatedRuns) {
    const aggregateScores = aggregateRunScores(run, testCases)
    for (const [modelId, score] of aggregateScores) {
      const existing = scoresByModel.get(modelId) ?? { runIds: [], scores: [] }
      existing.runIds.push(run.id)
      existing.scores.push(score)
      scoresByModel.set(modelId, existing)
    }
  }

  const modelStats: MultiRunModelStats[] = [...scoresByModel.entries()]
    .map(([modelId, value]) => {
      const mean = value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length
      const stdDev = scoreValuesStdDev(value.scores, mean)
      return {
        modelId,
        displayName: displayNames.get(modelId) ?? shortModelName(modelId),
        runIds: value.runIds,
        scores: value.scores,
        mean,
        stdDev,
        min: Math.min(...value.scores),
        max: Math.max(...value.scores),
        confidence95: confidence95(mean, stdDev, value.scores.length),
      }
    })
    .sort((left, right) => right.mean - left.mean)

  return {
    relatedRunCount: relatedRuns.length,
    modelStats,
    topComparison: compareTopModels(modelStats),
  }
}

function buildCaveats(
  context: BenchmarkExportContext,
  testCases: TestCase[],
  summary: BenchmarkSummary,
): string[] {
  const caveats: string[] = []
  const suite = snapshotToSuiteExport(context.run, context.testSuites)

  if (suite.source === 'current-suite') {
    caveats.push('This run predates suite snapshots; test case details were reconstructed from the current suite.')
  }
  if (suite.source === 'missing') {
    caveats.push('The original test suite was not found, so per-test prompt details are unavailable.')
  }
  if (context.run.status !== 'completed') {
    caveats.push(`The run status is ${context.run.status}; this export may be partial.`)
  }
  if (summary.failedCount > 0) {
    caveats.push(`${summary.failedCount} result(s) failed or were cancelled.`)
  }
  if (summary.coverage < 1) {
    caveats.push('Some expected model/test cells do not have scores. Effective score treats missing or unscored cells as zero.')
  }
  if (testCases.length === 0) {
    caveats.push('No test cases were available for this export.')
  }

  return caveats
}

export function buildBenchmarkExportDocument(context: BenchmarkExportContext): BenchmarkExportDocument {
  const generatedAt = context.generatedAt ?? Date.now()
  const suite = snapshotToSuiteExport(context.run, context.testSuites)
  const testCases = suite.testCases
  const modelRows = calculateModelRows(context.run, testCases, context.options.anonymizeModelIds)
  const testRows = calculateTestRows(context.run, testCases, context.options.anonymizeModelIds)
  const summary = calculateSummary(context.run, testCases, modelRows)
  const multiRun = context.options.includeMultiRunAnalysis
    ? buildMultiRunSummary(context.run, context.allRuns, testCases, modelRows)
    : undefined

  return {
    exportVersion: 1,
    generatedAt,
    appVersion: context.appVersion,
    options: context.options,
    run: {
      id: context.run.id,
      testSuiteId: context.run.testSuiteId,
      testSuiteName: context.run.testSuiteName,
      status: context.run.status,
      startedAt: context.run.startedAt,
      completedAt: context.run.completedAt,
      durationMs: context.run.completedAt ? context.run.completedAt - context.run.startedAt : undefined,
      judgeModel: context.run.judgeModel,
      parameters: context.run.parameters,
      models: context.run.models,
      resultCount: context.run.results.length,
      expectedResultCount: context.run.models.length * testCases.length,
      errorCount: context.run.errorCount ?? context.run.results.filter((result) => result.status === 'failed').length,
      errorSummary: context.run.errorSummary,
    },
    suite,
    summary,
    modelRows,
    testRows,
    multiRun,
    caveats: buildCaveats(context, testCases, summary),
  }
}
