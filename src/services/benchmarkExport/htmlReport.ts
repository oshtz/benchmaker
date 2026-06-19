import type { BenchmarkExportDocument, ModelExportRow, TestCaseExportRow } from './types'
import appIconUrl from '/src-tauri/icons/128x128.png?inline'
import {
  escapeHtml,
  formatCost,
  formatDateTime,
  formatDuration,
  formatInteger,
  formatLatency,
  formatPercent,
} from './formatters'

function renderCaveats(document: BenchmarkExportDocument): string {
  if (document.caveats.length === 0) return ''
  return `
    <section class="callout">
      <h2>Caveats</h2>
      <ul>
        ${document.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join('')}
      </ul>
    </section>
  `
}

function renderKpi(label: string, value: string, note?: string): string {
  return `
    <div class="kpi">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${note ? `<small>${escapeHtml(note)}</small>` : ''}
    </div>
  `
}

function renderCoverKpi(label: string, value: string): string {
  return `
    <div class="cover-kpi">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `
}

function renderScoreBar(value: number): string {
  const percent = Math.max(0, Math.min(100, value * 100))
  return `
    <div class="scorebar" aria-label="${percent.toFixed(1)} percent">
      <div style="width:${percent.toFixed(2)}%"></div>
    </div>
  `
}

