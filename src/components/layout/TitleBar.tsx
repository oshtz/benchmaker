import { appWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
  const handleMinimize = () => {
    void appWindow.minimize()
  }

  const handleMaximize = () => {
    void appWindow.toggleMaximize()
  }

  const handleClose = () => {
    void appWindow.close()
  }

  return (
    <div
      data-tauri-drag-region
      className="h-9 flex items-center justify-between bg-background/80 backdrop-blur-sm border-b border-border select-none relative z-50"
    >
      {/* Left side - Drag region */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* Right side - Window controls */}
      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Minimize"
        >
          <Minus className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Maximize"
        >
          <Square className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-inherit" />
        </button>
      </div>
    </div>
  )
}
