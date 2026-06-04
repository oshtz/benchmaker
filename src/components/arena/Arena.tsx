import { useEffect } from 'react'
import { Key, FileText, ListChecks } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { useModelStore } from '@/stores/modelStore'
import { getOpenRouterClient } from '@/services/openrouter'
import { ModelSelector } from './ModelSelector'
import { ParameterPanel } from './ParameterPanel'
import { ExecutionControls } from './ExecutionControls'
import { JudgeSelector } from './JudgeSelector'
import { ExecutionSafetyPanel } from './ExecutionSafetyPanel'

export function Arena() {
  const { apiKey } = useSettingsStore()
  const { testSuites, activeTestSuiteId } = useTestSuiteStore()
  const {
    setAvailableModels,
    setIsLoadingModels,
    setModelsError,
    setLastFetchedAt,
    lastFetchedAt,
    availableModels,
  } = useModelStore()

  const activeTestSuite = testSuites.find((s) => s.id === activeTestSuiteId)

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
        description="Connect your OpenRouter account to access hundreds of AI models"
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

  if (!activeTestSuite) {
    return (
      <EmptyState
        icon={FileText}
        title="No Test Suite Selected"
        description="You need a test suite with prompts to benchmark models"
        variant="warning"
        steps={[
          {
            number: 1,
            title: 'Go to the Prompts tab',
            description: 'Create or select an existing test suite',
          },
          {
            number: 2,
            title: 'Add test cases',
            description: 'Define the prompts you want to test',
          },
          {
            number: 3,
            title: 'Return to Arena',
            description: 'Select models and run your benchmark',
          },
        ]}
      />
    )
  }

  if (activeTestSuite.testCases.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No Test Cases"
        description={`Your test suite "${activeTestSuite.name}" needs at least one test case`}
        variant="warning"
        steps={[
          {
            number: 1,
            title: 'Go to the Prompts tab',
            description: 'Your test suite is selected but empty',
          },
          {
            number: 2,
            title: 'Click "Add Test Case"',
            description: 'Define a prompt and optionally an expected output',
          },
          {
            number: 3,
            title: 'Choose a scoring method',
            description: 'Select how responses should be evaluated',
          },
        ]}
      />
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 sm:gap-6">
      <div className="surface border-b-0 p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between shrink-0">
        <div className="min-w-0">
          <h2 className="headline">Arena</h2>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            Active suite: {activeTestSuite.name} ({activeTestSuite.testCases.length} test
            cases)
          </p>
        </div>
        <ExecutionControls testSuite={activeTestSuite} />
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3 flex-1 min-h-0">
        <div className="md:col-span-2 xl:col-span-2 min-h-0">
          <ModelSelector />
        </div>
        <div className="md:col-span-2 xl:col-span-1 grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-1 min-h-0">
          <ParameterPanel />
          <ExecutionSafetyPanel />
          <JudgeSelector />
        </div>
      </div>
    </div>
  )
}
