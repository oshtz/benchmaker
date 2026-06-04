import type { RunResult, TestSuite } from '@/types'

// Types for analytics data
export interface ModelStats {
  modelId: string
  modelName: string
  totalRuns: number
  totalTests: number
  avgScore: number
  avgLatency: number
  avgTokens: number
  successRate: number
  winCount: number
  scores: number[]
}

export interface CategoryStats {
  category: string
  totalTests: number
  avgScore: number
  topModel: string
  topModelScore: number
  modelScores: Map<string, number>
}

export interface DifficultyStats {
  difficulty: 'easy' | 'medium' | 'hard'
  totalTests: number
  avgScore: number
  topModel: string
  topModelScore: number
}

export interface TimeSeriesDataPoint {
  date: string
  timestamp: number
  modelScores: Map<string, number>
  avgScore: number
}

export interface OverallLeaderboard {
  rank: number
  modelId: string
  modelName: string
  avgScore: number
  totalTests: number
  winRate: number
  consistency: number // standard deviation of scores (lower is better)
}

export interface InterestingFact {
  type: 'improvement' | 'streak' | 'record' | 'comparison' | 'insight'
  title: string
  description: string
  value?: string | number
  icon?: string
}

export interface AnalyticsData {
  overallLeaderboard: OverallLeaderboard[]
  categoryLeaderboards: Map<string, OverallLeaderboard[]>
  difficultyStats: DifficultyStats[]
  modelStats: Map<string, ModelStats>
  timeSeriesData: TimeSeriesDataPoint[]
  interestingFacts: InterestingFact[]
  totalRuns: number
  totalTests: number
  totalModels: number
  avgScoreOverall: number
  dateRange: { start: number; end: number } | null
}

// Helper to extract model name from full ID
function getModelName(modelId: string): string {
  const parts = modelId.split('/')
  return parts[parts.length - 1] || modelId
}

// Calculate standard deviation
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

// Build model statistics from all runs
function buildModelStats(runs: RunResult[]): Map<string, ModelStats> {
  const stats = new Map<string, ModelStats>()
  const modelWins = new Map<string, number>()

  // Count wins per run
  for (const run of runs) {
    if (run.status !== 'completed') continue
    
    const runScores = new Map<string, { total: number; count: number }>()
    
    for (const result of run.results) {
      if (result.score) {
        const existing = runScores.get(result.modelId) || { total: 0, count: 0 }
        runScores.set(result.modelId, {
          total: existing.total + result.score.score,
          count: existing.count + 1,
        })
      }
    }

    // Find winner of this run
    let maxScore = -1
    let winner = ''
    for (const [modelId, { total, count }] of runScores) {
      const avg = count > 0 ? total / count : 0
      if (avg > maxScore) {
        maxScore = avg
        winner = modelId
      }
    }
    if (winner) {
      modelWins.set(winner, (modelWins.get(winner) || 0) + 1)
    }
  }

  // Build comprehensive stats
  for (const run of runs) {
    if (run.status !== 'completed') continue

    for (const result of run.results) {
      let stat = stats.get(result.modelId)
      if (!stat) {
        stat = {
          modelId: result.modelId,
          modelName: getModelName(result.modelId),
          totalRuns: 0,
          totalTests: 0,
          avgScore: 0,
          avgLatency: 0,
          avgTokens: 0,
          successRate: 0,
          winCount: modelWins.get(result.modelId) || 0,
          scores: [],
        }
        stats.set(result.modelId, stat)
      }

      stat.totalTests++
      if (result.score) {
        stat.scores.push(result.score.score)
      }
      if (result.latencyMs) {
        stat.avgLatency = (stat.avgLatency * (stat.totalTests - 1) + result.latencyMs) / stat.totalTests
      }
      if (result.tokenCount) {
        stat.avgTokens = (stat.avgTokens * (stat.totalTests - 1) + result.tokenCount) / stat.totalTests
      }
      if (result.status === 'completed') {
        stat.successRate = (stat.successRate * (stat.totalTests - 1) + 1) / stat.totalTests
      }
    }
  }

  // Calculate average scores
  for (const stat of stats.values()) {
    if (stat.scores.length > 0) {
      stat.avgScore = stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
    }
    // Count unique runs
    const runsWithModel = new Set(
      runs.filter(r => r.models.includes(stat.modelId)).map(r => r.id)
    )
    stat.totalRuns = runsWithModel.size
  }

  return stats
}

