/**
 * Code Extractor Utility
 * Extracts HTML/CSS/JS code from model responses that may be wrapped in markdown code blocks
 */

/**
 * Extracts HTML code from a model response
 * Handles various formats:
 * - Markdown code blocks (```html ... ```)
 * - Raw HTML starting with DOCTYPE or <html>
 * - Partial HTML (body content only)
 */
export function extractCodeFromResponse(response: string): string {
  if (!response || typeof response !== 'string') {
    return ''
  }

  const trimmedResponse = response.trim()

  // Try to extract from markdown code blocks (html, htm, or no language specified)
  const codeBlockMatch = trimmedResponse.match(/```(?:html?|htm)?\s*\n?([\s\S]*?)```/i)
  if (codeBlockMatch && codeBlockMatch[1]) {
    const extracted = codeBlockMatch[1].trim()
    return ensureCompleteHtml(extracted)
  }

  // Check if response starts with DOCTYPE or html tag (raw HTML)
  if (trimmedResponse.match(/^<!DOCTYPE\s+html/i) || trimmedResponse.match(/^<html/i)) {
    return trimmedResponse
  }

  // Check if it starts with head or body tag
  if (trimmedResponse.match(/^<head/i) || trimmedResponse.match(/^<body/i)) {
    return wrapInHtmlDocument(trimmedResponse)
  }

  // Check if it looks like HTML content (starts with common HTML tags)
  if (trimmedResponse.match(/^<(?:div|section|main|header|nav|article|aside|footer|form|table|ul|ol|p|h[1-6])/i)) {
    return wrapInHtmlDocument(`<body>${trimmedResponse}</body>`)
  }

  // If it contains HTML-like content anywhere, try to extract it
  const htmlContentMatch = trimmedResponse.match(/<(!DOCTYPE|html|head|body|div|section|main)[^>]*>[\s\S]*<\/\1>/i)
  if (htmlContentMatch) {
    return ensureCompleteHtml(htmlContentMatch[0])
  }

  // Return as-is if nothing matches - might be plain text or incomplete
  return trimmedResponse
}

/**
 * Ensures the HTML has a complete document structure
 */
function ensureCompleteHtml(html: string): string {
  const trimmed = html.trim()

  // Already has DOCTYPE
  if (trimmed.match(/^<!DOCTYPE\s+html/i)) {
    return trimmed
  }

  // Has html tag but no DOCTYPE
  if (trimmed.match(/^<html/i)) {
    return `<!DOCTYPE html>\n${trimmed}`
  }

  // Has head or body but no html wrapper
  if (trimmed.match(/^<head/i) || trimmed.match(/^<body/i)) {
    return wrapInHtmlDocument(trimmed)
  }

  // Just content, wrap it all
  return wrapInHtmlDocument(`<body>${trimmed}</body>`)
}

/**
 * Wraps content in a complete HTML document structure
 */
function wrapInHtmlDocument(content: string): string {
  const hasHead = content.match(/<head[\s>]/i)
  const hasBody = content.match(/<body[\s>]/i)

  if (hasHead && hasBody) {
    return `<!DOCTYPE html>
<html lang="en">
${content}
</html>`
  }

  if (hasHead) {
    return `<!DOCTYPE html>
<html lang="en">
${content}
<body></body>
</html>`
  }

  if (hasBody) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
${content}
</html>`
  }

  // Neither head nor body
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${content}
</body>
</html>`
}

/**
 * Extracts code progressively from streaming content
 * Returns the best extractable code so far, even if incomplete
 */
export function extractCodeFromStreamingContent(streamedContent: string): string {
  if (!streamedContent || typeof streamedContent !== 'string') {
    return ''
  }

  const trimmed = streamedContent.trim()

  // Check if we're inside a code block
  const codeBlockStart = trimmed.indexOf('```')
  if (codeBlockStart !== -1) {
    // Find the end of the language identifier line
    const afterBackticks = trimmed.substring(codeBlockStart + 3)
    const newlineIndex = afterBackticks.indexOf('\n')
    
    if (newlineIndex !== -1) {
      const codeStart = codeBlockStart + 3 + newlineIndex + 1
      const codeBlockEnd = trimmed.indexOf('```', codeStart)
      
      if (codeBlockEnd !== -1) {
        // Complete code block
        const code = trimmed.substring(codeStart, codeBlockEnd).trim()
        return ensureCompleteHtml(code)
      } else {
        // Incomplete code block - return what we have so far
        const partialCode = trimmed.substring(codeStart).trim()
        if (partialCode.length > 0) {
          return ensureCompleteHtml(partialCode)
        }
      }
    }
  }

  // No code block, try to extract HTML directly
  if (trimmed.match(/^<!DOCTYPE\s+html/i) || trimmed.match(/^<html/i)) {
    return trimmed
  }

  // Check for partial HTML content
  if (trimmed.match(/^<(?:head|body|div|section|main|header)/i)) {
    return ensureCompleteHtml(trimmed)
  }

  return ''
}

/**
 * Default system prompt for frontend code generation
 */
export const DEFAULT_FRONTEND_SYSTEM_PROMPT = `You are an expert frontend developer. Generate a complete, single-page HTML document with embedded CSS and JavaScript based on the user's request.

Requirements:
- Output ONLY the HTML code, no explanations or markdown formatting
- Include all CSS in a <style> tag in the <head>
- Include all JavaScript in a <script> tag before </body>
- Use modern, semantic HTML5
- Make the design visually appealing and responsive
- Ensure the code is complete and functional
- Do not include any text before or after the HTML code`
