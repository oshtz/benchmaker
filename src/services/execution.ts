import { getOpenRouterClient, type StreamResult } from './openrouter'
import { useRunStore } from '@/stores/runStore'
import { useModelStore } from '@/stores/modelStore'
import { scoreResponse } from '@/scoring'
import { delay, isAbortError, throwIfAborted, withAbortableTimeout } from './abort'
import type { TestSuite, TestCaseResult, ChatMessage, ModelParameters, OpenRouterModel } from '@/types'

function calculateCost(
  usage: StreamResult['usage'],
  model: OpenRouterModel | undefined
): number | undefined {
  if (!usage || !model) return undefined

  const promptPrice = parseFloat(model.pricing.prompt) || 0
  const completionPrice = parseFloat(model.pricing.completion) || 0

  const promptCost = usage.prompt_tokens * promptPrice
  const completionCost = usage.completion_tokens * completionPrice

  return promptCost + completionCost
}

export async function executeRun(
  runId: string,
  testSuite: TestSuite,
  apiKey: string,
  signal: AbortSignal,
  options: { concurrencyLimit?: number } = {}
): Promise<void> {
  const client = getOpenRouterClient(apiKey)
  const { addResult, updateResult, setResultScore, completeRun } = useRunStore.getState()
  const { selectedModelIds, judgeModelId, availableModels, getEffectiveParameters } = useModelStore.getState()
  
  // Use effective parameters (respects benchmark mode)
  const parameters = getEffectiveParameters()

  // Create a map for quick model lookup
  const modelMap = new Map(availableModels.map(m => [m.id, m]))

  // Create initial result entries for all test case + model combinations
  for (const testCase of testSuite.testCases) {
    for (const modelId of selectedModelIds) {
      const initialResult: TestCaseResult = {
        testCaseId: testCase.id,
        modelId,
        response: '',
        status: 'idle',
        streamedContent: '',
      }
      addResult(runId, initialResult)
    }
  }

  // Execute all combinations in parallel batches
  const concurrencyLimit = Math.min(20, Math.max(1, options.concurrencyLimit ?? 5))
  const tasks: Array<() => Promise<void>> = []

  for (const testCase of testSuite.testCases) {
    for (const modelId of selectedModelIds) {
      tasks.push(async () => {
        throwIfAborted(signal)

        const startTime = Date.now()
        updateResult(runId, testCase.id, modelId, { status: 'running' })

        try {
          const messages: ChatMessage[] = []

          // Add system prompt if present
          if (testSuite.systemPrompt) {
            messages.push({
              role: 'system',
              content: testSuite.systemPrompt,
            })
          }

          // Add the test case prompt
          messages.push({
            role: 'user',
            content: testCase.prompt,
          })

          const { content: fullResponse, usage } = await generateResponseWithRetries(
            client,
            modelId,
            messages,
            parameters,
            runId,
            testCase.id,
            signal,
            updateResult
          )

          throwIfAborted(signal)

          const latencyMs = Date.now() - startTime
          const model = modelMap.get(modelId)
          const cost = calculateCost(usage, model)

          updateResult(runId, testCase.id, modelId, {
            response: fullResponse,
            status: 'completed',
            latencyMs,
            promptTokens: usage?.prompt_tokens,
            completionTokens: usage?.completion_tokens,
            cost,
          })

          // Score the response
          const score = await scoreResponse(
            testCase,
            fullResponse,
            judgeModelId ? client : undefined,
            judgeModelId || undefined,
            testSuite.judgeSystemPrompt,
            signal
          )

          setResultScore(runId, testCase.id, modelId, score)
        } catch (error) {
          if (isAbortError(error)) {
            updateResult(runId, testCase.id, modelId, { status: 'cancelled' })
            throw error
          }

          updateResult(runId, testCase.id, modelId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      })
    }
  }

  // Execute with concurrency limit
  const executionErrors = await executeWithConcurrency(tasks, concurrencyLimit, signal)

  // Complete run with error summary if any errors occurred
  completeRun(runId, executionErrors.count > 0 ? {
    errorCount: executionErrors.count,
    errorSummary: executionErrors.summary,
  } : undefined)
}

const MAX_EMPTY_RESPONSE_RETRIES = 2
const EMPTY_RESPONSE_BACKOFF_MS = 400
// Per-request timeout in milliseconds (2 minutes)
const REQUEST_TIMEOUT_MS = 120000

interface ResponseWithUsage {
  content: string
  usage?: StreamResult['usage']
}

async function generateResponseWithRetries(
  client: ReturnType<typeof getOpenRouterClient>,
  modelId: string,
  messages: ChatMessage[],
  parameters: ModelParameters,
  runId: string,
  testCaseId: string,
  signal: AbortSignal,
  updateResult: (runId: string, testCaseId: string, modelId: string, updates: Partial<TestCaseResult>) => void
): Promise<ResponseWithUsage> {
  for (let attempt = 0; attempt <= MAX_EMPTY_RESPONSE_RETRIES; attempt++) {
    updateResult(runId, testCaseId, modelId, { streamedContent: '' })

    throwIfAborted(signal)

    let streamedContent = ''
    const result = await withAbortableTimeout(
      (requestSignal) =>
        client.createChatCompletionStreamWithUsage(
          {
            model: modelId,
            messages,
            temperature: parameters.temperature,
            top_p: parameters.topP,
            max_tokens: parameters.maxTokens,
            frequency_penalty: parameters.frequencyPenalty,
            presence_penalty: parameters.presencePenalty,
          },
          (chunk) => {
            streamedContent += chunk
            updateResult(runId, testCaseId, modelId, {
              streamedContent,
            })
          },
          { signal: requestSignal }
        ),
      signal,
      REQUEST_TIMEOUT_MS,
      `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
    )

    if (result.content.trim().length > 0) {
      return result
    }

    const fallbackResult = await fetchNonStreamingResponse(
      client,
      modelId,
      messages,
      parameters,
      signal
    )
    if (fallbackResult.content.trim().length > 0) {
      updateResult(runId, testCaseId, modelId, {
        streamedContent: fallbackResult.content,
      })
      return fallbackResult
    }

    if (attempt < MAX_EMPTY_RESPONSE_RETRIES) {
      await delay(EMPTY_RESPONSE_BACKOFF_MS * (attempt + 1), signal)
    }
  }

  return { content: '' }
}

async function fetchNonStreamingResponse(
  client: ReturnType<typeof getOpenRouterClient>,
  modelId: string,
  messages: ChatMessage[],
  parameters: ModelParameters,
  signal: AbortSignal
): Promise<ResponseWithUsage> {
  throwIfAborted(signal)

  try {
    const completion = await withAbortableTimeout(
      (requestSignal) =>
        client.createChatCompletion(
          {
            model: modelId,
            messages,
            temperature: parameters.temperature,
            top_p: parameters.topP,
            max_tokens: parameters.maxTokens,
            frequency_penalty: parameters.frequencyPenalty,
            presence_penalty: parameters.presencePenalty,
          },
          { signal: requestSignal }
        ),
      signal,
      REQUEST_TIMEOUT_MS,
      `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
    )

    const content = completion.choices?.[0]?.message?.content
    return {
      content: typeof content === 'string' ? content : '',
      usage: completion.usage,
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    return { content: '' }
  }
}

export interface ExecutionErrors {
  count: number
  summary: string
  details: Error[]
}

async function executeWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
  signal: AbortSignal
): Promise<ExecutionErrors> {
  const executing = new Set<Promise<void>>()
  const errors: Error[] = []

  for (const task of tasks) {
    throwIfAborted(signal)

    const promise = task().catch((error) => {
      if (isAbortError(error)) {
        throw error
      }
      errors.push(error)
    })

    executing.add(promise)
    void promise.then(
      () => executing.delete(promise),
      () => executing.delete(promise)
    )

    if (executing.size >= limit) {
      try {
        await Promise.race(executing)
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }
      }
    }
  }

  await Promise.all(executing)

  // Build error summary
  const errorSummary = errors.length > 0 
    ? `${errors.length} task(s) failed: ${[...new Set(errors.map(e => e.message))].join('; ')}`
    : ''

  if (errors.length > 0) {
    console.error('Some tasks failed:', errors)
  }

  return {
    count: errors.length,
    summary: errorSummary,
    details: errors,
  }
}
