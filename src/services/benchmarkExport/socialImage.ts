import type {
  BenchmarkExportDocument,
  ModelExportRow,
  ShareImagePreset,
  ShareImageTheme,
  ShareImageVariant,
} from './types'
import appIconUrl from '/src-tauri/icons/128x128.png?inline'
import {
  escapeXml,
  formatCost,
  formatDateTime,
  formatDuration,
  formatLatency,
  formatPercent,
} from './formatters'

const PRESETS: Record<ShareImagePreset, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  wide: { width: 1600, height: 900 },
}

const SOCIAL_PALETTES: Record<ShareImageTheme, {
  bg: string
  panel: string
  panelAlt: string
  text: string
  muted: string
  faint: string
  border: string
  track: string
  accent: string
  accent2: string
  good: string
}> = {
  dark: {
    bg: '#090909',
    panel: '#141312',
    panelAlt: '#1d1a18',
    text: '#f8f0e4',
    muted: '#aaa197',
    faint: '#6d665f',
    border: '#f8f0e4',
    track: '#302d2a',
    accent: '#E8549C',
    accent2: '#F28E2B',
    good: '#52d273',
  },
  light: {
    bg: '#eee8de',
    panel: '#fff9ee',
    panelAlt: '#e2d8c9',
    text: '#11100f',
    muted: '#62594f',
    faint: '#9b9083',
    border: '#11100f',
    track: '#cec3b5',
    accent: '#E8549C',
    accent2: '#F28E2B',
    good: '#087f5b',
  },
}

type TextOptions = {
  size: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  letterSpacing?: number
  opacity?: number
}

