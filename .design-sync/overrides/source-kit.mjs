// forked from design-sync lib/source-kit.mjs — thin wrapper that drops files
// from the synthesized entry (Benchmaker has no dist, so package-build
// synthesizes an entry from every src/components/ui/*.tsx; MonacoEditor.tsx
// statically imports `monaco-editor` (multi-MB, exceeds the 5MB upload cap)
// and Vite-only `...?worker` specifiers esbuild can't resolve, which would
// break the bundle). Imports the bundled original by relative path and only
// node:fs — no bare imports — so no .design-sync/node_modules symlink is
// needed. Declared in cfg.libOverrides.
//
// The exclusion lists are hardcoded below, NOT read from config: the converter's
// strict config schema (lib/common.mjs CONFIG_KEYS) rejects unknown top-level
// keys, so this repo-specific data lives in the fork it belongs to.
//   files: substrings matched against synth-entry `export * from "…"` lines
//   names: component names to drop from the discovered list (belt-and-suspenders)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolvePackage as orig } from '../../.ds-sync/lib/source-kit.mjs';

export async function resolvePackage(ctx) {
  const res = await orig(ctx);
  const files = ['MonacoEditor'];            // synth-entry `export * from "…"` lines to drop (substring match)
  const names = ['MonacoEditor', 'Editor'];  // components to drop from the discovered list (belt-and-suspenders)
  if (res.synthEntry && files.length) {
    const before = readFileSync(res.entry, 'utf8');
    const kept = before
      .split('\n')
      .filter((line) => !files.some((f) => line.includes(f)));
    writeFileSync(res.entry, kept.join('\n'));
    const dropped = before.split('\n').length - kept.length;
    if (dropped) console.error(`  [SYNTH_EXCLUDE] dropped ${dropped} file(s) from synth entry: ${files.join(', ')}`);
  }
  if (names.length && Array.isArray(res.components)) {
    const n0 = res.components.length;
    res.components = res.components.filter((c) => !names.includes(c.name));
    if (res.components.length !== n0) console.error(`  [SYNTH_EXCLUDE] dropped components: ${names.join(', ')}`);
  }
  return res;
}