// Build category-based statistics
function buildCategoryStats(
  runs: RunResult[],
  testSuites: TestSuite[]
): Map<string, CategoryStats> {
  const categoryStats = new Map<string, CategoryStats>()
  
  // Create a map of test case IDs to their categories
  const testCaseCategories = new Map<string, string>()
  for (const suite of testSuites) {
    for (const testCase of suite.testCases) {
      if (testCase.metadata.category) {
        testCaseCategories.set(testCase.id, testCase.metadata.category)
      }
    }
  }

  // Aggregate scores by category and model
  const categoryModelScores = new Map<string, Map<string, { total: number; count: number }>>()

  for (const run of runs) {
    if (run.status !== 'completed') continue

    for (const result of run.results) {
      const category = testCaseCategories.get(result.testCaseId)
      if (!category || !result.score) continue

      if (!categoryModelScores.has(category)) {
        categoryModelScores.set(category, new Map())
      }
      const modelScores = categoryModelScores.get(category)!
      const existing = modelScores.get(result.modelId) || { total: 0, count: 0 }
      modelScores.set(result.modelId, {
        total: existing.total + result.score.score,
        count: existing.count + 1,
      })
    }
  }

  // Build category stats
  for (const [category, modelScores] of categoryModelScores) {
    let totalTests = 0
    let totalScore = 0
    let topModel = ''
    let topModelScore = 0
    const avgModelScores = new Map<string, number>()

    for (const [modelId, { total, count }] of modelScores) {
      totalTests += count
      totalScore += total
      const avg = count > 0 ? total / count : 0
      avgModelScores.set(modelId, avg)
      if (avg > topModelScore) {
        topModelScore = avg
        topModel = modelId
      }
    }

    categoryStats.set(category, {
      category,
      totalTests,
      avgScore: totalTests > 0 ? totalScore / totalTests : 0,
      topModel: getModelName(topModel),
      topModelScore,
      modelScores: avgModelScores,
    })
  }

  return categoryStats
}

// Build difficulty-based statistics
function buildDifficultyStats(
  runs: RunResult[],
  testSuites: TestSuite[]
): DifficultyStats[] {
  const difficultyScores = new Map<string, Map<string, { total: number; count: number }>>()
  
  // Create a map of test case IDs to their difficulty
  const testCaseDifficulty = new Map<string, 'easy' | 'medium' | 'hard'>()
  for (const suite of testSuites) {
    for (const testCase of suite.testCases) {
      if (testCase.metadata.difficulty) {
        testCaseDifficulty.set(testCase.id, testCase.metadata.difficulty)
      }
    }
  }

  for (const run of runs) {
    if (run.status !== 'completed') continue

    for (const result of run.results) {
      const difficulty = testCaseDifficulty.get(result.testCaseId)
      if (!difficulty || !result.score) continue

      if (!difficultyScores.has(difficulty)) {
        difficultyScores.set(difficulty, new Map())
      }
      const modelScores = difficultyScores.get(difficulty)!
      const existing = modelScores.get(result.modelId) || { total: 0, count: 0 }
      modelScores.set(result.modelId, {
        total: existing.total + result.score.score,
        count: existing.count + 1,
      })
    }
  }

  const stats: DifficultyStats[] = []
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const modelScores = difficultyScores.get(difficulty)
    if (!modelScores) continue

    let totalTests = 0
    let totalScore = 0
    let topModel = ''
    let topModelScore = 0

    for (const [modelId, { total, count }] of modelScores) {
      totalTests += count
      totalScore += total
      const avg = count > 0 ? total / count : 0
      if (avg > topModelScore) {
        topModelScore = avg
        topModel = modelId
      }
    }

    stats.push({
      difficulty,
      totalTests,
      avgScore: totalTests > 0 ? totalScore / totalTests : 0,
      topModel: getModelName(topModel),
      topModelScore,
    })
  }

  return stats
}

