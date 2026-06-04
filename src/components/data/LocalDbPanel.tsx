import { useState } from 'react'
import { Database, FileText, Play, FlaskConical, ChevronRight, Trash2, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { useRunStore } from '@/stores/runStore'
import { buildSnapshot, hydrateFromDb, writeLocalDb } from '@/services/localDb'
import type { BenchmakerDb, TestSuite, RunResult } from '@/types'

function StatCard({ icon: Icon, label, value, sublabel }: {
  icon: React.ElementType
  label: string
  value: number
  sublabel?: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="p-2 rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sublabel && <div className="text-xs text-muted-foreground/70">{sublabel}</div>}
      </div>
    </div>
  )
}

function TestSuiteRow({ suite, onSelect }: { suite: TestSuite; onSelect: () => void }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <div className="p-2 rounded-md bg-blue-500/10">
        <FileText className="h-4 w-4 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{suite.name}</div>
        <div className="text-xs text-muted-foreground">
          {suite.testCases.length} test case{suite.testCases.length !== 1 ? 's' : ''}
        </div>
      </div>
      <Badge variant="outline" className="shrink-0">
        {new Date(suite.updatedAt).toLocaleDateString()}
      </Badge>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

function RunRow({ run }: { run: RunResult }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-500/10 text-green-600',
    running: 'bg-blue-500/10 text-blue-600',
    failed: 'bg-red-500/10 text-red-600',
    cancelled: 'bg-yellow-500/10 text-yellow-600',
    idle: 'bg-gray-500/10 text-gray-600',
  }

  const completedResults = run.results.filter(r => r.status === 'completed').length
  const totalResults = run.results.length

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
      <div className="p-2 rounded-md bg-purple-500/10">
        <Play className="h-4 w-4 text-purple-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{run.testSuiteName}</div>
        <div className="text-xs text-muted-foreground">
          {run.models.length} model{run.models.length !== 1 ? 's' : ''} · {completedResults}/{totalResults} results
        </div>
      </div>
      <Badge className={statusColors[run.status] || statusColors.idle}>
        {run.status}
      </Badge>
      <div className="text-xs text-muted-foreground shrink-0">
        {new Date(run.startedAt).toLocaleString()}
      </div>
    </div>
  )
}

