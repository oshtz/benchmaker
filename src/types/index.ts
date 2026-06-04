// Test Suite and Test Case Types
export interface TestCase {
  id: string
  prompt: string
  expectedOutput?: string
  scoringMethod: ScoringMethod
  weight: number
  metadata: {
    category?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    tags: string[]
  }
}

export interface TestSuite {
  id: string
  name: string
  description?: string
  systemPrompt: string
  judgeSystemPrompt?: string
  testCases: TestCase[]
  createdAt: number
  updatedAt: number
}

// Scoring Types
export type ScoringMethod =
  | 'exact-match'
  | 'regex-match'
  | 'numeric-tolerance'
  | 'boolean'
  | 'llm-judge'

export interface ScoringResult {
  score: number // 0-1 normalized
  confidence?: number
  notes?: string
  rawScore?: number
  maxScore?: number
}

export interface ScoringConfig {
  method: ScoringMethod
  // For regex matching
  pattern?: string
  flags?: string
  // For numeric tolerance
  tolerance?: number
  // For LLM judge
  judgeModel?: string
  rubric?: string
}

// Aggregate scoring with statistics
export interface AggregateScore {
  mean: number           // Weighted mean score (0-1)
  stdDev: number         // Standard deviation
  min: number            // Minimum score
  max: number            // Maximum score
  count: number          // Number of scored results
  totalWeight: number    // Sum of weights used
  confidence95?: [number, number]  // 95% confidence interval
}

// Multi-run statistics
export interface MultiRunStats {
  runIds: string[]
  modelId: string
  scores: number[]       // Individual run scores
  mean: number
  stdDev: number
  min: number
  max: number
  confidence95: [number, number]
}

// Model Types
export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  top_provider?: {
    context_length: number
    max_completion_tokens?: number
  }
}

export interface ModelParameters {
  temperature: number
  topP: number
  maxTokens: number
  frequencyPenalty: number
  presencePenalty: number
  benchmarkMode?: boolean  // When true, uses temp=0 for reproducibility
}

// Execution Types
export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TestCaseResult {
  testCaseId: string
  modelId: string
  response: string
  tokenCount?: number
  promptTokens?: number
  completionTokens?: number
  cost?: number // Cost in USD
  latencyMs?: number
  status: ExecutionStatus
  error?: string
  score?: ScoringResult
  streamedContent?: string
}

export interface RunResult {
  id: string
  testSuiteId: string
  testSuiteName: string
  models: string[]
  parameters: ModelParameters
  results: TestCaseResult[]
  status: ExecutionStatus
  startedAt: number
  completedAt?: number
  judgeModel?: string
  // Error tracking for surfacing in UI
  errorCount?: number
  errorSummary?: string
}

// Code Arena Types
export interface CodeArenaOutput {
  modelId: string
  rawResponse: string
  extractedCode: string
  status: ExecutionStatus
  error?: string
  latencyMs?: number
  promptTokens?: number
  completionTokens?: number
  cost?: number
  streamedContent?: string
  score?: ScoringResult
}

export interface CodeArenaRun {
  id: string
  type: 'code-arena'
  prompt: string
  systemPrompt: string
  models: string[]
  parameters: ModelParameters
  outputs: CodeArenaOutput[]
  status: ExecutionStatus
  startedAt: number
  completedAt?: number
  judgeModelId?: string
}

// Settings Types
export interface Settings {
  apiKey: string
  defaultTemperature: number
  defaultTopP: number
  defaultMaxTokens: number
  maxRunCostUsd: number
  concurrencyLimit: number
  theme: 'light' | 'dark' | 'system'
}

export interface BenchmakerDb {
  version: number
  updatedAt: number
  testSuites: TestSuite[]
  runs: RunResult[]
  codeArenaRuns: CodeArenaRun[]
  activeTestSuiteId: string | null
  currentRunId: string | null
  currentCodeArenaRunId: string | null
}

// OpenRouter API Types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  frequency_penalty?: number
  presence_penalty?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  choices: {
    index: number
    message: ChatMessage
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
