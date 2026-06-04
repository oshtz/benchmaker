# Benchmaker

Benchmaker is a desktop app for comparing LLMs under the same prompts, parameters, and scoring rules. It runs on React, TypeScript, and Tauri 1.x, with OpenRouter as the model API.

## What It Does

- Build reusable benchmark suites with system prompts, test cases, weights, and scoring methods.
- Compare multiple OpenRouter models in parallel with streaming responses.
- Score outputs with exact match, regex, numeric tolerance, boolean contains, LLM judge, and Code Arena judge flows.
- Run a Code Arena workflow for side-by-side frontend code generation with live previews.
- Persist suites, standard benchmark runs, Code Arena runs, execution metadata, token counts, and costs in local SQLite.
- Estimate run cost before execution, enforce an optional max-run cost cap, and configure request concurrency.
- Store the OpenRouter API key in the OS credential store in the desktop app.
- Check GitHub Releases for signed/checksummed update assets.

## Tech Stack

- React 19, TypeScript, Vite 7
- Tailwind CSS 4, Radix UI, Lucide icons, Monaco Editor
- Zustand state stores
- Tauri 1.x Rust backend
- SQLite via `rusqlite`
- OpenRouter API

## Requirements

- Node.js 20 is recommended
- Rust stable
- npm
- OpenRouter API key

## Install And Run

```bash
npm install
npm run tauri dev
```

Build the desktop app:

```bash
npm run tauri build
```

Run the browser-only Vite app for frontend development:

```bash
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

`npm run check` runs TypeScript, Vitest, and Rust tests. The Playwright smoke test uses Vite preview on port `4273` by default; override it with `PLAYWRIGHT_PORT` if needed.

## Data And Security

- App data is stored locally in a Tauri app-data SQLite database.
- The normalized database schema is versioned in `src-tauri/src/main.rs`.
- Snapshot import/export remains available through the Data tab for inspection and repair.
- OpenRouter keys are not written into the app snapshot or the persisted Zustand settings store. In Tauri builds they are stored through the OS credential store.
- In browser-only development, API keys are held in memory for the session.

## Cost Controls

The Arena and Code Arena both expose:

- Max run cost in USD. `0` disables the cap.
- Concurrent request limit from `1` to `20`.

Cost estimates use OpenRouter model pricing when available and a conservative character-based token estimate before execution. Actual token and cost metadata is persisted with completed outputs when the API returns usage data.

## Updates And Releases

The updater checks the latest GitHub release for platform-specific assets:

- Windows: `Benchmaker-Portable.exe`
- macOS: `Benchmaker.app.zip`

Each update asset must have a matching `.sha256` sidecar, or be covered by `checksums.txt`. The app verifies SHA-256 before writing or applying the update.

The GitHub Actions release workflow also supports optional Windows code signing through:

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

macOS release builds require the Apple signing and notarization secrets already referenced in `.github/workflows/build.yml`.

## Project Layout

```text
src/
  components/        React UI
  scoring/           Scoring implementations and judge helpers
  services/          OpenRouter, execution, local DB, updater, cost controls
  stores/            Zustand stores
  types/             Shared TypeScript types
src-tauri/
  src/main.rs        Tauri commands, SQLite schema, updater helpers
tests/e2e/           Playwright smoke tests
.github/workflows/   Build and quality workflows
```

## Useful Files

- `TESTING_METHODOLOGY.md`: scoring and reproducibility notes
- `UPDATE_ARCHITECTURE.md`: updater contract and release assets
- `RELEASE_RUNBOOK.md`: signing, notarization, and manual release smoke gates
- `TAURI2_MIGRATION_ASSESSMENT.md`: migration scope and recommendation
- `plans/code-arena-plan.md`: historical Code Arena implementation plan

## Current Roadmap

- Add richer export/reporting formats.
- Add deeper browser-level Code Arena verification.
- Reduce frontend bundle size with route/component chunking.
- Consider a Tauri 2 migration once the updater and plugin model are worth the migration cost.
