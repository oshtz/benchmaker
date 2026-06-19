import { Label, Input, Checkbox } from 'benchmaker'

const field = { display: 'flex', flexDirection: 'column', gap: 6 } as const
const row = { display: 'flex', alignItems: 'center', gap: 8 } as const

export const WithInput = () => (
  <div style={{ padding: 24, maxWidth: 340 }}>
    <div style={field}>
      <Label htmlFor="temperature">Temperature</Label>
      <Input id="temperature" type="number" step="0.1" defaultValue={0.7} />
    </div>
  </div>
)

export const WithCheckbox = () => (
  <div style={{ padding: 24, maxWidth: 340 }}>
    <div style={row}>
      <Checkbox id="stream" defaultChecked />
      <Label htmlFor="stream">Stream tokens during run</Label>
    </div>
  </div>
)
