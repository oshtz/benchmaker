import { Scale, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCodeArenaStore } from '@/stores/codeArenaStore'
import { useModelStore } from '@/stores/modelStore'

export function CodeArenaJudgeSelector() {
  const { judgeEnabled, judgeModelId, setJudgeEnabled, setJudgeModelId } = useCodeArenaStore()
  const { availableModels, isLoadingModels } = useModelStore()

  // Filter to models that are good for judging (typically larger models)
  const judgeModels = availableModels.filter((model) => {
    const id = model.id.toLowerCase()
    // Include popular judge-capable models
    return (
      id.includes('gpt-4') ||
      id.includes('claude-3') ||
      id.includes('gemini') ||
      id.includes('llama-3') ||
      id.includes('mistral-large') ||
      id.includes('command-r')
    )
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4" />
          LLM Judge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="judge-toggle" className="text-sm font-medium">
              Enable Judge
            </Label>
            <p className="text-xs text-muted-foreground">
              Use an LLM to evaluate code quality
            </p>
          </div>
          <Switch
            id="judge-toggle"
            checked={judgeEnabled}
            onCheckedChange={setJudgeEnabled}
          />
        </div>

        {/* Judge model selector */}
        {judgeEnabled && (
          <div className="space-y-2">
            <Label htmlFor="judge-model" className="text-sm font-medium">
              Judge Model
            </Label>
            <Select
              value={judgeModelId || ''}
              onValueChange={(value) => setJudgeModelId(value || null)}
              disabled={isLoadingModels}
            >
              <SelectTrigger id="judge-model">
                <SelectValue placeholder="Select a judge model" />
              </SelectTrigger>
              <SelectContent>
                {judgeModels.length === 0 ? (
                  <SelectItem value="" disabled>
                    No suitable models available
                  </SelectItem>
                ) : (
                  judgeModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.id}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Info about judging */}
        {judgeEnabled && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              The judge will evaluate each model's output based on visual accuracy, 
              code quality, functionality, and responsiveness. Scores range from 0-100%.
            </p>
          </div>
        )}

        {!judgeEnabled && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Without a judge, you can manually compare the visual outputs 
              of different models side by side.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
