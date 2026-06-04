import { getOpenRouterClient, type StreamResult } from './openrouter'
import { useCodeArenaStore } from '@/stores/codeArenaStore'
import { useCodeArenaRunStore, createCodeArenaRun } from '@/stores/codeArenaRunStore'
import { useModelStore } from '@/stores/modelStore'
import { extractCodeFromStreamingContent, extractCodeFromResponse } from './codeExtractor'
import { scoreCodeArenaOutput } from '@/scoring/code-arena-judge'
import type { ChatMessage, ModelParameters, OpenRouterModel, CodeArenaOutput } from '@/types'

// Per-request timeout in milliseconds (2 minutes)
const REQUEST_TIMEOUT_MS = 120000

/**
 * Wraps a promise with a timeout. If the timeout expires, throws an error.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

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

export async function executeCodeArenaRun(
  prompt: string,
  systemPrompt: string,
  modelIds: string[],
  parameters: ModelParameters,
  apiKey: string,
  signal: AbortSignal,
  judgeModelId: string | null,
  options: { concurrencyLimit?: number } = {}
): Promise<void> {
  const client = getOpenRouterClient(apiKey)
  const { updateOutput, setOutputScore } = useCodeArenaStore.getState()
  const { addRun, updateOutput: updateRunOutput, setOutputScore: setRunOutputScore, completeRun } = useCodeArenaRunStore.getState()
  const { availableModels } = useModelStore.getState()

  // Create a map for quick model lookup
  const modelMap = new Map(availableModels.map(m => [m.id, m]))

  // Create and store the run
  const run = createCodeArenaRun(prompt, systemPrompt, modelIds, parameters, judgeModelId || undefined)
  addRun(run)

  // Initialize outputs in the run
  for (const modelId of modelIds) {
    const initialOutput: CodeArenaOutput = {
      modelId,
      rawResponse: '',
      extractedCode: '',
      status: 'idle',
      streamedContent: '',
    }
    updateRunOutput(run.id, modelId, initialOutput)
  }

  // Execute all models in parallel with concurrency limit
  const concurrencyLimit = Math.min(20, Math.max(1, options.concurrencyLimit ?? 5))
  const tasks: Array<() => Promise<void>> = []

  for (const modelId of modelIds) {
    tasks.push(async () => {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const startTime = Date.now()
      
      // Update status to running
      updateOutput(modelId, { status: 'running' })
      updateRunOutput(run.id, modelId, { status: 'running' })

      try {
        const messages: ChatMessage[] = []

        // Add system prompt
        if (systemPrompt) {
          messages.push({
            role: 'system',
            content: systemPrompt,
          })
        }

        // Add user prompt
        messages.push({
          role: 'user',
          content: prompt,
        })

        // Stream the response with timeout
        let streamedContent = ''
        const streamPromise = client.createChatCompletionStreamWithUsage(
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
            
            // Extract code from streaming content for live preview
            const extractedCode = extractCodeFromStreamingContent(streamedContent)
            
            updateOutput(modelId, {
              streamedContent,
              extractedCode,
            })
            updateRunOutput(run.id, modelId, {
              streamedContent,
              extractedCode,
            })
          }
        )
        
        const result = await withTimeout(
          streamPromise,
          REQUEST_TIMEOUT_MS,
          `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
        )

        const latencyMs = Date.now() - startTime
        const model = modelMap.get(modelId)
        const cost = calculateCost(result.usage, model)

        // Final extraction from complete response
        const finalExtractedCode = extractCodeFromResponse(result.content)

        const completedOutput: Partial<CodeArenaOutput> = {
          rawResponse: result.content,
          extractedCode: finalExtractedCode,
          status: 'completed',
          latencyMs,
          promptTokens: result.usage?.prompt_tokens,
          completionTokens: result.usage?.completion_tokens,
          cost,
        }

        updateOutput(modelId, completedOutput)
        updateRunOutput(run.id, modelId, completedOutput)

        // Score with LLM judge if enabled
        if (judgeModelId) {
          try {
            const score = await scoreCodeArenaOutput(
              prompt,
              finalExtractedCode,
              client,
              judgeModelId
            )
            setOutputScore(modelId, score)
            setRunOutputScore(run.id, modelId, score)
          } catch (error) {
            console.error('Failed to score output:', error)
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          updateOutput(modelId, { status: 'cancelled' })
          updateRunOutput(run.id, modelId, { status: 'cancelled' })
          throw error
        }

        updateOutput(modelId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        updateRunOutput(run.id, modelId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  // Execute with concurrency limit
  await executeWithConcurrency(tasks, concurrencyLimit, signal)

  completeRun(run.id)
}

async function executeWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
  signal: AbortSignal
): Promise<void> {
  const executing = new Set<Promise<void>>()
  const errors: Error[] = []

  for (const task of tasks) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const promise = task().catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      errors.push(error)
    })

    executing.add(promise)
    promise.finally(() => executing.delete(promise))

    if (executing.size >= limit) {
      try {
        await Promise.race(executing)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
      }
    }
  }

  await Promise.all(executing)

  if (errors.length > 0) {
    console.error('Some tasks failed:', errors)
  }
}
