import type { ScoringResult } from '@/types'

export function scoreNumericTolerance(
  response: string,
  expected: string,
  tolerance: number = 0.01
): ScoringResult {
  const result = _scoreNumericTolerance(response, expected, tolerance)
  return {
    ...result,
    rawScore: Math.round(result.score * 100),
    maxScore: 100,
  }
}

function _scoreNumericTolerance(
  response: string,
  expected: string,
  tolerance: number = 0.01
): ScoringResult {
  if (!expected) {
    return {
      score: 1,
      notes: 'No expected value specified',
    }
  }

  // Extract numbers from the response
  const numbersInResponse = extractNumbers(response)
  const expectedNumber = parseFloat(expected)

  if (isNaN(expectedNumber)) {
    return {
      score: 0,
      confidence: 0,
      notes: `Invalid expected number: "${expected}"`,
    }
  }

  if (numbersInResponse.length === 0) {
    return {
      score: 0,
      confidence: 1,
      notes: 'No numbers found in response',
    }
  }

  // Check each number for a match within tolerance
  for (const num of numbersInResponse) {
    const diff = Math.abs(num - expectedNumber)
    const relativeDiff = Math.abs(diff / expectedNumber)

    if (diff <= tolerance || relativeDiff <= tolerance) {
      return {
        score: 1,
        confidence: 1,
        notes: `Exact match: ${num} ≈ ${expectedNumber}`,
      }
    }
  }

  // Find the closest number
  const closest = numbersInResponse.reduce((prev, curr) =>
    Math.abs(curr - expectedNumber) < Math.abs(prev - expectedNumber) ? curr : prev
  )

  const diff = Math.abs(closest - expectedNumber)
  const relativeDiff = expectedNumber !== 0 ? diff / Math.abs(expectedNumber) : diff

  // Continuous scoring based on relative difference
  // Score decreases smoothly from 1.0 to 0 as error increases
  // At 25% error, score is 0. Uses exponential decay for smooth curve.
  if (relativeDiff >= 0.25) {
    return {
      score: 0,
      confidence: 1,
      notes: `No match: closest was ${closest} (expected ${expectedNumber}, diff: ${(relativeDiff * 100).toFixed(1)}%)`,
    }
  }

  // Continuous score: 1.0 at 0% error, decays to 0 at 25% error
  // Using formula: score = 1 - (relativeDiff / 0.25)^0.5 for smooth decay
  // This gives: 0% error = 1.0, 1% = 0.8, 6.25% = 0.5, 25% = 0
  const score = Math.max(0, 1 - Math.pow(relativeDiff / 0.25, 0.5))
  
  // Confidence decreases as the error increases
  const confidence = Math.max(0.5, 1 - relativeDiff * 2)

  return {
    score,
    confidence,
    notes: `${score >= 0.99 ? 'Exact' : score >= 0.8 ? 'Close' : 'Partial'} match: ${closest} (expected ${expectedNumber}, diff: ${(relativeDiff * 100).toFixed(1)}%)`,
  }
}

function extractNumbers(text: string): number[] {
  // Match integers, decimals, negative numbers, and scientific notation
  const regex = /-?\d+\.?\d*(?:[eE][+-]?\d+)?/g
  const matches = text.match(regex) || []
  return matches.map((m) => parseFloat(m)).filter((n) => !isNaN(n))
}