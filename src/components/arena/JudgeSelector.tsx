import { Gavel } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useModelStore } from '@/stores/modelStore'
import { useState } from 'react'

export function JudgeSelector() {
  const { availableModels, judgeModelId, setJudgeModel } = useModelStore()
  const [useJudge, setUseJudge] = useState(!!judgeModelId)

  // Filter to high-quality models suitable for judging
  const judgeModels = availableModels.filter((model) => {
    const id = model.id.toLowerCase()
    return (
      id.includes('gpt-4') ||
      id.includes('claude') ||
      id.includes('gemini') ||
      id.includes('llama-3') ||
      id.includes('mistral-large') ||
      id.includes('command-r')
    )
  })

  const handleToggle = (enabled: boolean) => {
    setUseJudge(enabled)
    if (!enabled) {
      setJudgeModel(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Gavel className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">LLM Judge</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Use an LLM to evaluate responses</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="use-judge">Enable LLM Judge</Label>
          <Switch
            id="use-judge"
            checked={useJudge}
            onCheckedChange={handleToggle}
          />
        </div>

        {useJudge && (
          <div className="space-y-2">
            <Label>Judge Model</Label>
            <Select
              value={judgeModelId || ''}
              onValueChange={(v) => setJudgeModel(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a judge model..." />
              </SelectTrigger>
              <SelectContent>
                {judgeModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The judge will evaluate responses for test cases using LLM-as-Judge scoring
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
