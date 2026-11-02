import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Temporary migration ceiling, tightened whenever a checked-in batch reduces
// full strict compiler diagnostics. Zero is the acceptance criterion for #24.
const MAX_STRICT_DIAGNOSTICS = 315;
const root = fileURLToPath(new URL('../', import.meta.url));
const typescript = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const result = spawnSync(process.execPath, [
  typescript, '--project', join(root, 'tsconfig.json'),
  '--strict', '--noEmit', '--pretty', 'false',
], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024 });
if (result.error) throw result.error;
const output = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
const errors = output.split(/\r?\n/).filter((line) => /\berror TS\d+:/.test(line));
if (result.status !== 0 && errors.length === 0) {
  throw new Error('Full strict TypeScript probe failed without parseable diagnostics: ' + output.slice(-2000));
}
const counts = new Map();
for (const line of errors) {
  const code = line.match(/\berror (TS\d+):/)?.[1];
  if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
}
const breakdown = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('Full strict TypeScript diagnostic baseline: ' + errors.length +
  ' (maximum allowed: ' + MAX_STRICT_DIAGNOSTICS + ')');
console.log('Top diagnostic classes: ' + breakdown.map(([code, n]) => code + '=' + n).join(', '));
// Keep a bounded, deterministic per-module report to prioritize real fixes.
// This prints source paths and compiler diagnostics only, never source content.
const byFile = new Map();
for (const line of errors) {
  const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
  if (!match) continue;
  const [, file, , , code, detail] = match;
  const entry = byFile.get(file) ?? { count: 0, codes: new Map(), samples: [] };
  entry.count += 1;
  entry.codes.set(code, (entry.codes.get(code) ?? 0) + 1);
  if (entry.samples.length < 3) entry.samples.push(code + ': ' + detail.slice(0, 140));
  byFile.set(file, entry);
}
console.log('Most affected modules:');
for (const [file, entry] of [...byFile.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, 12)) {
  const codes = [...entry.codes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('  ' + file + ': ' + entry.count + ' (' + codes.map(([code, n]) => code + '=' + n).join(', ') + ')');
  for (const sample of entry.samples) console.log('    ' + sample);
}
if (errors.length > MAX_STRICT_DIAGNOSTICS) {
  console.error('Strict TypeScript diagnostic count regressed. Fix the new errors or explicitly review the baseline.');
  process.exitCode = 1;
}
if (errors.length === 0) {
  console.log('Full strict TypeScript checking passes; remove the temporary budget and enable strict=true in tsconfig.json.');
}
