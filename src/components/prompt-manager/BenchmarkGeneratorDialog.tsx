import { useEffect, useMemo, useState } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
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
import { generateBenchmark } from '@/services/benchmarkGenerator'

interface BenchmarkGeneratorDialogProps {
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function BenchmarkGeneratorDialog({ trigger, onSuccess }: BenchmarkGeneratorDialogProps) {
  const { apiKey } = useSettingsStore()
  const { availableModels, selectedModelIds, judgeModelId } = useModelStore()
  const { createTestSuite, updateSystemPrompt, updateJudgeSystemPrompt, addTestCase } =
    useTestSuiteStore()
  const { toast } = useToast()

  const defaultModelId = useMemo(() => {
    return judgeModelId || selectedModelIds[0] || ''
  }, [judgeModelId, selectedModelIds])

  const [open, setOpen] = useState(false)
  const [modelId, setModelId] = useState(defaultModelId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [testCaseCount, setTestCaseCount] = useState(10)
  const [isGenerating, setIsGenerating] = useState(false)

  const hasModels = availableModels.length > 0
  const canGenerate =
    Boolean(apiKey) && Boolean(modelId.trim()) && Boolean(name.trim()) && Boolean(description.trim())

  useEffect(() => {
    if (!open) return
    if (!modelId && defaultModelId) {
      setModelId(defaultModelId)
    }
  }, [open, modelId, defaultModelId])

  const handleGenerate = async () => {
    if (!apiKey || !modelId.trim() || !name.trim() || !description.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    try {
      const generated = await generateBenchmark({
        apiKey,
        modelId: modelId.trim(),
        name: name.trim(),
        description: description.trim(),
        testCaseCount: Math.min(Math.max(testCaseCount, 1), 20),
      })

      // Create the test suite
      const suite = createTestSuite(generated.name, generated.description)

      // Update system prompts
      updateSystemPrompt(suite.id, generated.systemPrompt)
      updateJudgeSystemPrompt(suite.id, generated.judgeSystemPrompt)

      // Add all test cases
      generated.testCases.forEach((tc) => {
        addTestCase(suite.id, {
          prompt: tc.prompt,
          expectedOutput: tc.expectedOutput,
          scoringMethod: tc.scoringMethod,
          weight: tc.weight,
          metadata: tc.metadata,
        })
      })

      toast({
        title: 'Benchmark generated',
        description: `Created "${generated.name}" with ${generated.testCases.length} test cases.`,
      })

      setOpen(false)
      resetForm()
      onSuccess?.()
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

  const resetForm = () => {
    setName('')
    setDescription('')
    setTestCaseCount(10)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="sm" disabled={!apiKey}>
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Benchmark
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Complete Benchmark</DialogTitle>
          <DialogDescription>
            Describe what you want to benchmark and AI will generate the system prompt, judge
            prompt, and test cases for you.
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
                placeholder="e.g., openai/gpt-4o"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Use a capable model for best results (GPT-4, Claude, etc.)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="benchmark-name">Benchmark Name *</Label>
            <Input
              id="benchmark-name"
              placeholder="e.g., Code Review Quality"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="benchmark-description">Description *</Label>
            <Textarea
              id="benchmark-description"
              placeholder="Describe what this benchmark should evaluate. Be specific about the capabilities, scenarios, and criteria you want to test.

Example: Evaluate an LLM's ability to review code for bugs, security issues, and style problems. Test should include various programming languages, different types of bugs (logic errors, off-by-one, null references), and varying code complexity levels."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              The more detailed your description, the better the generated benchmark.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-case-count">Number of Test Cases</Label>
            <Input
              id="test-case-count"
              type="number"
              min={1}
              max={20}
              value={testCaseCount}
              onChange={(e) => setTestCaseCount(parseInt(e.target.value, 10) || 10)}
            />
            <p className="text-xs text-muted-foreground">Between 1 and 20 test cases</p>
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
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
