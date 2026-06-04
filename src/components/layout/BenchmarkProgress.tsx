import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useRunStore } from '@/stores/runStore'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { Badge } from '@/components/ui/badge'

export function BenchmarkProgress() {
  const { runs, currentRunId } = useRunStore()
  const { testSuites } = useTestSuiteStore()

  const currentRun = runs.find((r) => r.id === currentRunId)

  if (!currentRun || currentRun.status === 'idle') {
    return null
  }

  const testSuite = testSuites.find((s) => s.id === currentRun.testSuiteId)
  const totalTasks = (testSuite?.testCases.length ?? 0) * currentRun.models.length
  const completedTasks = currentRun.results.filter(
    (r) => r.status === 'completed' || r.status === 'failed'
  ).length

  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  const isRunning = currentRun.status === 'running'
  const isCompleted = currentRun.status === 'completed'
  const isFailed = currentRun.status === 'failed'

  if (isCompleted || isFailed) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {isCompleted ? (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        ) : (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )}
      </div>
    )
  }

  if (!isRunning) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Progress value={progress} className="w-28 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completedTasks}/{totalTasks}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Running benchmark
        </span>
      </div>
    </div>
  )
}
