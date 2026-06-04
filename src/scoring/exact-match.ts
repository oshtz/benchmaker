import type { ScoringResult } from '@/types'

export function scoreExactMatch(response: string, expected: string): ScoringResult {
  const result = _scoreExactMatch(response, expected)
  return {
    ...result,
    rawScore: Math.round(result.score * 100),
    maxScore: 100,
  }
}

function _scoreExactMatch(response: string, expected: string): ScoringResult {
  if (!expected) {
    return {
      score: 1,
      notes: 'No expected output specified',
    }
  }

  const normalizedResponse = response.trim()
  const normalizedExpected = expected.trim()

  // Exact match
  if (normalizedResponse === normalizedExpected) {
    return {
      score: 1,
      confidence: 1,
      notes: 'Exact match',
    }
  }

  // Case-insensitive match
  if (normalizedResponse.toLowerCase() === normalizedExpected.toLowerCase()) {
    return {
      score: 0.95, // Very high but not perfect (case matters slightly)
      confidence: 1,
      notes: 'Case-insensitive match',
    }
  }

  // Calculate similarity using Levenshtein distance
  const similarity = calculateSimilarity(normalizedResponse, normalizedExpected)
  
  // Check if response contains the expected (for longer responses)
  // Score based on how much extra content surrounds the expected output
  if (normalizedResponse.includes(normalizedExpected)) {
    // Penalize based on how much extra content there is
    const extraContentRatio = 1 - (normalizedExpected.length / normalizedResponse.length)
    // Score from 0.95 (exact length match) down to 0.6 (lots of extra content)
    const containsScore = Math.max(0.6, 0.95 - (extraContentRatio * 0.35))
    return {
      score: containsScore,
      confidence: 0.9,
      notes: `Expected output found within response (${(extraContentRatio * 100).toFixed(0)}% extra content)`,
    }
  }

  // Case-insensitive contains check
  if (normalizedResponse.toLowerCase().includes(normalizedExpected.toLowerCase())) {
    const extraContentRatio = 1 - (normalizedExpected.length / normalizedResponse.length)
    const containsScore = Math.max(0.55, 0.90 - (extraContentRatio * 0.35))
    return {
      score: containsScore,
      confidence: 0.85,
      notes: `Expected output found (case-insensitive, ${(extraContentRatio * 100).toFixed(0)}% extra content)`,
    }
  }

  // Use similarity for partial matches - continuous scoring
  // Similarity of 1.0 = perfect match, 0.0 = completely different
  if (similarity > 0.5) {
    // Scale similarity to 0-0.7 range for partial matches
    // This ensures partial matches never score higher than contains matches
    const score = similarity * 0.7
    return {
      score,
      confidence: Math.max(0.4, similarity * 0.8),
      notes: `Partial similarity: ${(similarity * 100).toFixed(1)}%`,
    }
  }

  // Very low similarity - use raw similarity scaled down
  if (similarity > 0.2) {
    return {
      score: similarity * 0.4, // Max 0.2 score for low similarity
      confidence: 0.3,
      notes: `Low similarity: ${(similarity * 100).toFixed(1)}%`,
    }
  }

  return {
    score: 0,
    confidence: 1,
    notes: 'No match',
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // Create a matrix to store distances
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        )
      }
    }
  }

  return dp[m][n]
}
