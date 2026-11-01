import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const ext = JSON.parse(readFileSync(join(root, 'qwen-extension.json'), 'utf8'));
assert.equal(pkg.version, ext.version, 'Package and Qwen extension versions differ');
assert.equal(pkg.type, 'module');
assert.ok(existsSync(join(root, 'dist/index.js')), 'Missing runnable entrypoint');
assert.ok(existsSync(join(root, 'skills/native-runtime-debug/SKILL.md')), 'Missing Qwen skill');
let checked = 0;
function verify(from, relative = '') {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const name = join(relative, entry.name);
    const p = join(from, entry.name);
    if (entry.isDirectory()) verify(p, name);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      assert.equal(readFileSync(p, 'utf8'), readFileSync(join(root, 'dist', name), 'utf8'), 'Out of sync: ' + name);
      checked++;
    }
  }
}
verify(join(root, 'src'));
assert.ok(checked > 40, 'Missing source modules');
console.log('Verified Qwen extension v' + pkg.version + ' and ' + checked + ' source/distribution modules.');
