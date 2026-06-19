# design-sync notes — Benchmaker

Benchmaker is a Tauri **app**, not a published component library. The "design
system" is the shadcn/ui primitives in `src/components/ui/`. There is no `dist/`
and no `node_modules/benchmaker`, so the converter runs in **synth-entry**
(`shape: "package"`) mode, bundling the components straight from source.

## Required setup (per fresh clone)

- **Junction `node_modules/benchmaker` → repo root.** `package-build.mjs` does
  `realpathSync(PKG_DIR)` where `PKG_DIR = node_modules/<pkg>`, so the package
  dir must exist. It's a junction (Windows, no admin needed). `node_modules` is
  gitignored, so recreate on a fresh clone:
  `New-Item -ItemType Junction -Path node_modules\benchmaker -Target <repo-root>`
  (the self-reference `node_modules/benchmaker/node_modules` is harmless — nothing
  walks node_modules recursively here).
- **`cfg.buildCmd` (`node .design-sync/prebuild.mjs`) must run before the
  converter.** It produces the two things synth-entry can't:
  1. `dist/types/**` — a TypeScript declaration tree (`tsc --emitDeclarationOnly`)
     so `<Name>Props` contracts are real (variant/size/etc.), not empty. Picked up
     via `findTypesRoot` → `dist/types`. Both `dist/` and the tree are gitignored.
  2. `.design-sync/.cache/ds-tailwind.css` — the compiled `cssEntry`. Component
     styling is **Tailwind-v4-generated**, so there is no shipped stylesheet;
     this compile of `src/index.css` (theme tokens, `.dark`, the custom utilities
     `surface`/`headline`/`text-gradient`/`bg-brand-gradient`, and every utility
     used by the UI components + authored previews) IS the style surface.

## Decisions / gotchas

- **MonacoEditor excluded.** `src/components/ui/MonacoEditor.tsx` does
  `import * as monaco from 'monaco-editor'` (multi-MB, > the 5 MB upload cap) and
  Vite-only `...?worker` specifiers esbuild can't resolve. Dropped from the synth
  entry by the thin `.design-sync/overrides/source-kit.mjs` wrapper fork
  (`cfg.synthExclude`) and from the declaration emit (`tsconfig.dts.json`
  `exclude`). It is NOT in the synced set by design.
- **JetBrains Mono** (brand monospace) is wired via a remote Google Fonts
  `@import` prepended to the compiled cssEntry. `cfg.runtimeFontPrefixes`
  suppresses `[FONT_MISSING]` for it and for `Fira Code` (an unprovided fallback
  in the font stack — harmless, ui-monospace catches it).
- **Compound sub-parts are flat exports** (shadcn style: `DialogContent`, not
  `Dialog.Content`), so the converter can't auto-group them under their parent
  (`dts.compounds` is empty). They stay importable (full API for the design
  agent) but appear as separate cards; only the top-level primitives get authored
  previews — sub-parts ride the floor card. This is intentional.
- **Authored previews: use inline `style={{}}` for layout** (gaps, flex, padding
  of the wrapper), and the components' own classes for the components themselves.
  Reason: subagents authoring previews recapture via `preview-rebuild` only and
  do NOT recompile the cssEntry, so a brand-new Tailwind utility class introduced
  in a preview wouldn't be styled until the orchestrator's next full prebuild +
  rebuild. Inline-style layout sidesteps that entirely.

## Re-sync risks (what can silently go stale)

- **The junction.** Absent on a fresh clone → `realpathSync(PKG_DIR)` throws.
  Recreate it (above) before running anything.
- **`buildCmd` ordering.** If `prebuild.mjs` isn't run first, `dist/types` is
  stale/missing (empty prop contracts) and the cssEntry is missing (unstyled
  cards). Always run `cfg.buildCmd` before `package-build.mjs`.
- **JetBrains Mono is remote.** If Google Fonts is unreachable at render time,
  cards fall back to system monospace. Switch to bundled woff2 via `cfg.extraFonts`
  if offline fidelity is ever needed.
- **Toolchain drift.** Tailwind v4 / `@tailwindcss/postcss` and `typescript` are
  resolved from the repo's own `node_modules` — a major bump to either could
  change the compiled CSS or declaration output; re-grade if cards move.
- **`@tailwindcss/cli` is NOT used** — the prebuild compiles via the repo's
  installed `@tailwindcss/postcss` + `postcss` (bare imports resolved up from
  `.design-sync/`). No extra converter dep needed for CSS.

## Authoring learnings (first sync — 22 previews, all graded good)

- **Inline-style layout works perfectly** — every preview uses `style={{}}` for
  wrapper layout + CSS vars (`var(--color-muted-foreground)`) for wrapper colors,
  and the components' own source classes for the components. No new Tailwind
  utility classes were introduced, so no cssEntry recompile churn.
- **Overlays render cleanly via `cardMode: single`.** Dialog/AlertDialog/
  ConfirmDialog are centered modals (reliable). **Select and DropdownMenu render
  their OPEN popper content correctly anchored in-card — no fallback to a closed
  trigger was needed.** Current viewports are all good; the open Select/Dropdown
  popper sits top-left with generous space below (could tighten height to ~340 if
  a denser card is ever wanted — optional).
- **Slider is a styled native `<input type="range">`** (not Radix). Use
  controlled `value={number[]}` + a no-op `onValueChange`; the filled track is the
  browser `accent-color` (pink `accent-primary`). `max` defaults to 100.
- **ScrollArea scrollbar does not appear in static screenshots** — Radix renders
  it only on hover/scroll. The overflowing clipped content is the gradeable
  evidence; this is expected, not a defect.
- **EmptyState `icon` prop takes the lucide component itself** (`icon={FlaskConical}`),
  not an element.
- Re-sync: owned previews in `.design-sync/previews/` carry forward; grades are
  re-derived from the uploaded `_ds_sync.json` anchor (not in git).

## Known render warns (triaged legitimate — re-syncs check against this list)

- **`[RENDER_THIN]` CardContent, DropdownMenuLabel** — floor-card sub-parts that
  render an empty styled element in isolation (a bare `<div>` with padding / a
  label slot with no text). They only render meaningfully *inside* their parent,
  and Card/DropdownMenu both have authored previews that compose them. They ride
  the floor card by design (see "Compound sub-parts" above); not a defect.

## Config-schema migration (2026-06-19 re-sync)

- **Removed `cfg.synthExclude`.** The current converter's config schema
  (`lib/common.mjs` `CONFIG_KEYS`) is strict and rejects unknown top-level keys;
  `synthExclude` was a fork-private key the June-16 converter tolerated. The
  MonacoEditor exclusion lists are now **hardcoded inside**
  `.design-sync/overrides/source-kit.mjs` (the repo-specific file they belong in),
  so the fork is self-contained. If a future converter adds a first-class
  synth-entry exclusion key, migrate the lists back into config and simplify the
  fork. The re-stage also bumped the grade contract → a one-time full re-grade of
  all 22 (renders unchanged; verdicts reproduced from fresh sheets).
