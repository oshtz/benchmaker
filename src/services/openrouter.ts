import type {
  OpenRouterModel,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@/types'

export interface StreamResult {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Benchmaker',
    }
  }

  async fetchModels(): Promise<OpenRouterModel[]> {
    const response = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `Failed to fetch models: ${response.status}`)
    }

    const data = await response.json()
    return data.data as OpenRouterModel[]
  }

  async createChatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API request failed: ${response.status}`)
    }

    return response.json()
  }

  async *createChatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...request, stream: true }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API request failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let rawBody = ''
    let sawDataLine = false

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        rawBody += chunk
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          if (!trimmed.startsWith('data:')) continue

          sawDataLine = true
          if (trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue
          try {
            const json = JSON.parse(trimmed.slice(6))
            const content =
              json.choices?.[0]?.delta?.content ??
              json.choices?.[0]?.message?.content
            if (content) {
              yield content
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
      const tail = buffer.trim()
      if (tail.startsWith('data: ')) {
        sawDataLine = true
        if (tail !== 'data: [DONE]') {
          try {
            const json = JSON.parse(tail.slice(6))
            const content =
              json.choices?.[0]?.delta?.content ??
              json.choices?.[0]?.message?.content
            if (content) {
              yield content
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
      if (!sawDataLine) {
        try {
          const json = JSON.parse(rawBody.trim())
          const content =
            json.choices?.[0]?.message?.content ??
            json.choices?.[0]?.delta?.content
          if (content) {
            yield content
          }
        } catch {
          // Skip invalid JSON
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.fetchModels()
      return true
    } catch {
      return false
    }
  }

  async createChatCompletionStreamWithUsage(
    request: ChatCompletionRequest,
    onChunk?: (content: string) => void
  ): Promise<StreamResult> {
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...request, stream: true }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `API request failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let usage: StreamResult['usage'] | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          if (trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const content =
              json.choices?.[0]?.delta?.content ??
              json.choices?.[0]?.message?.content
            if (content) {
              fullContent += content
              onChunk?.(content)
            }
            // Capture usage if present (usually in final chunk)
            if (json.usage) {
              usage = json.usage
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Process remaining buffer
      const tail = buffer.trim()
      if (tail.startsWith('data: ') && tail !== 'data: [DONE]') {
        try {
          const json = JSON.parse(tail.slice(6))
          const content =
            json.choices?.[0]?.delta?.content ??
            json.choices?.[0]?.message?.content
          if (content) {
            fullContent += content
            onChunk?.(content)
          }
          if (json.usage) {
            usage = json.usage
          }
        } catch {
          // Skip invalid JSON
        }
      }

      return { content: fullContent, usage }
    } finally {
      reader.releaseLock()
    }
  }
}

// Singleton instance management
let clientInstance: OpenRouterClient | null = null

export function getOpenRouterClient(apiKey: string): OpenRouterClient {
  if (!clientInstance || clientInstance['apiKey'] !== apiKey) {
    clientInstance = new OpenRouterClient(apiKey)
  }
  return clientInstance
}

export function clearOpenRouterClient(): void {
  clientInstance = null
}
