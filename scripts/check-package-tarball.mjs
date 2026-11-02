// Check the actual distributable archive, not just the repository tree.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,basename} from 'node:path';
import {tmpdir} from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url));
const npmCli=process.env.npm_execpath;
assert.ok(npmCli && existsSync(npmCli),'Run with npm run check:pack so npm CLI is known');
const tmp=mkdtempSync(join(root,'.package-smoke-'));
const required=[
    'package.json','README.md','NOTICE','LICENSE',
    'qwen-extension.json','dist/index.js','dist/index.d.ts',
    'skills/native-runtime-debug/SKILL.md'
];
try{
    const stdout=execFileSync(process.execPath,[npmCli,'pack','--json','--ignore-scripts','--pack-destination',tmp],{
        cwd:root,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024
    });
    const [result]=JSON.parse(stdout);
    assert.ok(result.filename && result.files.length>40);
    const files=new Set(result.files.map(f=>f.path));
    for(const path of required)assert.ok(files.has(path),'Missing packaged file: '+path);
    for(const path of files){
        assert.ok(!path.endsWith('.js.map'),'Stale source map in packed archive: '+path);
        assert.ok(!path.startsWith('test/')&&!path.startsWith('integration/'),'Test files must not be published: '+path);
        assert.ok(!path.startsWith('node_modules/')&&!path.startsWith('.env'),'Sensitive or installed path in archive: '+path);
        assert.ok(!path.includes('Health-Report'),'Workstation data in archive');
    }
    const archive=join(tmp,basename(result.filename));
    assert.ok(existsSync(archive),'npm pack did not create the actual archive');
    execFileSync('tar',['-xzf',archive,'-C',tmp],{cwd:root,timeout:30000});
    const pkg=join(tmp,'package');
    const manifest=JSON.parse(readFileSync(join(pkg,'package.json'),'utf8'));
    const qwen=JSON.parse(readFileSync(join(pkg,'qwen-extension.json'),'utf8'));
    for (const file of files) if (file.endsWith('.js')) {
        assert.ok(!readFileSync(join(pkg,file),'utf8').includes('sourceMappingURL='),'Stale source map reference in package: '+file);
    }
    assert.match(manifest.version,/^[0-9]+[.][0-9]+[.][0-9]+(?:-[0-9A-Za-z.-]+)?$/);
    assert.equal(manifest.version,JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version);
    assert.equal(qwen.version,manifest.version);
    assert.equal(manifest.private,false);
    assert.equal(manifest.name,'@slp-dev1/qwen-dap-mcp');
    assert.equal(manifest.mcpName,'io.github.spk-c/qwen-dap-mcp','Published package must prove MCP Registry ownership');
    assert.equal(qwen.mcpServers['qwen-dap-mcp'].command,'node');
    assert.ok(qwen.mcpServers['qwen-dap-mcp'].args[0].includes('dist'));
    const version=execFileSync(process.execPath,[join(pkg,'dist','index.js'),'--version'],{
        cwd:root,encoding:'utf8',timeout:10000
    }).trim();
    assert.equal(version,manifest.version,'Packaged executable reports incorrect version');
    console.log('Packed '+result.filename+'; verified '+files.size+' archive files, extension manifest and executable.');
}finally{
    rmSync(tmp,{recursive:true,force:true});
}
