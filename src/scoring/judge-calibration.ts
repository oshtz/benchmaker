import { scoreLLMJudge } from './llm-judge'
import type { OpenRouterClient } from '@/services/openrouter'

/**
 * Reference sample for judge calibration
 * Contains known-good evaluations to measure judge accuracy
 */
export interface CalibrationSample {
  id: string
  prompt: string
  response: string
  expectedOutput?: string
  expectedScore: number  // Known correct score (0-1)
  tolerance: number      // Acceptable deviation (e.g., 0.1 = ±10%)
  category: string       // e.g., 'factual', 'creative', 'code'
}

/**
 * Result of calibrating a judge against reference samples
 */
export interface CalibrationResult {
  judgeModelId: string
  timestamp: number
  samples: CalibrationSampleResult[]
  summary: {
    totalSamples: number
    passedSamples: number
    passRate: number         // Percentage within tolerance
    meanAbsoluteError: number  // Average |expected - actual|
    maxError: number
    bias: number             // Average (actual - expected), positive = overscoring
    correlation: number      // Pearson correlation coefficient
  }
}

export interface CalibrationSampleResult {
  sampleId: string
  expectedScore: number
  actualScore: number
  error: number           // actual - expected
  absoluteError: number
  withinTolerance: boolean
  notes?: string
}

/**
 * Default calibration samples covering different response types
 */
export const DEFAULT_CALIBRATION_SAMPLES: CalibrationSample[] = [
  {
    id: 'perfect-factual',
    prompt: 'What is 2 + 2?',
    response: '4',
    expectedOutput: '4',
    expectedScore: 1.0,
    tolerance: 0.1,
    category: 'factual',
  },
  {
    id: 'wrong-factual',
    prompt: 'What is 2 + 2?',
    response: '5',
    expectedOutput: '4',
    expectedScore: 0.0,
    tolerance: 0.15,
    category: 'factual',
  },
  {
    id: 'partial-factual',
    prompt: 'What is the capital of France?',
    response: 'Paris is a major city in France known for the Eiffel Tower.',
    expectedOutput: 'Paris',
    expectedScore: 0.8,
    tolerance: 0.15,
    category: 'factual',
  },
  {
    id: 'verbose-correct',
    prompt: 'What is 10 * 5?',
    response: 'To calculate 10 multiplied by 5, we need to add 10 five times: 10 + 10 + 10 + 10 + 10 = 50. Therefore, 10 * 5 = 50.',
    expectedOutput: '50',
    expectedScore: 0.9,
    tolerance: 0.1,
    category: 'factual',
  },
  {
    id: 'empty-response',
    prompt: 'What is the meaning of life?',
    response: '',
    expectedScore: 0.0,
    tolerance: 0.05,
    category: 'empty',
  },
  {
    id: 'irrelevant-response',
    prompt: 'What is the speed of light?',
    response: 'I like pizza.',
    expectedOutput: '299,792,458 meters per second',
    expectedScore: 0.0,
    tolerance: 0.1,
    category: 'irrelevant',
  },
  {
    id: 'good-explanation',
    prompt: 'Explain why the sky is blue in simple terms.',
    response: 'The sky appears blue because of a phenomenon called Rayleigh scattering. When sunlight enters Earth\'s atmosphere, it collides with gas molecules. Blue light has a shorter wavelength, so it gets scattered more than other colors, making the sky look blue to us.',
    expectedScore: 0.9,
    tolerance: 0.1,
    category: 'explanation',
  },
  {
    id: 'mediocre-explanation',
    prompt: 'Explain why the sky is blue in simple terms.',
    response: 'The sky is blue because of the sun and the air.',
    expectedScore: 0.4,
    tolerance: 0.2,
    category: 'explanation',
  },
]

/**
 * Run calibration tests against a judge model
 */
