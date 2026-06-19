import { BarChart3, Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RunResult, TestCase } from '@/types'

interface BenchmarkChartsProps {
  run: RunResult
  testCases: TestCase[]
}

interface ModelChartRow {
  modelId: string
  displayName: string
  effectiveScore: number
  scoredMean: number | null
  scoredCount: number
  totalExpected: number
  coverage: number
  totalCost: number
  meanLatencyMs: number | null
}

function shortModelName(modelId: string): string {
  return modelId.split('/').pop() || modelId
}

function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.0001) return '<$0.0001'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

function formatLatency(latencyMs: number | null): string {
  if (!latencyMs) return '-'
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`
  return `${(latencyMs / 1000).toFixed(1)}s`
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value * 100))
}

function getModelRows(run: RunResult, testCases: TestCase[]): ModelChartRow[] {
  const weightMap = new Map(testCases.map((testCase) => [testCase.id, testCase.weight || 1]))
  const fallbackTestCaseIds = new Set(run.results.map((result) => result.testCaseId))
  const totalExpected = testCases.length || fallbackTestCaseIds.size
  const totalExpectedWeight = testCases.length
    ? testCases.reduce((sum, testCase) => sum + (testCase.weight || 1), 0)
    : totalExpected

  return run.models
    .map((modelId) => {
      const modelResults = run.results.filter((result) => result.modelId === modelId)
      let weightedScore = 0
      let scoredWeight = 0
      let totalCost = 0
      const latencies: number[] = []

      for (const result of modelResults) {
        if (result.score) {
          const weight = weightMap.get(result.testCaseId) || 1
          weightedScore += result.score.score * weight
          scoredWeight += weight
        }

        totalCost += result.cost || 0
        if (result.latencyMs) latencies.push(result.latencyMs)
      }

      const scoredCount = modelResults.filter((result) => result.score).length
      const scoredMean = scoredWeight > 0 ? weightedScore / scoredWeight : null
      const effectiveScore = totalExpectedWeight > 0 ? weightedScore / totalExpectedWeight : 0
      const meanLatencyMs = latencies.length > 0
        ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
        : null

      return {
        modelId,
        displayName: shortModelName(modelId),
        effectiveScore,
        scoredMean,
        scoredCount,
        totalExpected,
        coverage: totalExpected > 0 ? scoredCount / totalExpected : 0,
        totalCost,
        meanLatencyMs,
      }
    })
    .filter((row) => row.scoredCount > 0)
    .sort((left, right) => right.effectiveScore - left.effectiveScore || right.coverage - left.coverage)
}

function ScoreLeaderboard({ rows }: { rows: ModelChartRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Model Score Leaderboard
        </CardTitle>
        <CardDescription>
          Effective score by model, counting missing or unscored expected cells as zero.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.modelId} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="w-5 shrink-0 text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium" title={row.modelId}>
                    {row.displayName}
                  </span>
                </div>
                <div className="shrink-0 font-mono font-semibold">
                  {formatPercent(row.effectiveScore)}
                </div>
              </div>
              <div
                className="h-3 rounded-full bg-muted overflow-hidden"
                aria-label={`${row.displayName} effective score ${formatPercent(row.effectiveScore)}`}
              >
                <div
                  className={index === 0 ? 'h-full rounded-full bg-primary' : 'h-full rounded-full bg-primary/60'}
                  style={{ width: `${clampPercent(row.effectiveScore)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  Coverage {formatPercent(row.coverage, 0)}
                </span>
                <span>
                  {row.scoredCount}/{row.totalExpected} scored
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TradeoffChart({ rows }: { rows: ModelChartRow[] }) {
  const costRows = rows.filter((row) => row.totalCost > 0)
  const latencyRows = rows.filter((row) => row.meanLatencyMs !== null)
  const useCost = costRows.length >= 2
  const chartRows = useCost ? costRows : latencyRows

  if (chartRows.length < 2) return null

  const xValues = chartRows.map((row) => useCost ? row.totalCost : row.meanLatencyMs || 0)
  const rawXMax = Math.max(...xValues)
  const xMax = rawXMax > 0 ? rawXMax : 1
  const xPadding = xMax * 0.08
  const xDomainMax = xMax + xPadding
  const width = 420
  const height = 230
  const left = 46
  const right = 20
  const top = 20
  const bottom = 44
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const xScale = (value: number) => left + (value / xDomainMax) * plotWidth
  const yScale = (value: number) => top + (1 - value) * plotHeight

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          {useCost ? 'Score vs Cost' : 'Score vs Latency'}
        </CardTitle>
        <CardDescription>
          Labeled model tradeoff view for completed, scored results in this run.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <svg
          className="w-full h-auto overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={useCost ? 'Score versus model cost chart' : 'Score versus model latency chart'}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                className="stroke-border"
                strokeDasharray={tick === 0 ? undefined : '3 5'}
              />
              <text
                x={left - 8}
                y={yScale(tick) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {Math.round(tick * 100)}
              </text>
            </g>
          ))}

          <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} className="stroke-foreground/60" />
          <line x1={left} x2={left} y1={top} y2={height - bottom} className="stroke-foreground/60" />

          <text
            x={left + plotWidth / 2}
            y={height - 10}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {useCost ? `Run cost, max ${formatCost(xMax)}` : `Mean latency, max ${formatLatency(xMax)}`}
          </text>
          <text
            x={12}
            y={top + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${top + plotHeight / 2})`}
            className="fill-muted-foreground text-[10px]"
          >
            Score
          </text>

          {chartRows.map((row, index) => {
            const xValue = useCost ? row.totalCost : row.meanLatencyMs || 0
            const x = xScale(xValue)
            const y = yScale(row.effectiveScore)
            const labelAnchor = x > width - 125 ? 'end' : 'start'
            const labelX = labelAnchor === 'end' ? x - 10 : x + 10

            return (
              <g key={row.modelId}>
                <circle
                  cx={x}
                  cy={y}
                  r={index === 0 ? 5.5 : 4.5}
                  className={index === 0 ? 'fill-primary stroke-background' : 'fill-foreground/70 stroke-background'}
                  strokeWidth="2"
                >
                  <title>
                    {`${row.displayName}: ${formatPercent(row.effectiveScore)}, ${useCost ? formatCost(row.totalCost) : formatLatency(row.meanLatencyMs)}`}
                  </title>
                </circle>
                <text
                  x={labelX}
                  y={y + 4}
                  textAnchor={labelAnchor}
                  className="fill-foreground text-[10px] font-medium"
                >
                  {row.displayName.slice(0, 18)}
                </text>
              </g>
            )
          })}
        </svg>
      </CardContent>
    </Card>
  )
}

export function BenchmarkCharts({ run, testCases }: BenchmarkChartsProps) {
  const rows = getModelRows(run, testCases)

  if (rows.length < 2) return null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ScoreLeaderboard rows={rows} />
      <TradeoffChart rows={rows} />
    </div>
  )
}
