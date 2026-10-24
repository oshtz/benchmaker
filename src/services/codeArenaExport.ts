import { strToU8, zipSync } from 'fflate'
import type { CodeArenaRun, CodeArenaViewport } from '@/types'
import { getCachedCapture } from './codeArenaCapture'

export function codeArenaFileName(run: CodeArenaRun, suffix: string, extension: string): string {
  const date = new Date(run.startedAt).toISOString().slice(0, 10)
  const safe = suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artifact'
  return `benchmaker-code-arena-${date}-${safe}.${extension}`
}

async function saveBytes(fileName: string, extension: string, bytes: Uint8Array): Promise<string | null> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<string | null>('save_export_file', { fileName, extension, bytes: Array.from(bytes) })
  }
  const blob = new Blob([bytes as BlobPart])
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url)
  return fileName
}

export async function exportRawHtml(run: CodeArenaRun, modelId: string): Promise<string | null> {
  const output = run.outputs.find((item) => item.modelId === modelId)
  if (!output?.extractedCode) throw new Error('This result has no completed HTML.')
  return saveBytes(codeArenaFileName(run, modelId.split('/').pop() ?? 'result', 'html'), 'html', strToU8(output.extractedCode))
}

export async function exportComparisonPack(run: CodeArenaRun, includeRawHtml: boolean): Promise<string | null> {
  const files: Record<string, Uint8Array> = {}
  const manifest = { version: 1, runId: run.id, prompt: run.prompt, captureProfile: run.captureProfile, evaluation: run.evaluation, outputs: run.outputs.map(({ modelId, status, captures, rubricScores, judgeStatus }) => ({ modelId, status, captures: captures?.map(({ dataUrl: _dataUrl, ...capture }) => capture), rubricScores, judgeStatus })) }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  for (const output of run.outputs) {
    const safe = (output.modelId.split('/').pop() ?? 'model').replace(/[^a-z0-9-]/gi, '-')
    if (includeRawHtml && output.extractedCode) files[`html/${safe}.html`] = strToU8(output.extractedCode)
    for (const capture of output.captures ?? []) { const dataUrl = capture.dataUrl ?? getCachedCapture(run.id, output.modelId, capture.viewport); if (dataUrl) files[`captures/${safe}-${capture.viewport}.png`] = dataUrlBytes(dataUrl) }
  }
  return saveBytes(codeArenaFileName(run, 'comparison-pack', 'zip'), 'zip', zipSync(files, { level: 6 }))
}

export async function exportCapture(run: CodeArenaRun, modelId: string, viewport: CodeArenaViewport): Promise<string | null> {
  const capture = run.outputs.find((item) => item.modelId === modelId)?.captures?.find((item) => item.viewport === viewport)
  const dataUrl = capture?.dataUrl ?? getCachedCapture(run.id, modelId, viewport)
  if (!dataUrl) throw new Error('Capture is unavailable. Freeze and capture the run first.')
  return saveBytes(codeArenaFileName(run, `${modelId.split('/').pop()}-${viewport}`, 'png'), 'png', dataUrlBytes(dataUrl))
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.split(',')[1] ?? '')
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
