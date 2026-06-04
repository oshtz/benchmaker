import { useRef, useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CodeEditorViewProps {
  code: string
  className?: string
  showLineNumbers?: boolean
  isStreaming?: boolean
}

export function CodeEditorView({ 
  code, 
  className = '',
  showLineNumbers = true,
  isStreaming = false
}: CodeEditorViewProps) {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [code, isStreaming])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  // Simple syntax highlighting for HTML/CSS/JS
  const highlightCode = (code: string): string => {
    if (!code) return ''

    // Escape HTML entities first
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // HTML tags
    highlighted = highlighted.replace(
      /(&lt;\/?)([\w-]+)([^&]*?)(&gt;)/g,
      '<span class="text-pink-500">$1</span><span class="text-blue-500">$2</span><span class="text-yellow-600">$3</span><span class="text-pink-500">$4</span>'
    )

    // HTML attributes
    highlighted = highlighted.replace(
      /(\s)([\w-]+)(=)(&quot;|&#39;|")/g,
      '$1<span class="text-orange-400">$2</span><span class="text-white">$3</span><span class="text-green-400">$4</span>'
    )

    // Strings (in attributes)
    highlighted = highlighted.replace(
      /(&quot;|&#39;)([^&]*)(&quot;|&#39;)/g,
      '<span class="text-green-400">$1$2$3</span>'
    )

    // CSS properties (inside style tags or style attributes)
    highlighted = highlighted.replace(
      /([\w-]+)(\s*:\s*)([^;{}]+)(;)/g,
      '<span class="text-cyan-400">$1</span>$2<span class="text-orange-300">$3</span>$4'
    )

    // JavaScript keywords
    const jsKeywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw', 'import', 'export', 'default', 'from']
    jsKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'g')
      highlighted = highlighted.replace(regex, '<span class="text-purple-400">$1</span>')
    })

    // Comments (HTML, CSS, JS)
    highlighted = highlighted.replace(
      /(&lt;!--[\s\S]*?--&gt;)/g,
      '<span class="text-gray-500 italic">$1</span>'
    )
    highlighted = highlighted.replace(
      /(\/\*[\s\S]*?\*\/)/g,
      '<span class="text-gray-500 italic">$1</span>'
    )
    highlighted = highlighted.replace(
      /(\/\/[^\n]*)/g,
      '<span class="text-gray-500 italic">$1</span>'
    )

    return highlighted
  }

  const lines = code.split('\n')
  const lineCount = lines.length
  const lineNumberWidth = String(lineCount).length

  if (!code) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-xl ${className}`}>
        <p className="text-sm text-muted-foreground">No code generated yet</p>
      </div>
    )
  }

  return (
    <div className={`relative bg-[#1e1e1e] rounded-xl overflow-hidden ${className}`}>
      {/* Copy button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 h-7 w-7 bg-background/20 hover:bg-background/40 text-white"
        onClick={handleCopy}
        title="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>

      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="flex text-sm font-mono">
          {/* Line numbers */}
          {showLineNumbers && (
            <div className="flex-shrink-0 py-3 pl-3 pr-2 text-right text-gray-500 select-none border-r border-gray-700">
              {lines.map((_, index) => (
                <div key={index} className="leading-6">
                  {String(index + 1).padStart(lineNumberWidth, ' ')}
                </div>
              ))}
            </div>
          )}

          {/* Code content */}
          <pre
            ref={codeRef}
            className="flex-1 py-3 px-4 overflow-x-auto text-gray-100 leading-6"
            dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
          />
        </div>
      </ScrollArea>
    </div>
  )
}
