import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'src');
const output = join(root, 'dist');
if (!existsSync(join(source, 'index.ts'))) throw new Error('src/index.ts is missing; cannot build TypeScript.');
rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--project', join(root, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });

// The TypeScript code is authoritative. Retain generated src/**/*.js
// for existing Node ESM import paths and test fixtures.
let count = 0;
function mirrorGeneratedJs(dir, relative = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, entry.name), rel = join(relative, entry.name);
    if (entry.isDirectory()) { mirrorGeneratedJs(next, rel); continue; }
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const ts = join(source, rel.slice(0, -3) + '.ts');
    if (!existsSync(ts)) throw new Error('Generated JS has no TypeScript source: ' + rel);
    const lines = readFileSync(next, 'utf8').split('\n');
    if (lines[0]?.startsWith('#!') && lines[1] === '// @ts-nocheck') lines.splice(1, 1);
    else if (lines[0] === '// @ts-nocheck') lines.shift();
    const sourceJs = join(source, rel);
    // Pre-migration compiled files lacked a final newline. Preserve that
    // formatting byte-for-byte instead of dirtying all generated JS files.
    if (existsSync(sourceJs) && !readFileSync(sourceJs, 'utf8').endsWith('\n') && lines.at(-1) === '') lines.pop();
    writeFileSync(next, lines.join('\n'));
    mkdirSync(join(source, relative), { recursive: true });
    copyFileSync(next, sourceJs);
    count++;
  }
}
mirrorGeneratedJs(output);
if (count !== 51) throw new Error('Expected 51 migrated runtime modules, got ' + count);
console.log('Built ' + count + ' TypeScript modules and generated JS mirrors.');
