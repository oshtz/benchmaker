import { useMemo, useState } from 'react'
import { Play, Square, Repeat, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { useSettingsStore } from '@/stores/settingsStore'
import { useModelStore } from '@/stores/modelStore'
import { useRunStore } from '@/stores/runStore'
import { executeRun } from '@/services/execution'
import { estimateStandardRunCost, formatCost, isOverBudget } from '@/services/costControls'
import type { TestSuite } from '@/types'

interface ExecutionControlsProps {
  testSuite: TestSuite
}

export function ExecutionControls({ testSuite }: ExecutionControlsProps) {
  const { apiKey, maxRunCostUsd, concurrencyLimit } = useSettingsStore()
  const { selectedModelIds, judgeModelId, availableModels, getEffectiveParameters } = useModelStore()
  const { createRun } = useRunStore()
  const { toast } = useToast()

  const [isRunning, setIsRunning] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [currentRunIndex, setCurrentRunIndex] = useState(0)
  const [totalRuns, setTotalRuns] = useState(1)

  const effectiveParameters = getEffectiveParameters()
  const estimatedOneRunCost = useMemo(
    () =>
      estimateStandardRunCost({
        testSuite,
        modelIds: selectedModelIds,
        availableModels,
        parameters: effectiveParameters,
        judgeModelId,
      }),
    [availableModels, effectiveParameters, judgeModelId, selectedModelIds, testSuite]
  )
  const oneRunOverBudget = isOverBudget(estimatedOneRunCost, maxRunCostUsd)
  const hasRunInputs = selectedModelIds.length > 0 && testSuite.testCases.length > 0
  const canRun = hasRunInputs && !oneRunOverBudget

  const executeSingleRun = async (controller: AbortController): Promise<string> => {
    const run = createRun({
      testSuiteId: testSuite.id,
      testSuiteName: testSuite.name,
      models: selectedModelIds,
      parameters: effectiveParameters,
      results: [],
      status: 'running',
      startedAt: Date.now(),
      judgeModel: judgeModelId || undefined,
    })

    await executeRun(run.id, testSuite, apiKey!, controller.signal, { concurrencyLimit })
    return run.id
  }

  const handleRun = async (numRuns: number = 1) => {
    if (!hasRunInputs || !apiKey) {
      toast({
        title: 'Cannot start run',
        description: 'Please select at least one model and ensure test cases exist',
        variant: 'destructive',
      })
      return
    }

    const estimatedCost = estimateStandardRunCost({
      testSuite,
      modelIds: selectedModelIds,
      availableModels,
      parameters: effectiveParameters,
      runCount: numRuns,
      judgeModelId,
    })

    if (isOverBudget(estimatedCost, maxRunCostUsd)) {
      toast({
        title: 'Run blocked by cost cap',
        description: `Estimated ${formatCost(estimatedCost)} exceeds your ${formatCost(maxRunCostUsd)} cap.`,
        variant: 'destructive',
      })
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    setIsRunning(true)
    setTotalRuns(numRuns)
    setCurrentRunIndex(0)

    const completedRunIds: string[] = []
    let cancelled = false

    try {
      for (let i = 0; i < numRuns; i++) {
        if (controller.signal.aborted) {
          cancelled = true
          break
        }

        setCurrentRunIndex(i + 1)
        const runId = await executeSingleRun(controller)
        completedRunIds.push(runId)
      }

      if (!cancelled) {
        if (numRuns === 1) {
          toast({
            title: 'Run completed',
            description: `Benchmarked ${selectedModelIds.length} models on ${testSuite.testCases.length} test cases`,
          })
        } else {
          toast({
            title: `${numRuns} runs completed`,
            description: `Completed ${numRuns} benchmark runs. Use Results tab to analyze multi-run statistics.`,
          })
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({
          title: 'Runs cancelled',
          description: `Stopped after ${completedRunIds.length} of ${numRuns} runs`,
        })
      } else {
        toast({
          title: 'Run failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    } finally {
      setIsRunning(false)
      setAbortController(null)
      setCurrentRunIndex(0)
      setTotalRuns(1)
    }
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const runOptions = [3, 5, 10]

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <Button variant="destructive" onClick={handleStop}>
          <Square className="h-4 w-4 mr-2" />
          Stop {totalRuns > 1 ? `(${currentRunIndex}/${totalRuns})` : ''}
        </Button>
      ) : (
        <div className="flex items-center bg-brand-gradient rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 transition-all hover:-translate-y-[1px]">
          <Button 
            variant="ghost"
            onClick={() => handleRun(1)} 
            disabled={!canRun}
            className="rounded-r-none hover:bg-white/10 hover:text-white text-white border-0"
          >
            <Play className="h-4 w-4 mr-2" />
            Run Benchmark
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost"
                disabled={!canRun}
                className="rounded-l-none hover:bg-white/10 hover:text-white text-white border-0 border-l border-white/20 px-2"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {runOptions.map((n) => (
                <DropdownMenuItem key={n} onClick={() => handleRun(n)}>
                  <Repeat className="h-4 w-4 mr-2" />
                  Run {n} times
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {selectedModelIds.length === 0 && (
        <span className="text-sm text-muted-foreground">
          Select models to run
        </span>
      )}
      {selectedModelIds.length > 0 && (
        <span className={oneRunOverBudget ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          Est. {formatCost(estimatedOneRunCost)}
          {maxRunCostUsd > 0 && ` / cap ${formatCost(maxRunCostUsd)}`}
        </span>
      )}
    </div>
  )
}
