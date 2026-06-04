import { useState, useRef } from 'react'
import { Plus, Trash2, Edit, ChevronDown, ChevronRight, Download, Upload, FileJson, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { TestCaseEditor } from './TestCaseEditor'
import { useToast } from '@/components/ui/use-toast'
import type { TestSuite, TestCase, ScoringMethod } from '@/types'

interface TestCaseListProps {
  testSuite: TestSuite
}

interface ExportableTestCase {
  prompt: string
  expectedOutput?: string
  scoringMethod: ScoringMethod
  weight: number
  category?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
}

function exportToJSON(testCases: TestCase[]): string {
  const exportData: ExportableTestCase[] = testCases.map((tc) => ({
    prompt: tc.prompt,
    expectedOutput: tc.expectedOutput,
    scoringMethod: tc.scoringMethod,
    weight: tc.weight,
    category: tc.metadata.category,
    difficulty: tc.metadata.difficulty,
    tags: tc.metadata.tags,
  }))
  return JSON.stringify(exportData, null, 2)
}

function exportToCSV(testCases: TestCase[]): string {
  const headers = ['prompt', 'expectedOutput', 'scoringMethod', 'weight', 'category', 'difficulty', 'tags']
  const escapeCSV = (value: string | undefined | null): string => {
    if (value === undefined || value === null) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = testCases.map((tc) => [
    escapeCSV(tc.prompt),
    escapeCSV(tc.expectedOutput),
    tc.scoringMethod,
    String(tc.weight),
    escapeCSV(tc.metadata.category),
    tc.metadata.difficulty || '',
    tc.metadata.tags.join(';'),
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

function parseJSON(content: string): Omit<TestCase, 'id'>[] {
  const data = JSON.parse(content)
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    prompt: item.prompt || '',
    expectedOutput: item.expectedOutput,
    scoringMethod: item.scoringMethod || 'exact-match',
    weight: item.weight ?? 1,
    metadata: {
      category: item.category,
      difficulty: item.difficulty,
      tags: Array.isArray(item.tags) ? item.tags : [],
    },
  }))
}

function parseCSV(content: string): Omit<TestCase, 'id'>[] {
  const lines = content.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return []

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
  const promptIdx = headers.indexOf('prompt')
  const expectedIdx = headers.indexOf('expectedoutput')
  const scoringIdx = headers.indexOf('scoringmethod')
  const weightIdx = headers.indexOf('weight')
  const categoryIdx = headers.indexOf('category')
  const difficultyIdx = headers.indexOf('difficulty')
  const tagsIdx = headers.indexOf('tags')

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    return {
      prompt: values[promptIdx] || '',
      expectedOutput: values[expectedIdx] || undefined,
      scoringMethod: (values[scoringIdx] as ScoringMethod) || 'exact-match',
      weight: parseFloat(values[weightIdx]) || 1,
      metadata: {
        category: values[categoryIdx] || undefined,
        difficulty: (['easy', 'medium', 'hard'].includes(values[difficultyIdx])
          ? values[difficultyIdx]
          : undefined) as 'easy' | 'medium' | 'hard' | undefined,
        tags: values[tagsIdx] ? values[tagsIdx].split(';').filter(Boolean) : [],
      },
    }
  })
}