export async function calibrateJudge(
  client: OpenRouterClient,
  judgeModelId: string,
  samples: CalibrationSample[] = DEFAULT_CALIBRATION_SAMPLES,
  judgeSystemPrompt?: string
): Promise<CalibrationResult> {
  const results: CalibrationSampleResult[] = []

  for (const sample of samples) {
    try {
      const scoringResult = await scoreLLMJudge(
        sample.prompt,
        sample.response,
        sample.expectedOutput,
        client,
        judgeModelId,
        judgeSystemPrompt
      )

      const actualScore = scoringResult.score
      const error = actualScore - sample.expectedScore
      const absoluteError = Math.abs(error)
      const withinTolerance = absoluteError <= sample.tolerance

      results.push({
        sampleId: sample.id,
        expectedScore: sample.expectedScore,
        actualScore,
        error,
        absoluteError,
        withinTolerance,
        notes: scoringResult.notes,
      })
    } catch (error) {
      results.push({
        sampleId: sample.id,
        expectedScore: sample.expectedScore,
        actualScore: 0,
        error: -sample.expectedScore,
        absoluteError: sample.expectedScore,
        withinTolerance: false,
        notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  // Calculate summary statistics
  const passedSamples = results.filter(r => r.withinTolerance).length
  const meanAbsoluteError = results.reduce((sum, r) => sum + r.absoluteError, 0) / results.length
  const maxError = Math.max(...results.map(r => r.absoluteError))
  const bias = results.reduce((sum, r) => sum + r.error, 0) / results.length

  // Calculate Pearson correlation
  const correlation = calculateCorrelation(
    results.map(r => r.expectedScore),
    results.map(r => r.actualScore)
  )

  return {
    judgeModelId,
    timestamp: Date.now(),
    samples: results,
    summary: {
      totalSamples: results.length,
      passedSamples,
      passRate: passedSamples / results.length,
      meanAbsoluteError,
      maxError,
      bias,
      correlation,
    },
  }
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return 0
  return numerator / denominator
}

/**
 * Interpret calibration results
 */
export function interpretCalibrationResult(result: CalibrationResult): {
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  recommendation: string
  details: string[]
} {
  const { summary } = result
  const details: string[] = []

  // Assess overall quality
  let quality: 'excellent' | 'good' | 'fair' | 'poor'
  
  if (summary.passRate >= 0.9 && summary.meanAbsoluteError <= 0.1 && summary.correlation >= 0.9) {
    quality = 'excellent'
  } else if (summary.passRate >= 0.75 && summary.meanAbsoluteError <= 0.15 && summary.correlation >= 0.8) {
    quality = 'good'
  } else if (summary.passRate >= 0.5 && summary.meanAbsoluteError <= 0.25 && summary.correlation >= 0.6) {
    quality = 'fair'
  } else {
    quality = 'poor'
  }

  // Generate details
  details.push(`Pass rate: ${(summary.passRate * 100).toFixed(1)}% (${summary.passedSamples}/${summary.totalSamples} within tolerance)`)
  details.push(`Mean absolute error: ${(summary.meanAbsoluteError * 100).toFixed(1)}%`)
  details.push(`Max error: ${(summary.maxError * 100).toFixed(1)}%`)
  details.push(`Correlation: ${summary.correlation.toFixed(3)}`)
  
  if (summary.bias > 0.05) {
    details.push(`Bias: +${(summary.bias * 100).toFixed(1)}% (tends to overscore)`)
  } else if (summary.bias < -0.05) {
    details.push(`Bias: ${(summary.bias * 100).toFixed(1)}% (tends to underscore)`)
  } else {
    details.push(`Bias: ${(summary.bias * 100).toFixed(1)}% (minimal)`)
  }

  // Generate recommendation
  let recommendation: string
  switch (quality) {
    case 'excellent':
      recommendation = 'This judge model is highly reliable for scoring. Results can be trusted with minimal variance.'
      break
    case 'good':
      recommendation = 'This judge model is reliable for most use cases. Consider running 2-3 times for LLM-judged critical tasks.'
      break
    case 'fair':
      recommendation = 'This judge model shows moderate reliability. Run 3-5 times and average scores for better accuracy.'
      break
    case 'poor':
      recommendation = 'This judge model is unreliable. Consider using a different judge model or deterministic scoring methods.'
      break
  }

  return { quality, recommendation, details }
}
