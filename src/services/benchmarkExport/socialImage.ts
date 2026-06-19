import type { BenchmarkExportDocument, ShareImagePreset } from './types'
import { escapeXml, formatCost, formatDateTime, formatDuration, formatPercent } from './formatters'

const PRESETS: Record<ShareImagePreset, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  wide: { width: 1600, height: 900 },
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}...`
}

function text(value: string, x: number, y: number, options: {
  size: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  letterSpacing?: number
}): string {
  return `<text x="${x}" y="${y}" font-size="${options.size}" font-weight="${options.weight ?? 500}" fill="${options.fill ?? '#141414'}" text-anchor="${options.anchor ?? 'start'}" letter-spacing="${options.letterSpacing ?? 0}">${escapeXml(value)}</text>`
}

function leaderboardRows(document: BenchmarkExportDocument, x: number, y: number, width: number): string {
  return document.modelRows.slice(0, 3).map((row, index) => {
    const rowY = y + index * 78
    const barWidth = Math.max(8, Math.min(width - 260, row.effectiveScore * (width - 260)))
    return `
      <g>
        <rect x="${x}" y="${rowY - 40}" width="${width}" height="58" rx="8" fill="${index === 0 ? '#fff3d2' : '#f3f3f3'}" stroke="${index === 0 ? '#e2b345' : '#dedede'}" />
        ${text(`#${row.rank}`, x + 24, rowY - 3, { size: 26, weight: 800, fill: index === 0 ? '#9d6a00' : '#666' })}
        ${text(truncate(row.displayName, 30), x + 92, rowY - 6, { size: 24, weight: 800 })}
        ${text(formatPercent(row.effectiveScore), x + width - 28, rowY - 6, { size: 26, weight: 900, anchor: 'end', fill: '#0c8a53' })}
        <rect x="${x + 92}" y="${rowY + 7}" width="${width - 260}" height="8" rx="4" fill="#dedede" />
        <rect x="${x + 92}" y="${rowY + 7}" width="${barWidth}" height="8" rx="4" fill="url(#scoreGradient)" />
      </g>
    `
  }).join('')
}

export function getShareImageSize(preset: ShareImagePreset): { width: number; height: number } {
  return PRESETS[preset]
}

export function generateShareImageSvg(document: BenchmarkExportDocument): string {
  const { width, height } = PRESETS[document.options.imagePreset]
  const top = document.summary.topModel
  const padding = width >= 1400 ? 92 : 70
  const titleY = padding + 24
  const scoreY = height >= 1200 ? 430 : width >= 1400 ? 330 : 360
  const leaderboardY = height >= 1200 ? 735 : width >= 1400 ? 560 : 650
  const leaderWidth = width - padding * 2
  const statsY = height - padding - 96
  const statusLine = `${document.summary.testCaseCount} tests / ${document.summary.modelCount} models / ${formatDuration(document.summary.durationMs)}`
  const costLine = document.summary.totalCost > 0 ? ` / ${formatCost(document.summary.totalCost)}` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8A64D6" />
      <stop offset="48%" stop-color="#E8549C" />
      <stop offset="100%" stop-color="#F28E2B" />
    </linearGradient>
    <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#df4b91" />
      <stop offset="100%" stop-color="#f18a32" />
    </linearGradient>
    <filter id="paperNoise">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.08" />
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#fbfbfb" />
  <rect width="100%" height="100%" filter="url(#paperNoise)" opacity="0.75" />
  <rect x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" rx="18" fill="none" stroke="#141414" stroke-width="4" />
  <rect x="${padding}" y="${padding}" width="${width - padding * 2}" height="10" fill="url(#brandGradient)" />

  ${text('BENCHMAKER', padding + 28, titleY, { size: 26, weight: 900, fill: '#df4b91', letterSpacing: 5 })}
  ${text('Benchmark Results', padding + 28, titleY + 72, { size: width >= 1400 ? 74 : 64, weight: 900 })}
  ${text(truncate(document.suite.name, width >= 1400 ? 52 : 34), padding + 32, titleY + 122, { size: 30, weight: 700, fill: '#666' })}

  <g>
    ${text(top ? formatPercent(top.effectiveScore) : '-', padding + 26, scoreY, { size: width >= 1400 ? 132 : 146, weight: 900, fill: '#0c8a53' })}
    ${text('top effective score', padding + 36, scoreY + 48, { size: 28, weight: 800, fill: '#666' })}
    ${text(top ? truncate(top.displayName, width >= 1400 ? 38 : 24) : 'No scored model', padding + 36, scoreY + 98, { size: width >= 1400 ? 46 : 42, weight: 900 })}
  </g>

  <g>
    ${leaderboardRows(document, padding + 28, leaderboardY, leaderWidth - 56)}
  </g>

  <g>
    <rect x="${padding + 28}" y="${statsY - 38}" width="${leaderWidth - 56}" height="108" rx="8" fill="#141414" />
    ${text(statusLine, padding + 58, statsY + 3, { size: 28, weight: 800, fill: '#ffffff' })}
    ${text(`${formatPercent(document.summary.coverage, 0)} scored coverage${costLine}`, padding + 58, statsY + 46, { size: 24, weight: 700, fill: '#f2b94b' })}
    ${text(`Generated ${formatDateTime(document.generatedAt)}`, width - padding - 58, statsY + 46, { size: 18, weight: 600, fill: '#b8b8b8', anchor: 'end' })}
  </g>
</svg>`
}

export async function generateShareImagePng(exportDocument: BenchmarkExportDocument): Promise<Blob> {
  const svg = generateShareImageSvg(exportDocument)
  const { width, height } = PRESETS[exportDocument.options.imagePreset]
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Unable to render export image.'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is unavailable.')
    context.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error('Unable to encode export image.'))
          return
        }
        resolve(pngBlob)
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
