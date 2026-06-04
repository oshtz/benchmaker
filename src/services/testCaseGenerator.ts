import type { ScoringMethod, TestCase } from '@/types'
import { getOpenRouterClient } from '@/services/openrouter'

export interface GeneratedTestCase {
  prompt: string
  expectedOutput?: string
  scoringMethod?: ScoringMethod
  metadata?: {
    category?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    tags?: string[]
  }
}

interface GenerateTestCasesInput {
  apiKey: string
  modelId: string
  count: number
  systemPrompt: string
  existingTestCases: TestCase[]
  additionalNotes?: string
}

const ALLOWED_METHODS: ScoringMethod[] = [
  'exact-match',
  'regex-match',
  'numeric-tolerance',
  'boolean',
  'llm-judge',
]

export async function generateTestCases({
  apiKey,
  modelId,
  count,
  systemPrompt,
  existingTestCases,
  additionalNotes,
}: GenerateTestCasesInput): Promise<GeneratedTestCase[]> {
  const client = getOpenRouterClient(apiKey)

  const completion = await client.createChatCompletion({
    model: modelId,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserPrompt({
          count,
          systemPrompt,
          existingTestCases,
          additionalNotes,
        }),
      },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  })

  const response = completion.choices[0]?.message?.content || ''
  const parsed = extractGeneratedCases(response)

  return parsed
    .map((item) => normalizeGeneratedCase(item))
    .filter((item): item is GeneratedTestCase => item !== null)
}

function buildSystemPrompt(): string {
  return `You are a benchmark designer. Generate high-quality LLM test cases based on a system prompt and existing examples.

Return ONLY valid JSON. Do not include markdown, code fences, or extra text.`
}

function buildUserPrompt({
  count,
  systemPrompt,
  existingTestCases,
  additionalNotes,
}: {
  count: number
  systemPrompt: string
  existingTestCases: TestCase[]
  additionalNotes?: string
}): string {
  const existingSummary = summarizeTestCases(existingTestCases)
  const notesBlock = additionalNotes?.trim()
    ? `\nAdditional Notes:\n${additionalNotes.trim()}\n`
    : ''

  return `System Prompt:
${systemPrompt || '(none)'}

Existing Test Cases (${existingTestCases.length}):
${existingSummary}
${notesBlock}
Instructions:
- Generate ${count} NEW test cases that complement (not repeat) the existing ones.
- Keep prompts concise and unambiguous.
- Use one of these scoring methods only: ${ALLOWED_METHODS.join(', ')}.
- If scoring method is "regex-match", set expectedOutput to a regex pattern string.
- If scoring method is "numeric-tolerance", set expectedOutput to a single number.
- If scoring method is "boolean", set expectedOutput to a substring to check (or omit to allow auto-pass).
- If scoring method is "llm-judge", expectedOutput may be omitted or used as reference.
- Include optional metadata: category, difficulty (easy|medium|hard), tags.

Output JSON array in this exact shape:
[
  {
    "prompt": "string",
    "expectedOutput": "string or omitted",
    "scoringMethod": "exact-match | regex-match | numeric-tolerance | boolean | llm-judge",
    "metadata": {
      "category": "optional string",
      "difficulty": "easy|medium|hard",
      "tags": ["optional", "array"]
    }
  }
]`
}

function summarizeTestCases(testCases: TestCase[]): string {
  if (testCases.length === 0) {
    return '(none)'
  }

  const limit = 8
  const lines = testCases.slice(0, limit).map((testCase, index) => {
    const prompt = truncate(testCase.prompt, 140)
    const expected = testCase.expectedOutput
      ? truncate(testCase.expectedOutput, 80)
      : 'none'
    return `${index + 1}. Prompt: "${prompt}" | Scoring: ${testCase.scoringMethod} | Expected: "${expected}"`
  })

  if (testCases.length > limit) {
    lines.push(`...and ${testCases.length - limit} more.`)
  }

  return lines.join('\n')
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 3)}...`
}

function extractGeneratedCases(raw: string): GeneratedTestCase[] {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    const parsed = safeJsonParse(arrayMatch[0])
    if (Array.isArray(parsed)) {
      return parsed as GeneratedTestCase[]
    }
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    const parsed = safeJsonParse(objectMatch[0]) as
      | { testCases?: GeneratedTestCase[]; testcases?: GeneratedTestCase[] }
      | GeneratedTestCase[]
      | null
    if (Array.isArray(parsed)) return parsed
    if (parsed?.testCases && Array.isArray(parsed.testCases)) {
      return parsed.testCases
    }
    if (parsed?.testcases && Array.isArray(parsed.testcases)) {
      return parsed.testcases
    }
  }

  return []
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeGeneratedCase(item: GeneratedTestCase): GeneratedTestCase | null {
  if (!item || !item.prompt || typeof item.prompt !== 'string') {
    return null
  }

  const scoringMethod = isValidScoringMethod(item.scoringMethod)
    ? item.scoringMethod
    : 'exact-match'

  const metadata = item.metadata
    ? {
        category: item.metadata.category?.trim() || undefined,
        difficulty: item.metadata.difficulty || undefined,
        tags: Array.isArray(item.metadata.tags)
          ? item.metadata.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [],
      }
    : undefined

  return {
    prompt: item.prompt.trim(),
    expectedOutput: item.expectedOutput?.trim() || undefined,
    scoringMethod,
    metadata,
  }
}

function isValidScoringMethod(method?: string): method is ScoringMethod {
  if (!method) return false
  return ALLOWED_METHODS.includes(method as ScoringMethod)
}
