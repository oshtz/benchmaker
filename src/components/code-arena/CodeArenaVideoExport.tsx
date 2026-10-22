import { useEffect, useMemo, useRef, useState } from 'react'
import { Square, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useCodeArenaRunStore } from '@/stores/codeArenaRunStore'
import type { CodeArenaRun } from '@/types'
import {
  cancelCodeArenaVideoExport,
  CODE_ARENA_VIDEO_PRESETS,
  createCodeArenaVideoJobId,
  defaultCodeArenaVideoSelection,
  exportCodeArenaVideo,
  type CodeArenaVideoAspect,
  type CodeArenaVideoProgress,
  type CodeArenaVideoTheme,
} from '@/services/codeArenaVideo'

export function CodeArenaVideoExport({ run }: { run: CodeArenaRun }) {
  const [aspect, setAspect] = useState<CodeArenaVideoAspect>('wide')
  const [theme, setTheme] = useState<CodeArenaVideoTheme>('dark')
  const [selected, setSelected] = useState<string[]>(() => defaultCodeArenaVideoSelection(run))
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<CodeArenaVideoProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { updateRun } = useCodeArenaRunStore()
  const { toast } = useToast()
  const desktopRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const candidates = useMemo(
    () => run.outputs.filter((output) => output.status === 'completed' && (output.captures?.length ?? 0) >= 2),
    [run.outputs],
  )

  useEffect(() => {
    setSelected(defaultCodeArenaVideoSelection(run))
    setProgress(null)
  }, [run.id])

  const toggleModel = (modelId: string, checked: boolean) => {
    setSelected((current) => checked
      ? current.includes(modelId) || current.length >= 4 ? current : [...current, modelId]
      : current.filter((item) => item !== modelId))
  }

  const exportVideo = async () => {
    const nextJobId = createCodeArenaVideoJobId()
    const controller = new AbortController()
    abortRef.current = controller
    setJobId(nextJobId)
    setProgress({ jobId: nextJobId, phase: 'preparing', progress: 0, message: 'Preparing reel' })
    try {
      const artifact = await exportCodeArenaVideo({ run, modelIds: selected, aspect, theme, jobId: nextJobId, onProgress: setProgress, signal: controller.signal })
      if (!artifact) return
      updateRun(run.id, { exportArtifacts: [...(run.exportArtifacts ?? []), artifact] })
      toast({ title: 'MP4 reel exported', description: artifact.path })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export Code Arena reel.'
      toast({ title: message.includes('cancelled') ? 'Export cancelled' : 'Video export failed', description: message, variant: message.includes('cancelled') ? 'default' : 'destructive' })
    } finally {
      abortRef.current = null
      setJobId(null)
    }
  }

  const cancel = async () => {
    abortRef.current?.abort()
    if (jobId) await cancelCodeArenaVideoExport(jobId)
  }

  const preset = CODE_ARENA_VIDEO_PRESETS[aspect]
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Video className="h-4 w-4" />Comparison reel</h3>
        <p className="mt-1 text-xs text-muted-foreground">Intro, up to four captured model cards, and a scored leaderboard. Encoded locally as H.264, 30 fps, with no audio.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Aspect preset</Label>
          <Select value={aspect} onValueChange={(value) => setAspect(value as CodeArenaVideoAspect)} disabled={Boolean(jobId)}>
            <SelectTrigger aria-label="Video aspect preset"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wide">Wide · 1600×900</SelectItem>
              <SelectItem value="square">Square · 1080×1080</SelectItem>
              <SelectItem value="portrait">Portrait · 1080×1350</SelectItem>
              <SelectItem value="story">Story · 1080×1920</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select value={theme} onValueChange={(value) => setTheme(value as CodeArenaVideoTheme)} disabled={Boolean(jobId)}>
            <SelectTrigger aria-label="Video theme"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="dark">Dark</SelectItem><SelectItem value="light">Light</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Model cards · {selected.length}/4</Label>
        {candidates.length === 0 ? <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Freeze the run first to create fixed desktop and mobile captures.</p> : <div className="grid gap-2 sm:grid-cols-2">{candidates.map((output) => {
          const checked = selected.includes(output.modelId)
          const id = `video-model-${run.id}-${output.modelId}`.replace(/[^a-z0-9-]/gi, '-')
          return <label key={output.modelId} htmlFor={id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><Checkbox id={id} checked={checked} disabled={Boolean(jobId) || (!checked && selected.length >= 4)} onCheckedChange={(value) => toggleModel(output.modelId, value === true)} /><span className="min-w-0 flex-1 truncate">{output.modelId.split('/').pop()}</span><span className="text-xs text-muted-foreground">{output.rubricScores ? `${Math.round(output.rubricScores.total)}%` : '—'}</span></label>
        })}</div>}
      </div>
      {progress && <div className="space-y-2" aria-live="polite"><div className="flex justify-between text-xs text-muted-foreground"><span>{progress.message}</span><span>{Math.round(progress.progress * 100)}%</span></div><Progress value={progress.progress * 100} /></div>}
      {!desktopRuntime && <p className="text-xs text-amber-600">MP4 encoding requires the Benchmaker desktop runtime. Browser preview and HTML export remain available.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{preset.width}×{preset.height} · approximately {4 + selected.length * 3}s</span>
        {jobId ? <Button variant="destructive" onClick={() => void cancel()}><Square className="mr-2 h-4 w-4" />Cancel encoding</Button> : <Button disabled={!desktopRuntime || selected.length === 0} onClick={() => void exportVideo()}><Video className="mr-2 h-4 w-4" />Export MP4</Button>}
      </div>
      {(run.exportArtifacts ?? []).filter((artifact) => artifact.kind === 'mp4').slice(0, 2).map((artifact) => <p key={artifact.id} className="truncate text-xs text-muted-foreground">Last export: {artifact.path}</p>)}
    </div>
  )
}
