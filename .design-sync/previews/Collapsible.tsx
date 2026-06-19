import { Collapsible, CollapsibleTrigger, CollapsibleContent } from 'benchmaker'
import { ChevronDown } from 'lucide-react'

const trigger = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-muted)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-foreground)',
  cursor: 'pointer',
} as const

const content = {
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
  fontSize: 12.5,
  lineHeight: 1.6,
  color: 'var(--color-muted-foreground)',
  whiteSpace: 'pre-wrap',
} as const

export const SystemPrompt = () => (
  <div style={{ padding: 24, maxWidth: 480 }}>
    <Collapsible defaultOpen>
      <CollapsibleTrigger style={trigger}>
        System prompt
        <ChevronDown style={{ height: 16, width: 16 }} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div style={content}>{`You are an expert evaluator. Read the model's answer and
the reference solution, then score correctness from 0–10.
Respond with JSON: { "score": number, "reason": string }.`}</div>
      </CollapsibleContent>
    </Collapsible>
  </div>
)

export const FailedCase = () => (
  <div style={{ padding: 24, maxWidth: 480 }}>
    <Collapsible defaultOpen>
      <CollapsibleTrigger style={trigger}>
        Case #47 — Failed (score 2/10)
        <ChevronDown style={{ height: 16, width: 16 }} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div style={content}>{`Input: "Convert 98.6°F to Celsius."
Expected: 37°C
gpt-4o-mini: "98.6°F is about 67°C."
Judge: Incorrect arithmetic; off by 30°C.`}</div>
      </CollapsibleContent>
    </Collapsible>
  </div>
)
