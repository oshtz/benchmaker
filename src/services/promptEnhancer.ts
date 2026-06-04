import type { TestCase } from '@/types'
import { getOpenRouterClient } from '@/services/openrouter'

export type PromptEnhancerTarget = 'system' | 'judge'

interface EnhancePromptInput {
  apiKey: string
  modelId: string
  target: PromptEnhancerTarget
  currentPrompt: string
  systemPrompt?: string
  existingTestCases?: TestCase[]
  notes?: string
}

export async function enhancePrompt({
  apiKey,
  modelId,
  target,
  currentPrompt,
  systemPrompt,
  existingTestCases = [],
  notes,
}: EnhancePromptInput): Promise<string> {
  const client = getOpenRouterClient(apiKey)

  const completion = await client.createChatCompletion({
    model: modelId,
    messages: [
      { role: 'system', content: buildEnhancerSystemPrompt(target) },
      {
        role: 'user',
        content: buildEnhancerUserPrompt({
          target,
          currentPrompt,
          systemPrompt,
          existingTestCases,
          notes,
        }),
      },
    ],
    temperature: 0.3,
    max_tokens: 900,
  })

  const response = completion.choices[0]?.message?.content || ''
  return sanitizePrompt(response)
}

function buildEnhancerSystemPrompt(target: PromptEnhancerTarget): string {
  const base = `You are a senior prompt engineer. Improve prompts for clarity, determinism, and evaluation rigor.

Requirements:
- Preserve any explicit output format or constraints.
- Keep the prompt concise and structured.
- Do not include markdown fences or extra commentary.
- Output only the improved prompt text.`

  if (target === 'judge') {
    return `${base}
- This prompt is an add-on to a fixed judge rubric, so avoid restating global scoring rules.
- Ensure consistent scoring and reproducibility.`
  }

  return base
}

function buildEnhancerUserPrompt({
  target,
  currentPrompt,
  systemPrompt,
  existingTestCases,
  notes,
}: {
  target: PromptEnhancerTarget
  currentPrompt: string
  systemPrompt?: string
  existingTestCases: TestCase[]
  notes?: string
}): string {
  const testCaseSummary = summarizeTestCases(existingTestCases)
  const notesBlock = notes?.trim() ? `\nNotes:\n${notes.trim()}\n` : ''

  if (target === 'judge') {
    return `Target: Judge prompt add-on

Current judge prompt:
${currentPrompt || '(none)'}

Related system prompt (if any):
${systemPrompt || '(none)'}
${notesBlock}
Existing test cases:
${testCaseSummary}

Task:
Rewrite the judge prompt add-on so it is precise, deterministic, and aligned to the system prompt and test cases. Preserve any output format.`
  }

  return `Target: System prompt

Current system prompt:
${currentPrompt || '(none)'}
${notesBlock}
Existing test cases:
${testCaseSummary}

Task:
Rewrite the system prompt so it is clear, unambiguous, and sets strong constraints aligned to the existing test cases.`
}

function summarizeTestCases(testCases: TestCase[]): string {
  if (testCases.length === 0) return '(none)'

  const limit = 6
  const lines = testCases.slice(0, limit).map((testCase, index) => {
    const prompt = truncate(testCase.prompt, 120)
    const expected = testCase.expectedOutput
      ? truncate(testCase.expectedOutput, 80)
      : 'none'
    return `${index + 1}. "${prompt}" | ${testCase.scoringMethod} | expected: "${expected}"`
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

function sanitizePrompt(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  let cleaned = trimmed.replace(/```(?:text|markdown)?/gi, '').replace(/```/g, '')
  cleaned = cleaned.trim()

  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim()
  }

  return cleaned
}
