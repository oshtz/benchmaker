import { describe, expect, it } from 'vitest'
import { normalizeSnapshot } from './localDb'
import type { BenchmakerDb } from '@/types'

describe('normalizeSnapshot', () => {
  it('rejects payloads without the required benchmark arrays', () => {
    expect(normalizeSnapshot({ testSuites: [] } as Partial<BenchmakerDb>)).toBeNull()
  })

  it('fills Code Arena fields for pre-v3 snapshots', () => {
    const normalized = normalizeSnapshot({
      version: 2,
      updatedAt: 123,
      testSuites: [],
      runs: [],
      activeTestSuiteId: null,
      currentRunId: null,
    } as Partial<BenchmakerDb>)

    expect(normalized).toMatchObject({
      version: 2,
      codeArenaRuns: [],
      currentCodeArenaRunId: null,
    })
  })

  it('preserves Code Arena runs when present', () => {
    const normalized = normalizeSnapshot({
      version: 3,
      updatedAt: 123,
      testSuites: [],
      runs: [],
      codeArenaRuns: [
        {
          id: 'code-run-1',
          type: 'code-arena',
          prompt: 'Build a button',
          systemPrompt: '',
          models: ['model/a'],
          parameters: {
            temperature: 0,
            topP: 1,
            maxTokens: 1024,
            frequencyPenalty: 0,
            presencePenalty: 0,
          },
          outputs: [],
          status: 'completed',
          startedAt: 100,
          completedAt: 200,
        },
      ],
      activeTestSuiteId: null,
      currentRunId: null,
      currentCodeArenaRunId: 'code-run-1',
    })

    expect(normalized?.codeArenaRuns).toHaveLength(1)
    expect(normalized?.currentCodeArenaRunId).toBe('code-run-1')
  })
})
