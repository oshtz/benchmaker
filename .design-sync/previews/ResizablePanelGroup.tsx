import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from 'benchmaker'

const label = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-muted-foreground)',
  marginBottom: 8,
} as const

const mono = {
  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
  fontSize: 12.5,
  lineHeight: 1.6,
  color: 'var(--color-foreground)',
  whiteSpace: 'pre-wrap',
} as const

export const PromptResponse = () => (
  <ResizablePanelGroup direction="horizontal">
    <ResizablePanel defaultSize={45}>
      <div style={{ padding: 16, height: '100%' }}>
        <p style={label}>Prompt</p>
        <p style={mono}>{`Convert 98.6°F to Celsius.
Show your working, then give
the final answer.`}</p>
      </div>
    </ResizablePanel>
    <ResizableHandle withHandle />
    <ResizablePanel defaultSize={55}>
      <div style={{ padding: 16, height: '100%' }}>
        <p style={label}>Response — gpt-4o</p>
        <p style={mono}>{`(98.6 − 32) × 5/9
= 66.6 × 5/9
= 37°C`}</p>
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
)
