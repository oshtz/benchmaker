# Benchmaker Design System — build conventions

Monospace-forward, pink-accented UI from the Benchmaker app: shadcn / Radix
primitives styled with **Tailwind v4** and CSS-variable tokens. Import components
from `benchmaker` (they resolve from `window.BenchmakerUI.*`).

## Setup & theming
- **No ThemeProvider — theming is pure CSS.** Every token is a CSS custom
  property in `styles.css` (`:root` from Tailwind's `@theme`, overridden under
  `.dark`). Components read them through utilities; there is nothing to wrap.
- **Dark mode:** add `class="dark"` to any ancestor (typically the root). Every
  `--color-*` token flips — no JS, no provider.
- **Monospace is the brand signature.** The whole UI renders in **JetBrains Mono**
  (→ `Fira Code` → `ui-monospace`); `styles.css` sets it on `body`. Keep your own
  layout/glue type in the same family — do **not** introduce a sans-serif stack.
- **Toast** is the only component needing its own context: render the exported
  `Toaster` (it wraps `ToastProvider` + `ToastViewport`) once near the root, then
  trigger toasts. Dialog / Select / DropdownMenu use Radix portals — no app-level
  provider needed.

## Styling idiom — Tailwind v4 utilities over the tokens
Style with utility classes; color utilities map 1:1 to the tokens (Tailwind v4
generates `{prop}-{token}` from `@theme`). Use tokens, never raw hex:

| Role | Utilities |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground`, `text-primary-foreground` |
| Brand — pink `hsl(330 75% 62%)` | `bg-primary`, `text-primary` |
| Destructive — red | `bg-destructive`, `text-destructive` |
| Lines | `border-border`, `border-input` |
| Radius | `rounded-xl` (= `--radius` 0.75rem), `rounded-lg`, `rounded-md` |

Four custom utilities carry the brand — prefer them over re-deriving:
- **`surface`** — the standard card treatment (`bg-card` + hairline border + soft
  shadow + `rounded-xl`) for your own panels when you're not using `<Card>`.
- **`headline`** — responsive bold display type with tight tracking.
- **`text-gradient`** — the purple→pink→orange brand gradient clipped to text
  (hero headings).
- **`bg-brand-gradient`** — that same gradient as a fill.

Don't invent token names — the authoritative set is the `--color-*` list in
`styles.css`.

## Where the truth lives
- **`styles.css`** (and its `@import` of `_ds_bundle.css`) — the full token +
  component-style surface. Read it before styling.
- Per component: **`<Name>.d.ts`** (props contract) and **`<Name>.prompt.md`**
  (usage + examples). Compose from these, not from guesses.

## Idiomatic build snippet
```tsx
import { Card, Badge, Button } from 'benchmaker'

<Card className="p-6 flex flex-col gap-4">
  <div className="flex items-center justify-between">
    <h3 className="headline">Latency benchmark</h3>
    <Badge variant="success">Completed</Badge>
  </div>
  <p className="text-sm text-muted-foreground">gpt-4o · 1,240 tokens · 3.2s</p>
  <Button>Re-run</Button>
</Card>
```
Library components for the controls; Benchmaker's own utilities (`headline`,
`surface`, the token classes) for your layout glue.
