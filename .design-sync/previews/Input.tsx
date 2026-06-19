import { Input, Label } from 'benchmaker'

const field = { display: 'flex', flexDirection: 'column', gap: 6 } as const
const muted = { color: 'var(--color-muted-foreground)', fontSize: 12 }

export const Labeled = () => (
  <div style={{ padding: 24, maxWidth: 360 }}>
    <div style={field}>
      <Label htmlFor="run-name">Run name</Label>
      <Input id="run-name" placeholder="e.g. Opus 4.8 vs GPT — reasoning suite" />
      <span style={muted}>Shown in the results dashboard.</span>
    </div>
  </div>
)

export const Filled = () => (
  <div style={{ padding: 24, maxWidth: 360 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={field}>
        <Label htmlFor="max-tokens">Max tokens</Label>
        <Input id="max-tokens" type="number" defaultValue={4096} />
      </div>
      <div style={field}>
        <Label htmlFor="api-key">OpenRouter API key</Label>
        <Input id="api-key" type="password" defaultValue="sk-or-v1-9f2c" />
      </div>
    </div>
  </div>
)

export const Disabled = () => (
  <div style={{ padding: 24, maxWidth: 360 }}>
    <div style={field}>
      <Label htmlFor="model-id">Model ID</Label>
      <Input id="model-id" defaultValue="anthropic/claude-opus-4-8" disabled />
      <span style={muted}>Locked while a benchmark is running.</span>
    </div>
  </div>
)
