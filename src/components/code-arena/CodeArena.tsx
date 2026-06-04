import { useEffect } from 'react'
import { Key, Code2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSettingsStore } from '@/stores/settingsStore'
import { useModelStore } from '@/stores/modelStore'
import { getOpenRouterClient } from '@/services/openrouter'
import { CodeArenaHeader } from './CodeArenaHeader'
import { CodeArenaGrid } from './CodeArenaGrid'
import { CodeArenaExecutionControls } from './CodeArenaExecutionControls'
import { CodeArenaJudgeSelector } from './CodeArenaJudgeSelector'
import { ModelSelector } from '@/components/arena/ModelSelector'
import { ExecutionSafetyPanel } from '@/components/arena/ExecutionSafetyPanel'

export function CodeArena() {
  const { apiKey } = useSettingsStore()
  const {
    setAvailableModels,
    setIsLoadingModels,
    setModelsError,
    setLastFetchedAt,
    lastFetchedAt,
    availableModels,
  } = useModelStore()

  // Fetch models when API key is available
  useEffect(() => {
    if (!apiKey) return

    // Only fetch if we haven't fetched in the last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    if (lastFetchedAt && lastFetchedAt > fiveMinutesAgo && availableModels.length > 0) {
      return
    }

    const fetchModels = async () => {
      setIsLoadingModels(true)
      setModelsError(null)

      try {
        const client = getOpenRouterClient(apiKey)
        const models = await client.fetchModels()
        setAvailableModels(models)
        setLastFetchedAt(Date.now())
      } catch (error) {
        setModelsError(
          error instanceof Error ? error.message : 'Failed to fetch models'
        )
      } finally {
        setIsLoadingModels(false)
      }
    }

    fetchModels()
  }, [apiKey])

  if (!apiKey) {
    return (
      <EmptyState
        icon={Key}
        title="API Key Required"
        description="Connect your OpenRouter account to access AI models for code generation"
        variant="warning"
        steps={[
          {
            number: 1,
            title: 'Get an API key',
            description: 'Sign up at openrouter.ai and generate an API key',
          },
          {
            number: 2,
            title: 'Click the key icon in the header',
            description: 'Enter your API key to unlock model access',
          },
        ]}
      />
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header section */}
      <div className="surface border-b-0 p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between shrink-0 mb-4">
        <div className="min-w-0 flex items-center gap-3">
          <Code2 className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h2 className="headline">Code Arena</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Compare AI models generating frontend code with live preview
            </p>
          </div>
        </div>
        <CodeArenaExecutionControls />
      </div>

      {/* Main content with resizable panels */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-xl">
          {/* Left panel - Configuration */}
          <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%">
            <ScrollArea className="h-full w-full">
              <div className="flex flex-col gap-4 pr-2 w-full">
                <CodeArenaHeader />
                <div className="flex-1 min-h-0">
                  <ModelSelector useCodeArenaStore={true} />
                </div>
                <div className="shrink-0">
                  <ExecutionSafetyPanel />
                </div>
                <div className="shrink-0">
                  <CodeArenaJudgeSelector />
                </div>
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel - Model outputs grid */}
          <ResizablePanel defaultSize="75%" minSize="50%">
            <div className="h-full pl-2">
              <CodeArenaGrid />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
