import { ScrollArea } from 'benchmaker'

const cases = [
  { id: 1, name: 'Two-step word problem', score: '10/10', ok: true },
  { id: 2, name: 'Unit conversion (°F → °C)', score: '2/10', ok: false },
  { id: 3, name: 'JSON extraction', score: '9/10', ok: true },
  { id: 4, name: 'Multi-hop reasoning', score: '8/10', ok: true },
  { id: 5, name: 'Edge-case null handling', score: '4/10', ok: false },
  { id: 6, name: 'Code completion (Python)', score: '10/10', ok: true },
  { id: 7, name: 'Summarization fidelity', score: '7/10', ok: true },
  { id: 8, name: 'Instruction following', score: '9/10', ok: true },
  { id: 9, name: 'Refusal calibration', score: '3/10', ok: false },
  { id: 10, name: 'Tool-call formatting', score: '10/10', ok: true },
]

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  fontSize: 13,
  borderBottom: '1px solid var(--color-border)',
} as const

export const TestCaseList = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <ScrollArea
      style={{ height: 160 }}
      className="rounded-lg border border-border"
    >
      <div style={{ width: '100%' }}>
        {cases.map((c) => (
          <div key={c.id} style={rowStyle}>
            <span style={{ color: 'var(--color-foreground)' }}>
              #{c.id} {c.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                color: c.ok ? 'var(--color-primary)' : 'var(--color-destructive)',
              }}
            >
              {c.score}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  </div>
)
