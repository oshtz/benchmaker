import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { ResponseCell } from './ResponseCell'
import type { RunResult } from '@/types'

interface ComparisonGridProps {
  run: RunResult
}

const MIN_COLUMN_WIDTH = 120
const MIN_ROW_HEIGHT = 40

export function ComparisonGrid({ run }: ComparisonGridProps) {
  const { testSuites } = useTestSuiteStore()
  const testSuite = testSuites.find((s) => s.id === run.testSuiteId)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const [columnWidths, setColumnWidths] = useState<number[]>([])
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})
  const [isResizingColumn, setIsResizingColumn] = useState<number | null>(null)
  const [isResizingRow, setIsResizingRow] = useState<string | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; initialSize: number }>({ x: 0, y: 0, initialSize: 0 })

  const totalColumns = run.models.length + 1

  // Initialize column widths evenly based on container width
  useEffect(() => {
    const updateColumnWidths = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const evenWidth = Math.max(MIN_COLUMN_WIDTH, Math.floor(containerWidth / totalColumns))
        setColumnWidths(Array(totalColumns).fill(evenWidth))
      }
    }

    updateColumnWidths()

    const resizeObserver = new ResizeObserver(updateColumnWidths)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [totalColumns])

  // Column resize handlers
  const handleColumnResizeStart = useCallback((e: React.MouseEvent, columnIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingColumn(columnIndex)
    resizeStartRef.current = { x: e.clientX, y: 0, initialSize: columnWidths[columnIndex] || MIN_COLUMN_WIDTH }
  }, [columnWidths])

  const handleColumnResizeMove = useCallback((e: MouseEvent) => {
    if (isResizingColumn === null) return

    const delta = e.clientX - resizeStartRef.current.x
    const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartRef.current.initialSize + delta)

    setColumnWidths(prev => {
      const updated = [...prev]
      updated[isResizingColumn] = newWidth
      return updated
    })
  }, [isResizingColumn])

  const handleColumnResizeEnd = useCallback(() => {
    setIsResizingColumn(null)
  }, [])

  // Row resize handlers
  const handleRowResizeStart = useCallback((e: React.MouseEvent, rowId: string, currentHeight: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingRow(rowId)
    resizeStartRef.current = { x: 0, y: e.clientY, initialSize: currentHeight }
  }, [])

  const handleRowResizeMove = useCallback((e: MouseEvent) => {
    if (isResizingRow === null) return

    const delta = e.clientY - resizeStartRef.current.y
    const newHeight = Math.max(MIN_ROW_HEIGHT, resizeStartRef.current.initialSize + delta)

    setRowHeights(prev => ({
      ...prev,
      [isResizingRow]: newHeight
    }))
  }, [isResizingRow])

  const handleRowResizeEnd = useCallback(() => {
    setIsResizingRow(null)
  }, [])

  // Global mouse event listeners for resize
  useEffect(() => {
    if (isResizingColumn !== null) {
      document.addEventListener('mousemove', handleColumnResizeMove)
      document.addEventListener('mouseup', handleColumnResizeEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleColumnResizeMove)
        document.removeEventListener('mouseup', handleColumnResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizingColumn, handleColumnResizeMove, handleColumnResizeEnd])

  useEffect(() => {
    if (isResizingRow !== null) {
      document.addEventListener('mousemove', handleRowResizeMove)
      document.addEventListener('mouseup', handleRowResizeEnd)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleRowResizeMove)
        document.removeEventListener('mouseup', handleRowResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizingRow, handleRowResizeMove, handleRowResizeEnd])

  if (!testSuite) {
    return (
      <div>
        <div className="py-8 text-center text-muted-foreground">
          Test suite not found
        </div>
      </div>
    )
  }

  const toggleRow = (testCaseId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(testCaseId)) {
        next.delete(testCaseId)
      } else {
        next.add(testCaseId)
      }
      return next
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.6) return 'bg-yellow-500'
    if (score >= 0.4) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getResultForCell = (testCaseId: string, modelId: string) => {
    return run.results.find(
      (r) => r.testCaseId === testCaseId && r.modelId === modelId
    )
  }

  const getColumnWidth = (index: number) => columnWidths[index] || MIN_COLUMN_WIDTH
  const getRowHeight = (rowId: string) => rowHeights[rowId]

  // Resize handle component for columns
  const ColumnResizeHandle = ({ columnIndex }: { columnIndex: number }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-[3px] cursor-col-resize z-10 hover:bg-primary/50"
      onMouseDown={(e) => handleColumnResizeStart(e, columnIndex)}
    />
  )

  // Resize handle component for rows
  const RowResizeHandle = ({ rowId, currentHeight }: { rowId: string; currentHeight: number }) => (
    <div
      className="absolute left-0 right-0 bottom-0 h-[3px] cursor-row-resize z-10 hover:bg-primary/50"
      onMouseDown={(e) => handleRowResizeStart(e, rowId, currentHeight)}
    />
  )

  return (
    <div className="overflow-hidden flex flex-col h-full min-h-0">
      <div className="p-0 flex-1 min-h-0" ref={containerRef}>
        <ScrollArea className="h-full w-full">
          <div className="min-w-max">
            {/* Header Row */}
            <div className="flex border-b border-border/70 bg-background/70 sticky top-0 backdrop-blur z-20">
              <div
                className="relative shrink-0 p-2 sm:p-3 font-medium border-r border-border/70 text-sm sm:text-base"
                style={{ width: getColumnWidth(0) }}
              >
                Test Case
                <ColumnResizeHandle columnIndex={0} />
              </div>
              {run.models.map((modelId, idx) => (
                <div
                  key={modelId}
                  className="relative shrink-0 p-2 sm:p-3 font-medium border-r border-border/70 text-center text-sm sm:text-base"
                  style={{ width: getColumnWidth(idx + 1) }}
                >
                  <span className="truncate block">
                    {modelId.split('/').pop()}
                  </span>
                  <ColumnResizeHandle columnIndex={idx + 1} />
                </div>
              ))}
            </div>

            {/* Data Rows */}
            {testSuite.testCases.map((testCase, index) => {
              const rowId = `row-${testCase.id}`
              const customHeight = getRowHeight(rowId)

              return (
                <div key={testCase.id} className="border-b border-border/60 relative">
                  {/* Summary Row */}
                  <div
                    className="flex cursor-pointer hover:bg-muted/40 transition-colors relative"
                    onClick={() => toggleRow(testCase.id)}
                    style={customHeight ? { minHeight: customHeight } : undefined}
                  >
                    <div
                      className="relative shrink-0 p-2 sm:p-3 border-r border-border/60 flex items-center gap-1.5 sm:gap-2 overflow-hidden"
                      style={{ width: getColumnWidth(0) }}
                    >
                      {expandedRows.has(testCase.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm font-medium shrink-0">#{index + 1}</span>
                      <span className="text-xs sm:text-sm truncate min-w-0">
                        {testCase.prompt}
                      </span>
                    </div>
                    {run.models.map((modelId, idx) => {
                      const result = getResultForCell(testCase.id, modelId)
                      return (
                        <div
                          key={modelId}
                          className="relative shrink-0 p-2 sm:p-3 border-r border-border/60 flex items-center justify-center"
                          style={{ width: getColumnWidth(idx + 1) }}
                        >
                          {result?.status === 'running' ? (
                            <span className="decoding-text text-[10px] text-primary uppercase font-bold tracking-widest">RUNNING</span>
                          ) : result?.status === 'failed' ? (
                            <Badge variant="destructive">Failed</Badge>
                          ) : result?.score ? (
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${getScoreColor(
                                  result.score.score
                                )}`}
                              />
                              <span className="font-mono text-sm">
                                {(result.score.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          ) : result?.status === 'completed' ? (
                            <Badge variant="outline">No score</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                      )
                    })}
                    <RowResizeHandle rowId={rowId} currentHeight={customHeight || MIN_ROW_HEIGHT} />
                  </div>

                  {/* Expanded Content */}
                  {expandedRows.has(testCase.id) && (
                    <div className="bg-muted/20">
                      {/* Prompt */}
                      <div className="p-3 sm:p-4 border-b border-border/60">
                        <div className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">
                          Prompt
                        </div>
                        <div className="text-xs sm:text-sm whitespace-pre-wrap">
                          {testCase.prompt}
                        </div>
                        {testCase.expectedOutput && (
                          <div className="mt-2">
                            <div className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">
                              Expected Output
                            </div>
                            <div className="text-xs sm:text-sm font-mono bg-background/70 p-2 rounded-lg border border-border/60">
                              {testCase.expectedOutput}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Responses */}
                      <div className="flex relative">
                        <div
                          className="relative shrink-0 p-2 sm:p-3 border-r border-border/60 text-xs sm:text-sm font-medium text-muted-foreground"
                          style={{ width: getColumnWidth(0) }}
                        >
                          Responses
                        </div>
                        {run.models.map((modelId, idx) => {
                          const result = getResultForCell(testCase.id, modelId)
                          const expandedRowId = `expanded-${testCase.id}`
                          const expandedHeight = getRowHeight(expandedRowId)
                          return (
                            <div
                              key={modelId}
                              className="relative shrink-0 p-2 sm:p-3 border-r border-border/60"
                              style={{
                                width: getColumnWidth(idx + 1),
                                minHeight: expandedHeight
                              }}
                            >
                              <ResponseCell result={result} />
                            </div>
                          )
                        })}
                        <RowResizeHandle
                          rowId={`expanded-${testCase.id}`}
                          currentHeight={getRowHeight(`expanded-${testCase.id}`) || 100}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
