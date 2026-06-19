import { useMemo, useState } from 'react'
import { Download, FileText, Image as ImageIcon, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import {
  buildBenchmarkExportDocument,
  buildScientificFilename,
  buildShareImageFilename,
  generateScientificHtml,
  generateScientificPdf,
  generateShareImagePng,
  generateShareImageSvg,
  getShareImageSize,
  saveExportArtifact,
  type BenchmarkExportOptions,
  type ExportMode,
  type ScientificExportFormat,
  type ShareImagePreset,
} from '@/services/benchmarkExport'
import type { RunResult, TestSuite } from '@/types'

interface ExportResultsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  run: RunResult
  testSuites: TestSuite[]
  allRuns: RunResult[]
}

const DEFAULT_OPTIONS: BenchmarkExportOptions = {
  mode: 'scientific',
  scientificFormat: 'html',
  imagePreset: 'square',
  includeRawResponses: true,
  includeExpectedOutputs: true,
  includeSystemPrompt: false,
  includeJudgePrompt: false,
  includeScoringNotes: true,
  includeCostTokens: true,
  includeMultiRunAnalysis: true,
  anonymizeModelIds: false,
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(1)}%`
}

function OptionRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function ExportResultsDialog({
  open,
  onOpenChange,
  run,
  testSuites,
  allRuns,
}: ExportResultsDialogProps) {
  const [options, setOptions] = useState<BenchmarkExportOptions>(DEFAULT_OPTIONS)
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const exportDocument = useMemo(
    () => buildBenchmarkExportDocument({ run, testSuites, allRuns, options }),
    [allRuns, options, run, testSuites],
  )

  const sharePreviewSrc = useMemo(() => {
    if (options.mode !== 'share-image') return ''
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generateShareImageSvg(exportDocument))}`
  }, [exportDocument, options.mode])

  const updateOption = <Key extends keyof BenchmarkExportOptions>(
    key: Key,
    value: BenchmarkExportOptions[Key],
  ) => {
    setOptions((current) => ({ ...current, [key]: value }))
  }

  const handleModeChange = (mode: string) => {
    updateOption('mode', mode as ExportMode)
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      if (options.mode === 'scientific') {
        if (options.scientificFormat === 'html') {
          const html = generateScientificHtml(exportDocument)
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
          const result = await saveExportArtifact({
            blob,
            filename: buildScientificFilename(exportDocument, 'html'),
            extension: 'html',
          })
          if (!result.cancelled) {
            toast({ title: 'Report exported', description: result.savedPath || 'HTML report downloaded.' })
          }
          return
        }

        const pdf = generateScientificPdf(exportDocument)
        const pdfBuffer = new ArrayBuffer(pdf.byteLength)
        new Uint8Array(pdfBuffer).set(pdf)
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
        const result = await saveExportArtifact({
          blob,
          filename: buildScientificFilename(exportDocument, 'pdf'),
          extension: 'pdf',
        })
        if (!result.cancelled) {
          toast({ title: 'Report exported', description: result.savedPath || 'PDF report downloaded.' })
        }
        return
      }

      const blob = await generateShareImagePng(exportDocument)
      const result = await saveExportArtifact({
        blob,
        filename: buildShareImageFilename(exportDocument, options.imagePreset),
        extension: 'png',
      })
      if (!result.cancelled) {
        toast({ title: 'Image exported', description: result.savedPath || 'Share image downloaded.' })
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown export error',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const expectedCells = exportDocument.summary.expectedResultCount
  const shareSize = getShareImageSize(options.imagePreset)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Benchmark Results</DialogTitle>
          <DialogDescription>
            Create a detailed scientific report or a compact share image for this run.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Tabs value={options.mode} onValueChange={handleModeChange}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scientific" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Scientific
                </TabsTrigger>
                <TabsTrigger value="share-image" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Image
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {options.mode === 'scientific' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Report Format</Label>
                  <Select
                    value={options.scientificFormat}
                    onValueChange={(value) => updateOption('scientificFormat', value as ScientificExportFormat)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="html">HTML report</SelectItem>
                      <SelectItem value="pdf">PDF report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <OptionRow
                  id="include-raw-responses"
                  label="Raw responses"
                  description="Include model output text in the appendix."
                  checked={options.includeRawResponses}
                  onCheckedChange={(checked) => updateOption('includeRawResponses', checked)}
                />
                <OptionRow
                  id="include-expected"
                  label="Expected outputs"
                  description="Show expected answers next to each test case."
                  checked={options.includeExpectedOutputs}
                  onCheckedChange={(checked) => updateOption('includeExpectedOutputs', checked)}
                />
                <OptionRow
                  id="include-system"
                  label="System prompt"
                  description="Include the suite system prompt in methodology."
                  checked={options.includeSystemPrompt}
                  onCheckedChange={(checked) => updateOption('includeSystemPrompt', checked)}
                />
                <OptionRow
                  id="include-judge"
                  label="Judge prompt"
                  description="Include the judge prompt when a judge model was used."
                  checked={options.includeJudgePrompt}
                  onCheckedChange={(checked) => updateOption('includeJudgePrompt', checked)}
                />
                <OptionRow
                  id="include-notes"
                  label="Scoring notes"
                  description="Include judge/scoring notes and result errors."
                  checked={options.includeScoringNotes}
                  onCheckedChange={(checked) => updateOption('includeScoringNotes', checked)}
                />
                <OptionRow
                  id="include-cost"
                  label="Cost and tokens"
                  description="Include token usage and cost metadata when available."
                  checked={options.includeCostTokens}
                  onCheckedChange={(checked) => updateOption('includeCostTokens', checked)}
                />
                <OptionRow
                  id="include-multirun"
                  label="Multi-run analysis"
                  description="Include related completed runs from the same suite."
                  checked={options.includeMultiRunAnalysis}
                  onCheckedChange={(checked) => updateOption('includeMultiRunAnalysis', checked)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Image Size</Label>
                  <Select
                    value={options.imagePreset}
                    onValueChange={(value) => updateOption('imagePreset', value as ShareImagePreset)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Square 1080 x 1080</SelectItem>
                      <SelectItem value="portrait">Portrait 1080 x 1350</SelectItem>
                      <SelectItem value="wide">Wide 1600 x 900</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <OptionRow
                  id="anonymize-image"
                  label="Anonymize model names"
                  description="Use Model 1, Model 2, and Model 3 labels."
                  checked={options.anonymizeModelIds}
                  onCheckedChange={(checked) => updateOption('anonymizeModelIds', checked)}
                />
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  Share images never include prompts, expected outputs, raw responses, or judge prompts.
                </div>
              </div>
            )}

            {options.mode === 'scientific' && (
              <OptionRow
                id="anonymize-report"
                label="Anonymize model names"
                description="Use neutral model labels throughout the export."
                checked={options.anonymizeModelIds}
                onCheckedChange={(checked) => updateOption('anonymizeModelIds', checked)}
              />
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{exportDocument.suite.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(exportDocument.run.startedAt).toLocaleString()} / {exportDocument.run.status}
                  </p>
                </div>
                <Badge variant={exportDocument.suite.source === 'run-snapshot' ? 'success' : 'warning'}>
                  {exportDocument.suite.source === 'run-snapshot' ? 'Snapshot' : 'Reconstructed'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-background/70 p-3">
                  <div className="text-xs text-muted-foreground">Top Model</div>
                  <div className="truncate text-lg font-semibold">
                    {exportDocument.summary.topModel?.displayName || '-'}
                  </div>
                </div>
                <div className="rounded-lg bg-background/70 p-3">
                  <div className="text-xs text-muted-foreground">Top Score</div>
                  <div className="text-lg font-semibold text-emerald-600">
                    {formatPercent(exportDocument.summary.topModel?.effectiveScore)}
                  </div>
                </div>
                <div className="rounded-lg bg-background/70 p-3">
                  <div className="text-xs text-muted-foreground">Coverage</div>
                  <div className="text-lg font-semibold">
                    {formatPercent(exportDocument.summary.coverage)}
                  </div>
                </div>
                <div className="rounded-lg bg-background/70 p-3">
                  <div className="text-xs text-muted-foreground">Cells</div>
                  <div className="text-lg font-semibold">
                    {exportDocument.summary.scoredCount}/{expectedCells}
                  </div>
                </div>
              </div>

              {exportDocument.caveats.length > 0 && (
                <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    <ShieldAlert className="h-4 w-4" />
                    Export caveats
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {exportDocument.caveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {options.mode === 'share-image' ? (
              <div className="rounded-lg border border-border/60 bg-background p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>PNG preview</span>
                  <span>{shareSize.width} x {shareSize.height}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/60 bg-muted">
                  <img src={sharePreviewSrc} alt="Benchmark share image preview" className="block w-full" />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60">
                <div className="border-b border-border/60 bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Report Contents
                </div>
                <div className="grid gap-2 p-3 text-sm sm:grid-cols-2">
                  <Badge variant="outline">Executive summary</Badge>
                  <Badge variant="outline">Leaderboard</Badge>
                  <Badge variant="outline">Methodology</Badge>
                  <Badge variant="outline">Per-test results</Badge>
                  {options.includeRawResponses && <Badge variant="outline">Raw response appendix</Badge>}
                  {options.includeMultiRunAnalysis && <Badge variant="outline">Multi-run analysis</Badge>}
                  {options.includeSystemPrompt && <Badge variant="outline">System prompt</Badge>}
                  {options.includeJudgePrompt && <Badge variant="outline">Judge prompt</Badge>}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || exportDocument.summary.expectedResultCount === 0}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export {options.mode === 'scientific' ? options.scientificFormat.toUpperCase() : 'PNG'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
