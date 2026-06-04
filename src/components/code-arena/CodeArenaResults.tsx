import { useState } from 'react'
import { History, Trash2, Eye, Code, Clock, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCodeArenaRunStore } from '@/stores/codeArenaRunStore'
import { CodePreviewPanel } from './CodePreviewPanel'
import { CodeEditorView } from './CodeEditorView'
import type { CodeArenaOutput } from '@/types'

export function CodeArenaResults() {
  const { runs, currentRunId, setCurrentRun, deleteRun } = useCodeArenaRunStore()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')

  const currentRun = runs.find((r) => r.id === currentRunId)
  const selectedOutput = currentRun?.outputs.find((o) => o.modelId === selectedOutputId)

  if (runs.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-full gap-4 py-12">
          <History className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="font-medium">No Code Arena Runs Yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Run a Code Arena benchmark to see results here
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Run selector */}
      <Card className="shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Code Arena History</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={currentRunId || ''} onValueChange={setCurrentRun}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      <div className="flex flex-col">
                        <span className="truncate max-w-[250px]">
                          {run.prompt.slice(0, 50)}...
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString()} - {run.models.length} models
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentRunId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Run details */}
      {currentRun && (
        <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-3">
          {/* Model list */}
          <Card className="lg:col-span-1 min-h-0 flex flex-col">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm">Models</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-4 pt-0">
                  {currentRun.outputs.map((output) => (
                    <OutputCard
                      key={output.modelId}
                      output={output}
                      isSelected={selectedOutputId === output.modelId}
                      onClick={() => setSelectedOutputId(output.modelId)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Output viewer */}
          <Card className="lg:col-span-2 min-h-0 flex flex-col">
            <CardHeader className="pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {selectedOutput 
                    ? selectedOutput.modelId.split('/').pop() 
                    : 'Select a model'}
                </CardTitle>
                {selectedOutput && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant={viewMode === 'preview' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7"
                      onClick={() => setViewMode('preview')}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant={viewMode === 'code' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7"
                      onClick={() => setViewMode('code')}
                    >
                      <Code className="h-3.5 w-3.5 mr-1" />
                      Code
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-2">
              {selectedOutput ? (
                viewMode === 'preview' ? (
                  <CodePreviewPanel 
                    code={selectedOutput.extractedCode} 
                    className="h-full" 
                  />
                ) : (
                  <CodeEditorView 
                    code={selectedOutput.extractedCode} 
                    className="h-full" 
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a model to view its output
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Code Arena Run"
        description="Are you sure you want to delete this run? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (currentRunId) {
            deleteRun(currentRunId)
          }
          setDeleteDialogOpen(false)
        }}
      />
    </div>
  )
}

interface OutputCardProps {
  output: CodeArenaOutput
  isSelected: boolean
  onClick: () => void
}

function OutputCard({ output, isSelected, onClick }: OutputCardProps) {
  const modelName = output.modelId.split('/').pop() || output.modelId

  const getStatusBadge = () => {
    switch (output.status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Done</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'bg-primary/10 border-primary'
          : 'bg-background/60 border-border/70 hover:bg-muted/70'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{modelName}</span>
        {getStatusBadge()}
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        {output.latencyMs && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(output.latencyMs / 1000).toFixed(1)}s
          </span>
        )}
        {output.cost !== undefined && output.cost > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${output.cost.toFixed(4)}
          </span>
        )}
        {output.score && (
          <span className="font-medium text-foreground">
            Score: {Math.round(output.score.score * 100)}%
          </span>
        )}
      </div>

      {output.error && (
        <p className="text-xs text-destructive mt-2 truncate">{output.error}</p>
      )}
    </div>
  )
}
