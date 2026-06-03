import { describe, expect, it } from 'vitest'
import { scoreResponse } from './index'
import type { TestCase } from '@/types'

function testCase(scoringMethod: TestCase['scoringMethod'], expectedOutput = 'yes'): TestCase {
  return {
    id: 'case-1',
    prompt: 'Answer the question.',
    expectedOutput,
    scoringMethod,
    weight: 1,
    metadata: { tags: [] },
  }
}

describe('scoreResponse', () => {
  it('normalizes exact match scores to a 0-100 raw scale', async () => {
    const result = await scoreResponse(testCase('exact-match', 'Paris'), 'Paris')

    expect(result.score).toBe(1)
    expect(result.rawScore).toBe(100)
    expect(result.maxScore).toBe(100)
  })

  it('normalizes boolean matches to a 0-100 raw scale', async () => {
    const pass = await scoreResponse(testCase('boolean', 'green'), 'The answer is green.')
    const fail = await scoreResponse(testCase('boolean', 'green'), 'The answer is blue.')

    expect(pass).toMatchObject({ score: 1, rawScore: 100, maxScore: 100 })
    expect(fail).toMatchObject({ score: 0, rawScore: 0, maxScore: 100 })
  })

  it('scores numeric tolerance matches deterministically', async () => {
    const result = await scoreResponse(testCase('numeric-tolerance', '42'), '42.004')

    expect(result.score).toBe(1)
    expect(result.rawScore).toBe(100)
    expect(result.maxScore).toBe(100)
  })

  it('returns a failed score for invalid regex patterns instead of throwing', async () => {
    const result = await scoreResponse(testCase('regex-match', '['), 'anything')

    expect(result.score).toBe(0)
    expect(result.confidence).toBe(0)
    expect(result.notes).toContain('Invalid regex pattern')
  })
})
