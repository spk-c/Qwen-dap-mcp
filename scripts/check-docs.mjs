import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const readme = join(root, 'README.md');
const contents = readFileSync(readme, 'utf8');
const links = [...contents.matchAll(/\]\(([^)\s]+)\)/g)].map(match => match[1]);
const githubPrefix = 'https://github.com/spk-c/Qwen-dap-mcp/';
let checked = 0;

for (const link of links) {
  if (link.startsWith('#') || link.startsWith('mailto:')) continue;
  let relative;
  if (link.startsWith('https://') || link.startsWith('http://')) {
    if (!link.startsWith(githubPrefix)) continue;
    const rest = link.slice(githubPrefix.length);
    if (rest.startsWith('blob/main/')) relative = rest.slice('blob/main/'.length);
    else if (rest.startsWith('tree/main/')) relative = rest.slice('tree/main/'.length);
    else continue; // Releases, issues, workflows, repository landing pages
  } else {
    relative = link;
    // The README is shipped to npm without repository docs: don't use relative file links.
    assert.fail('npm README has a relative file link: ' + link);
  }
  const clean = decodeURIComponent(relative.split('#')[0].split('?')[0]);
  const target = resolve(dirname(readme), clean);
  assert.ok(target.startsWith(root), 'README link escapes repository: ' + link);
  assert.ok(existsSync(target), 'Broken README repository link: ' + link);
  checked++;
}
assert.ok(checked >= 10, 'Expected to verify npm-friendly GitHub documentation links.');
console.log('Verified ' + checked + ' GitHub README file/directory links; no relative file links.');