function TestCasesTable({ suite }: { suite: TestSuite }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{suite.name} - Test Cases</h4>
        <Badge variant="outline">{suite.testCases.length} cases</Badge>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 p-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <div>#</div>
          <div>Prompt</div>
          <div>Method</div>
          <div>Weight</div>
        </div>
        <ScrollArea className="h-[200px]">
          {suite.testCases.map((tc, idx) => (
            <div key={tc.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 p-2 text-sm border-b last:border-0 hover:bg-muted/30">
              <div className="text-muted-foreground">{idx + 1}</div>
              <div className="truncate">{tc.prompt}</div>
              <Badge variant="secondary" className="text-xs">{tc.scoringMethod}</Badge>
              <div className="text-muted-foreground">{tc.weight}</div>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}

function ResultsTable({ run }: { run: RunResult }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Run Results</h4>
        <Badge variant="outline">{run.results.length} results</Badge>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 p-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <div>Model</div>
          <div>Test Case</div>
          <div>Status</div>
          <div>Score</div>
          <div>Latency</div>
        </div>
        <ScrollArea className="h-[200px]">
          {run.results.map((result, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 p-2 text-sm border-b last:border-0 hover:bg-muted/30">
              <div className="truncate font-mono text-xs">{result.modelId.split('/').pop()}</div>
              <div className="truncate text-muted-foreground">{result.testCaseId.slice(0, 8)}...</div>
              <Badge
                variant={result.status === 'completed' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {result.status}
              </Badge>
              <div>{result.score?.score !== undefined ? `${(result.score.score * 100).toFixed(0)}%` : '-'}</div>
              <div className="text-muted-foreground">{result.latencyMs ? `${result.latencyMs}ms` : '-'}</div>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}

export function LocalDbPanel() {
  const testSuites = useTestSuiteStore((state) => state.testSuites)
  const activeTestSuiteId = useTestSuiteStore((state) => state.activeTestSuiteId)
  const runs = useRunStore((state) => state.runs)
  const currentRunId = useRunStore((state) => state.currentRunId)
  const clearAllRuns = useRunStore((state) => state.clearAllRuns)

  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null)
  const [selectedRun, setSelectedRun] = useState<RunResult | null>(null)
  const [jsonTab, setJsonTab] = useState<'view' | 'edit'>('view')
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState('')

  // Calculate stats
  const totalTestCases = testSuites.reduce((sum, s) => sum + s.testCases.length, 0)
  const totalResults = runs.reduce((sum, r) => sum + r.results.length, 0)
  const completedRuns = runs.filter(r => r.status === 'completed').length

  const handleExport = () => {
    const snapshot = buildSnapshot()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `benchmaker-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as Partial<BenchmakerDb>

        if (!parsed || !Array.isArray(parsed.testSuites) || !Array.isArray(parsed.runs)) {
          setError('Invalid format: expected testSuites and runs arrays.')
          return
        }

        const normalized: BenchmakerDb = {
          version: typeof parsed.version === 'number' ? parsed.version : 3,
          updatedAt: Date.now(),
          testSuites: parsed.testSuites,
          runs: parsed.runs,
          codeArenaRuns: Array.isArray(parsed.codeArenaRuns) ? parsed.codeArenaRuns : [],
          activeTestSuiteId: parsed.activeTestSuiteId ?? null,
          currentRunId: parsed.currentRunId ?? null,
          currentCodeArenaRunId: parsed.currentCodeArenaRunId ?? null,
        }

        hydrateFromDb(normalized)
        await writeLocalDb(normalized)
        setError('')
      } catch {
        setError('Failed to parse JSON file.')
      }
    }
    input.click()
  }

  const handleApplyJson = async () => {
    setError('')
    try {
      const parsed = JSON.parse(jsonText) as Partial<BenchmakerDb>
      if (!parsed || !Array.isArray(parsed.testSuites) || !Array.isArray(parsed.runs)) {
        setError('Invalid format: expected testSuites and runs arrays.')
        return
      }

      const normalized: BenchmakerDb = {
        version: typeof parsed.version === 'number' ? parsed.version : 3,
        updatedAt: Date.now(),
        testSuites: parsed.testSuites,
        runs: parsed.runs,
        codeArenaRuns: Array.isArray(parsed.codeArenaRuns) ? parsed.codeArenaRuns : [],
        activeTestSuiteId: parsed.activeTestSuiteId ?? null,
        currentRunId: parsed.currentRunId ?? null,
        currentCodeArenaRunId: parsed.currentCodeArenaRunId ?? null,
      }

      hydrateFromDb(normalized)
      await writeLocalDb(normalized)
      setJsonTab('view')
    } catch {
      setError('Invalid JSON syntax.')
    }
  }

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Explorer
            </CardTitle>
            <CardDescription>
              Browse and manage your SQLite database
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <StatCard icon={FileText} label="Test Suites" value={testSuites.length} />
          <StatCard icon={FlaskConical} label="Test Cases" value={totalTestCases} />
          <StatCard icon={Play} label="Runs" value={runs.length} sublabel={`${completedRuns} completed`} />
          <StatCard icon={Database} label="Results" value={totalResults} />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="suites" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="shrink-0">
            <TabsTrigger value="suites">Test Suites</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="json">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="suites" className="flex-1 min-h-0 mt-3">
            <div className="h-full flex gap-4">
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-2">
                  {testSuites.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No test suites yet. Create one in the Prompts tab.
                    </div>
                  ) : (
                    testSuites.map((suite) => (
                      <TestSuiteRow
                        key={suite.id}
                        suite={suite}
                        onSelect={() => setSelectedSuite(selectedSuite?.id === suite.id ? null : suite)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>

              {selectedSuite && (
                <div className="flex-1 border-l pl-4">
                  <TestCasesTable suite={selectedSuite} />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="runs" className="flex-1 min-h-0 mt-3">
            <div className="h-full flex flex-col gap-3">
              {runs.length > 0 && (
                <div className="flex justify-end shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => clearAllRuns()}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All Runs
                  </Button>
                </div>
              )}
              <div className="flex-1 min-h-0 flex gap-4">
                <ScrollArea className="flex-1 pr-2">
                  <div className="space-y-2">
                    {runs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No runs yet. Execute a benchmark in the Run tab.
                      </div>
                    ) : (
                      runs.map((run) => (
                        <div
                          key={run.id}
                          onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
                          className="cursor-pointer"
                        >
                          <RunRow run={run} />
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {selectedRun && (
                  <div className="flex-1 border-l pl-4">
                    <ResultsTable run={selectedRun} />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="json" className="flex-1 min-h-0 mt-3 flex flex-col gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={jsonTab === 'view' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setJsonTab('view')}
              >
                View
              </Button>
              <Button
                variant={jsonTab === 'edit' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setJsonTab('edit')
                  setJsonText(JSON.stringify(buildSnapshot(), null, 2))
                }}
              >
                Edit
              </Button>
            </div>

            {jsonTab === 'view' ? (
              <ScrollArea className="flex-1 border rounded-lg">
                <pre className="p-4 text-xs font-mono">
                  {JSON.stringify(buildSnapshot(), null, 2)}
                </pre>
              </ScrollArea>
            ) : (
              <>
                <Textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="flex-1 min-h-0 font-mono text-xs"
                  placeholder="Paste JSON here..."
                />
                {error && <div className="text-xs text-destructive">{error}</div>}
                <div className="flex justify-end gap-2 shrink-0">
                  <Button variant="outline" onClick={() => setJsonTab('view')}>
                    Cancel
                  </Button>
                  <Button onClick={handleApplyJson}>
                    Apply Changes
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Active State Info */}
        <div className="text-xs text-muted-foreground border-t pt-3 shrink-0">
          Active Suite: {activeTestSuiteId ? testSuites.find(s => s.id === activeTestSuiteId)?.name || 'Unknown' : 'None'}
          {' · '}
          Current Run: {currentRunId || 'None'}
        </div>
      </CardContent>
    </Card>
  )
}
