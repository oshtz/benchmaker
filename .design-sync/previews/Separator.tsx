import { Separator } from 'benchmaker'

const heading = { fontSize: 14, fontWeight: 600, color: 'var(--color-foreground)' } as const
const body = { fontSize: 13, lineHeight: 1.5, color: 'var(--color-muted-foreground)' } as const

export const Horizontal = () => (
  <div style={{ padding: 24, maxWidth: 480 }}>
    <div style={{ marginBottom: 12 }}>
      <p style={heading}>Run configuration</p>
      <p style={body}>4 models compared over 128 test cases, scored by an LLM judge.</p>
    </div>
    <Separator />
    <div style={{ marginTop: 12 }}>
      <p style={heading}>Judge settings</p>
      <p style={body}>claude-3.5-sonnet at temperature 0, max 1024 tokens.</p>
    </div>
  </div>
)

export const Vertical = () => (
  <div style={{ padding: 24 }}>
    <div style={{ display: 'flex', height: 24, alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--color-muted-foreground)' }}>
      <span>128 cases</span>
      <Separator orientation="vertical" />
      <span>94.5% accuracy</span>
      <Separator orientation="vertical" />
      <span>312ms p50</span>
      <Separator orientation="vertical" />
      <span>$0.41 total</span>
    </div>
  </div>
)
