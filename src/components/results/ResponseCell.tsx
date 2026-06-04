import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TestCaseResult } from '@/types'

interface ResponseCellProps {
  result: TestCaseResult | undefined
}

export function ResponseCell({ result }: ResponseCellProps) {
  const [expanded, setExpanded] = useState(false)

  if (!result) {
    return (
      <div className="text-sm text-muted-foreground">
        No result
      </div>
    )
  }

  if (result.status === 'running') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="decoding-text text-primary text-xs uppercase font-bold tracking-widest">AWAITING_TELEMETRY</span>
          
        </div>
        {result.streamedContent && (
          <div className="text-xs bg-black text-primary font-mono border border-border p-2 rounded-lg max-h-32 overflow-y-auto">
            {result.streamedContent}
          </div>
        )}
      </div>
    )
  }

  if (result.status === 'failed') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Failed
        </div>
        <div className="text-xs text-muted-foreground">
          {result.error || 'Unknown error'}
        </div>
      </div>
    )
  }

  const response = result.response || result.streamedContent || ''
  const isLong = response.length > 200

  return (
    <div className="space-y-2">
      {/* Metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        {result.latencyMs && (
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {(result.latencyMs / 1000).toFixed(1)}s
          </Badge>
        )}
        {result.score && (
          <Badge
            variant={result.score.score >= 0.7 ? 'default' : 'secondary'}
            className="text-xs"
          >
            {(result.score.score * 100).toFixed(0)}%
          </Badge>
        )}
      </div>

      {/* Response */}
      <div
        className={`text-xs bg-black text-primary font-mono border border-border p-2 rounded-lg overflow-hidden ${
          !expanded && isLong ? 'max-h-24' : ''
        }`}
      >
        <pre className="whitespace-pre-wrap font-sans">{response}</pre>
      </div>

      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show more
            </>
          )}
        </Button>
      )}

      {/* Score notes */}
      {result.score?.notes && (
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-lg px-2 py-1">
          {result.score.notes}
        </div>
      )}
    </div>
  )
}
