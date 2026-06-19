import type { BenchmarkExportDocument } from './types'
import {
  formatCost,
  formatDateTime,
  formatDuration,
  formatInteger,
  formatLatency,
  formatPercent,
} from './formatters'

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

interface PdfLine {
  text: string
  size: number
  gap: number
}

function sanitizePdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r/g, '')
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      return code === 10 || (code >= 32 && code <= 126) ? char : '?'
    })
    .join('')
}

function escapePdfText(value: string): string {
  return sanitizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapText(value: string, maxChars: number): string[] {
  const rawLines = sanitizePdfText(value).split('\n')
  const lines: string[] = []

  for (const rawLine of rawLines) {
    const words = rawLine.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }

    let line = ''
    for (const word of words) {
      if (word.length > maxChars) {
        if (line) {
          lines.push(line)
          line = ''
        }
        for (let index = 0; index < word.length; index += maxChars) {
          lines.push(word.slice(index, index + maxChars))
        }
        continue
      }

      const next = line ? `${line} ${word}` : word
      if (next.length > maxChars) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }

    if (line) lines.push(line)
  }

  return lines
}

class PdfTextLayout {
  private readonly pages: PdfLine[][] = [[]]
  private currentHeight = MARGIN

  addHeading(text: string, size = 18): void {
    this.addGap(10)
    this.addWrapped(text, size, 8)
  }

  addText(text: string, size = 10, gap = 3): void {
    this.addWrapped(text, size, gap)
  }

  addGap(gap: number): void {
    this.currentHeight += gap
    if (this.currentHeight > PAGE_HEIGHT - MARGIN) {
      this.newPage()
    }
  }

  getPages(): PdfLine[][] {
    return this.pages
  }

  private addWrapped(text: string, size: number, gap: number): void {
    const maxChars = Math.max(42, Math.floor(CONTENT_WIDTH / (size * 0.52)))
    for (const line of wrapText(text, maxChars)) {
      const lineHeight = size + gap
      if (this.currentHeight + lineHeight > PAGE_HEIGHT - MARGIN) {
        this.newPage()
      }
      this.pages[this.pages.length - 1].push({ text: line, size, gap })
      this.currentHeight += lineHeight
    }
  }

  private newPage(): void {
    this.pages.push([])
    this.currentHeight = MARGIN
  }
}

function pushModelSummary(layout: PdfTextLayout, document: BenchmarkExportDocument): void {
  layout.addHeading('Leaderboard')
  for (const row of document.modelRows) {
    const costTokens = document.options.includeCostTokens
      ? `, tokens ${formatInteger(row.totalTokens)}, cost ${formatCost(row.totalCost)}`
      : ''
    layout.addText(
      `${row.rank}. ${row.displayName}: effective ${formatPercent(row.effectiveScore)}, scored mean ${formatPercent(row.scoredMean)}, coverage ${formatPercent(row.coverage, 0)}, success ${formatPercent(row.successRate, 0)}, latency ${formatLatency(row.meanLatencyMs)}, failures ${row.failedCount}${costTokens}`,
      10,
      4,
    )
  }
}

function pushMethodology(layout: PdfTextLayout, document: BenchmarkExportDocument): void {
  const params = document.run.parameters
  layout.addHeading('Methodology')
  layout.addText(`Ranking metric: effective score. Missing or unscored expected cells count as zero.`, 10)
  layout.addText(`Temperature ${params.temperature}, top_p ${params.topP}, max tokens ${params.maxTokens}, frequency penalty ${params.frequencyPenalty}, presence penalty ${params.presencePenalty}, benchmark mode ${params.benchmarkMode ? 'enabled' : 'disabled'}.`, 10)
  layout.addText(`Judge model: ${document.run.judgeModel || '-'}.`, 10)

  if (document.options.includeSystemPrompt && document.suite.systemPrompt) {
    layout.addHeading('System Prompt', 13)
    layout.addText(document.suite.systemPrompt, 8)
  }

  if (document.options.includeJudgePrompt && document.suite.judgeSystemPrompt) {
    layout.addHeading('Judge Prompt', 13)
    layout.addText(document.suite.judgeSystemPrompt, 8)
  }
}

function pushMultiRun(layout: PdfTextLayout, document: BenchmarkExportDocument): void {
  if (!document.multiRun) return

  layout.addHeading('Multi-Run Analysis')
  layout.addText(`Based on ${document.multiRun.relatedRunCount} completed runs.`, 10)
  for (const row of document.multiRun.modelStats) {
    layout.addText(`${row.displayName}: mean ${formatPercent(row.mean)}, std dev ${formatPercent(row.stdDev)}, 95% CI ${formatPercent(row.confidence95[0])} - ${formatPercent(row.confidence95[1])}, range ${formatPercent(row.min)} - ${formatPercent(row.max)}.`, 10)
  }
  if (document.multiRun.topComparison) {
    const comparison = document.multiRun.topComparison
    layout.addText(`${comparison.displayNameA} vs ${comparison.displayNameB}: difference ${formatPercent(comparison.scoreDiff)}, approximate p-value ${comparison.pValue.toFixed(4)}, effect size ${comparison.effectSize.toFixed(3)}.`, 10)
  }
}

