export function shortModelName(modelId: string): string {
  const parts = modelId.split('/')
  return parts[parts.length - 1] || modelId
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined || Number.isNaN(cost)) return '-'
  if (cost === 0) return '$0.00'
  if (cost < 0.0001) return '<$0.0001'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs < 0) return '-'
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`
  const seconds = durationMs / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

export function formatLatency(latencyMs: number | null | undefined): string {
  if (latencyMs === null || latencyMs === undefined || Number.isNaN(latencyMs)) return '-'
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`
  return `${(latencyMs / 1000).toFixed(1)}s`
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Math.round(value).toLocaleString()
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function isoDateForFilename(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function slugifyFilenamePart(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || 'benchmark'
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function escapeXml(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}