// Build time series data for trend analysis
function buildTimeSeriesData(runs: RunResult[]): TimeSeriesDataPoint[] {
  const completedRuns = runs
    .filter(r => r.status === 'completed' && r.completedAt)
    .sort((a, b) => a.startedAt - b.startedAt)

  const dataPoints: TimeSeriesDataPoint[] = []

  for (const run of completedRuns) {
    const modelScores = new Map<string, number>()
    const scoresByModel = new Map<string, { total: number; count: number }>()

    for (const result of run.results) {
      if (result.score) {
        const existing = scoresByModel.get(result.modelId) || { total: 0, count: 0 }
        scoresByModel.set(result.modelId, {
          total: existing.total + result.score.score,
          count: existing.count + 1,
        })
      }
    }

    let totalScore = 0
    let totalCount = 0
    for (const [modelId, { total, count }] of scoresByModel) {
      modelScores.set(modelId, count > 0 ? total / count : 0)
      totalScore += total
      totalCount += count
    }

    dataPoints.push({
      date: new Date(run.startedAt).toLocaleDateString(),
      timestamp: run.startedAt,
      modelScores,
      avgScore: totalCount > 0 ? totalScore / totalCount : 0,
    })
  }

  return dataPoints
}

// Build overall leaderboard
function buildOverallLeaderboard(modelStats: Map<string, ModelStats>): OverallLeaderboard[] {
  const leaderboard: OverallLeaderboard[] = []
  const totalWins = Array.from(modelStats.values()).reduce((sum, s) => sum + s.winCount, 0)

  for (const stat of modelStats.values()) {
    const consistency = calculateStdDev(stat.scores)
    leaderboard.push({
      rank: 0,
      modelId: stat.modelId,
      modelName: stat.modelName,
      avgScore: stat.avgScore,
      totalTests: stat.totalTests,
      winRate: totalWins > 0 ? stat.winCount / totalWins : 0,
      consistency,
    })
  }

  // Sort by average score descending
  leaderboard.sort((a, b) => b.avgScore - a.avgScore)
  
  // Assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1
  })

  return leaderboard
}

// Build category leaderboards
function buildCategoryLeaderboards(
  categoryStats: Map<string, CategoryStats>,
  modelStats: Map<string, ModelStats>
): Map<string, OverallLeaderboard[]> {
  const leaderboards = new Map<string, OverallLeaderboard[]>()

  for (const [category, stats] of categoryStats) {
    const leaderboard: OverallLeaderboard[] = []

    for (const [modelId, score] of stats.modelScores) {
      const modelStat = modelStats.get(modelId)
      leaderboard.push({
        rank: 0,
        modelId,
        modelName: getModelName(modelId),
        avgScore: score,
        totalTests: modelStat?.totalTests || 0,
        winRate: 0,
        consistency: modelStat ? calculateStdDev(modelStat.scores) : 0,
      })
    }

    leaderboard.sort((a, b) => b.avgScore - a.avgScore)
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1
    })

    leaderboards.set(category, leaderboard)
  }

  return leaderboards
}

