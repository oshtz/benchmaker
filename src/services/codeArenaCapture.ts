import type { CodeArenaCapture, CodeArenaRuntimeReport, CodeArenaViewport } from '@/types'

const captureCache = new Map<string, string>()
const profiles: Record<CodeArenaViewport, { width: number; height: number }> = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }

export function getCachedCapture(runId: string, modelId: string, viewport: CodeArenaViewport): string | undefined {
  return captureCache.get(`${runId}:${modelId}:${viewport}`)
}

export async function captureCodeArenaOutput(runId: string, modelId: string, code: string, viewport: CodeArenaViewport, allowRemoteAssets: boolean): Promise<{ capture: CodeArenaCapture; runtimeReport: CodeArenaRuntimeReport }> {
  const profile = profiles[viewport]
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(code, 'text/html')
  const remoteUrls = Array.from(documentNode.querySelectorAll('[src],[href]')).map((node) => node.getAttribute('src') ?? node.getAttribute('href') ?? '').filter((url) => /^https?:\/\//i.test(url))
  if (!allowRemoteAssets) {
    for (const node of documentNode.querySelectorAll('[src],[href]')) {
      const attribute = node.hasAttribute('src') ? 'src' : 'href'
      if (/^https?:\/\//i.test(node.getAttribute(attribute) ?? '')) node.removeAttribute(attribute)
    }
  }
  documentNode.querySelectorAll('script').forEach((node) => node.remove())
  const markup = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${profile.width}px;height:${profile.height}px;overflow:hidden;background:white">${documentNode.head.innerHTML}${documentNode.body.innerHTML}</div>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${profile.width}" height="${profile.height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  const image = await loadImage(url)
  URL.revokeObjectURL(url)
  const canvas = document.createElement('canvas'); canvas.width = profile.width; canvas.height = profile.height
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas capture is unavailable.')
  context.fillStyle = '#fff'; context.fillRect(0, 0, profile.width, profile.height); context.drawImage(image, 0, 0)
  const dataUrl = canvas.toDataURL('image/png')
  captureCache.set(`${runId}:${modelId}:${viewport}`, dataUrl)
  let path: string | undefined
  if ('__TAURI_INTERNALS__' in window) {
    const { invoke } = await import('@tauri-apps/api/core')
    const binary = atob(dataUrl.split(',')[1] ?? '')
    const bytes = Array.from(binary, (character) => character.charCodeAt(0))
    path = await invoke<string>('save_code_arena_artifact', { runId, fileName: `${safeName(modelId)}-${viewport}.png`, bytes })
  }
  return { capture: { viewport, ...profile, path, createdAt: Date.now() }, runtimeReport: { consoleMessages: [], runtimeErrors: [], requestFailures: [], blockedRequests: allowRemoteAssets ? [] : remoteUrls } }
}

function loadImage(url: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('The generated document could not be rasterized.')); image.src = url }) }
function safeName(value: string): string { return (value.split('/').pop() ?? 'model').replace(/[^a-z0-9-]/gi, '-') }
