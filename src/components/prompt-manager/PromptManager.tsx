import { useState } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Plus, FolderOpen, Wand2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { JudgePromptEditor } from './JudgePromptEditor'
import { SystemPromptEditor } from './SystemPromptEditor'
import { TestCaseList } from './TestCaseList'
import { TestSuiteSelector } from './TestSuiteSelector'
import { TestCaseGeneratorDialog } from './TestCaseGeneratorDialog'
import { BenchmarkGeneratorDialog } from './BenchmarkGeneratorDialog'

export function PromptManager() {
  const { testSuites, activeTestSuiteId, createTestSuite } = useTestSuiteStore()
  const { apiKey } = useSettingsStore()
  const activeTestSuite = testSuites.find((s) => s.id === activeTestSuiteId)

  const [newSuiteName, setNewSuiteName] = useState('')
  const [newSuiteDescription, setNewSuiteDescription] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreateSuite = () => {
    if (!newSuiteName.trim()) return
    createTestSuite(newSuiteName.trim(), newSuiteDescription.trim() || undefined)
    setNewSuiteName('')
    setNewSuiteDescription('')
    setDialogOpen(false)
  }

  if (testSuites.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={Sparkles}
          title="Build your first benchmark suite"
          description="Define prompts, constraints, and evaluation rules to compare models."
          className="shadow-2xl shadow-primary/5 border-primary/10"
          steps={[
            {
              number: 1,
              title: 'Create a test suite',
              description: 'Group related test cases with a shared system prompt',
            },
            {
              number: 2,
              title: 'Add test cases',
              description: 'Define prompts and expected outputs to evaluate',
            },
            {
              number: 3,
              title: 'Run in the Arena',
              description: 'Select models, configure parameters, and execute',
            },
          ]}
          action={
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <BenchmarkGeneratorDialog
                trigger={
                  <Button size="lg" disabled={!apiKey} className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    Generate with AI
                  </Button>
                }
              />
              <span className="text-muted-foreground text-sm font-medium">or</span>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create manually
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl border-border/40 bg-background/95 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle className="text-gradient">Create Test Suite</DialogTitle>
                    <DialogDescription>
                      A test suite contains a system prompt and multiple test cases
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="suite-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
                      <Input
                        id="suite-name"
                        placeholder="e.g., Logic Puzzles Benchmark"
                        value={newSuiteName}
                        onChange={(e) => setNewSuiteName(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="suite-description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
                      <Input
                        id="suite-description"
                        placeholder="e.g., Tests reasoning and logic capabilities"
                        value={newSuiteDescription}
                        onChange={(e) => setNewSuiteDescription(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateSuite} disabled={!newSuiteName.trim()}>
                      Create Suite
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 sm:gap-6 max-w-[1600px] mx-auto w-full">
      <div className="surface p-4 sm:p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0 shadow-sm border-border/40">
        <div className="min-w-0 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <TestSuiteSelector />
        </div>
        <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center shrink-0">
          {activeTestSuite && <TestCaseGeneratorDialog testSuite={activeTestSuite} />}
          <BenchmarkGeneratorDialog />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-background/50">
                <Plus className="h-4 w-4" />
                New Suite
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl border-border/40 bg-background/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-gradient">Create Test Suite</DialogTitle>
                <DialogDescription>
                  A test suite contains a system prompt and multiple test cases
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="suite-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
                  <Input
                    id="suite-name"
                    placeholder="e.g., Logic Puzzles Benchmark"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suite-description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
                  <Input
                    id="suite-description"
                    placeholder="e.g., Tests reasoning and logic capabilities"
                    value={newSuiteDescription}
                    onChange={(e) => setNewSuiteDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSuite} disabled={!newSuiteName.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeTestSuite && (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 items-stretch surface overflow-hidden border-border/40 shadow-sm">
          <ResizablePanel defaultSize={35} minSize={20} className="flex flex-col gap-0 border-r border-border/40 bg-background/40 min-h-0 bg-muted/20">
            <div className="flex-1 overflow-auto border-b border-border/40 bg-background/40 min-h-0 p-0 relative bg-background/40 backdrop-blur-sm">
              <SystemPromptEditor testSuite={activeTestSuite} />
            </div>
            <div className="flex-1 overflow-auto min-h-0 p-0 relative bg-background/40 backdrop-blur-sm">
              <JudgePromptEditor testSuite={activeTestSuite} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-border/40 hover:bg-primary/50 transition-colors" />
          <ResizablePanel defaultSize={65} minSize={30} className="min-h-0 min-w-0 bg-background/40 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col">
              <TestCaseList testSuite={activeTestSuite} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}

