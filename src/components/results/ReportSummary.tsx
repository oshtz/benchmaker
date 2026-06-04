import { Clock, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useRunStore } from '@/stores/runStore'
import type { RunResult } from '@/types'

interface ReportSummaryProps {
  run: RunResult
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.0001) return '<$0.0001'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export function ReportSummary({ run }: ReportSummaryProps) {
  const { getAggregateScores, getTotalCost, getAggregateCosts } = useRunStore()
  const scores = getAggregateScores(run.id)
  const totalCost = getTotalCost(run.id)
  const modelCosts = getAggregateCosts(run.id)

  const duration = run.completedAt
    ? ((run.completedAt - run.startedAt) / 1000).toFixed(1)
    : 'In progress'

  const completedCount = run.results.filter((r) => r.status === 'completed').length
  const failedCount = run.results.filter((r) => r.status === 'failed').length
  const totalCount = run.results.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const getStatusBadge = () => {
    switch (run.status) {
      case 'completed':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        )
      case 'running':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Clock className="h-3 w-3 animate-spin" />
            Running
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        )
      default:
        return null
    }
  }

  const sortedModels = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])

  // Sort models by cost (cheapest first) for display
  const sortedByCost = Array.from(modelCosts.entries()).sort((a, b) => a[1] - b[1])

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
      <Card className="relative overflow-hidden col-span-2 sm:col-span-1">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <CardHeader className="pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
            Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge()}
            {run.status === 'running' && (
              <span className="text-xs sm:text-sm text-muted-foreground">
                {completedCount}/{totalCount}
              </span>
            )}
          </div>
          {run.status === 'running' && (
            <Progress value={progressPercent} className="mt-2 sm:mt-3 h-1.5 sm:h-2" />
          )}
        </CardContent>
      </Card>

      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
            Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-semibold">
            {typeof duration === 'string' ? duration : `${duration}s`}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            Started {new Date(run.startedAt).toLocaleTimeString()}
          </p>
        </CardContent>
      </Card>

      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
            Test Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
              <span className="text-base sm:text-lg font-semibold">{completedCount}</span>
            </div>
            {failedCount > 0 && (
              <div className="flex items-center gap-1" title={run.errorSummary || `${failedCount} task(s) failed`}>
                <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-500" />
                <span className="text-base sm:text-lg font-semibold">{failedCount}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {run.models.length} models × {Math.round(totalCount / run.models.length)} tests
          </p>
          {run.errorSummary && (
            <p className="text-[10px] sm:text-xs text-rose-500 mt-1 line-clamp-2" title={run.errorSummary}>
              {run.errorSummary}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
            Top Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedModels.length > 0 ? (
            <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0">
              <div className="text-xs sm:text-sm font-semibold truncate max-w-full">
                {sortedModels[0][0].split('/').pop()}
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-emerald-600">
                {(sortedModels[0][1] * 100).toFixed(1)}%
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No scores yet</div>
          )}
        </CardContent>
      </Card>

      <Card className="col-span-2 sm:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Total Cost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-semibold">
            {formatCost(totalCost)}
          </div>
          {sortedByCost.length > 0 && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Cheapest: {sortedByCost[0][0].split('/').pop()} ({formatCost(sortedByCost[0][1])})
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
