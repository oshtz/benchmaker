import type { CodeArenaExportArtifact, CodeArenaRun, CodeArenaViewport } from '@/types'
import { getCachedCapture } from './codeArenaCapture'

export type CodeArenaVideoAspect = 'wide' | 'square' | 'portrait' | 'story'
export type CodeArenaVideoTheme = 'dark' | 'light'

export const CODE_ARENA_VIDEO_PRESETS: Record<CodeArenaVideoAspect, { width: number; height: number }> = {
  wide: { width: 1600, height: 900 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
}

export interface CodeArenaVideoProgress {
  jobId: string
  phase: 'preparing' | 'encoding' | 'saving' | 'completed' | 'cancelled'
  progress: number
  message: string
}

interface NativeVideoArtifact {
  path: string
  width: number
  height: number
  fps: number
  durationMs: number
  frameCount: number
  codec: string
}

interface ReelFrame {
  pngBytes: number[]
  durationMs: number
}

export interface CodeArenaTimelineEntry {
  kind: 'intro' | 'model' | 'leaderboard'
  durationMs: number
  modelId?: string
}

export function createCodeArenaVideoJobId(): string {
  return `${Date.now()}-${crypto.randomUUID().replace(/-/g, '')}`
}

export function defaultCodeArenaVideoSelection(run: CodeArenaRun): string[] {
  return [...run.outputs]
    .filter((output) => output.status === 'completed' && (output.captures?.length ?? 0) >= 2)
    .sort((a, b) => (b.rubricScores?.total ?? -1) - (a.rubricScores?.total ?? -1))
    .slice(0, 4)
    .map((output) => output.modelId)
}

export function buildCodeArenaVideoTimeline(run: CodeArenaRun, modelIds: string[]): CodeArenaTimelineEntry[] {
  const selected = modelIds
    .slice(0, 4)
    .filter((modelId) => run.outputs.some((output) => output.modelId === modelId && output.status === 'completed'))
  if (selected.length === 0) throw new Error('Select at least one completed captured output.')
  return [
    { kind: 'intro', durationMs: 1500 },
    ...selected.map((modelId) => ({ kind: 'model' as const, modelId, durationMs: 2750 })),
    { kind: 'leaderboard', durationMs: 2500 },
  ]
}

export async function cancelCodeArenaVideoExport(jobId: string): Promise<void> {
  if (!isTauriRuntime()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('cancel_code_arena_export', { jobId })
}

export async function exportCodeArenaVideo({
  run,
  modelIds,
  aspect,
  theme,
  jobId,
  onProgress,
  signal,
}: {
  run: CodeArenaRun
  modelIds: string[]
  aspect: CodeArenaVideoAspect
  theme: CodeArenaVideoTheme
  jobId: string
  onProgress?: (progress: CodeArenaVideoProgress) => void
  signal?: AbortSignal
}): Promise<CodeArenaExportArtifact | null> {
  if (!isTauriRuntime()) throw new Error('MP4 export requires the Benchmaker desktop app.')
  const timeline = buildCodeArenaVideoTimeline(run, modelIds)
  const preset = CODE_ARENA_VIDEO_PRESETS[aspect]
  const frameData = await loadSelectedCaptures(run, timeline)
  const frames: ReelFrame[] = []
  for (const [index, entry] of timeline.entries()) {
    throwIfCancelled(signal)
    onProgress?.({ jobId, phase: 'preparing', progress: (index + 1) / (timeline.length * 2), message: 'Rendering branded reel frames' })
    frames.push({ pngBytes: Array.from(await renderTimelineFrame(run, timeline, entry, frameData, preset, theme)), durationMs: entry.durationMs })
  }
  throwIfCancelled(signal)

  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<CodeArenaVideoProgress>('code-arena-export-progress', (event) => {
    if (event.payload.jobId === jobId) onProgress?.(event.payload)
  })
  try {
    const result = await invoke<NativeVideoArtifact | null>('export_code_arena_video', {
      request: {
        jobId,
        runId: run.id,
        fileName: codeArenaVideoFileName(run),
        width: preset.width,
        height: preset.height,
        fps: 30,
        frames,
      },
    })
    if (!result) return null
    return {
      id: jobId,
      kind: 'mp4',
      path: result.path,
      createdAt: Date.now(),
      metadata: {
        aspect,
        theme,
        width: result.width,
        height: result.height,
        fps: result.fps,
        durationMs: result.durationMs,
        frameCount: result.frameCount,
        codec: result.codec,
        modelCount: modelIds.length,
      },
    }
  } finally {
    unlisten()
  }
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Code Arena video export was cancelled.', 'AbortError')
}

function codeArenaVideoFileName(run: CodeArenaRun): string {
  const date = new Date(run.startedAt).toISOString().slice(0, 10)
  return `benchmaker-code-arena-${date}-comparison-reel.mp4`
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function loadSelectedCaptures(
  run: CodeArenaRun,
  timeline: CodeArenaTimelineEntry[],
): Promise<Map<string, { desktop: HTMLImageElement; mobile: HTMLImageElement }>> {
  const result = new Map<string, { desktop: HTMLImageElement; mobile: HTMLImageElement }>()
  for (const entry of timeline) {
    if (!entry.modelId || result.has(entry.modelId)) continue
    const desktop = await loadImage(await captureDataUrl(run, entry.modelId, 'desktop'))
    const mobile = await loadImage(await captureDataUrl(run, entry.modelId, 'mobile'))
    result.set(entry.modelId, { desktop, mobile })
  }
  return result
}

async function captureDataUrl(run: CodeArenaRun, modelId: string, viewport: CodeArenaViewport): Promise<string> {
  const capture = run.outputs.find((output) => output.modelId === modelId)?.captures?.find((item) => item.viewport === viewport)
  const cached = capture?.dataUrl ?? getCachedCapture(run.id, modelId, viewport)
  if (cached) return cached
  if (!capture?.path) throw new Error(`${viewport} capture is unavailable for ${modelId}.`)
  const { invoke } = await import('@tauri-apps/api/core')
  const bytes = await invoke<number[]>('read_code_arena_artifact', { path: capture.path })
  return URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }))
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (source.startsWith('blob:')) URL.revokeObjectURL(source)
      resolve(image)
    }
    image.onerror = () => reject(new Error('A frozen capture could not be loaded.'))
    image.src = source
  })
}

