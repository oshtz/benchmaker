# Testing Methodology

Benchmaker evaluates model outputs on a normalized `0..1` internal scale and displays scores as `0..100`.

## Scoring Methods

| Method | Output | Deterministic | Best for |
| --- | --- | --- | --- |
| Exact match | 0-100 continuous | Yes | Short precise answers |
| Regex match | 0 or 100 | Yes | Format validation |
| Numeric tolerance | 0-100 continuous | Yes | Math and numeric tasks |
| Boolean contains | 0 or 100 | Yes | Simple required-content checks |
| LLM judge | 0-100 continuous | No | Subjective or multi-criteria tasks |
| Code Arena judge | 0-100 continuous | No | Frontend code generation |

## Scoring Result Shape

```ts
interface ScoringResult {
  score: number
  confidence?: number
  notes?: string
  rawScore?: number
  maxScore?: number
}
```

`score` is always normalized. `rawScore` and `maxScore` preserve the source scale where useful. Deterministic boolean scoring now records `rawScore` as `100` or `0` and `maxScore` as `100`.

## Standard Arena Flow

1. Create one result entry for each test-case and model pair.
2. Execute requests through OpenRouter with the configured concurrency limit.
3. Stream model output when supported.
4. Persist response text, latency, usage tokens, cost, status, and errors.
5. Score each result with the test case scoring method.
6. Persist run-level parameters, judge model, error count, and error summary.

## Code Arena Flow

1. Send the Code Arena system prompt and user prompt to each selected model.
2. Stream and extract runnable HTML from model output.
3. Render each output in a sandboxed iframe.
4. Optionally score outputs with the Code Arena judge.
5. Persist the full Code Arena run in SQLite as a JSON payload, including outputs, costs, status, and judge metadata.

## Reproducibility

Enable Benchmark Mode when you need repeatable model behavior:

- Temperature is forced to `0`.
- Frequency penalty is forced to `0`.
- Presence penalty is forced to `0`.
- The effective benchmark parameters are persisted with the run.

LLM judges and provider-side sampling can still introduce variance, so compare subjective scores across repeated runs.

## Cost Controls

The app estimates run cost before execution using OpenRouter pricing data when available. A max run cost of `0` disables the cap. If a cap is set and the estimated cost exceeds it, execution is blocked before requests are sent.

Actual token and cost metadata is persisted when the API returns usage data.

## Recommended Protocol

1. Prefer deterministic scoring for factual, structural, or numeric checks.
2. Use LLM judges for rubric-style tasks where deterministic rules are too brittle.
3. Run subjective benchmarks 3-5 times and compare means and standard deviations.
4. Keep the same model parameters across all compared models.
5. Set realistic cost caps for large suites and Code Arena runs.
6. Use the persisted run history rather than screenshots or manual notes for comparisons.

## Automated Verification

Current automated checks:

```bash
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

Vitest covers deterministic scoring, code extraction, and local DB snapshot normalization. Rust tests cover SQLite migration and round-tripping of run metadata and Code Arena payloads. Playwright provides a browser smoke test for the built app shell.

## Known Limits

- LLM judge scores can vary even with low temperature.
- Cost estimates depend on model metadata and approximate token counting before execution.
- Code Arena preview code is sandboxed, but generated JavaScript can still affect its own iframe runtime.
- Browser-level visual judging of Code Arena output is not automated yet.
