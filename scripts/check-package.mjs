import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const ext = JSON.parse(readFileSync(join(root, 'qwen-extension.json'), 'utf8'));
assert.equal(pkg.version, ext.version);
assert.equal(pkg.type, 'module');
assert.equal(pkg.name, '@slp-dev1/qwen-dap-mcp');
assert.equal(pkg.private, false, 'npm release package must be publishable');
assert.ok(existsSync(join(root, 'dist/index.js')));
assert.ok(existsSync(join(root, 'dist/index.d.ts')));
assert.ok(existsSync(join(root, 'skills/native-runtime-debug/SKILL.md')));
let checked = 0;
function verify(from, relative = '') {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const name = join(relative, entry.name);
    const p = join(from, entry.name);
    if (entry.isDirectory()) verify(p, name);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      assert.equal(readFileSync(p, 'utf8'), readFileSync(join(root, 'dist', name), 'utf8'), 'Source/distribution drift: ' + name);
      assert.ok(existsSync(join(root, 'dist', name.slice(0,-3)+'.d.ts')), 'Missing generated declaration: ' + name);
      assert.ok(existsSync(join(root, 'src', name.slice(0, -3) + '.ts')), 'Missing TypeScript source for ' + name);
      checked++;
    }
  }
}
verify(join(root, 'src'));
assert.ok(checked > 40);
console.log('Verified version ' + pkg.version + ' and generated JS/declarations for ' + checked + ' modules.');