type LiquidBarOptions = {
  glow?: boolean
  noiseOpacity?: number
  opacity?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hashNumber(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededUnit(seed: string, salt: number): number {
  return hashNumber(`${seed}:${salt}`) / 0xffffffff
}

function seededBetween(seed: string, salt: number, min: number, max: number): number {
  return min + (max - min) * seededUnit(seed, salt)
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}...`
}

function truncateToWidth(value: string, maxWidth: number, fontSize: number): string {
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * 0.58)))
  return truncate(value, maxChars)
}

function text(value: string, x: number, y: number, options: TextOptions): string {
  const opacity = options.opacity === undefined ? '' : ` opacity="${options.opacity}"`
  return `<text x="${x}" y="${y}" font-size="${options.size}" font-weight="${options.weight ?? 500}" fill="${options.fill ?? '#141414'}" text-anchor="${options.anchor ?? 'start'}" letter-spacing="${options.letterSpacing ?? 0}"${opacity}>${escapeXml(value)}</text>`
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPercent(value)}`
}

function absoluteAssetUrl(assetUrl: string): string {
  if (/^(data:|https?:|file:|tauri:|asset:)/.test(assetUrl)) return assetUrl
  if (typeof window === 'undefined') return assetUrl
  return new URL(assetUrl, window.location.href).href
}

function appIconMark(x: number, y: number, size: number): string {
  return `<image href="${escapeXml(absoluteAssetUrl(appIconUrl))}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`
}

function liquidBar(
  seed: string,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  palette: typeof SOCIAL_PALETTES.dark,
  options: LiquidBarOptions = {},
): string {
  if (width <= 0 || height <= 0) return ''

  const id = hashNumber(`${seed}:${Math.round(x)}:${Math.round(y)}:${Math.round(width)}:${Math.round(height)}`).toString(36)
  const clipId = `liquidClip-${id}`
  const gradientId = `liquidGradient-${id}`
  const horizontal = width >= height
  const x1 = x + width * seededBetween(seed, 1, -0.2, 0.18)
  const y1 = y + height * seededBetween(seed, 2, -0.3, 0.35)
  const x2 = x + width * seededBetween(seed, 3, 0.78, 1.25)
  const y2 = y + height * seededBetween(seed, 4, 0.65, 1.35)
  const midStop = seededBetween(seed, 5, 34, 58)
  const lateStop = seededBetween(seed, 6, 68, 86)
  const opacity = options.opacity ?? 1
  const noiseOpacity = options.noiseOpacity ?? 0.16
  const groupFilter = options.glow ? ' filter="url(#barGlow)"' : ''

  const blobs = [0, 1, 2, 3].map((blobIndex) => {
    const color = blobIndex % 2 === 0 ? palette.accent : palette.accent2
    const cx = x + width * seededBetween(seed, 10 + blobIndex, -0.08, 1.08)
    const cy = y + height * seededBetween(seed, 20 + blobIndex, -0.12, 1.12)
    const rx = width * (horizontal
      ? seededBetween(seed, 30 + blobIndex, 0.18, 0.48)
      : seededBetween(seed, 30 + blobIndex, 0.72, 1.35))
    const ry = height * (horizontal
      ? seededBetween(seed, 40 + blobIndex, 1.15, 2.6)
      : seededBetween(seed, 40 + blobIndex, 0.18, 0.42))
    const blobOpacity = seededBetween(seed, 50 + blobIndex, 0.16, 0.34)
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${blobOpacity}" filter="url(#liquidBlobBlur)" />`
  }).join('')

  const washOpacity = horizontal ? 0.2 : 0.16

  return `
    <defs>
      <clipPath id="${clipId}">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" />
      </clipPath>
      <linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        <stop offset="0%" stop-color="${palette.accent}" />
        <stop offset="${midStop}%" stop-color="${palette.accent2}" />
        <stop offset="${lateStop}%" stop-color="${palette.accent}" />
        <stop offset="100%" stop-color="${palette.accent2}" />
      </linearGradient>
    </defs>
    <g opacity="${opacity}"${groupFilter}>
      <g clip-path="url(#${clipId})">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${gradientId})" />
        ${blobs}
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#liquidSheen)" opacity="${washOpacity}" />
        <rect x="${x}" y="${y}" width="${width}" height="${height}" filter="url(#liquidBarNoise)" opacity="${noiseOpacity}" />
      </g>
    </g>
  `
}

function socialSvgDefs(document: BenchmarkExportDocument, palette: typeof SOCIAL_PALETTES.dark): string {
  return `
    <linearGradient id="socialAccent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${palette.accent}" />
      <stop offset="100%" stop-color="${palette.accent2}" />
    </linearGradient>
    <linearGradient id="liquidSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.border}" stop-opacity="0.24" />
      <stop offset="42%" stop-color="${palette.border}" stop-opacity="0.04" />
      <stop offset="100%" stop-color="${palette.border}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="rowSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.border}" stop-opacity="0.18" />
      <stop offset="100%" stop-color="${palette.border}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="leaderRowWash" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.12" />
      <stop offset="42%" stop-color="${palette.accent2}" stop-opacity="0.06" />
      <stop offset="100%" stop-color="${palette.accent2}" stop-opacity="0" />
    </linearGradient>
    <pattern id="socialGrid" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M 42 0 L 0 0 0 42" fill="none" stroke="${palette.border}" stroke-width="1" opacity="${document.options.imageTheme === 'dark' ? 0.055 : 0.12}" />
    </pattern>
    <filter id="rowShadow" x="-5%" y="-20%" width="110%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="${document.options.imageTheme === 'dark' ? 0.26 : 0.12}" />
    </filter>
    <filter id="barGlow" x="-10%" y="-220%" width="120%" height="540%">
      <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="${palette.accent}" flood-opacity="0.3" />
    </filter>
    <filter id="liquidBlobBlur" x="-40%" y="-240%" width="180%" height="580%">
      <feGaussianBlur stdDeviation="14" />
    </filter>
    <filter id="liquidBarNoise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="3" seed="17" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncR type="table" tableValues="1 1" />
        <feFuncG type="table" tableValues="1 1" />
        <feFuncB type="table" tableValues="1 1" />
        <feFuncA type="table" tableValues="0 0.32" />
      </feComponentTransfer>
    </filter>
    <filter id="socialNoise">
      <feTurbulence type="fractalNoise" baseFrequency="0.74" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.12" />
      </feComponentTransfer>
    </filter>
    <style>
      text { font-family: 'JetBrains Mono','Fira Code',Consolas,ui-monospace,monospace; text-rendering: geometricPrecision; }
    </style>
  `
}

function classicMetricBox(
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  const valueSize = width < 120 ? 15 : 17

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${palette.panelAlt}" stroke="${palette.border}" stroke-opacity="0.11" />
    <rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${Math.max(1, height * 0.42)}" rx="11" fill="url(#rowSheen)" opacity="0.16" />
    ${text(label.toUpperCase(), x + 14, y + 21, { size: 10, weight: 900, fill: palette.muted, letterSpacing: 1 })}
    ${text(truncateToWidth(value, width - 28, valueSize), x + 14, y + height - 15, { size: valueSize, weight: 900, fill: palette.text })}
  `
}

function classicHeroPanel(
  document: BenchmarkExportDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  const top = document.summary.topModel
  if (!top) return ''

  const metricGap = 12
  const metricWidth = clamp(width * 0.34, 220, 336)
  const metricX = x + width - metricWidth - 34
  const metricBoxWidth = (metricWidth - metricGap) / 2
  const metricBoxHeight = height >= 380 ? 64 : 54
  const metricY = y + (height >= 380 ? 86 : 76)
  const scoreAreaWidth = metricX - x - 64
  const compactHero = width < 700
  const scoreSize = compactHero ? 96 : height >= 400 ? 128 : height >= 320 ? 112 : 96
  const scoreY = y + (compactHero ? 164 : height >= 400 ? 176 : height >= 320 ? 154 : 134)
  const nameSize = compactHero ? 22 : height >= 380 ? 27 : 23
  const metaSize = height >= 380 ? 18 : 16
  const nameY = scoreY + (height >= 400 ? 48 : 42)
  const metaY = nameY + (height >= 380 ? 38 : 32)
  const barHeight = height >= 380 ? 18 : 16
  const barY = y + height - (height >= 380 ? 54 : 44)
  const barWidth = width - 68
  const filledWidth = top.effectiveScore === 0 ? 0 : Math.max(8, barWidth * top.effectiveScore)
  const cost = document.summary.totalCost > 0 ? formatCost(document.summary.totalCost) : 'No cost'

  return `
    <g filter="url(#rowShadow)">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${palette.panel}" stroke="url(#socialAccent)" stroke-opacity="0.74" stroke-width="2" />
      <rect x="${x + 2}" y="${y + 2}" width="${width - 4}" height="${height - 4}" rx="22" fill="url(#leaderRowWash)" opacity="0.34" />
      <rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${Math.max(1, height * 0.32)}" rx="23" fill="url(#rowSheen)" opacity="0.18" />
      ${text('TOP EFFECTIVE SCORE', x + 34, y + 50, { size: 19, weight: 900, fill: palette.accent2, letterSpacing: 2 })}
      ${text(formatPercent(top.effectiveScore), x + 34, scoreY, { size: scoreSize, weight: 900, fill: palette.good })}
      <svg x="${x + 38}" y="${nameY - nameSize}" width="${Math.max(120, scoreAreaWidth)}" height="${nameSize + 12}" overflow="hidden">
        ${text(truncateToWidth(top.displayName, Math.max(120, scoreAreaWidth), nameSize), 0, nameSize, { size: nameSize, weight: 600, fill: palette.text })}
      </svg>
      ${text(`${top.scoredCount}/${top.totalExpected} scored / ${formatDuration(document.summary.durationMs)}`, x + 38, metaY, { size: metaSize, weight: 800, fill: palette.muted })}
      ${classicMetricBox('Tests', String(document.summary.testCaseCount), metricX, metricY, metricBoxWidth, metricBoxHeight, palette)}
      ${classicMetricBox('Models', String(document.summary.modelCount), metricX + metricBoxWidth + metricGap, metricY, metricBoxWidth, metricBoxHeight, palette)}
      ${classicMetricBox('Coverage', formatPercent(document.summary.coverage, 0), metricX, metricY + metricBoxHeight + metricGap, metricBoxWidth, metricBoxHeight, palette)}
      ${classicMetricBox('Cost', cost, metricX + metricBoxWidth + metricGap, metricY + metricBoxHeight + metricGap, metricBoxWidth, metricBoxHeight, palette)}
      <rect x="${x + 34}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${barHeight / 2}" fill="${palette.track}" />
      ${liquidBar(`classic-hero-${top.modelId}`, x + 34, barY, filledWidth, barHeight, barHeight / 2, palette, { glow: true, noiseOpacity: 0.14 })}
    </g>
  `
}

function classicLeaderboardRows(
  document: BenchmarkExportDocument,
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  gap: number,
  limit: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  return document.modelRows.slice(0, limit).map((row, index) => {
    const rowY = y + index * (rowHeight + gap)
    const rowFill = index === 0 ? palette.panelAlt : palette.panel
    const rankSize = rowHeight >= 88 ? 34 : 28
    const labelFontSize = rowHeight >= 88 ? 21 : 18
    const subFontSize = rowHeight >= 88 ? 15 : 13
    const scoreSize = rowHeight >= 88 ? 28 : 24
    const labelX = x + (rowHeight >= 80 ? 96 : 82)
    const scoreX = x + width - 24
    const scoreAreaWidth = rowHeight >= 80 ? 134 : 118
    const trackHeight = rowHeight >= 82 ? 14 : 12
    const trackWidth = clamp(width * 0.24, 112, rowHeight >= 80 ? 220 : 190)
    const trackX = x + width - scoreAreaWidth - trackWidth - 22
    const trackY = rowY + rowHeight * 0.58
    const labelWidth = Math.max(100, trackX - labelX - 24)
    const score = clamp(row.effectiveScore, 0, 1)
    const barWidth = score === 0 ? 0 : Math.max(6, score * trackWidth)

    return `
      <g filter="${index === 0 ? 'url(#rowShadow)' : ''}">
        <rect x="${x}" y="${rowY}" width="${width}" height="${rowHeight}" rx="14" fill="${rowFill}" stroke="${index === 0 ? 'url(#socialAccent)' : palette.border}" stroke-opacity="${index === 0 ? 0.58 : 0.12}" stroke-width="${index === 0 ? 2 : 1}" />
        ${index === 0 ? `<rect x="${x + 2}" y="${rowY + 2}" width="${width - 4}" height="${rowHeight - 4}" rx="12" fill="url(#leaderRowWash)" opacity="0.28" />` : ''}
        <rect x="${x + 1}" y="${rowY + 1}" width="${width - 2}" height="${Math.max(1, rowHeight * 0.38)}" rx="13" fill="url(#rowSheen)" opacity="${index === 0 ? 0.2 : 0.12}" />
        <rect x="${x}" y="${rowY + 14}" width="5" height="${rowHeight - 28}" rx="2.5" fill="${index === 0 ? 'url(#socialAccent)' : palette.border}" opacity="${index === 0 ? 1 : 0.16}" />
        ${text(String(row.rank).padStart(2, '0'), x + 24, rowY + rowHeight * 0.61, { size: rankSize, weight: 900, fill: index === 0 ? palette.accent : palette.faint })}
        <svg x="${labelX}" y="${rowY}" width="${labelWidth}" height="${rowHeight}" overflow="hidden">
          ${text(truncateToWidth(row.displayName, labelWidth, labelFontSize), 0, rowHeight * 0.42, { size: labelFontSize, weight: 600, fill: palette.text })}
          ${text(`${row.scoredCount}/${row.totalExpected} scored`, 1, rowHeight * 0.71, { size: subFontSize, weight: 800, fill: palette.muted })}
        </svg>
        <rect x="${trackX}" y="${trackY}" width="${trackWidth}" height="${trackHeight}" rx="${trackHeight / 2}" fill="${palette.track}" />
        ${liquidBar(`classic-row-${row.modelId}-${row.rank}`, trackX, trackY, barWidth, trackHeight, trackHeight / 2, palette, { glow: index === 0, noiseOpacity: 0.12, opacity: index === 0 ? 1 : 0.72 })}
        ${text(formatPercent(row.effectiveScore), scoreX, rowY + rowHeight * 0.61, { size: scoreSize, weight: 900, anchor: 'end', fill: index === 0 ? palette.good : palette.text })}
      </g>
    `
  }).join('')
}

function classicLeaderboardPanel(
  document: BenchmarkExportDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  limit: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  const rows = document.modelRows.slice(0, limit)
  if (rows.length === 0) return ''

  const gap = height >= 720 ? 18 : 14
  const rowTop = y + 78
  const rowHeight = clamp((height - 102 - gap * (rows.length - 1)) / rows.length, 56, height >= 780 ? 122 : 94)

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="22" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.13" />
      <rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${Math.max(1, height * 0.13)}" rx="21" fill="url(#rowSheen)" opacity="0.12" />
      ${text('RANKED MODELS', x + 28, y + 46, { size: 19, weight: 900, fill: palette.accent2, letterSpacing: 2 })}
      ${text('EFFECTIVE SCORE', x + width - 28, y + 46, { size: 13, weight: 900, fill: palette.muted, anchor: 'end', letterSpacing: 1 })}
      ${classicLeaderboardRows(document, x + 18, rowTop, width - 36, rowHeight, gap, limit, palette)}
    </g>
  `
}

function generateClassicShareImageSvg(document: BenchmarkExportDocument): string {
  const { width, height } = PRESETS[document.options.imagePreset]
  const palette = SOCIAL_PALETTES[document.options.imageTheme]
  const padding = width >= 1400 ? 72 : 58
  const isWide = width > height
  const isTall = height >= 1700
  const bodyTop = padding + (isWide ? 202 : 222)
  const footerRuleY = height - padding - 94
  const contentBottom = footerRuleY - 28
  const panelGap = isWide ? 34 : isTall ? 38 : 28
  const hasResults = document.modelRows.length > 0
  const content = (() => {
    if (!hasResults) return socialEmptyState(width, height, padding, palette)

    if (isWide) {
      const availableWidth = width - padding * 2 - panelGap
      const heroWidth = Math.round(availableWidth * 0.43)
      const panelHeight = contentBottom - bodyTop
      const leaderX = padding + heroWidth + panelGap
      const leaderWidth = width - leaderX - padding

      return `
        ${classicHeroPanel(document, padding, bodyTop, heroWidth, panelHeight, palette)}
        ${classicLeaderboardPanel(document, leaderX, bodyTop, leaderWidth, panelHeight, 4, palette)}
      `
    }

    const heroHeight = isTall ? 430 : height >= 1200 ? 340 : 270
    const leaderY = bodyTop + heroHeight + panelGap
    const leaderHeight = contentBottom - leaderY
    const rowLimit = isTall ? 6 : height >= 1200 ? 5 : 3

    return `
      ${classicHeroPanel(document, padding, bodyTop, width - padding * 2, heroHeight, palette)}
      ${classicLeaderboardPanel(document, padding, leaderY, width - padding * 2, leaderHeight, rowLimit, palette)}
    `
  })()

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${socialSvgDefs(document, palette)}
  </defs>
  <rect width="100%" height="100%" fill="${palette.bg}" />
  <rect width="100%" height="100%" fill="url(#socialGrid)" />
  <rect width="100%" height="100%" filter="url(#socialNoise)" opacity="${document.options.imageTheme === 'dark' ? 0.7 : 0.38}" />
  <rect x="${padding / 2}" y="${padding / 2}" width="${width - padding}" height="${height - padding}" rx="28" fill="none" stroke="${palette.border}" stroke-opacity="0.18" stroke-width="3" />
  <rect x="${padding}" y="${padding + 132}" width="${width - padding * 2}" height="7" fill="url(#socialAccent)" />
  ${socialTitle(document, width, padding, palette, 'RESULT CARD')}
  ${content}
  ${socialFooter(document, width, height, padding, palette)}
</svg>`
}

function socialTitle(
  document: BenchmarkExportDocument,
  width: number,
  padding: number,
  palette: typeof SOCIAL_PALETTES.dark,
  rightLabel = 'LLM BENCHMARK',
): string {
  const titleSize = width >= 1400 ? 58 : 50
  const maxTitleLength = width >= 1400 ? 42 : 27
  const meta = `${document.summary.testCaseCount} tests / ${document.summary.modelCount} models / ${formatDuration(document.summary.durationMs)}`
  const iconSize = width >= 1400 ? 62 : 56

  return `
    ${appIconMark(padding, padding, iconSize)}
    ${text('BENCHMAKER', padding + iconSize + 18, padding + 35, { size: 24, weight: 900, fill: palette.accent, letterSpacing: 5 })}
    ${text(rightLabel, width - padding, padding + 35, { size: 21, weight: 800, fill: palette.muted, anchor: 'end', letterSpacing: 2 })}
    ${text(truncate(document.suite.name.toUpperCase(), maxTitleLength), padding, padding + 112, { size: titleSize, weight: 900, fill: palette.text })}
    ${text(meta.toUpperCase(), padding, padding + 166, { size: 20, weight: 800, fill: palette.muted, letterSpacing: 1 })}
  `
}

function socialFooter(document: BenchmarkExportDocument, width: number, height: number, padding: number, palette: typeof SOCIAL_PALETTES.dark): string {
  const footerY = height - padding - 40
  const cost = document.summary.totalCost > 0 ? formatCost(document.summary.totalCost) : 'NO COST DATA'
  const coverage = `${formatPercent(document.summary.coverage, 0)} COVERAGE`
  const generated = formatDateTime(document.generatedAt).toUpperCase()

  return `
    <rect x="${padding}" y="${footerY - 54}" width="${width - padding * 2}" height="2" fill="${palette.border}" opacity="0.55" />
    <rect x="${padding}" y="${footerY - 54}" width="${Math.min(260, width - padding * 2)}" height="8" fill="url(#socialAccent)" />
    ${text(coverage, padding, footerY, { size: 19, weight: 900, fill: palette.text, letterSpacing: 1 })}
    ${text(cost.toUpperCase(), width / 2, footerY, { size: 19, weight: 900, fill: palette.accent2, anchor: 'middle', letterSpacing: 1 })}
    ${text(generated, width - padding, footerY, { size: 16, weight: 700, fill: palette.muted, anchor: 'end' })}
  `
}

function socialEmptyState(width: number, height: number, padding: number, palette: typeof SOCIAL_PALETTES.dark): string {
  return `
    <rect x="${padding}" y="${height * 0.42}" width="${width - padding * 2}" height="150" rx="20" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.2" />
    ${text('NO SCORED RESULTS', width / 2, height * 0.42 + 70, { size: 34, weight: 900, fill: palette.text, anchor: 'middle' })}
    ${text('Run the benchmark to generate a share card.', width / 2, height * 0.42 + 112, { size: 22, weight: 700, fill: palette.muted, anchor: 'middle' })}
  `
}

function renderSocialLeaderboard(
  document: BenchmarkExportDocument,
  width: number,
  height: number,
  padding: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  const rows = document.modelRows.slice(0, height >= 1700 ? 6 : width >= 1400 ? 4 : 5)
  if (rows.length === 0) return socialEmptyState(width, height, padding, palette)

  const chartTop = padding + 232
  const availableHeight = height - chartTop - padding - 128
  const gap = height >= 1700 ? 24 : 18
  const maxRowHeight = height >= 1700 ? 248 : height >= 1200 ? 154 : 142
  const rowHeight = clamp((availableHeight - gap * (rows.length - 1)) / rows.length, 92, maxRowHeight)
  const rowWidth = width - padding * 2
  const labelX = padding + 110
  const labelFontSize = width >= 1400 ? 24 : 21
  const trackX = padding + (width >= 1400 ? 520 : 430)
  const labelWidth = trackX - labelX - 32
  const scoreX = width - padding - 34
  const trackWidth = scoreX - trackX - (width >= 1400 ? 174 : 164)
  const trackHeight = rowHeight >= 150 ? 18 : 15
  const trackYRatio = rowHeight >= 150 ? 0.52 : 0.49

  return `
    <rect x="${padding}" y="${chartTop - 54}" width="${rowWidth}" height="1" fill="${palette.border}" opacity="0.18" />
    ${text('MODEL LEADERBOARD', padding, chartTop - 28, { size: 22, weight: 900, fill: palette.accent2, letterSpacing: 2 })}
    ${text('EFFECTIVE SCORE', scoreX, chartTop - 28, { size: 16, weight: 900, fill: palette.muted, anchor: 'end', letterSpacing: 1 })}
    ${rows.map((row, index) => {
      const y = chartTop + index * (rowHeight + gap)
      const score = clamp(row.effectiveScore, 0, 1)
      const barWidth = score === 0 ? 0 : Math.max(6, score * trackWidth)
      const rowFill = index === 0 ? palette.panelAlt : palette.panel
      const displayName = truncateToWidth(row.displayName, labelWidth, labelFontSize)
      const trackY = y + rowHeight * trackYRatio
      const markerX = trackX + barWidth
      return `
        <g filter="${index === 0 ? 'url(#rowShadow)' : ''}">
          <rect x="${padding}" y="${y}" width="${rowWidth}" height="${rowHeight}" rx="16" fill="${rowFill}" stroke="${index === 0 ? 'url(#socialAccent)' : palette.border}" stroke-opacity="${index === 0 ? 0.72 : 0.14}" stroke-width="${index === 0 ? 2 : 1}" />
          ${index === 0 ? `<rect x="${padding + 2}" y="${y + 2}" width="${rowWidth - 4}" height="${rowHeight - 4}" rx="14" fill="url(#leaderRowWash)" opacity="0.42" />` : ''}
          <rect x="${padding + 1}" y="${y + 1}" width="${rowWidth - 2}" height="${Math.max(1, rowHeight * 0.36)}" rx="15" fill="url(#rowSheen)" opacity="${index === 0 ? 0.24 : 0.13}" />
          <rect x="${padding}" y="${y + 18}" width="6" height="${rowHeight - 36}" rx="3" fill="${index === 0 ? 'url(#socialAccent)' : palette.border}" opacity="${index === 0 ? 1 : 0.18}" />
          ${text(String(row.rank).padStart(2, '0'), padding + 28, y + rowHeight * 0.62, { size: 40, weight: 900, fill: index === 0 ? palette.accent : palette.faint })}
          <svg x="${labelX}" y="${y}" width="${labelWidth}" height="${rowHeight}" overflow="hidden">
            ${text(displayName, 0, rowHeight * 0.45, { size: labelFontSize, weight: 600, fill: palette.text })}
            ${text(`${row.scoredCount}/${row.totalExpected} scored`, 2, rowHeight * 0.72, { size: 18, weight: 700, fill: palette.muted })}
          </svg>
          <rect x="${trackX}" y="${trackY}" width="${trackWidth}" height="${trackHeight}" rx="${trackHeight / 2}" fill="${palette.track}" />
          <rect x="${trackX}" y="${trackY}" width="${trackWidth}" height="1" fill="${palette.border}" opacity="0.2" />
          ${liquidBar(`leaderboard-${row.modelId}-${row.rank}`, trackX, trackY, barWidth, trackHeight, trackHeight / 2, palette, { glow: index === 0, noiseOpacity: 0.12 })}
          ${barWidth > 0 ? `<circle cx="${markerX}" cy="${trackY + trackHeight / 2}" r="${trackHeight * 0.42}" fill="${palette.accent2}" stroke="${rowFill}" stroke-width="3" />` : ''}
          ${text(formatPercent(row.effectiveScore), scoreX, y + rowHeight * 0.6, { size: width >= 1400 ? 36 : 34, weight: 900, fill: index === 0 ? palette.good : palette.text, anchor: 'end' })}
        </g>
      `
    }).join('')}
  `
}

function renderSocialBars(
  document: BenchmarkExportDocument,
  width: number,
  height: number,
  padding: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  const rows = document.modelRows.slice(0, width >= 1400 ? 6 : 5)
  if (rows.length === 0) return socialEmptyState(width, height, padding, palette)

  const top = document.summary.topModel
  const titleY = padding + 190
  const chartTop = titleY + 64
  const chartHeight = height - chartTop - padding - 180
  const chartWidth = width - padding * 2
  const chartInset = 36
  const gap = width >= 1400 ? 26 : 18
  const plotWidth = chartWidth - chartInset * 2
  const barWidth = (plotWidth - gap * (rows.length - 1)) / rows.length
  const baselineY = chartTop + chartHeight

  return `
    ${text('SCORE BARS', padding, titleY, { size: 22, weight: 900, fill: palette.accent2, letterSpacing: 2 })}
    ${text(top ? formatPercent(top.effectiveScore) : '-', width - padding, titleY + 10, { size: 74, weight: 900, fill: palette.good, anchor: 'end' })}
    ${text(top ? truncate(top.displayName, width >= 1400 ? 38 : 29) : 'No model', width - padding, titleY + 52, { size: 18, weight: 600, fill: palette.muted, anchor: 'end', letterSpacing: 0 })}
    <rect x="${padding}" y="${chartTop}" width="${chartWidth}" height="${chartHeight}" rx="20" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.14" />
    <line x1="${padding + chartInset}" y1="${baselineY - 42}" x2="${width - padding - chartInset}" y2="${baselineY - 42}" stroke="${palette.border}" stroke-opacity="0.35" stroke-width="3" />
    ${rows.map((row, index) => {
      const x = padding + chartInset + index * (barWidth + gap)
      const usableHeight = chartHeight - 118
      const actualBarWidth = Math.max(40, barWidth - 24)
      const barHeight = Math.max(12, row.effectiveScore * usableHeight)
      const barX = x + (barWidth - actualBarWidth) / 2
      const barY = baselineY - 42 - barHeight
      const modelLabelSize = width >= 1400 ? 16 : 15
      const modelLabel = truncateToWidth(row.displayName, barWidth - 8, modelLabelSize)
      return `
        <g>
          ${liquidBar(`bars-${row.modelId}-${row.rank}`, barX, barY, actualBarWidth, barHeight, 16, palette, { glow: index === 0, noiseOpacity: index === 0 ? 0.18 : 0.12, opacity: index === 0 ? 1 : 0.42 })}
          ${index === 0 ? '' : `<rect x="${barX}" y="${barY}" width="${actualBarWidth}" height="${barHeight}" rx="16" fill="none" stroke="${palette.border}" stroke-opacity="0.12" />`}
          ${text(formatPercent(row.effectiveScore, 0), x + barWidth / 2, barY - 20, { size: 24, weight: 900, fill: index === 0 ? palette.accent : palette.text, anchor: 'middle' })}
          ${text(modelLabel, x + barWidth / 2, baselineY + 16, { size: modelLabelSize, weight: 600, fill: palette.text, anchor: 'middle' })}
          ${text(`#${row.rank}`, x + barWidth / 2, baselineY + 44, { size: 16, weight: 800, fill: palette.muted, anchor: 'middle' })}
        </g>
      `
    }).join('')}
  `
}

function renderSocialHero(
  document: BenchmarkExportDocument,
  width: number,
  height: number,
  padding: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  const top = document.summary.topModel
  if (!top) return socialEmptyState(width, height, padding, palette)

  const isWide = width > height
  const isTall = height >= 1700
  const isSquare = width === height
  const heroY = isWide ? padding + 350 : isTall ? padding + 525 : padding + 455
  const scoreSize = isWide ? 156 : height >= 1700 ? 188 : 176
  const panelTop = isWide ? padding + 190 : padding + 245
  const panelHeight = isWide ? height - panelTop - padding - 125 : isTall ? 650 : isSquare ? 430 : 470
  const panelWidth = isWide ? width * 0.56 - padding : width - padding * 2
  const panelX = padding
  const miniRows = document.modelRows.slice(1, isWide ? 5 : isTall ? 5 : isSquare ? 3 : 4)
  const miniX = isWide ? width * 0.62 : padding
  const miniY = isWide ? panelTop + 20 : panelTop + panelHeight + (isTall ? 86 : isSquare ? 36 : 54)
  const miniWidth = isWide ? width - miniX - padding : width - padding * 2
  const miniGap = isTall ? 118 : isSquare ? 62 : 74
  const miniRowHeight = isTall ? 86 : isSquare ? 52 : 58

  return `
    <rect x="${panelX}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" rx="26" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.16" />
    ${text('TOP EFFECTIVE SCORE', panelX + 38, panelTop + 58, { size: 22, weight: 900, fill: palette.accent2, letterSpacing: 2 })}
    ${text(formatPercent(top.effectiveScore), panelX + 38, heroY, { size: scoreSize, weight: 900, fill: palette.good })}
    ${text(truncate(top.displayName, isWide ? 35 : 31), panelX + 44, heroY + 62, { size: isWide ? 27 : 30, weight: 600, fill: palette.text })}
    ${text(`${top.scoredCount}/${top.totalExpected} scored / ${formatPercent(top.coverage, 0)} coverage`, panelX + 46, heroY + 104, { size: 22, weight: 800, fill: palette.muted })}
    <rect x="${panelX + 42}" y="${panelTop + panelHeight - 92}" width="${panelWidth - 84}" height="18" rx="9" fill="${palette.track}" />
    ${liquidBar(`hero-${top.modelId}`, panelX + 42, panelTop + panelHeight - 92, Math.max(10, (panelWidth - 84) * top.effectiveScore), 18, 9, palette, { glow: true, noiseOpacity: 0.12 })}
    ${text('NEXT BEST', miniX, miniY, { size: 22, weight: 900, fill: palette.accent2, letterSpacing: 2 })}
    ${miniRows.map((row, index) => {
      const y = miniY + (isTall ? 72 : 58) + index * miniGap
      return `
        <g>
          <rect x="${miniX}" y="${y - 42}" width="${miniWidth}" height="${miniRowHeight}" rx="14" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.12" />
          ${text(`#${row.rank}`, miniX + 22, y - 4, { size: isTall ? 28 : 24, weight: 900, fill: palette.faint })}
          ${text(truncate(row.displayName, isWide ? 32 : isTall ? 36 : 26), miniX + 82, y - 6, { size: isTall ? 24 : 20, weight: 600, fill: palette.text })}
          ${text(formatPercent(row.effectiveScore), miniX + miniWidth - 24, y - 6, { size: isTall ? 28 : 24, weight: 900, fill: palette.text, anchor: 'end' })}
        </g>
      `
    }).join('')}
  `
}

function h2hMetric(label: string, left: string, right: string, x: number, y: number, width: number, palette: typeof SOCIAL_PALETTES.dark): string {
  return `
    <g>
      ${text(left, x, y, { size: 22, weight: 900, fill: palette.text })}
      ${text(label.toUpperCase(), x + width / 2, y, { size: 17, weight: 800, fill: palette.muted, anchor: 'middle', letterSpacing: 1 })}
      ${text(right, x + width, y, { size: 22, weight: 900, fill: palette.text, anchor: 'end' })}
      <line x1="${x}" y1="${y + 18}" x2="${x + width}" y2="${y + 18}" stroke="${palette.border}" stroke-opacity="0.12" />
    </g>
  `
}

function renderSocialH2h(
  document: BenchmarkExportDocument,
  width: number,
  height: number,
  padding: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  const [left, right] = document.modelRows
  if (!left) return socialEmptyState(width, height, padding, palette)

  const fallback: ModelExportRow = right ?? {
    ...left,
    rank: 2,
    displayName: 'No runner-up',
    fullDisplayName: 'No runner-up',
    effectiveScore: 0,
    scoredMean: null,
    coverage: 0,
    successRate: 0,
    scoredCount: 0,
    completedCount: 0,
    failedCount: 0,
    missingCount: left.totalExpected,
    unscoredCount: 0,
    totalCost: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    meanLatencyMs: null,
    medianLatencyMs: null,
  }

  const isWide = width > height
  const isTall = height >= 1700
  const compactStack = !isWide && !isTall
  const compactMetrics = isWide || compactStack
  const topY = isTall ? padding + 250 : compactStack ? padding + 234 : padding + 220
  const panelGap = isWide ? 34 : 28
  const panelWidth = isWide ? (width - padding * 2 - panelGap) / 2 : width - padding * 2
  const panelHeight = isWide ? 320 : isTall ? 330 : compactStack ? 216 : 275
  const leftX = padding
  const rightX = isWide ? padding + panelWidth + panelGap : padding
  const rightY = isWide ? topY : topY + panelHeight + panelGap + (isTall ? 96 : compactStack ? 56 : 72)
  const delta = left.effectiveScore - fallback.effectiveScore
  const metricY = isWide ? topY + panelHeight + 94 : rightY + panelHeight + (isTall ? 128 : compactStack ? 66 : 92)
  const panelNameOffset = compactStack ? 96 : 112
  const panelScoreOffset = compactStack ? 178 : 230
  const panelScoreSize = compactStack ? 74 : 88
  const compactMetricY = isWide ? topY + panelHeight + 42 : rightY + panelHeight + 38
  const deltaWidth = isWide ? 176 : compactStack ? 208 : 236
  const deltaHeight = isWide ? 34 : compactStack ? 50 : 58
  const deltaX = width / 2 - deltaWidth / 2
  const deltaY = isWide ? topY + panelHeight - 14 : topY + panelHeight + (compactStack ? 16 : 25)
  const deltaTextY = deltaY + (isWide ? 23 : compactStack ? 33 : 38)
  const deltaTextSize = isWide ? 17 : compactStack ? 20 : 23

  return `
    ${text('HEAD TO HEAD', padding, topY - (isWide ? 26 : compactStack ? 30 : 42), { size: 22, weight: 900, fill: palette.accent2, letterSpacing: 2 })}
    <rect x="${leftX}" y="${topY}" width="${panelWidth}" height="${panelHeight}" rx="24" fill="${palette.panel}" stroke="${palette.accent}" stroke-width="3" />
    <rect x="${rightX}" y="${rightY}" width="${panelWidth}" height="${panelHeight}" rx="24" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.18" />
    ${text('#01', leftX + 34, topY + 56, { size: 24, weight: 900, fill: palette.accent, letterSpacing: 2 })}
    ${text(truncate(left.displayName, isWide ? 28 : 32), leftX + 34, topY + panelNameOffset, { size: compactStack ? 24 : 27, weight: 600, fill: palette.text })}
    ${text(formatPercent(left.effectiveScore), leftX + 34, topY + panelScoreOffset, { size: panelScoreSize, weight: 900, fill: palette.good })}
    ${text('#02', rightX + 34, rightY + 56, { size: 24, weight: 900, fill: palette.faint, letterSpacing: 2 })}
    ${text(truncate(fallback.displayName, isWide ? 28 : 32), rightX + 34, rightY + panelNameOffset, { size: compactStack ? 24 : 27, weight: 600, fill: palette.text })}
    ${text(formatPercent(fallback.effectiveScore), rightX + 34, rightY + panelScoreOffset, { size: panelScoreSize, weight: 900, fill: palette.text })}
    <rect x="${deltaX}" y="${deltaY}" width="${deltaWidth}" height="${deltaHeight}" rx="${deltaHeight / 2}" fill="url(#socialAccent)" />
    ${text(`${formatSignedPercent(delta)} DELTA`, width / 2, deltaTextY, { size: deltaTextSize, weight: 900, fill: '#090909', anchor: 'middle', letterSpacing: 1 })}
    ${compactMetrics ? `
      <rect x="${padding}" y="${compactMetricY}" width="${width - padding * 2}" height="${isWide ? 76 : 80}" rx="18" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.12" />
      ${text('COVERAGE', padding + 34, compactMetricY + 28, { size: 13, weight: 900, fill: palette.muted, letterSpacing: 1 })}
      ${text(`${formatPercent(left.coverage, 0)} / ${formatPercent(fallback.coverage, 0)}`, padding + 34, compactMetricY + 58, { size: 21, weight: 900, fill: palette.text })}
      ${text('MEAN LATENCY', width / 2, compactMetricY + 28, { size: 13, weight: 900, fill: palette.muted, anchor: 'middle', letterSpacing: 1 })}
      ${text(`${formatLatency(left.meanLatencyMs)} / ${formatLatency(fallback.meanLatencyMs)}`, width / 2, compactMetricY + 58, { size: 21, weight: 900, fill: palette.text, anchor: 'middle' })}
      ${text('TOTAL COST', width - padding - 34, compactMetricY + 28, { size: 13, weight: 900, fill: palette.muted, anchor: 'end', letterSpacing: 1 })}
      ${text(`${formatCost(left.totalCost)} / ${formatCost(fallback.totalCost)}`, width - padding - 34, compactMetricY + 58, { size: 21, weight: 900, fill: palette.text, anchor: 'end' })}
    ` : `
      <rect x="${padding}" y="${metricY - 48}" width="${width - padding * 2}" height="210" rx="22" fill="${palette.panel}" stroke="${palette.border}" stroke-opacity="0.12" />
      ${h2hMetric('Coverage', formatPercent(left.coverage, 0), formatPercent(fallback.coverage, 0), padding + 34, metricY, width - padding * 2 - 68, palette)}
      ${h2hMetric('Mean latency', formatLatency(left.meanLatencyMs), formatLatency(fallback.meanLatencyMs), padding + 34, metricY + 64, width - padding * 2 - 68, palette)}
      ${h2hMetric('Total cost', formatCost(left.totalCost), formatCost(fallback.totalCost), padding + 34, metricY + 128, width - padding * 2 - 68, palette)}
    `}
  `
}

function renderSocialVariant(
  variant: ShareImageVariant,
  document: BenchmarkExportDocument,
  width: number,
  height: number,
  padding: number,
  palette: typeof SOCIAL_PALETTES.dark,
): string {
  if (variant === 'bars') return renderSocialBars(document, width, height, padding, palette)
  if (variant === 'hero') return renderSocialHero(document, width, height, padding, palette)
  if (variant === 'h2h') return renderSocialH2h(document, width, height, padding, palette)
  return renderSocialLeaderboard(document, width, height, padding, palette)
}

function generateSocialCardSvg(document: BenchmarkExportDocument): string {
  const { width, height } = PRESETS[document.options.imagePreset]
  const palette = SOCIAL_PALETTES[document.options.imageTheme]
  const padding = width >= 1400 ? 72 : 58
  const variant = document.options.imageVariant

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${socialSvgDefs(document, palette)}
  </defs>
  <rect width="100%" height="100%" fill="${palette.bg}" />
  <rect width="100%" height="100%" fill="url(#socialGrid)" />
  <rect width="100%" height="100%" filter="url(#socialNoise)" opacity="${document.options.imageTheme === 'dark' ? 0.7 : 0.38}" />
  <rect x="${padding / 2}" y="${padding / 2}" width="${width - padding}" height="${height - padding}" rx="28" fill="none" stroke="${palette.border}" stroke-opacity="0.18" stroke-width="3" />
  <rect x="${padding}" y="${padding + 132}" width="${width - padding * 2}" height="7" fill="url(#socialAccent)" />
  ${socialTitle(document, width, padding, palette)}
  ${renderSocialVariant(variant, document, width, height, padding, palette)}
  ${socialFooter(document, width, height, padding, palette)}
</svg>`
}

export function getShareImageSize(preset: ShareImagePreset): { width: number; height: number } {
  return PRESETS[preset]
}

export function generateShareImageSvg(document: BenchmarkExportDocument): string {
  if (document.options.imageTemplate === 'social-card') {
    return generateSocialCardSvg(document)
  }

  return generateClassicShareImageSvg(document)
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