export function TestCaseList({ testSuite }: TestCaseListProps) {
  const { deleteTestCase, addTestCases } = useTestSuiteStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const getExpectedLabel = (method: TestCase['scoringMethod']) => {
    switch (method) {
      case 'regex-match':
        return 'Regex Pattern'
      case 'numeric-tolerance':
        return 'Expected Number'
      case 'boolean':
        return 'Expected Text'
      case 'llm-judge':
        return 'Reference Answer'
      default:
        return 'Expected Output'
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDelete = (testCaseId: string) => {
    deleteTestCase(testSuite.id, testCaseId)
  }

  const handleExportJSON = () => {
    const content = exportToJSON(testSuite.testCases)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${testSuite.name.replace(/[^a-z0-9]/gi, '_')}_test_cases.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Exported', description: `${testSuite.testCases.length} test cases exported to JSON` })
  }

  const handleExportCSV = () => {
    const content = exportToCSV(testSuite.testCases)
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${testSuite.name.replace(/[^a-z0-9]/gi, '_')}_test_cases.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Exported', description: `${testSuite.testCases.length} test cases exported to CSV` })
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        let testCases: Omit<TestCase, 'id'>[]

        if (file.name.endsWith('.json')) {
          testCases = parseJSON(content)
        } else if (file.name.endsWith('.csv')) {
          testCases = parseCSV(content)
        } else {
          throw new Error('Unsupported file format. Use JSON or CSV.')
        }

        if (testCases.length === 0) {
          throw new Error('No valid test cases found in file')
        }

        addTestCases(testSuite.id, testCases)
        toast({
          title: 'Imported',
          description: `${testCases.length} test case${testCases.length !== 1 ? 's' : ''} imported successfully`,
        })
      } catch (error) {
        toast({
          title: 'Import failed',
          description: error instanceof Error ? error.message : 'Failed to parse file',
          variant: 'destructive',
        })
      }
    }
    reader.readAsText(file)

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getScoringBadgeVariant = (method: string) => {
    switch (method) {
      case 'exact-match':
        return 'default'
      case 'regex-match':
        return 'secondary'
      case 'llm-judge':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getScoringBadgeLabel = (method: string) => {
    switch (method) {
      case 'exact-match':
        return 'Exact'
      case 'regex-match':
        return 'Regex'
      case 'llm-judge':
        return 'Judge'
      case 'numeric-tolerance':
        return 'Numeric'
      case 'boolean':
        return 'Bool'
      default:
        return method
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleImport}
        className="hidden"
      />
      <div className="h-full flex flex-col min-w-0 min-h-0 overflow-hidden bg-transparent">
        <div className="p-4 border-b border-border/40 shrink-0 bg-background/60 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Test Cases</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {testSuite.testCases.length} test case
                {testSuite.testCases.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={testSuite.testCases.length === 0}>
                    <Download className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button size="sm" onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 p-0 overflow-hidden min-w-0 min-h-0">
          <div className="h-full overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6">
            {testSuite.testCases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No test cases yet. Click "Add" to create one.
              </div>
            ) : (
              <div className="space-y-2 min-w-0">
                {testSuite.testCases.map((testCase, index) => (
                  <div
                    key={testCase.id}
                    className="border border-border/40 rounded-xl overflow-hidden bg-card shadow-sm min-w-0"
                  >
                    <div
                      className="group flex items-center gap-2 p-3 bg-muted/20 cursor-pointer hover:bg-muted/50 hover:border-l-2 hover:border-l-primary transition-colors min-w-0"
                      onClick={() => toggleExpanded(testCase.id)}
                    >
                      {expandedIds.has(testCase.id) ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <span className="text-sm font-medium shrink-0">
                        #{index + 1}
                      </span>
                      <span className="text-sm truncate flex-1 min-w-0">
                        {testCase.prompt.slice(0, 50)}
                        {testCase.prompt.length > 50 ? '...' : ''}
                      </span>
                      <Badge variant={getScoringBadgeVariant(testCase.scoringMethod)} className="shrink-0 text-xs">
                        {getScoringBadgeLabel(testCase.scoringMethod)}
                      </Badge>
                      <div className="flex items-center shrink-0 gap-0.5">
                        <button
                          className="h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent/60 transition-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingTestCase(testCase)
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(testCase.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {expandedIds.has(testCase.id) && (
                      <div className="p-3 border-t border-border/60 bg-background/70 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Prompt:
                          </span>
                          <p className="text-sm whitespace-pre-wrap">
                            {testCase.prompt}
                          </p>
                        </div>
                        {testCase.expectedOutput && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {getExpectedLabel(testCase.scoringMethod)}:
                            </span>
                            <p className="text-sm whitespace-pre-wrap font-mono bg-muted p-2 rounded">
                              {testCase.expectedOutput}
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {testCase.metadata.category && (
                            <Badge variant="outline">
                              {testCase.metadata.category}
                            </Badge>
                          )}
                          {testCase.metadata.difficulty && (
                            <Badge variant="outline">
                              {testCase.metadata.difficulty}
                            </Badge>
                          )}
                          {testCase.metadata.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TestCaseEditor
        testSuiteId={testSuite.id}
        testCase={editingTestCase}
        open={isCreating || !!editingTestCase}
        onClose={() => {
          setIsCreating(false)
          setEditingTestCase(null)
        }}
      />
    </>
  )
}
