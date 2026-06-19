import { Switch, Label } from 'benchmaker'

const row = { display: 'flex', alignItems: 'center', gap: 12 } as const
const col = { display: 'flex', flexDirection: 'column', gap: 16 } as const

export const States = () => (
  <div style={{ padding: 24 }}>
    <div style={col}>
      <div style={row}>
        <Switch id="sw-on" defaultChecked />
        <Label htmlFor="sw-on">Parallel execution</Label>
      </div>
      <div style={row}>
        <Switch id="sw-off" />
        <Label htmlFor="sw-off">Stop on first failure</Label>
      </div>
    </div>
  </div>
)

export const RunSettings = () => (
  <div style={{ padding: 24, maxWidth: 320 }}>
    <div style={col}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <Label htmlFor="sw-stream">Stream responses</Label>
        <Switch id="sw-stream" defaultChecked />
      </div>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <Label htmlFor="sw-cost">Track token cost</Label>
        <Switch id="sw-cost" defaultChecked />
      </div>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <Label htmlFor="sw-dryrun">Dry run only</Label>
        <Switch id="sw-dryrun" />
      </div>
    </div>
  </div>
)

export const Disabled = () => (
  <div style={{ padding: 24 }}>
    <div style={col}>
      <div style={row}>
        <Switch id="sw-dis-on" defaultChecked disabled />
        <Label htmlFor="sw-dis-on">Local cache (enforced)</Label>
      </div>
      <div style={row}>
        <Switch id="sw-dis-off" disabled />
        <Label htmlFor="sw-dis-off">Beta judge model (locked)</Label>
      </div>
    </div>
  </div>
)
