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
import { enhancePrompt } from '@/services/promptEnhancer'
import type { TestSuite } from '@/types'
import type { PromptEnhancerTarget } from '@/services/promptEnhancer'

interface PromptEnhancerDialogProps {
  testSuite: TestSuite
  target: PromptEnhancerTarget
  currentPrompt: string
  onApply: (value: string) => void
  buttonLabel?: string
}

export function PromptEnhancerDialog({
  testSuite,
  target,
  currentPrompt,
  onApply,
  buttonLabel = 'Enhance',
}: PromptEnhancerDialogProps) {
  const { apiKey } = useSettingsStore()
  const { availableModels, selectedModelIds, judgeModelId } = useModelStore()
  const { toast } = useToast()

  const defaultModelId = useMemo(() => {
    return judgeModelId || selectedModelIds[0] || ''
  }, [judgeModelId, selectedModelIds])

  const [open, setOpen] = useState(false)
  const [modelId, setModelId] = useState(defaultModelId)
  const [notes, setNotes] = useState('')
  const [draft, setDraft] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const hasModels = availableModels.length > 0
  const canGenerate = Boolean(apiKey) && Boolean(modelId.trim())

  useEffect(() => {
    if (open) {
      if (!modelId && defaultModelId) {
        setModelId(defaultModelId)
      }
      setDraft(currentPrompt || '')
      return
    }
    setNotes('')
  }, [open, modelId, defaultModelId, currentPrompt])

  const handleGenerate = async () => {
    if (!apiKey || !modelId.trim()) {
      toast({
        title: 'Missing configuration',
        description: 'Set an API key and choose a model.',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    try {
      const improved = await enhancePrompt({
        apiKey,
        modelId: modelId.trim(),
        target,
        currentPrompt,
        systemPrompt: testSuite.systemPrompt,
        existingTestCases: testSuite.testCases,
        notes,
      })

      if (!improved.trim()) {
        toast({
          title: 'No prompt returned',
          description: 'Try adjusting your notes or model selection.',
          variant: 'destructive',
        })
        return
      }

      setDraft(improved)
    } catch (error) {
      toast({
        title: 'Enhancement failed',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApply = () => {
    if (!draft.trim()) return
    onApply(draft.trim())
    setOpen(false)
    setNotes('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!apiKey}>
          <Sparkles className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Enhance {target === 'system' ? 'System Prompt' : 'Judge Prompt'}
          </DialogTitle>
          <DialogDescription>
            Uses your suite context and cases to refine clarity and rigor.
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

          <div className="space-y-2">
            <Label htmlFor="enhancer-notes">Focus or constraints (optional)</Label>
            <Textarea
              id="enhancer-notes"
              placeholder="e.g., enforce strict output format, include scoring details"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="enhancer-draft">Draft</Label>
            <Textarea
              id="enhancer-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enhancing...
              </>
            ) : (
              'Generate Draft'
            )}
          </Button>
          <Button variant="default" onClick={handleApply} disabled={!draft.trim()}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
