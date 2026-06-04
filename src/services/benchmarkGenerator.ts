import type { ScoringMethod } from '@/types'
import { getOpenRouterClient } from '@/services/openrouter'

export interface GeneratedBenchmark {
  name: string
  description: string
  systemPrompt: string
  judgeSystemPrompt: string
  testCases: GeneratedTestCase[]
}

interface GeneratedTestCase {
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

interface GenerateBenchmarkInput {
  apiKey: string
  modelId: string
  name: string
  description: string
  testCaseCount?: number
}

const ALLOWED_METHODS: ScoringMethod[] = [
  'exact-match',
  'regex-match',
  'numeric-tolerance',
  'boolean',
  'llm-judge',
]

export async function generateBenchmark({
  apiKey,
  modelId,
  name,
  description,
  testCaseCount = 10,
}: GenerateBenchmarkInput): Promise<GeneratedBenchmark> {
  const client = getOpenRouterClient(apiKey)

  const completion = await client.createChatCompletion({
    model: modelId,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserPrompt({ name, description, testCaseCount }),
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  })

  const response = completion.choices[0]?.message?.content || ''
  return parseGeneratedBenchmark(response, name, description)
}

function buildSystemPrompt(): string {
  return `You are an expert benchmark designer for evaluating Large Language Models. Your task is to create comprehensive, well-structured benchmarks that effectively test LLM capabilities.

## Your Role
Given a benchmark name and description, you will generate:
1. A detailed system prompt that sets up the evaluation context
2. A judge system prompt for LLM-based evaluation
3. A diverse set of test cases with appropriate scoring methods

## Principles for Benchmark Design

### System Prompt Design
- Be specific about the role, context, and expected behavior
- Include clear constraints and formatting requirements
- Define the scope of acceptable responses
- Avoid ambiguity that could lead to inconsistent scoring
- Include examples if they help clarify expectations

### Judge System Prompt Design
The judge prompt should:
- Establish clear evaluation criteria with specific dimensions to assess
- Define a 0-10 scoring scale with concrete anchor points
- Require structured JSON output: {"score": number, "reasoning": string}
- Focus on objective, measurable qualities when possible
- Account for partial credit scenarios
- Penalize common failure modes (hallucination, irrelevance, incompleteness)

### Test Case Design
Create diverse test cases that:
- Cover different difficulty levels (easy, medium, hard)
- Test various aspects of the capability being evaluated
- Include edge cases and potential failure modes
- Have clear, unambiguous expected outputs when applicable
- Use appropriate scoring methods for each case type

### Scoring Method Selection
Choose the most appropriate method for each test case:

1. **exact-match**: For questions with single correct answers (facts, definitions, calculations)
   - Best for: factual recall, precise terminology, specific formats
   - expectedOutput: The exact correct answer

2. **regex-match**: For answers matching specific patterns
   - Best for: formatted outputs (dates, codes, structured data)
   - expectedOutput: A regex pattern like "/pattern/flags"

3. **numeric-tolerance**: For numerical answers with acceptable variance
   - Best for: calculations, estimations, measurements
   - expectedOutput: The expected number (tolerance is applied automatically)

4. **boolean**: For checking presence of key information
   - Best for: checking if specific concepts/keywords are mentioned
   - expectedOutput: The substring that must be present

5. **llm-judge**: For subjective or complex evaluations
   - Best for: creative tasks, explanations, analysis, open-ended responses
   - expectedOutput: Can include reference material or criteria for the judge

### Weight Assignment
- Assign weights 0.5-2.0 based on importance and difficulty
- Core competency tests: weight 1.5-2.0
- Standard tests: weight 1.0
- Edge cases or bonus tests: weight 0.5-1.0

### Categories and Tags
- Group related test cases with meaningful categories
- Use tags to enable filtering and analysis (e.g., ["reasoning", "math", "multi-step"])

## Output Format
Return ONLY valid JSON (no markdown fences or extra text) in this exact structure:

{
  "systemPrompt": "The complete system prompt for the benchmark...",
  "judgeSystemPrompt": "The complete judge system prompt for LLM-based evaluation...",
  "testCases": [
    {
      "prompt": "The test question or task",
      "expectedOutput": "Expected answer (if applicable)",
      "scoringMethod": "exact-match|regex-match|numeric-tolerance|boolean|llm-judge",
      "weight": 1.0,
      "metadata": {
        "category": "Category name",
        "difficulty": "easy|medium|hard",
        "tags": ["tag1", "tag2"]
      }
    }
  ]
}`
}

function buildUserPrompt({
  name,
  description,
  testCaseCount,
}: {
  name: string
  description: string
  testCaseCount: number
}): string {
  return `Create a complete benchmark for evaluating LLMs with the following specifications:

## Benchmark Name
${name}

## Benchmark Description
${description}

## Requirements
- Generate exactly ${testCaseCount} test cases
- Include a mix of difficulty levels (roughly 30% easy, 50% medium, 20% hard)
- Use a variety of scoring methods appropriate to each test case
- Create test cases that thoroughly evaluate the described capability
- Ensure test cases are diverse and non-redundant
- Make the system prompt detailed enough to guide model behavior
- Make the judge prompt comprehensive enough for fair evaluation

Generate the complete benchmark now.`
}

function parseGeneratedBenchmark(
  raw: string,
  name: string,
  description: string
): GeneratedBenchmark {
  // Clean up response - remove markdown fences if present
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

  // Try to extract JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse benchmark: No JSON object found in response')
  }

