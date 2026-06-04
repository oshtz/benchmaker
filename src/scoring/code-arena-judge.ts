import type { ScoringResult } from '@/types'
import { getOpenRouterClient } from '@/services/openrouter'

type OpenRouterClient = ReturnType<typeof getOpenRouterClient>

const CODE_ARENA_JUDGE_PROMPT = `You are an expert frontend developer evaluating AI-generated HTML/CSS/JavaScript code. Analyze the code based on the following criteria:

1. **Visual Accuracy** (40%): Does the output match the user's request visually? Consider layout, colors, typography, and overall design.

2. **Code Quality** (30%): Is the code clean, semantic, and well-structured? Consider:
   - Proper HTML5 semantic elements
   - Clean and organized CSS
   - Readable JavaScript (if applicable)
   - No obvious errors or anti-patterns

3. **Functionality** (20%): Does any JavaScript work correctly? Are interactive elements functional?

4. **Responsiveness** (10%): Does the layout adapt to different screen sizes? Is mobile-friendly design considered?

User Request: {prompt}

Generated Code:
\`\`\`html
{code}
\`\`\`

Evaluate the code and provide:
1. A score from 0 to 100
2. A brief explanation of your evaluation

Your response MUST follow this exact format:
SCORE: [number between 0 and 100]
EXPLANATION: [your analysis in 2-3 sentences]`

export async function scoreCodeArenaOutput(
  prompt: string,
  code: string,
  client: OpenRouterClient,
  judgeModelId: string
): Promise<ScoringResult> {
  if (!code || code.trim().length === 0) {
    return {
      score: 0,
      notes: 'No code was generated',
    }
  }

  try {
    const judgePrompt = CODE_ARENA_JUDGE_PROMPT
      .replace('{prompt}', prompt)
      .replace('{code}', code)

    const response = await client.createChatCompletion({
      model: judgeModelId,
      messages: [
        {
          role: 'user',
          content: judgePrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent scoring
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content || ''
    
    // Parse the response
    const scoreMatch = content.match(/SCORE[\s*"':=\-]*(\d+)/i)
    const explanationMatch = content.match(/EXPLANATION[\s*"':=\-]*(.+)/is)

    if (!scoreMatch) {
      // Try to find any number in the response as a fallback
      const anyNumber = content.match(/\b(\d{1,3})\b/)
      if (anyNumber) {
        const score = Math.min(100, Math.max(0, parseInt(anyNumber[1], 10)))
        return {
          score: score / 100,
          rawScore: score,
          maxScore: 100,
          notes: content.trim(),
        }
      }

      return {
        score: 0, // Default to 0 if we can't parse - don't inflate scores
        confidence: 0, // Low confidence since we couldn't parse
        notes: 'Could not parse judge response: ' + content.slice(0, 200),
      }
    }

    const rawScore = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)))
    const explanation = explanationMatch 
      ? explanationMatch[1].trim() 
      : content.replace(/SCORE[\s*"':=\-]*\d+/i, '').trim()

    return {
      score: rawScore / 100,
      rawScore,
      maxScore: 100,
      notes: explanation,
    }
  } catch (error) {
    console.error('Failed to score with LLM judge:', error)
    return {
      score: 0,
      notes: `Judge error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Alternative simpler judge prompt for faster evaluation
 */
export const SIMPLE_JUDGE_PROMPT = `Rate this HTML/CSS/JS code from 0-100 based on how well it matches the request.

Request: {prompt}

Code:
{code}

Reply with just a number from 0-100.`

const QUICK_SCORE_CODE_LIMIT = 5000

export async function quickScoreCodeArenaOutput(
  prompt: string,
  code: string,
  client: OpenRouterClient,
  judgeModelId: string
): Promise<ScoringResult> {
  if (!code || code.trim().length === 0) {
    return {
      score: 0,
      notes: 'No code was generated',
    }
  }

  const wasTruncated = code.length > QUICK_SCORE_CODE_LIMIT
  const truncatedCode = wasTruncated ? code.slice(0, QUICK_SCORE_CODE_LIMIT) : code

  try {
    const judgePrompt = SIMPLE_JUDGE_PROMPT
      .replace('{prompt}', prompt)
      .replace('{code}', truncatedCode)

    const response = await client.createChatCompletion({
      model: judgeModelId,
      messages: [
        {
          role: 'user',
          content: judgePrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 50,
    })

    const content = response.choices[0]?.message?.content || ''
    const scoreMatch = content.match(/\b(\d{1,3})\b/)

    if (!scoreMatch) {
      return {
        score: 0, // Default to 0 if we can't parse - don't inflate scores
        confidence: 0,
        notes: 'Could not parse quick score',
      }
    }

    const rawScore = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)))
    const truncationWarning = wasTruncated 
      ? ` (Warning: code truncated from ${code.length} to ${QUICK_SCORE_CODE_LIMIT} chars)` 
      : ''

    return {
      score: rawScore / 100,
      rawScore,
      maxScore: 100,
      confidence: wasTruncated ? 0.8 : 1, // Lower confidence when truncated
      notes: `Quick evaluation${truncationWarning}`,
    }
  } catch (error) {
    console.error('Failed quick score:', error)
    return {
      score: 0,
      notes: `Quick score error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}