import { Textarea, Label } from 'benchmaker'

const field = { display: 'flex', flexDirection: 'column', gap: 6 } as const
const muted = { color: 'var(--color-muted-foreground)', fontSize: 12 }

export const Labeled = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <div style={field}>
      <Label htmlFor="sys-prompt">System prompt</Label>
      <Textarea
        id="sys-prompt"
        rows={4}
        placeholder="You are an expert evaluator. Score each answer 1-10 for factual accuracy..."
      />
      <span style={muted}>Sent to the judge model before each test case.</span>
    </div>
  </div>
)

export const Filled = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <div style={field}>
      <Label htmlFor="test-prompt">Test case prompt</Label>
      <Textarea
        id="test-prompt"
        rows={5}
        defaultValue={"Summarize the following earnings call transcript in 3 bullet points, then list any forward-looking guidance the CFO gave.\n\nTranscript: ..."}
      />
    </div>
  </div>
)

export const Disabled = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <div style={field}>
      <Label htmlFor="judge-rationale">Judge rationale</Label>
      <Textarea
        id="judge-rationale"
        rows={3}
        defaultValue="Answer correctly identified all three key metrics but missed the revenue caveat. Deducted 1 point."
        disabled
      />
      <span style={muted}>Generated output is read-only.</span>
    </div>
  </div>
)
