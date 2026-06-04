import { describe, expect, it } from 'vitest'
import { extractCodeFromResponse, extractCodeFromStreamingContent } from './codeExtractor'

describe('codeExtractor', () => {
  it('extracts fenced HTML and preserves a complete document', () => {
    const result = extractCodeFromResponse('```html\n<!DOCTYPE html><html><body>Hi</body></html>\n```')

    expect(result).toBe('<!DOCTYPE html><html><body>Hi</body></html>')
  })

  it('wraps partial body content in a complete HTML document', () => {
    const result = extractCodeFromResponse('<main>Benchmaker</main>')

    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<body><main>Benchmaker</main></body>')
  })

  it('returns progressive HTML while a markdown code block is streaming', () => {
    const result = extractCodeFromStreamingContent('```html\n<section>Loading')

    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<section>Loading')
  })
})
