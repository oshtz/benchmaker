import type { ModelParameters, OpenRouterModel, TestSuite } from '@/types'

const CHARS_PER_TOKEN_ESTIMATE = 4

export function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return '$0.00'
  if (cost < 0.0001) return '<$0.0001'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.ceil(trimmed.length / CHARS_PER_TOKEN_ESTIMATE)
}

export function getModelMap(models: OpenRouterModel[]): Map<string, OpenRouterModel> {
  return new Map(models.map((model) => [model.id, model]))
}

function getModelPrices(model: OpenRouterModel | undefined): {
  promptPrice: number
  completionPrice: number
} {
  if (!model) {
    return { promptPrice: 0, completionPrice: 0 }
  }

  return {
    promptPrice: Number.parseFloat(model.pricing.prompt) || 0,
    completionPrice: Number.parseFloat(model.pricing.completion) || 0,
  }
}

function estimateModelCallCost(
  model: OpenRouterModel | undefined,
  promptTokens: number,
  maxCompletionTokens: number
): number {
  const { promptPrice, completionPrice } = getModelPrices(model)
  return (promptTokens * promptPrice) + (maxCompletionTokens * completionPrice)
}

export function estimateStandardRunCost({
  testSuite,
  modelIds,
  availableModels,
  parameters,
  runCount = 1,
  judgeModelId,
}: {
  testSuite: TestSuite
  modelIds: string[]
  availableModels: OpenRouterModel[]
  parameters: ModelParameters
  runCount?: number
  judgeModelId?: string | null
}): number {
  const modelMap = getModelMap(availableModels)
  const systemPromptTokens = estimateTokenCount(testSuite.systemPrompt)
  let total = 0

  for (const testCase of testSuite.testCases) {
    const promptTokens = systemPromptTokens + estimateTokenCount(testCase.prompt)
    for (const modelId of modelIds) {
      total += estimateModelCallCost(
        modelMap.get(modelId),
        promptTokens,
        parameters.maxTokens
      )
    }

    if (testCase.scoringMethod === 'llm-judge' && judgeModelId) {
      const judgePromptTokens =
        estimateTokenCount(testCase.prompt) +
        estimateTokenCount(testCase.expectedOutput ?? '') +
        parameters.maxTokens
      total += estimateModelCallCost(modelMap.get(judgeModelId), judgePromptTokens, 500)
    }
  }

  return total * runCount
}

export function estimateCodeArenaRunCost({
  prompt,
  systemPrompt,
  modelIds,
  availableModels,
  parameters,
  judgeEnabled,
  judgeModelId,
}: {
  prompt: string
  systemPrompt: string
  modelIds: string[]
  availableModels: OpenRouterModel[]
  parameters: ModelParameters
  judgeEnabled: boolean
  judgeModelId?: string | null
}): number {
  const modelMap = getModelMap(availableModels)
  const promptTokens = estimateTokenCount(prompt) + estimateTokenCount(systemPrompt)
  let total = 0

  for (const modelId of modelIds) {
    total += estimateModelCallCost(modelMap.get(modelId), promptTokens, parameters.maxTokens)
  }

  if (judgeEnabled && judgeModelId) {
    const judgePromptTokens = promptTokens + parameters.maxTokens
    total += modelIds.length * estimateModelCallCost(modelMap.get(judgeModelId), judgePromptTokens, 500)
  }

  return total
}

export function isOverBudget(estimatedCost: number, maxRunCostUsd: number): boolean {
  return maxRunCostUsd > 0 && estimatedCost > maxRunCostUsd
}
