import { AlertCircle, Clock, DollarSign, Code, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodePreviewPanel } from './CodePreviewPanel'
import { CodeEditorView } from './CodeEditorView'
import type { CodeArenaOutput } from '@/types'

interface CodeArenaModelPanelProps {
  modelId: string
  output: CodeArenaOutput | undefined
  isPreviewMode: boolean
  onToggleView: () => void
}

export function CodeArenaModelPanel({
  modelId,
  output,
  isPreviewMode,
  onToggleView,
}: CodeArenaModelPanelProps) {
  const modelName = modelId.split('/').pop() || modelId

  const getStatusBadge = () => {
    if (!output) {
      return <Badge variant="secondary">Pending</Badge>
    }

    switch (output.status) {
      case 'running':
        return (
          <Badge variant="outline" className="border-primary text-primary">
            <span className="decoding-text">
            RUNNING</span>
          </Badge>
        )
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge variant="secondary">Idle</Badge>
    }
  }

  const getScoreBadge = () => {
    if (!output?.score) return null

    const score = output.score.score
    const percentage = Math.round(score * 100)
    
    let bgColor = 'bg-green-500'
    
    if (score < 0.4) {
      bgColor = 'bg-red-500'
    } else if (score < 0.7) {
      bgColor = 'bg-yellow-500'
    }

    return (
      <Badge variant="default" className={bgColor}>
        Score: {percentage}%
      </Badge>
    )
  }

  const displayCode = output?.extractedCode || ''
  const isLoading = output?.status === 'running'
  const hasError = output?.status === 'failed'

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="py-2 px-3 shrink-0 border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium truncate" title={modelId}>
            {modelName}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {getStatusBadge()}
            {getScoreBadge()}
          </div>
        </div>

        {/* View toggle and metadata */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Button
              variant={isPreviewMode ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => !isPreviewMode && onToggleView()}
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
            <Button
              variant={!isPreviewMode ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => isPreviewMode && onToggleView()}
            >
              <Code className="h-3 w-3 mr-1" />
              Code
            </Button>
          </div>

          {/* Metadata badges */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {output?.latencyMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(output.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
            {output?.cost !== undefined && output.cost > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${output.cost.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        {hasError ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive p-4">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm text-center">{output?.error || 'An error occurred'}</p>
          </div>
        ) : isLoading && !displayCode ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
            <span className="decoding-text text-primary font-bold">RUNNING</span>
            <p className="text-sm text-muted-foreground">Generating code...</p>
            {output?.streamedContent && (
              <p className="text-xs text-muted-foreground">
                {output.streamedContent.length} characters received
              </p>
            )}
          </div>
        ) : isPreviewMode ? (
          <CodePreviewPanel code={displayCode} className="h-full" />
        ) : (
          <CodeEditorView code={displayCode} className="h-full" isStreaming={isLoading} />
        )}
      </CardContent>

      {/* Score notes */}
      {output?.score?.notes && (
        <div className="px-3 py-2 shrink-0 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground line-clamp-2">
            {output.score.notes}
          </div>
        </div>
      )}
    </Card>
  )
}
