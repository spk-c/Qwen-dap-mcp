import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'src');
const output = join(root, 'dist');
if (!existsSync(source)) throw new Error('src/ is missing; cannot build.');
function copySources(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const input = join(from, entry.name);
    const destination = join(to, entry.name);
    if (entry.isDirectory()) copySources(input, destination);
    else if (entry.isFile() && entry.name.endsWith('.js')) copyFileSync(input, destination);
  }
}
copySources(source, output);
console.log('Built dist/ from editable src/ JavaScript sources.');
