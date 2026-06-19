// design-sync pre-build for Benchmaker (recorded as cfg.buildCmd).
// Run from the repo root: `node .design-sync/prebuild.mjs`
// Produces the two inputs the converter can't synthesize itself:
//   1. dist/types/**          — declaration tree → accurate <Name>Props contracts
//   2. .design-sync/.cache/ds-tailwind.css — compiled Tailwind (theme tokens,
//      dark mode, custom utilities, every utility used by the UI components AND
//      the authored previews), with JetBrains Mono wired via a remote @import.
// Both outputs are gitignored; this script regenerates them deterministically.
//
// Bare imports (postcss, @tailwindcss/postcss) resolve up from .design-sync/
// into the repo's own node_modules. typescript is invoked as the repo binary.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const ROOT = process.cwd();
const CACHE = resolve(ROOT, '.design-sync/.cache');
mkdirSync(CACHE, { recursive: true });

// ── 1. declaration tree ───────────────────────────────────────────────────
console.error('[prebuild] emitting declaration tree → dist/types/ …');
execFileSync(
  process.execPath,
  [resolve(ROOT, 'node_modules/typescript/bin/tsc'), '-p', resolve(ROOT, '.design-sync/tsconfig.dts.json')],
  { stdio: 'inherit' },
);

// ── 2. compile Tailwind → cssEntry ─────────────────────────────────────────
// Wrapper input lives in .cache so @import / @source resolve relatively; the
// explicit @source lines guarantee the UI components and the authored previews
// are scanned regardless of auto-detection.
console.error('[prebuild] compiling Tailwind → .design-sync/.cache/ds-tailwind.css …');
const inputPath = resolve(CACHE, '_tw_input.css');
writeFileSync(
  inputPath,
  ['@import "../../src/index.css";', '@source "../../src";', '@source "../../.design-sync/previews";', ''].join('\n'),
);
const result = await postcss([tailwindcss()]).process(readFileSync(inputPath, 'utf8'), { from: inputPath });

// ── 2b. tag Tailwind v4 INTERNALS so the claude.ai/design token classifier
// skips them. The app's self-check scrapes every CSS custom property in the
// styles.css @import closure and promotes it to a design token (a documented,
// otherwise-tolerated "token pollution" — see the converter's lib/css.mjs).
// These are utility *mechanism*, not design tokens: all --tw-* (translate/
// scale/gradient/border-style/space-reverse/…, both their @property
// registrations and their under-utility assignments), the
// --default-transition-* pair, and --animate-spin. Real token families
// (--color-*, --spacing, --text-*, --radius-*, --font-weight-*, --tracking-*)
// are left alone. Annotation, NOT deletion: utilities read these via var(), so
// they must remain in the CSS — the comment only reclassifies them.
const INTERNAL_DECL =
  /(?<![\w-])(?:--tw-[\w-]+|--default-transition-duration|--default-transition-timing-function|--animate-spin)\s*:[^;{}]*;/g;
const INTERNAL_PROP = /@property\s+--tw-[\w-]+\s*\{/g;
let compiledCss = result.css;
let tagged = 0;
compiledCss = compiledCss.replace(INTERNAL_DECL, (m) => { tagged++; return `${m} /* @kind other */`; });
compiledCss = compiledCss.replace(INTERNAL_PROP, (m) => { tagged++; return `${m} /* @kind other */`; });
console.error(`[prebuild] tagged ${tagged} Tailwind-internal custom-property declaration(s)/registration(s) with @kind other`);

// JetBrains Mono (the brand monospace) is referenced by the base layer but not
// shipped — wire it via a remote @import (prepended so it stays rule-1 valid;
// added after Tailwind processing so it isn't stripped). cfg.runtimeFontPrefixes
// suppresses the converter's [FONT_MISSING] for these runtime-loaded families.
const fontImport =
  "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap');\n";
writeFileSync(resolve(CACHE, 'ds-tailwind.css'), fontImport + compiledCss);

console.error('[prebuild] done.');