// Generate interesting facts from the data
function generateInterestingFacts(
  runs: RunResult[],
  modelStats: Map<string, ModelStats>,
  timeSeriesData: TimeSeriesDataPoint[],
  overallLeaderboard: OverallLeaderboard[]
): InterestingFact[] {
  const facts: InterestingFact[] = []

  // Fact: Most consistent model
  if (overallLeaderboard.length > 0) {
    const mostConsistent = [...overallLeaderboard].sort((a, b) => a.consistency - b.consistency)[0]
    if (mostConsistent.consistency < 0.2) {
      facts.push({
        type: 'insight',
        title: 'Most Consistent Performer',
        description: `${mostConsistent.modelName} shows the most consistent performance with minimal score variation.`,
        value: `±${(mostConsistent.consistency * 100).toFixed(1)}%`,
        icon: '🎯',
      })
    }
  }

  // Fact: Biggest improver over time
  if (timeSeriesData.length >= 3) {
    const modelImprovements = new Map<string, number>()
    const firstHalf = timeSeriesData.slice(0, Math.floor(timeSeriesData.length / 2))
    const secondHalf = timeSeriesData.slice(Math.floor(timeSeriesData.length / 2))

    const allModels = new Set<string>()
    timeSeriesData.forEach(dp => dp.modelScores.forEach((_, m) => allModels.add(m)))

    for (const modelId of allModels) {
      const firstScores = firstHalf.filter(dp => dp.modelScores.has(modelId)).map(dp => dp.modelScores.get(modelId)!)
      const secondScores = secondHalf.filter(dp => dp.modelScores.has(modelId)).map(dp => dp.modelScores.get(modelId)!)

      if (firstScores.length > 0 && secondScores.length > 0) {
        const firstAvg = firstScores.reduce((a, b) => a + b, 0) / firstScores.length
        const secondAvg = secondScores.reduce((a, b) => a + b, 0) / secondScores.length
        modelImprovements.set(modelId, secondAvg - firstAvg)
      }
    }

    const biggestImprover = [...modelImprovements.entries()].sort((a, b) => b[1] - a[1])[0]
    if (biggestImprover && biggestImprover[1] > 0.05) {
      facts.push({
        type: 'improvement',
        title: 'Rising Star',
        description: `${getModelName(biggestImprover[0])} has shown significant improvement over recent benchmarks.`,
        value: `+${(biggestImprover[1] * 100).toFixed(1)}%`,
        icon: '📈',
      })
    }
  }

  // Fact: Speed champion
  const speedStats = Array.from(modelStats.values()).filter(s => s.avgLatency > 0)
  if (speedStats.length > 0) {
    const fastest = speedStats.sort((a, b) => a.avgLatency - b.avgLatency)[0]
    facts.push({
      type: 'record',
      title: 'Speed Champion',
      description: `${fastest.modelName} has the fastest average response time.`,
      value: `${fastest.avgLatency.toFixed(0)}ms`,
      icon: '⚡',
    })
  }

  // Fact: Most tested model
  const mostTested = Array.from(modelStats.values()).sort((a, b) => b.totalTests - a.totalTests)[0]
  if (mostTested && mostTested.totalTests > 10) {
    facts.push({
      type: 'insight',
      title: 'Most Tested',
      description: `${mostTested.modelName} has been evaluated the most across all benchmarks.`,
      value: `${mostTested.totalTests} tests`,
      icon: '🔬',
    })
  }

  // Fact: Perfect scores
  const perfectScoreModels = Array.from(modelStats.values()).filter(s => 
    s.scores.some(score => score === 1)
  )
  if (perfectScoreModels.length > 0) {
    const perfectCounts = perfectScoreModels.map(s => ({
      model: s.modelName,
      count: s.scores.filter(score => score === 1).length,
    })).sort((a, b) => b.count - a.count)

    if (perfectCounts[0].count > 0) {
      facts.push({
        type: 'record',
        title: 'Perfect Score Leader',
        description: `${perfectCounts[0].model} has achieved the most perfect scores.`,
        value: `${perfectCounts[0].count} perfect`,
        icon: '🏆',
      })
    }
  }

  // Fact: Head-to-head comparison
  if (overallLeaderboard.length >= 2) {
    const top2 = overallLeaderboard.slice(0, 2)
    const scoreDiff = top2[0].avgScore - top2[1].avgScore
    if (scoreDiff < 0.05) {
      facts.push({
        type: 'comparison',
        title: 'Close Competition',
        description: `${top2[0].modelName} and ${top2[1].modelName} are in a tight race for the top spot.`,
        value: `${(scoreDiff * 100).toFixed(1)}% gap`,
        icon: '🏁',
      })
    }
  }

  // Fact: Total benchmarking stats
  const completedRuns = runs.filter(r => r.status === 'completed')
  if (completedRuns.length > 0) {
    const totalDuration = completedRuns.reduce((sum, r) => 
      sum + (r.completedAt ? r.completedAt - r.startedAt : 0), 0
    )
    if (totalDuration > 60000) {
      facts.push({
        type: 'insight',
        title: 'Benchmarking Time',
        description: 'Total time spent running benchmarks across all sessions.',
        value: `${(totalDuration / 60000).toFixed(1)} min`,
        icon: '⏱️',
      })
    }
  }

  // Fact: Win streak
  if (timeSeriesData.length >= 3) {
    const modelWinStreaks = new Map<string, number>()
    let currentStreak = new Map<string, number>()

    for (const dp of timeSeriesData) {
      let maxScore = -1
      let winner = ''
      for (const [modelId, score] of dp.modelScores) {
        if (score > maxScore) {
          maxScore = score
          winner = modelId
        }
      }
      if (winner) {
        const streak = (currentStreak.get(winner) || 0) + 1
        currentStreak.set(winner, streak)
        // Reset other streaks
        for (const modelId of currentStreak.keys()) {
          if (modelId !== winner) {
            currentStreak.set(modelId, 0)
          }
        }
        // Track max streak
        const maxStreak = modelWinStreaks.get(winner) || 0
        if (streak > maxStreak) {
          modelWinStreaks.set(winner, streak)
        }
      }
    }

    const longestStreak = [...modelWinStreaks.entries()].sort((a, b) => b[1] - a[1])[0]
    if (longestStreak && longestStreak[1] >= 3) {
      facts.push({
        type: 'streak',
        title: 'Winning Streak',
        description: `${getModelName(longestStreak[0])} achieved the longest consecutive win streak.`,
        value: `${longestStreak[1]} wins`,
        icon: '🔥',
      })
    }
  }

  return facts
}

