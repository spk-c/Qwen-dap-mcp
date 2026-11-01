import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=join(root,'README.md');
const contents=readFileSync(path,'utf8');
const links=[...contents.matchAll(/\]\(([^)\s]+)\)/g)].map(x=>x[1]).filter(x=>!x.startsWith('https:')&&!x.startsWith('http:')&&!x.startsWith('#')&&!x.startsWith('mailto:'));
for (const link of links) {
  const relative=link.split('#')[0];
  const target=resolve(dirname(path),relative);
  assert.ok(target.startsWith(root),'README link escapes repository: '+link);
  assert.ok(existsSync(target),'Broken README link: '+link);
}
console.log('Verified ' + links.length + ' local README links.');
