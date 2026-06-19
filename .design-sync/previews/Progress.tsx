import { Progress } from 'benchmaker'

const row = { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } as const
const muted = { color: 'var(--color-muted-foreground)' }
const block = { display: 'flex', flexDirection: 'column', gap: 18 } as const

export const RunProgress = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <div style={block}>
      <div>
        <div style={row}><span>Claude Opus 4.8</span><span style={muted}>100 / 100</span></div>
        <Progress value={100} />
      </div>
      <div>
        <div style={row}><span>GPT-5.1</span><span style={muted}>72 / 100</span></div>
        <Progress value={72} />
      </div>
      <div>
        <div style={row}><span>Gemini 3 Pro</span><span style={muted}>33 / 100</span></div>
        <Progress value={33} />
      </div>
    </div>
  </div>
)

export const Overall = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <div style={row}>
      <span>Benchmark in progress</span>
      <span style={muted}>205 / 300 cases</span>
    </div>
    <Progress value={68} />
  </div>
)