function renderModelTable(rows: ModelExportRow[], includeCostTokens: boolean): string {
  return `
    <section>
      <h2>Leaderboard</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Model</th>
              <th>Effective Score</th>
              <th>Scored Mean</th>
              <th>Coverage</th>
              <th>Success</th>
              <th>Latency</th>
              ${includeCostTokens ? '<th>Tokens</th><th>Cost</th>' : ''}
              <th>Failures</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${row.rank === 1 ? 'leader-row' : ''}">
                <td class="rank">${row.rank}</td>
                <td>
                  <strong>${escapeHtml(row.displayName)}</strong>
                  <small>${escapeHtml(row.fullDisplayName)}</small>
                </td>
                <td>
                  <strong>${formatPercent(row.effectiveScore)}</strong>
                  ${renderScoreBar(row.effectiveScore)}
                </td>
                <td>${formatPercent(row.scoredMean)}</td>
                <td>${formatPercent(row.coverage, 0)}<small>${row.scoredCount}/${row.totalExpected} scored</small></td>
                <td>${formatPercent(row.successRate, 0)}</td>
                <td>${formatLatency(row.meanLatencyMs)}</td>
                ${includeCostTokens ? `<td>${formatInteger(row.totalTokens)}</td><td>${formatCost(row.totalCost)}</td>` : ''}
                <td>${row.failedCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderMethodology(document: BenchmarkExportDocument): string {
  const { parameters } = document.run
  const scoringMethods = Object.entries(document.summary.scoringMethodCounts)
    .filter(([, count]) => count > 0)
    .map(([method, count]) => `${method}: ${count}`)
    .join(', ')

  return `
    <section>
      <h2>Methodology</h2>
      <div class="grid two">
        <div class="panel">
          <h3>Run Settings</h3>
          <dl>
            <dt>Temperature</dt><dd>${parameters.temperature}</dd>
            <dt>Top P</dt><dd>${parameters.topP}</dd>
            <dt>Max Tokens</dt><dd>${parameters.maxTokens}</dd>
            <dt>Frequency Penalty</dt><dd>${parameters.frequencyPenalty}</dd>
            <dt>Presence Penalty</dt><dd>${parameters.presencePenalty}</dd>
            <dt>Benchmark Mode</dt><dd>${parameters.benchmarkMode ? 'Enabled' : 'Disabled'}</dd>
            <dt>Judge Model</dt><dd>${escapeHtml(document.run.judgeModel || '-')}</dd>
          </dl>
        </div>
        <div class="panel">
          <h3>Scoring</h3>
          <dl>
            <dt>Scoring Methods</dt><dd>${escapeHtml(scoringMethods || '-')}</dd>
            <dt>Ranking Metric</dt><dd>Effective score</dd>
            <dt>Effective Score</dt><dd>Weighted score over all expected cells; missing/unscored cells count as zero.</dd>
            <dt>Scored Mean</dt><dd>Weighted score over cells that produced scores.</dd>
          </dl>
        </div>
      </div>
      ${document.options.includeSystemPrompt && document.suite.systemPrompt ? `
        <h3>System Prompt</h3>
        <pre>${escapeHtml(document.suite.systemPrompt)}</pre>
      ` : ''}
      ${document.options.includeJudgePrompt && document.suite.judgeSystemPrompt ? `
        <h3>Judge Prompt</h3>
        <pre>${escapeHtml(document.suite.judgeSystemPrompt)}</pre>
      ` : ''}
    </section>
  `
}

function renderMultiRun(document: BenchmarkExportDocument): string {
  if (!document.multiRun) return ''

  return `
    <section>
      <h2>Multi-Run Analysis</h2>
      <p class="muted">Based on ${document.multiRun.relatedRunCount} completed runs of this suite.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Runs</th>
              <th>Mean</th>
              <th>Std Dev</th>
              <th>95% CI</th>
              <th>Range</th>
            </tr>
          </thead>
          <tbody>
            ${document.multiRun.modelStats.map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.displayName)}</strong></td>
                <td>${row.scores.length}</td>
                <td>${formatPercent(row.mean)}</td>
                <td>${formatPercent(row.stdDev)}</td>
                <td>${formatPercent(row.confidence95[0])} - ${formatPercent(row.confidence95[1])}</td>
                <td>${formatPercent(row.min)} - ${formatPercent(row.max)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${document.multiRun.topComparison ? `
        <div class="panel">
          <h3>Top Two Comparison</h3>
          <p>
            ${escapeHtml(document.multiRun.topComparison.displayNameA)} leads
            ${escapeHtml(document.multiRun.topComparison.displayNameB)}
            by ${formatPercent(document.multiRun.topComparison.scoreDiff)}.
            Approximate p-value: ${document.multiRun.topComparison.pValue.toFixed(4)}.
            ${document.multiRun.topComparison.isSignificant ? 'The observed difference is significant at p < 0.05.' : 'The observed difference is not significant at p < 0.05.'}
          </p>
        </div>
      ` : ''}
    </section>
  `
}

function renderTestRows(rows: TestCaseExportRow[], document: BenchmarkExportDocument): string {
  return `
    <section>
      <h2>Per-Test Results</h2>
      ${rows.map((row) => `
        <article class="testcase">
          <header>
            <h3>Test ${row.index}</h3>
            <div>
              <span>${escapeHtml(row.scoringMethod)}</span>
              <span>Weight ${row.weight}</span>
              ${row.difficulty ? `<span>${escapeHtml(row.difficulty)}</span>` : ''}
              ${row.category ? `<span>${escapeHtml(row.category)}</span>` : ''}
            </div>
          </header>
          <p>${escapeHtml(row.prompt)}</p>
          ${document.options.includeExpectedOutputs && row.expectedOutput ? `
            <h4>Expected Output</h4>
            <pre>${escapeHtml(row.expectedOutput)}</pre>
          ` : ''}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Latency</th>
                  ${document.options.includeCostTokens ? '<th>Tokens</th><th>Cost</th>' : ''}
                  ${document.options.includeScoringNotes ? '<th>Notes</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${row.cells.map((cell) => `
                  <tr>
                    <td><strong>${escapeHtml(cell.displayName)}</strong></td>
                    <td>${escapeHtml(cell.status)}</td>
                    <td>${cell.score ? formatPercent(cell.score.score) : '-'}</td>
                    <td>${formatLatency(cell.latencyMs)}</td>
                    ${document.options.includeCostTokens ? `<td>${formatInteger((cell.promptTokens || 0) + (cell.completionTokens || 0))}</td><td>${formatCost(cell.cost)}</td>` : ''}
                    ${document.options.includeScoringNotes ? `<td>${escapeHtml(cell.scoringNotes || cell.error || '')}</td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

function renderRawResponses(document: BenchmarkExportDocument): string {
  if (!document.options.includeRawResponses) return ''

  return `
    <section>
      <h2>Raw Responses Appendix</h2>
      ${document.testRows.map((row) => `
        <article class="testcase">
          <h3>Test ${row.index}</h3>
          ${row.cells.map((cell) => `
            <details>
              <summary>${escapeHtml(cell.displayName)} - ${cell.score ? formatPercent(cell.score.score) : escapeHtml(cell.status)}</summary>
              ${cell.error ? `<p class="error">${escapeHtml(cell.error)}</p>` : ''}
              <pre>${escapeHtml(cell.response || '(empty response)')}</pre>
            </details>
          `).join('')}
        </article>
      `).join('')}
    </section>
  `
}

export function generateScientificHtml(document: BenchmarkExportDocument): string {
  const topModel = document.summary.topModel
  const appIcon = escapeHtml(appIconUrl)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(document.suite.name)} - Benchmark Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eee8de;
      --paper: #fff9ee;
      --paper-2: #f6efe4;
      --ink: #11100f;
      --muted: #62594f;
      --faint: #9b9083;
      --line: rgba(17, 16, 15, .16);
      --panel: #fff9ee;
      --panel-strong: #e2d8c9;
      --dark: #090909;
      --dark-panel: #141312;
      --dark-text: #f8f0e4;
      --accent: #E8549C;
      --accent-2: #F28E2B;
      --good: #087f5b;
      --warn: #a65f00;
      --error: #b42318;
      --track: #cec3b5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(rgba(17, 16, 15, .055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(17, 16, 15, .055) 1px, transparent 1px),
        var(--bg);
      background-size: 42px 42px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      line-height: 1.45;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: .26;
      background-image:
        repeating-linear-gradient(0deg, rgba(255,255,255,.22) 0 1px, transparent 1px 3px),
        repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 1px, transparent 1px 4px);
      mix-blend-mode: soft-light;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 34px 28px 80px; position: relative; }
    header.cover {
      position: relative;
      overflow: hidden;
      color: var(--dark-text);
      background:
        linear-gradient(rgba(248, 240, 228, .06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(248, 240, 228, .06) 1px, transparent 1px),
        var(--dark);
      background-size: 42px 42px;
      border: 1px solid rgba(248, 240, 228, .18);
      border-radius: 22px;
      padding: 28px;
      margin-bottom: 30px;
      box-shadow: 0 20px 70px rgba(17, 16, 15, .18);
    }
    header.cover::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(180deg, rgba(248, 240, 228, .08), transparent 38%);
    }
    .brand-row, .cover-body, .cover-kpis, .meta, .accent-rule { position: relative; z-index: 1; }
    .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand-lockup { display: flex; align-items: center; gap: 14px; }
    .app-icon { width: 46px; height: 46px; border-radius: 10px; box-shadow: 0 0 0 1px rgba(248, 240, 228, .22); }
    .brand { color: var(--accent); font-weight: 900; text-transform: uppercase; letter-spacing: .18em; font-size: 12px; }
    .brand-subtitle, .format-pill { color: var(--faint); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; }
    .format-pill { border: 1px solid rgba(248, 240, 228, .22); border-radius: 999px; padding: 7px 10px; color: var(--dark-text); }
    .accent-rule { height: 7px; margin: 24px 0 28px; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
    .cover-body { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 28px; align-items: end; }
    h1 { font-size: 44px; margin: 0 0 14px; letter-spacing: -.04em; line-height: 1.04; }
    .cover-description { color: #c9bfb4; max-width: 780px; margin: 18px 0 0; }
    .cover-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .cover-kpi {
      border: 1px solid rgba(248, 240, 228, .14);
      background: rgba(248, 240, 228, .045);
      padding: 11px;
    }
    .cover-kpi span { display: block; color: #aaa197; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; }
    .cover-kpi strong { display: block; color: var(--dark-text); font-size: 17px; margin-top: 5px; letter-spacing: -.03em; }
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      margin: 38px 0 14px;
      letter-spacing: -.03em;
    }
    h2::after { content: ""; height: 2px; flex: 1; background: linear-gradient(90deg, var(--accent), var(--accent-2), transparent); opacity: .75; }
    h3 { font-size: 16px; margin: 16px 0 8px; letter-spacing: -.02em; }
    h4 { font-size: 12px; margin: 12px 0 6px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    p, li, td, th, dd, dt { font-size: 13px; }
    .muted, small { color: var(--muted); }
    small { display: block; margin-top: 2px; }
    .meta { display: flex; gap: 10px; flex-wrap: wrap; color: #aaa197; font-size: 12px; }
    .meta span { border: 1px solid rgba(248, 240, 228, .16); background: rgba(248, 240, 228, .04); padding: 5px 8px; }
    .grid { display: grid; gap: 14px; }
    .grid.kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 24px 0; }
    .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kpi, .panel, .callout {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 10px;
      padding: 14px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.6);
    }
    .kpi { position: relative; overflow: hidden; min-height: 112px; }
    .kpi::before {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 5px;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
    }
    .kpi span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .kpi strong { display: block; font-size: 27px; margin-top: 7px; letter-spacing: -.05em; line-height: 1.05; }
    .callout { border-color: rgba(242, 142, 43, .5); background: #fff1dc; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); }
    table { border-collapse: collapse; width: 100%; min-width: 760px; }
    th, td { padding: 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; background: var(--panel-strong); }
    tr:last-child td { border-bottom: 0; }
    tbody tr { background: var(--paper); }
    tbody tr:nth-child(even) { background: var(--paper-2); }
    .leader-row { background: #fff1e4; }
    .leader-row td:first-child { color: var(--accent); }
    .rank { font-weight: 900; font-size: 18px; letter-spacing: -.03em; }
    .scorebar {
      height: 9px;
      background: var(--track);
      border: 1px solid rgba(17, 16, 15, .08);
      border-radius: 99px;
      overflow: hidden;
      margin-top: 7px;
      width: min(220px, 100%);
    }
    .scorebar div {
      position: relative;
      height: 100%;
      border-radius: inherit;
      overflow: hidden;
      background:
        radial-gradient(circle at 18% 35%, rgba(255,255,255,.35), transparent 27%),
        radial-gradient(circle at 72% 40%, rgba(242,142,43,.9), transparent 31%),
        linear-gradient(90deg, var(--accent), var(--accent-2) 52%, var(--accent));
    }
    .scorebar div::after {
      content: "";
      position: absolute;
      inset: 0;
      opacity: .16;
      background:
        repeating-linear-gradient(90deg, rgba(255,255,255,.55) 0 1px, transparent 1px 4px),
        linear-gradient(180deg, rgba(255,255,255,.26), transparent 58%);
    }
    dl { display: grid; grid-template-columns: 160px 1fr; gap: 8px 12px; margin: 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--dark);
      color: var(--dark-text);
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
      overflow-x: auto;
    }
    .testcase { border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 14px 0; page-break-inside: avoid; background: var(--paper); }
    .testcase header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
    .testcase header div { display: flex; gap: 6px; flex-wrap: wrap; justify-content: end; }
    .testcase header span {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 8px;
      color: var(--muted);
      font-size: 11px;
    }
    details { border-top: 1px solid var(--line); padding: 10px 0; }
    summary { cursor: pointer; font-weight: 700; }
    .error { color: var(--error); }
    footer { margin-top: 40px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--line); padding-top: 16px; }
    @media print {
      body { background: #fff; }
      body::before { display: none; }
      main { padding: 16mm 12mm; max-width: none; }
      header.cover { box-shadow: none; break-inside: avoid; }
      .grid.kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .table-wrap { overflow: visible; }
      table { min-width: 0; }
      details { break-inside: avoid; }
    }
    @media (max-width: 760px) {
      h1 { font-size: 30px; }
      .cover-body { grid-template-columns: 1fr; }
      .cover-kpis { grid-template-columns: 1fr 1fr; }
      .grid.kpis, .grid.two { grid-template-columns: 1fr; }
      main { padding: 24px 16px 56px; }
    }
  </style>
</head>
<body>
  <main>
    <header class="cover">
      <div class="brand-row">
        <div class="brand-lockup">
          <img class="app-icon" src="${appIcon}" alt="" />
          <div>
            <div class="brand">Benchmaker</div>
            <div class="brand-subtitle">Scientific Report</div>
          </div>
        </div>
        <div class="format-pill">HTML Report</div>
      </div>
      <div class="accent-rule"></div>
      <div class="cover-body">
        <div>
          <h1>${escapeHtml(document.suite.name)}</h1>
          <div class="meta">
            <span>Run started: ${formatDateTime(document.run.startedAt)}</span>
            <span>Generated: ${formatDateTime(document.generatedAt)}</span>
            <span>Status: ${escapeHtml(document.run.status)}</span>
            <span>Suite source: ${escapeHtml(document.suite.source)}</span>
          </div>
          ${document.suite.description ? `<p class="cover-description">${escapeHtml(document.suite.description)}</p>` : ''}
        </div>
        <div class="cover-kpis">
          ${renderCoverKpi('Top', topModel?.displayName || '-')}
          ${renderCoverKpi('Score', topModel ? formatPercent(topModel.effectiveScore) : '-')}
          ${renderCoverKpi('Coverage', formatPercent(document.summary.coverage, 0))}
          ${renderCoverKpi('Duration', formatDuration(document.summary.durationMs))}
        </div>
      </div>
    </header>

    <section>
      <h2>Executive Summary</h2>
      <div class="grid kpis">
        ${renderKpi('Top Model', topModel?.displayName || '-', topModel ? topModel.fullDisplayName : undefined)}
        ${renderKpi('Effective Score', topModel ? formatPercent(topModel.effectiveScore) : '-')}
        ${renderKpi('Coverage', formatPercent(document.summary.coverage, 0), `${document.summary.scoredCount}/${document.summary.expectedResultCount} scored`)}
        ${renderKpi('Duration', formatDuration(document.summary.durationMs))}
        ${renderKpi('Models', String(document.summary.modelCount))}
        ${renderKpi('Test Cases', String(document.summary.testCaseCount))}
        ${renderKpi('Total Cost', formatCost(document.summary.totalCost))}
        ${renderKpi('Total Tokens', formatInteger(document.summary.totalTokens))}
      </div>
    </section>

    ${renderCaveats(document)}
    ${renderModelTable(document.modelRows, document.options.includeCostTokens)}
    ${renderMethodology(document)}
    ${renderMultiRun(document)}
    ${renderTestRows(document.testRows, document)}
    ${renderRawResponses(document)}

    <footer>
      Export version ${document.exportVersion}${document.appVersion ? `, Benchmaker ${escapeHtml(document.appVersion)}` : ''}.
      Run ID: ${escapeHtml(document.run.id)}. Suite ID: ${escapeHtml(document.run.testSuiteId)}.
    </footer>
  </main>
</body>
</html>`
}
