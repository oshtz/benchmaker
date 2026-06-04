import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useSettingsStore } from '@/stores/settingsStore'
import { useModelStore } from '@/stores/modelStore'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { generateTestCases } from '@/services/testCaseGenerator'
import type { TestSuite } from '@/types'

interface TestCaseGeneratorDialogProps {
  testSuite: TestSuite
}

export function TestCaseGeneratorDialog({ testSuite }: TestCaseGeneratorDialogProps) {
  const { apiKey } = useSettingsStore()
  const { availableModels, selectedModelIds, judgeModelId } = useModelStore()
  const { addTestCase } = useTestSuiteStore()
  const { toast } = useToast()

  const defaultModelId = useMemo(() => {
    return judgeModelId || selectedModelIds[0] || ''
  }, [judgeModelId, selectedModelIds])

  const [open, setOpen] = useState(false)
  const [modelId, setModelId] = useState(defaultModelId)
  const [count, setCount] = useState(3)
  const [notes, setNotes] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const hasModels = availableModels.length > 0
  const canGenerate = Boolean(apiKey) && Boolean(modelId.trim()) && count > 0

  useEffect(() => {
    if (!open) return
    if (!modelId && defaultModelId) {
      setModelId(defaultModelId)
    }
  }, [open, modelId, defaultModelId])

  const handleGenerate = async () => {
    if (!apiKey || !modelId.trim()) {
      toast({
        title: 'Missing configuration',
        description: 'Set an API key and choose a model to generate test cases.',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    try {
      const safeCount = Math.min(Math.max(count, 1), 20)
      const generated = await generateTestCases({
        apiKey,
        modelId: modelId.trim(),
        count: safeCount,
        systemPrompt: testSuite.systemPrompt,
        existingTestCases: testSuite.testCases,
        additionalNotes: notes,
      })

      if (generated.length === 0) {
        toast({
          title: 'No test cases generated',
          description: 'Try adjusting your notes or model selection.',
          variant: 'destructive',
        })
        return
      }

      generated.forEach((item) => {
        addTestCase(testSuite.id, {
          prompt: item.prompt,
          expectedOutput: item.expectedOutput,
          scoringMethod: item.scoringMethod || 'exact-match',
          weight: 1,
          metadata: {
            category: item.metadata?.category,
            difficulty: item.metadata?.difficulty,
            tags: item.metadata?.tags || [],
          },
        })
      })

      toast({
        title: 'Test cases generated',
        description: `Added ${generated.length} new test case${generated.length === 1 ? '' : 's'}.`,
      })

      setOpen(false)
      setNotes('')
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" disabled={!apiKey}>
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Cases
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Test Cases</DialogTitle>
          <DialogDescription>
            Uses your system prompt and existing cases to draft new tests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Model</Label>
            {hasModels ? (
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.slice(0, 50).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="e.g., openai/gpt-4o-mini"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {hasModels
                ? 'Model list is loaded from OpenRouter.'
                : 'Model list not loaded yet. Paste a model id.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="case-count">Number of cases</Label>
              <Input
                id="case-count"
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>System prompt in scope</Label>
              <div className="text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-3 py-2">
                {testSuite.systemPrompt ? 'Enabled' : 'No system prompt set'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Focus or constraints (optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g., emphasize constraints, add edge cases, include regex patterns"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
