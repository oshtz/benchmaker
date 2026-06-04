import { useEffect, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CodePreviewPanelProps {
  code: string
  className?: string
}

export function CodePreviewPanel({ code, className = '' }: CodePreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  // Update iframe content when code changes
  useEffect(() => {
    if (!code) {
      setError(null)
      return
    }

    try {
      // Validate that we have some HTML content
      if (!code.includes('<') || !code.includes('>')) {
        setError('Invalid HTML content')
        return
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render preview')
    }
  }, [code])

  const handleRefresh = () => {
    setKey((prev) => prev + 1)
  }

  if (!code) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-xl ${className}`}>
        <p className="text-sm text-muted-foreground">No code to preview</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-destructive/10 rounded-xl p-4 ${className}`}>
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={`relative bg-white rounded-xl overflow-hidden ${className}`}>
      {/* Refresh button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 h-7 w-7 bg-background/80 hover:bg-background"
        onClick={handleRefresh}
        title="Refresh preview"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>

      {/* Sandboxed iframe for rendering HTML */}
      <iframe
        key={key}
        ref={iframeRef}
        srcDoc={code}
        sandbox="allow-scripts"
        className="w-full h-full border-0"
        title="Code Preview"
        style={{ backgroundColor: 'white' }}
      />
    </div>
  )
}
