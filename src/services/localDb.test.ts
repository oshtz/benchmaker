import { describe, expect, it } from 'vitest'
import { buildSnapshotChangeSet, normalizeSnapshot } from './localDb'
import type { BenchmakerDb, CodeArenaRun, RunResult, TestSuite } from '@/types'

const baseParameters = {
  temperature: 0,
  topP: 1,
  maxTokens: 1024,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

const suite: TestSuite = {
  id: 'suite-1',
  name: 'Suite 1',
  systemPrompt: '',
  testCases: [],
  createdAt: 100,
  updatedAt: 100,
}

const run: RunResult = {
  id: 'run-1',
  testSuiteId: 'suite-1',
  testSuiteName: 'Suite 1',
  models: ['model/a'],
  parameters: baseParameters,
  results: [],
  status: 'completed',
  startedAt: 200,
}

const codeArenaRun: CodeArenaRun = {
  id: 'code-run-1',
  type: 'code-arena',
  prompt: 'Build a button',
  systemPrompt: '',
  models: ['model/a'],
  parameters: baseParameters,
  outputs: [],
  status: 'completed',
  startedAt: 300,
}

function db(overrides: Partial<BenchmakerDb> = {}): BenchmakerDb {
  return {
    version: 3,
    updatedAt: 123,
    testSuites: [suite],
    runs: [run],
    codeArenaRuns: [codeArenaRun],
    activeTestSuiteId: 'suite-1',
    currentRunId: 'run-1',
    currentCodeArenaRunId: 'code-run-1',
    ...overrides,
  }
}

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

describe('buildSnapshotChangeSet', () => {
  it('saves every entity and app state for an initial snapshot', () => {
    const changes = buildSnapshotChangeSet(null, db())

    expect(changes.deletedTestSuiteIds).toEqual([])
    expect(changes.deletedRunIds).toEqual([])
    expect(changes.deletedCodeArenaRunIds).toEqual([])
    expect(changes.savedTestSuites).toEqual([suite])
    expect(changes.savedRuns).toEqual([run])
    expect(changes.savedCodeArenaRuns).toEqual([codeArenaRun])
    expect(changes.appStateChanged).toBe(true)
  })

  it('only reports changed and deleted rows after the first snapshot', () => {
    const nextSuite = { ...suite, name: 'Renamed suite', updatedAt: 200 }
    const next = db({
      testSuites: [nextSuite],
      runs: [],
      codeArenaRuns: [codeArenaRun],
      currentRunId: null,
    })

    const changes = buildSnapshotChangeSet(db(), next)

    expect(changes.deletedTestSuiteIds).toEqual([])
    expect(changes.deletedRunIds).toEqual(['run-1'])
    expect(changes.deletedCodeArenaRunIds).toEqual([])
    expect(changes.savedTestSuites).toEqual([nextSuite])
    expect(changes.savedRuns).toEqual([])
    expect(changes.savedCodeArenaRuns).toEqual([])
    expect(changes.appStateChanged).toBe(true)
  })
})