function pushPerTestResults(layout: PdfTextLayout, document: BenchmarkExportDocument): void {
  layout.addHeading('Per-Test Results')
  for (const row of document.testRows) {
    layout.addHeading(`Test ${row.index}`, 13)
    layout.addText(`Method ${row.scoringMethod}, weight ${row.weight}${row.category ? `, category ${row.category}` : ''}${row.difficulty ? `, difficulty ${row.difficulty}` : ''}.`, 9)
    layout.addText(`Prompt: ${row.prompt}`, 8)
    if (document.options.includeExpectedOutputs && row.expectedOutput) {
      layout.addText(`Expected: ${row.expectedOutput}`, 8)
    }
    for (const cell of row.cells) {
      const tokenCost = document.options.includeCostTokens
        ? `, tokens ${formatInteger((cell.promptTokens || 0) + (cell.completionTokens || 0))}, cost ${formatCost(cell.cost)}`
        : ''
      const notes = document.options.includeScoringNotes && (cell.scoringNotes || cell.error)
        ? `, notes ${cell.scoringNotes || cell.error}`
        : ''
      layout.addText(`${cell.displayName}: ${cell.status}, score ${cell.score ? formatPercent(cell.score.score) : '-'}, latency ${formatLatency(cell.latencyMs)}${tokenCost}${notes}.`, 8)
      if (document.options.includeRawResponses && cell.response) {
        layout.addText(`Response: ${cell.response.slice(0, 1600)}`, 7)
      }
    }
  }
}

function buildTextLayout(document: BenchmarkExportDocument): PdfLine[][] {
  const layout = new PdfTextLayout()
  const topModel = document.summary.topModel

  layout.addHeading('Benchmaker Scientific Report', 20)
  layout.addText(document.suite.name, 16, 8)
  layout.addText(`Run started: ${formatDateTime(document.run.startedAt)}. Generated: ${formatDateTime(document.generatedAt)}.`, 10)
  layout.addText(`Status: ${document.run.status}. Suite source: ${document.suite.source}. Run ID: ${document.run.id}.`, 9)
  if (document.suite.description) layout.addText(document.suite.description, 9)

  layout.addHeading('Executive Summary')
  layout.addText(`Top model: ${topModel?.displayName || '-'}. Effective score: ${topModel ? formatPercent(topModel.effectiveScore) : '-'}.`, 11)
  layout.addText(`Models: ${document.summary.modelCount}. Test cases: ${document.summary.testCaseCount}. Coverage: ${formatPercent(document.summary.coverage, 0)} (${document.summary.scoredCount}/${document.summary.expectedResultCount} scored). Duration: ${formatDuration(document.summary.durationMs)}.`, 10)
  layout.addText(`Total cost: ${formatCost(document.summary.totalCost)}. Total tokens: ${formatInteger(document.summary.totalTokens)}.`, 10)

  if (document.caveats.length > 0) {
    layout.addHeading('Caveats')
    for (const caveat of document.caveats) {
      layout.addText(`- ${caveat}`, 10)
    }
  }

  pushModelSummary(layout, document)
  pushMethodology(layout, document)
  pushMultiRun(layout, document)
  pushPerTestResults(layout, document)

  return layout.getPages()
}

function contentStreamForPage(lines: PdfLine[], pageNumber: number, pageCount: number): string {
  const commands: string[] = ['BT']
  let y = PAGE_HEIGHT - MARGIN

  commands.push(`/F1 9 Tf ${MARGIN} 24 Td (${escapePdfText(`Page ${pageNumber} of ${pageCount}`)}) Tj`)
  commands.push('ET')
  commands.push('BT')

  for (const line of lines) {
    commands.push(`/F1 ${line.size} Tf`)
    commands.push(`1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapePdfText(line.text)}) Tj`)
    y -= line.size + line.gap
  }

  commands.push('ET')
  return commands.join('\n')
}

export function generateScientificPdf(document: BenchmarkExportDocument): Uint8Array {
  const pages = buildTextLayout(document)
  const objects: string[] = []
  const pageObjectIds: number[] = []

  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('') // pages object placeholder
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  for (const [index, pageLines] of pages.entries()) {
    const contentObjectId = objects.length + 2
    const pageObjectId = objects.length + 1
    pageObjectIds.push(pageObjectId)

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`)
    const stream = contentStreamForPage(pageLines, index + 1, pages.length)
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new TextEncoder().encode(pdf)
}