  let parsed: {
    systemPrompt?: string
    judgeSystemPrompt?: string
    testCases?: GeneratedTestCase[]
  }

  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    throw new Error(`Failed to parse benchmark JSON: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // Validate required fields
  if (!parsed.systemPrompt || typeof parsed.systemPrompt !== 'string') {
    throw new Error('Generated benchmark is missing a valid systemPrompt')
  }

  if (!parsed.judgeSystemPrompt || typeof parsed.judgeSystemPrompt !== 'string') {
    throw new Error('Generated benchmark is missing a valid judgeSystemPrompt')
  }

  if (!Array.isArray(parsed.testCases) || parsed.testCases.length === 0) {
    throw new Error('Generated benchmark is missing valid testCases')
  }

  // Normalize and validate test cases
  const normalizedTestCases = parsed.testCases
    .map((tc) => normalizeTestCase(tc))
    .filter((tc): tc is GeneratedTestCase => tc !== null)

  if (normalizedTestCases.length === 0) {
    throw new Error('No valid test cases could be extracted from the response')
  }

  return {
    name,
    description,
    systemPrompt: parsed.systemPrompt.trim(),
    judgeSystemPrompt: parsed.judgeSystemPrompt.trim(),
    testCases: normalizedTestCases,
  }
}

function normalizeTestCase(item: Partial<GeneratedTestCase>): GeneratedTestCase | null {
  if (!item || !item.prompt || typeof item.prompt !== 'string') {
    return null
  }

  const scoringMethod = isValidScoringMethod(item.scoringMethod)
    ? item.scoringMethod
    : 'llm-judge'

  const weight = typeof item.weight === 'number' && item.weight > 0 && item.weight <= 10
    ? item.weight
    : 1.0

  const difficulty = isValidDifficulty(item.metadata?.difficulty)
    ? item.metadata.difficulty
    : 'medium'

  return {
    prompt: item.prompt.trim(),
    expectedOutput: item.expectedOutput?.toString().trim() || undefined,
    scoringMethod,
    weight,
    metadata: {
      category: item.metadata?.category?.trim() || undefined,
      difficulty,
      tags: Array.isArray(item.metadata?.tags)
        ? item.metadata.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [],
    },
  }
}

function isValidScoringMethod(method?: string): method is ScoringMethod {
  if (!method) return false
  return ALLOWED_METHODS.includes(method as ScoringMethod)
}

function isValidDifficulty(
  difficulty?: string
): difficulty is 'easy' | 'medium' | 'hard' {
  return difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard'
}