async function renderTimelineFrame(
  run: CodeArenaRun,
  timeline: CodeArenaTimelineEntry[],
  entry: CodeArenaTimelineEntry,
  captures: Map<string, { desktop: HTMLImageElement; mobile: HTMLImageElement }>,
  size: { width: number; height: number },
  theme: CodeArenaVideoTheme,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas rendering is unavailable.')
  const palette = theme === 'dark'
    ? { background: '#090c0b', surface: '#111714', text: '#f4f7f5', muted: '#9da9a2', accent: '#78f0a7', purple: '#c798ff', border: '#2b3931' }
    : { background: '#f4f7f2', surface: '#ffffff', text: '#111713', muted: '#647069', accent: '#168c4b', purple: '#7c3dc7', border: '#cbd5ce' }
  context.fillStyle = palette.background
  context.fillRect(0, 0, size.width, size.height)
  drawBayerWash(context, size.width, size.height, palette.accent, palette.purple, theme === 'dark' ? 0.28 : 0.18)

  if (entry.kind === 'intro') drawIntro(context, run, size, palette)
  else if (entry.kind === 'model' && entry.modelId) drawModelCard(context, run, entry.modelId, captures.get(entry.modelId), size, palette)
  else drawLeaderboard(context, run, timeline, size, palette)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to encode reel frame.')), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

function drawBayerWash(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  from: string,
  to: string,
  opacity: number,
) {
  const matrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
  context.save()
  for (let y = 0; y < height; y += 2) {
    const mix = y / Math.max(1, height)
    context.fillStyle = mix < 0.55 ? from : to
    context.globalAlpha = opacity * (1 - Math.abs(mix - 0.5))
    for (let x = 0; x < width; x += 2) {
      const threshold = matrix[(y / 2) % 4][(x / 2) % 4] / 16
      const field = (x / width) * 0.7 + mix * 0.3
      if (field > threshold) context.fillRect(x, y, 2, 2)
    }
  }
  context.restore()
}

type ReelPalette = { background: string; surface: string; text: string; muted: string; accent: string; purple: string; border: string }

function drawBrand(context: CanvasRenderingContext2D, size: { width: number; height: number }, palette: ReelPalette) {
  context.fillStyle = palette.accent
  context.fillRect(64, 56, 12, 32)
  context.fillStyle = palette.text
  context.font = '700 24px Arial, sans-serif'
  context.fillText('BENCHMAKER', 90, 82)
  context.fillStyle = palette.muted
  context.font = '600 18px Arial, sans-serif'
  context.textAlign = 'right'
  context.fillText('CODE ARENA', size.width - 64, 80)
  context.textAlign = 'left'
}

function drawIntro(context: CanvasRenderingContext2D, run: CodeArenaRun, size: { width: number; height: number }, palette: ReelPalette) {
  drawBrand(context, size, palette)
  context.fillStyle = palette.accent
  context.font = `700 ${Math.round(size.width * 0.027)}px Arial, sans-serif`
  context.fillText('MODEL COMPARISON', 64, size.height * 0.33)
  context.fillStyle = palette.text
  context.font = `800 ${Math.round(size.width * 0.055)}px Arial, sans-serif`
  drawWrappedText(context, run.prompt, 64, size.height * 0.43, size.width - 128, Math.round(size.width * 0.065), 4)
  context.fillStyle = palette.muted
  context.font = `500 ${Math.round(size.width * 0.019)}px Arial, sans-serif`
  context.fillText(`${run.models.length} models · fixed desktop + mobile captures`, 64, size.height - 80)
}

function drawModelCard(
  context: CanvasRenderingContext2D,
  run: CodeArenaRun,
  modelId: string,
  capture: { desktop: HTMLImageElement; mobile: HTMLImageElement } | undefined,
  size: { width: number; height: number },
  palette: ReelPalette,
) {
  if (!capture) throw new Error(`Frozen captures are unavailable for ${modelId}.`)
  drawBrand(context, size, palette)
  const output = run.outputs.find((item) => item.modelId === modelId)
  const ranked = [...run.outputs].filter((item) => item.rubricScores).sort((a, b) => (b.rubricScores?.total ?? 0) - (a.rubricScores?.total ?? 0))
  const rank = Math.max(1, ranked.findIndex((item) => item.modelId === modelId) + 1)
  const score = output?.rubricScores?.total
  context.fillStyle = palette.text
  context.font = `800 ${Math.round(size.width * 0.034)}px Arial, sans-serif`
  context.fillText(modelId.split('/').pop() ?? modelId, 64, 145)
  context.fillStyle = palette.muted
  context.font = `600 ${Math.round(size.width * 0.017)}px Arial, sans-serif`
  context.fillText(`CARD ${rank} · ${score === undefined ? 'UNSCORED' : `${Math.round(score)}%`}`, 64, 180)

  const top = 215
  const bottom = size.height - 54
  const contentHeight = bottom - top
  if (size.width / size.height > 1.35) {
    drawImagePanel(context, capture.desktop, 64, top, size.width - 390, contentHeight, palette)
    drawImagePanel(context, capture.mobile, size.width - 340, top, 276, contentHeight, palette)
  } else {
    const desktopHeight = Math.round(contentHeight * 0.62)
    drawImagePanel(context, capture.desktop, 54, top, size.width - 108, desktopHeight, palette)
    const mobileWidth = Math.min(Math.round(size.width * 0.34), 350)
    drawImagePanel(context, capture.mobile, size.width - mobileWidth - 54, top + desktopHeight + 28, mobileWidth, contentHeight - desktopHeight - 28, palette)
  }
}

function drawImagePanel(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, palette: ReelPalette) {
  context.save()
  roundedRect(context, x, y, width, height, 20)
  context.clip()
  context.fillStyle = palette.surface
  context.fillRect(x, y, width, height)
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
  context.restore()
  context.strokeStyle = palette.border
  context.lineWidth = 2
  roundedRect(context, x, y, width, height, 20)
  context.stroke()
}

function drawLeaderboard(context: CanvasRenderingContext2D, run: CodeArenaRun, timeline: CodeArenaTimelineEntry[], size: { width: number; height: number }, palette: ReelPalette) {
  drawBrand(context, size, palette)
  context.fillStyle = palette.text
  context.font = `800 ${Math.round(size.width * 0.05)}px Arial, sans-serif`
  context.fillText('FINAL LEADERBOARD', 64, 180)
  const selectedIds = timeline.flatMap((entry) => entry.modelId ? [entry.modelId] : [])
  const rows = run.outputs.filter((output) => selectedIds.includes(output.modelId)).sort((a, b) => (b.rubricScores?.total ?? -1) - (a.rubricScores?.total ?? -1))
  const rowHeight = Math.min(130, (size.height - 310) / Math.max(1, rows.length))
  rows.forEach((output, index) => {
    const y = 235 + index * rowHeight
    context.fillStyle = palette.surface
    roundedRect(context, 64, y, size.width - 128, rowHeight - 18, 18)
    context.fill()
    context.strokeStyle = palette.border
    context.stroke()
    context.fillStyle = index === 0 ? palette.accent : palette.muted
    context.font = `800 ${Math.round(size.width * 0.026)}px Arial, sans-serif`
    context.fillText(`#${index + 1}`, 92, y + rowHeight * 0.55)
    context.fillStyle = palette.text
    context.font = `700 ${Math.round(size.width * 0.027)}px Arial, sans-serif`
    context.fillText(output.modelId.split('/').pop() ?? output.modelId, 180, y + rowHeight * 0.55)
    context.textAlign = 'right'
    context.fillStyle = palette.accent
    context.font = `800 ${Math.round(size.width * 0.03)}px Arial, sans-serif`
    context.fillText(output.rubricScores ? `${Math.round(output.rubricScores.total)}%` : '—', size.width - 92, y + rowHeight * 0.55)
    context.textAlign = 'left'
  })
  context.fillStyle = palette.muted
  context.font = `500 ${Math.round(size.width * 0.017)}px Arial, sans-serif`
  context.fillText('Generated locally · H.264 · 30 fps · no audio', 64, size.height - 55)
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    } else line = next
  }
  if (lines.length < maxLines && line) lines.push(line)
  lines.slice(0, maxLines).forEach((value, index) => context.fillText(value, x, y + index * lineHeight))
}
