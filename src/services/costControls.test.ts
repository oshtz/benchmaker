import { describe, expect, it } from 'vitest'
import {
  estimateCodeArenaRunCost,
  estimateStandardRunCost,
  estimateTokenCount,
  formatCost,
  isOverBudget,
} from './costControls'
import type { OpenRouterModel, TestSuite } from '@/types'

const cheapModel: OpenRouterModel = {
  id: 'provider/cheap',
  name: 'Cheap',
  context_length: 8192,
  pricing: {
    prompt: '0.001',
    completion: '0.002',
  },
}

const judgeModel: OpenRouterModel = {
  id: 'provider/judge',
  name: 'Judge',
  context_length: 8192,
  pricing: {
    prompt: '0.003',
    completion: '0.004',
  },
}

const testSuite: TestSuite = {
  id: 'suite-1',
  name: 'Cost suite',
  systemPrompt: 'System prompt',
  testCases: [
    {
      id: 'case-1',
      prompt: 'First prompt',
      expectedOutput: 'First answer',
      scoringMethod: 'exact-match',
      weight: 1,
      metadata: { tags: [] },
    },
    {
      id: 'case-2',
      prompt: 'Judge prompt',
      expectedOutput: 'Judge answer',
      scoringMethod: 'llm-judge',
      weight: 1,
      metadata: { tags: [] },
    },
  ],
  createdAt: 1,
  updatedAt: 1,
}

const parameters = {
  temperature: 0,
  topP: 1,
  maxTokens: 10,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

describe('costControls', () => {
  it('estimates tokens by trimmed character length', () => {
    expect(estimateTokenCount('')).toBe(0)
    expect(estimateTokenCount(' 12345 ')).toBe(2)
  })

  it('formats tiny and regular costs consistently', () => {
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(0.00001)).toBe('<$0.0001')
    expect(formatCost(0.0042)).toBe('$0.0042')
    expect(formatCost(1.234)).toBe('$1.23')
  })

  it('estimates standard benchmark cost including LLM judge work', () => {
    const estimate = estimateStandardRunCost({
      testSuite,
      modelIds: ['provider/cheap'],
      availableModels: [cheapModel, judgeModel],
      parameters,
      runCount: 2,
      judgeModelId: 'provider/judge',
    })

    expect(estimate).toBeGreaterThan(0)
    expect(estimate).toBeCloseTo(4.204, 3)
  })

  it('estimates Code Arena cost including judge fanout', () => {
    const estimate = estimateCodeArenaRunCost({
      prompt: 'Build a button',
      systemPrompt: 'Return complete HTML',
      modelIds: ['provider/cheap', 'provider/cheap'],
      availableModels: [cheapModel, judgeModel],
      parameters,
      judgeEnabled: true,
      judgeModelId: 'provider/judge',
    })

    expect(estimate).toBeCloseTo(4.172, 3)
  })

  it('only blocks over-budget runs when a positive cap is configured', () => {
    expect(isOverBudget(10, 0)).toBe(false)
    expect(isOverBudget(10, 10)).toBe(false)
    expect(isOverBudget(10.01, 10)).toBe(true)
  })
})
