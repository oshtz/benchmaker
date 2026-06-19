import { Badge } from 'benchmaker'

const row = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: 24 } as const

export const Variants = () => (
  <div style={row}>
    <Badge>92%</Badge>
    <Badge variant="secondary">gpt-4o-mini</Badge>
    <Badge variant="destructive">Failed</Badge>
    <Badge variant="outline">128 cases</Badge>
    <Badge variant="success">Passed</Badge>
    <Badge variant="warning">Running</Badge>
  </div>
)

export const RunStatus = () => (
  <div style={row}>
    <Badge variant="success">Completed</Badge>
    <Badge variant="warning">Queued</Badge>
    <Badge variant="destructive">Timed out</Badge>
    <Badge variant="secondary">Cancelled</Badge>
  </div>
)

export const Metrics = () => (
  <div style={row}>
    <Badge>94.5% accuracy</Badge>
    <Badge variant="outline">312ms p50</Badge>
    <Badge variant="outline">$0.0042 / 1k</Badge>
    <Badge variant="secondary">judge: claude-3.5</Badge>
  </div>
)
