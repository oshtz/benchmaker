import type { BenchmarkExportDocument, ScientificExportFormat, ShareImagePreset } from './types'
import { isoDateForFilename, slugifyFilenamePart } from './formatters'

export interface ExportArtifact {
  blob: Blob
  filename: string
  extension: 'html' | 'pdf' | 'png'
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function blobToBytes(blob: Blob): Promise<number[]> {
  const buffer = await blob.arrayBuffer()
  return Array.from(new Uint8Array(buffer))
}

async function invokeNativeSave(artifact: ExportArtifact): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/tauri')
  const bytes = await blobToBytes(artifact.blob)
  return invoke<string | null>('save_export_file', {
    fileName: artifact.filename,
    extension: artifact.extension,
    bytes,
  })
}

function downloadBlob(artifact: ExportArtifact): void {
  const url = URL.createObjectURL(artifact.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = artifact.filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function saveExportArtifact(artifact: ExportArtifact): Promise<{ savedPath?: string; cancelled: boolean }> {
  if (isTauriRuntime()) {
    const savedPath = await invokeNativeSave(artifact)
    return savedPath ? { savedPath, cancelled: false } : { cancelled: true }
  }

  downloadBlob(artifact)
  return { cancelled: false }
}

export function buildScientificFilename(
  document: BenchmarkExportDocument,
  format: ScientificExportFormat,
): string {
  const date = isoDateForFilename(document.run.startedAt || document.generatedAt)
  const suite = slugifyFilenamePart(document.suite.name)
  return `benchmaker-${suite}-${date}.${format}`
}

export function buildShareImageFilename(
  document: BenchmarkExportDocument,
  preset: ShareImagePreset,
): string {
  const date = isoDateForFilename(document.run.startedAt || document.generatedAt)
  const suite = slugifyFilenamePart(document.suite.name)
  return `benchmaker-${suite}-${preset}-${date}.png`
}
