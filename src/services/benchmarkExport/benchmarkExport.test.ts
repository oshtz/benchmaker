import { describe, expect, it } from 'vitest'
import {
  buildBenchmarkExportDocument,
  generateScientificHtml,
  generateShareImageSvg,
} from '.'
import type { BenchmarkExportOptions } from './types'
import type { RunResult, TestSuite } from '@/types'

const options: BenchmarkExportOptions = {
  mode: 'scientific',
  imagePreset: 'square',
  imageTemplate: 'classic',
  imageVariant: 'leaderboard',
  imageTheme: 'dark',
  includeRawResponses: true,
  includeExpectedOutputs: true,
  includeSystemPrompt: false,
  includeJudgePrompt: false,
  includeScoringNotes: true,
  includeCostTokens: true,
  includeMultiRunAnalysis: true,
  anonymizeModelIds: false,
}

const suite: TestSuite = {
  id: 'suite-1',
  name: 'Math <Suite>',
  description: 'Simple arithmetic',
  systemPrompt: 'Answer directly.',
  judgeSystemPrompt: 'Judge correctness.',
  createdAt: 100,
  updatedAt: 100,
  testCases: [
    {
      id: 'case-1',
      prompt: 'What is 2 + 2?',
      expectedOutput: '4',
      scoringMethod: 'exact-match',
      weight: 2,
      metadata: { category: 'math', difficulty: 'easy', tags: ['arithmetic'] },
    },
    {
      id: 'case-2',
      prompt: 'What is 10 / 2?',
      expectedOutput: '5',
      scoringMethod: 'numeric-tolerance',
      weight: 1,
      metadata: { tags: [] },
    },
  ],
}

const run: RunResult = {
  id: 'run-1',
  testSuiteId: suite.id,
  testSuiteName: suite.name,
  testSuiteSnapshot: {
    name: suite.name,
    description: suite.description,
    systemPrompt: suite.systemPrompt,
    judgeSystemPrompt: suite.judgeSystemPrompt,
    testCases: suite.testCases,
  },
  models: ['provider/model-a', 'provider/model-b'],
  parameters: {
    temperature: 0,
    topP: 1,
    maxTokens: 512,
    frequencyPenalty: 0,
    presencePenalty: 0,
    benchmarkMode: true,
  },
  results: [
    {
      testCaseId: 'case-1',
      modelId: 'provider/model-a',
      response: '4',
      status: 'completed',
      score: { score: 1, notes: 'correct' },
      latencyMs: 1000,
      promptTokens: 10,
      completionTokens: 2,
      cost: 0.00001,
    },
    {
      testCaseId: 'case-2',
      modelId: 'provider/model-a',
      response: '6',
      status: 'completed',
      score: { score: 0 },
      latencyMs: 1400,
      promptTokens: 10,
      completionTokens: 2,
      cost: 0.00001,
    },
    {
      testCaseId: 'case-1',
      modelId: 'provider/model-b',
      response: '<script>alert(1)</script>',
      status: 'completed',
      score: { score: 0.5 },
      latencyMs: 800,
    },
  ],
  status: 'completed',
  startedAt: 1000,
  completedAt: 5000,
}

describe('benchmark export document', () => {
  it('ranks by effective score and treats missing scores as zero', () => {
    const document = buildBenchmarkExportDocument({
      run,
      testSuites: [suite],
      allRuns: [run],
      options,
      generatedAt: 10_000,
    })

    expect(document.suite.source).toBe('run-snapshot')
    expect(document.modelRows[0].modelId).toBe('provider/model-a')
    expect(document.modelRows[0].effectiveScore).toBeCloseTo(2 / 3)
    expect(document.modelRows[1].effectiveScore).toBeCloseTo(1 / 3)
    expect(document.modelRows[1].coverage).toBeCloseTo(0.5)
    expect(document.caveats).toContain('Some expected model/test cells do not have scores. Effective score treats missing or unscored cells as zero.')
  })

  it('escapes HTML report content', () => {
    const document = buildBenchmarkExportDocument({
      run,
      testSuites: [suite],
      allRuns: [run],
      options,
      generatedAt: 10_000,
    })

    const html = generateScientificHtml(document)

    expect(html).toContain('Math &lt;Suite&gt;')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('uses the branded report layout for HTML exports', () => {
    const document = buildBenchmarkExportDocument({
      run,
      testSuites: [suite],
      allRuns: [run],
      options,
      generatedAt: 10_000,
    })

    const html = generateScientificHtml(document)

    expect(html).toContain('class="app-icon"')
    expect(html).toContain('class="accent-rule"')
    expect(html).toContain('linear-gradient(90deg, var(--accent), var(--accent-2))')
    expect(html).toContain('class="leader-row"')
  })

  it('keeps share images prompt-free and supports anonymized labels', () => {
    const document = buildBenchmarkExportDocument({
      run,
      testSuites: [suite],
      allRuns: [run],
      options: { ...options, mode: 'share-image', anonymizeModelIds: true },
      generatedAt: 10_000,
    })

    const svg = generateShareImageSvg(document)

    expect(svg).toContain('Model 1')
    expect(svg).not.toContain('What is 2 + 2?')
    expect(svg).not.toContain('provider/model-a')
  })

  it('generates reference-style social cards', () => {
    const document = buildBenchmarkExportDocument({
      run,
      testSuites: [suite],
      allRuns: [run],
      options: {
        ...options,
        mode: 'share-image',
        imagePreset: 'story',
        imageTemplate: 'social-card',
        imageVariant: 'h2h',
        imageTheme: 'light',
      },
      generatedAt: 10_000,
    })

    const svg = generateShareImageSvg(document)

    expect(svg).toContain('width="1080" height="1920"')
    expect(svg).toContain('HEAD TO HEAD')
    expect(svg).toContain('MATH &lt;SUITE&gt;')
    expect(svg).not.toContain('What is 2 + 2?')
  })
})
