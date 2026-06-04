import { useState, useEffect } from 'react'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import type { TestCase, ScoringMethod } from '@/types'

interface TestCaseEditorProps {
  testSuiteId: string
  testCase: TestCase | null
  open: boolean
  onClose: () => void
}

const scoringMethods: { value: ScoringMethod; label: string; description: string }[] = [
  { value: 'exact-match', label: 'Exact Match', description: 'Response must exactly match expected output' },
  { value: 'regex-match', label: 'Regex Match', description: 'Response must match a regular expression pattern' },
  { value: 'numeric-tolerance', label: 'Numeric Tolerance', description: 'Numeric answer within tolerance range' },
  { value: 'boolean', label: 'Boolean', description: 'Pass/fail based on presence of expected text' },
  { value: 'llm-judge', label: 'LLM Judge', description: 'Use another LLM to evaluate the response' },
]

const difficulties = ['easy', 'medium', 'hard'] as const

export function TestCaseEditor({
  testSuiteId,
  testCase,
  open,
  onClose,
}: TestCaseEditorProps) {
  const { addTestCase, updateTestCase } = useTestSuiteStore()

  const [prompt, setPrompt] = useState('')
  const [expectedOutput, setExpectedOutput] = useState('')
  const [scoringMethod, setScoringMethod] = useState<ScoringMethod>('exact-match')
  const [weight, setWeight] = useState(1)
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'none'>('none')
  const [tags, setTags] = useState('')

  const expectedOutputConfig = (() => {
    switch (scoringMethod) {
      case 'regex-match':
        return {
          label: 'Regex Pattern',
          placeholder: 'e.g. /^(?!.*[eE]).+$/ or ^(?!.*[eE]).+$',
          helper:
            'Uses JavaScript regex. Wrap with /pattern/flags or provide a plain pattern.',
        }
      case 'numeric-tolerance':
        return {
          label: 'Expected Number',
          placeholder: 'e.g. 3.14',
          helper: 'Default tolerance is 0.01; any number within tolerance passes.',
        }
      case 'boolean':
        return {
          label: 'Expected Text',
          placeholder: 'Text that must appear in the response',
          helper: 'Case-insensitive substring check.',
        }
      case 'llm-judge':
        return {
          label: 'Reference Answer (Optional)',
          placeholder: 'Optional rubric or reference answer for the judge',
          helper: 'Used as guidance for the judge model.',
        }
      default:
        return {
          label: 'Expected Output',
          placeholder: 'Enter the expected response (for objective scoring)',
          helper: '',
        }
    }
  })()

  useEffect(() => {
    if (testCase) {
      setPrompt(testCase.prompt)
      setExpectedOutput(testCase.expectedOutput || '')
      setScoringMethod(testCase.scoringMethod)
      setWeight(testCase.weight)
      setCategory(testCase.metadata.category || '')
      setDifficulty(testCase.metadata.difficulty || 'none')
      setTags(testCase.metadata.tags.join(', '))
    } else {
      setPrompt('')
      setExpectedOutput('')
      setScoringMethod('exact-match')
      setWeight(1)
      setCategory('')
      setDifficulty('none')
      setTags('')
    }
  }, [testCase, open])

  const handleSave = () => {
    if (!prompt.trim()) return

    const metadata = {
      category: category.trim() || undefined,
      difficulty: difficulty === 'none' ? undefined : difficulty,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }

    if (testCase) {
      updateTestCase(testSuiteId, testCase.id, {
        prompt: prompt.trim(),
        expectedOutput: expectedOutput.trim() || undefined,
        scoringMethod,
        weight,
        metadata,
      })
    } else {
      addTestCase(testSuiteId, {
        prompt: prompt.trim(),
        expectedOutput: expectedOutput.trim() || undefined,
        scoringMethod,
        weight,
        metadata,
      })
    }

    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{testCase ? 'Edit Test Case' : 'Add Test Case'}</DialogTitle>
          <DialogDescription>
            Define a prompt and how the response should be scored
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt *</Label>
            <Textarea
              id="prompt"
              placeholder="Enter the question or task for the model..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected">{expectedOutputConfig.label}</Label>
            <Textarea
              id="expected"
              placeholder={expectedOutputConfig.placeholder}
              value={expectedOutput}
              onChange={(e) => setExpectedOutput(e.target.value)}
              rows={3}
            />
            {expectedOutputConfig.helper ? (
              <p className="text-xs text-muted-foreground">
                {expectedOutputConfig.helper}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Scoring Method</Label>
              <Select
                value={scoringMethod}
                onValueChange={(v) => setScoringMethod(v as ScoringMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scoringMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex flex-col">
                        <span>{method.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {method.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., Logic"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) =>
                  setDifficulty(v as 'easy' | 'medium' | 'hard' | 'none')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {difficulties.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="tag1, tag2"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!prompt.trim()}>
            {testCase ? 'Save Changes' : 'Add Test Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
