import type { ScoringResult } from '@/types'

export function scoreRegexMatch(response: string, pattern: string): ScoringResult {
  const result = _scoreRegexMatch(response, pattern)
  return {
    ...result,
    rawScore: Math.round(result.score * 100),
    maxScore: 100,
  }
}

function _scoreRegexMatch(response: string, pattern: string): ScoringResult {
  if (!pattern) {
    return {
      score: 1,
      notes: 'No pattern specified',
    }
  }

  try {
    // Parse the pattern - support format: /pattern/flags
    let regexPattern = pattern
    let flags = ''

    if (pattern.startsWith('/')) {
      const lastSlash = pattern.lastIndexOf('/')
      if (lastSlash > 0) {
        regexPattern = pattern.slice(1, lastSlash)
        flags = pattern.slice(lastSlash + 1)
      }
    }

    const regex = new RegExp(regexPattern, flags)
    const matches = response.match(regex)

    if (matches) {
      return {
        score: 1,
        confidence: 1,
        notes: `Pattern matched: "${matches[0]}"`,
      }
    }

    return {
      score: 0,
      confidence: 1,
      notes: 'Pattern did not match',
    }
  } catch (error) {
    return {
      score: 0,
      confidence: 0,
      notes: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}