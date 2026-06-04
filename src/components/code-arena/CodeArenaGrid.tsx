import React from 'react'
import { Eye, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { CodeArenaModelPanel } from './CodeArenaModelPanel'
import { useCodeArenaStore } from '@/stores/codeArenaStore'

export function CodeArenaGrid() {
  const { 
    selectedModelIds, 
    outputs, 
    viewModes, 
    toggleViewMode,
    setAllViewModes 
  } = useCodeArenaStore()

  if (selectedModelIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
        <p>Select models to compare</p>
      </div>
    )
  }

  // Check if all are in preview mode
  const allPreview = selectedModelIds.every(id => viewModes.get(id) !== false)
  const allCode = selectedModelIds.every(id => viewModes.get(id) === false)

  // For single model, just show it full width
  if (selectedModelIds.length === 1) {
    const modelId = selectedModelIds[0]
    return (
      <div className="flex flex-col h-full gap-3">
        {/* Global view toggle */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <span className="text-sm text-muted-foreground mr-2">View:</span>
          <Button
            variant={allPreview ? 'default' : 'outline'}
            size="sm"
            className="h-7"
            onClick={() => setAllViewModes(true)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Preview
          </Button>
          <Button
            variant={allCode ? 'default' : 'outline'}
            size="sm"
            className="h-7"
            onClick={() => setAllViewModes(false)}
          >
            <Code className="h-3.5 w-3.5 mr-1" />
            Code
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          <CodeArenaModelPanel
            modelId={modelId}
            output={outputs.get(modelId)}
            isPreviewMode={viewModes.get(modelId) !== false}
            onToggleView={() => toggleViewMode(modelId)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Global view toggle */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        <span className="text-sm text-muted-foreground mr-2">All views:</span>
        <Button
          variant={allPreview ? 'default' : 'outline'}
          size="sm"
          className="h-7"
          onClick={() => setAllViewModes(true)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Preview
        </Button>
        <Button
          variant={allCode ? 'default' : 'outline'}
          size="sm"
          className="h-7"
          onClick={() => setAllViewModes(false)}
        >
          <Code className="h-3.5 w-3.5 mr-1" />
          Code
        </Button>
      </div>

      {/* Model panels with resizable layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {selectedModelIds.map((modelId, index) => (
            <React.Fragment key={modelId}>
              <ResizablePanel
                defaultSize={100 / selectedModelIds.length}
                minSize={20}
              >
                <div className="h-full px-1">
                  <CodeArenaModelPanel
                    modelId={modelId}
                    output={outputs.get(modelId)}
                    isPreviewMode={viewModes.get(modelId) !== false}
                    onToggleView={() => toggleViewMode(modelId)}
                  />
                </div>
              </ResizablePanel>
              {index < selectedModelIds.length - 1 && (
                <ResizableHandle withHandle />
              )}
            </React.Fragment>
          ))}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