// Main analytics computation function
export function computeAnalytics(
  runs: RunResult[],
  testSuites: TestSuite[]
): AnalyticsData {
  const completedRuns = runs.filter(r => r.status === 'completed')
  
  // Build all statistics
  const modelStats = buildModelStats(runs)
  const categoryStats = buildCategoryStats(runs, testSuites)
  const difficultyStats = buildDifficultyStats(runs, testSuites)
  const timeSeriesData = buildTimeSeriesData(runs)
  const overallLeaderboard = buildOverallLeaderboard(modelStats)
  const categoryLeaderboards = buildCategoryLeaderboards(categoryStats, modelStats)
  const interestingFacts = generateInterestingFacts(runs, modelStats, timeSeriesData, overallLeaderboard)

  // Calculate overall stats
  const allScores = Array.from(modelStats.values()).flatMap(s => s.scores)
  const avgScoreOverall = allScores.length > 0 
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
    : 0

  const timestamps = completedRuns.map(r => r.startedAt)
  const dateRange = timestamps.length > 0 
    ? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
    : null

  return {
    overallLeaderboard,
    categoryLeaderboards,
    difficultyStats,
    modelStats,
    timeSeriesData,
    interestingFacts,
    totalRuns: completedRuns.length,
    totalTests: allScores.length,
    totalModels: modelStats.size,
    avgScoreOverall,
    dateRange,
  }
}
