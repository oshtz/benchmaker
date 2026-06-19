import {
  ToastProvider,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  ToastViewport,
} from 'benchmaker'

// ToastViewport ships position:fixed, which collapses the card root to ~1px
// (and the toast paints off-canvas). For the static preview we override it to
// flow in-card via an inline style (inline beats the .fixed class), so both
// variants render stacked and the card has real height. cfg.overrides.Toast:
// cardMode 'single'.
const flowViewport = {
  position: 'static',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  width: '100%',
  padding: 0,
} as const

export const Default = () => (
  <div style={{ padding: 24 }}>
    <ToastProvider duration={1000000}>
      <Toast open>
        <div style={{ display: 'grid', gap: 4 }}>
          <ToastTitle>Benchmark complete</ToastTitle>
          <ToastDescription>
            Claude Opus 4.8 finished 128 prompts in 2m 14s.
          </ToastDescription>
        </div>
        <ToastAction altText="View results">View</ToastAction>
        <ToastClose />
      </Toast>
      <Toast open variant="destructive">
        <div style={{ display: 'grid', gap: 4 }}>
          <ToastTitle>Run failed</ToastTitle>
          <ToastDescription>
            GPT-5 returned a 429 rate-limit error. Retry or lower concurrency.
          </ToastDescription>
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport style={flowViewport} />
    </ToastProvider>
  </div>
)
