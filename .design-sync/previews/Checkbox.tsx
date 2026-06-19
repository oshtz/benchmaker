import { Checkbox, Label } from 'benchmaker'

const row = { display: 'flex', alignItems: 'center', gap: 8 } as const
const col = { display: 'flex', flexDirection: 'column', gap: 14 } as const

export const States = () => (
  <div style={{ padding: 24 }}>
    <div style={col}>
      <div style={row}>
        <Checkbox id="cb-on" defaultChecked />
        <Label htmlFor="cb-on">Run judge model on each response</Label>
      </div>
      <div style={row}>
        <Checkbox id="cb-off" />
        <Label htmlFor="cb-off">Cache identical prompts</Label>
      </div>
    </div>
  </div>
)

export const ModelSelection = () => (
  <div style={{ padding: 24 }}>
    <div style={col}>
      <div style={row}>
        <Checkbox id="m-opus" defaultChecked />
        <Label htmlFor="m-opus">Claude Opus 4.8</Label>
      </div>
      <div style={row}>
        <Checkbox id="m-gpt" defaultChecked />
        <Label htmlFor="m-gpt">GPT-5.1</Label>
      </div>
      <div style={row}>
        <Checkbox id="m-gemini" />
        <Label htmlFor="m-gemini">Gemini 3 Pro</Label>
      </div>
    </div>
  </div>
)

export const Disabled = () => (
  <div style={{ padding: 24 }}>
    <div style={col}>
      <div style={row}>
        <Checkbox id="cb-dis-on" defaultChecked disabled />
        <Label htmlFor="cb-dis-on">Include latency metrics (always on)</Label>
      </div>
      <div style={row}>
        <Checkbox id="cb-dis-off" disabled />
        <Label htmlFor="cb-dis-off">Export raw logs (unavailable)</Label>
      </div>
    </div>
  </div>
)
