import { RotateCcw, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useModelStore } from '@/stores/modelStore'

export function ParameterPanel() {
  const { parameters, setParameters, resetParameters, toggleBenchmarkMode } = useModelStore()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Parameters</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Applied to all models</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={resetParameters} className="shrink-0">
            <RotateCcw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {/* Benchmark Mode Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="benchmark-mode" className="cursor-pointer">Benchmark Mode</Label>
              <p className="text-xs text-muted-foreground">Uses temp=0 for reproducible results</p>
            </div>
          </div>
          <Switch
            id="benchmark-mode"
            checked={parameters.benchmarkMode ?? false}
            onCheckedChange={toggleBenchmarkMode}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Temperature</Label>
            <span className="text-sm text-muted-foreground">
              {parameters.benchmarkMode ? '0.00 (locked)' : parameters.temperature.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[parameters.benchmarkMode ? 0 : parameters.temperature]}
            onValueChange={([v]) => setParameters({ temperature: v })}
            min={0}
            max={2}
            step={0.01}
            disabled={parameters.benchmarkMode}
            className={parameters.benchmarkMode ? 'opacity-50' : ''}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Top P</Label>
            <span className="text-sm text-muted-foreground">
              {parameters.topP.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[parameters.topP]}
            onValueChange={([v]) => setParameters({ topP: v })}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-tokens">Max Tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            min={1}
            max={128000}
            value={parameters.maxTokens}
            onChange={(e) =>
              setParameters({ maxTokens: parseInt(e.target.value) || 2048 })
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Frequency Penalty</Label>
            <span className="text-sm text-muted-foreground">
              {parameters.benchmarkMode ? '0.00 (locked)' : parameters.frequencyPenalty.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[parameters.benchmarkMode ? 0 : parameters.frequencyPenalty]}
            onValueChange={([v]) => setParameters({ frequencyPenalty: v })}
            min={-2}
            max={2}
            step={0.01}
            disabled={parameters.benchmarkMode}
            className={parameters.benchmarkMode ? 'opacity-50' : ''}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Presence Penalty</Label>
            <span className="text-sm text-muted-foreground">
              {parameters.benchmarkMode ? '0.00 (locked)' : parameters.presencePenalty.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[parameters.benchmarkMode ? 0 : parameters.presencePenalty]}
            onValueChange={([v]) => setParameters({ presencePenalty: v })}
            min={-2}
            max={2}
            step={0.01}
            disabled={parameters.benchmarkMode}
            className={parameters.benchmarkMode ? 'opacity-50' : ''}
          />
        </div>
      </CardContent>
    </Card>
  )
}
