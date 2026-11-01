import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=join(root,'src');
let checked=0;
function visit(dir){
    for(const e of readdirSync(dir,{withFileTypes:true})){
        const path=join(dir,e.name);
        if(e.isDirectory()){visit(path);continue;}
        if(!e.isFile()||!e.name.endsWith('.ts')||e.name.endsWith('.d.ts'))continue;
        const text=readFileSync(path,'utf8');
        assert.ok(!/^\s*\/\/\s*@ts-nocheck\b/m.test(text),
            'TypeScript checking disabled in '+path);
        checked++;
    }
}
visit(source);
assert.equal(checked,51,'Expected 51 checked TypeScript runtime modules');
console.log('Verified '+checked+' TypeScript runtime modules without @ts-nocheck.');
