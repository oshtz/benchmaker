import { Slider, Label } from 'benchmaker'

const field = { display: 'flex', flexDirection: 'column', gap: 8 } as const
const head = { display: 'flex', justifyContent: 'space-between', fontSize: 13 } as const
const muted = { color: 'var(--color-muted-foreground)' }
const noop = () => {}

export const Temperature = () => (
  <div style={{ padding: 24, maxWidth: 360 }}>
    <div style={field}>
      <div style={head}>
        <Label htmlFor="temp">Temperature</Label>
        <span style={muted}>0.7</span>
      </div>
      <Slider value={[70]} max={200} step={1} onValueChange={noop} />
    </div>
  </div>
)

export const SampleSettings = () => (
  <div style={{ padding: 24, maxWidth: 360 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={field}>
        <div style={head}>
          <Label htmlFor="topp">Top P</Label>
          <span style={muted}>0.90</span>
        </div>
        <Slider value={[90]} max={100} step={1} onValueChange={noop} />
      </div>
      <div style={field}>
        <div style={head}>
          <Label htmlFor="concurrency">Concurrency</Label>
          <span style={muted}>8 workers</span>
        </div>
        <Slider value={[8]} max={16} step={1} onValueChange={noop} />
      </div>
    </div>
  </div>
)

export const Disabled = () => (
  <div style={{ padding: 24, maxWidth: 360 }}>
    <div style={field}>
      <div style={head}>
        <Label htmlFor="seed">Seed (fixed while running)</Label>
        <span style={muted}>42</span>
      </div>
      <Slider value={[42]} max={100} step={1} onValueChange={noop} disabled />
    </div>
  </div>
)
