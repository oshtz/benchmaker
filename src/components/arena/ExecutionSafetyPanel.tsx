import { DollarSign, Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/stores/settingsStore'

export function ExecutionSafetyPanel() {
  const {
    maxRunCostUsd,
    concurrencyLimit,
    setMaxRunCostUsd,
    setConcurrencyLimit,
  } = useSettingsStore()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">Run Safety</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Budget and rate controls</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div className="space-y-2">
          <Label htmlFor="max-run-cost" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Max Run Cost
          </Label>
          <Input
            id="max-run-cost"
            type="number"
            min={0}
            step={0.01}
            value={maxRunCostUsd}
            onChange={(event) => setMaxRunCostUsd(Number.parseFloat(event.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">Set 0 to disable the cap.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="concurrency-limit" className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Concurrent Requests
          </Label>
          <Input
            id="concurrency-limit"
            type="number"
            min={1}
            max={20}
            step={1}
            value={concurrencyLimit}
            onChange={(event) => setConcurrencyLimit(Number.parseInt(event.target.value, 10) || 1)}
          />
          <p className="text-xs text-muted-foreground">Higher values are faster but hit provider limits sooner.</p>
        </div>
      </CardContent>
    </Card>
  )
}
