import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {
  MIN_GDB_DAP_MAJOR, parseGdbVersion, discoverGdbDap,
  buildGdbDapLaunchConfiguration, buildGdbDapPidAttachConfiguration,
  resolveGdbDapRemoteEndpoint, buildGdbDapRemoteAttachConfiguration,
  buildGdbDapCoreConfiguration
} from '../src/adapters/gdb-dap.js';
import {
  discoverLldbDap, buildLldbDapLaunchConfiguration,
  buildLldbDapAttachConfiguration, buildLldbDapCoreConfiguration,
  resolveLldbDapRemoteEndpoint, buildLldbDapRemoteAttachConfiguration
} from '../src/adapters/lldb-dap.js';
import {
  discoverCodeLldb, buildCodeLldbLaunchConfiguration,
  buildCodeLldbAttachConfiguration
} from '../src/adapters/codelldb.js';
import {buildCodeLldbDumpConfiguration} from '../src/adapters/codelldb-dump.js';

function fixture(fn) {
  const root=mkdtempSync(join(tmpdir(),'qwen-adapter-config-'));
  const program=join(root,'test program.exe');
  const dump=join(root,'test dump.dmp');
  writeFileSync(program,'test fixture, never launched');
  writeFileSync(dump,'fake dump data; test only config generation');
  try { return fn({root,program,dump}); }
  finally { rmSync(root,{recursive:true,force:true}); }
}

test('GDB version parser handles distro/patch versions and rejects unrecognized output',()=>{
  assert.equal(MIN_GDB_DAP_MAJOR,14);
  assert.deepEqual(parseGdbVersion('GNU gdb (GDB) 18.1\nCopyright'),{major:18,minor:1,raw:'GNU gdb (GDB) 18.1'});
  assert.equal(parseGdbVersion('GNU gdb 14').major,14);
  assert.equal(parseGdbVersion('unrelated information'),undefined);
});

test('GDB program launch uses canonical file path, safe defaults and optional environment',()=>{
  fixture(({root,program})=>{
    const config=buildGdbDapLaunchConfiguration({program,args:['--mode','stress']});
    assert.equal(config.program,resolve(program));
    assert.equal(config.cwd,dirname(config.program));
    assert.deepEqual(config.args,['--mode','stress']);
    assert.equal(config.stopOnEntry,false);
    assert.deepEqual(buildGdbDapLaunchConfiguration({program,cwd:root,env:{MY_VAR:'value'},stopOnEntry:true,stopAtBeginningOfMainSubprogram:true}).env,{MY_VAR:'value'});
    assert.equal(buildGdbDapLaunchConfiguration({program,stopAtBeginningOfMainSubprogram:false}).stopAtBeginningOfMainSubprogram,false);
  });
});

test('GDB PID attach requires positive safe integer and optionally validates program',()=>{
  fixture(({program})=>{
    assert.deepEqual(buildGdbDapPidAttachConfiguration({pid:123}),{pid:123});
    assert.equal(buildGdbDapPidAttachConfiguration({pid:1,program}).program,resolve(program));
    for(const pid of [0,-1,1.3,'12',Number.MAX_SAFE_INTEGER+1,NaN,Infinity]) {
      assert.throws(()=>buildGdbDapPidAttachConfiguration({pid}),/positive safe integer/,String(pid));
    }
  });
});

test('GDB remote attach rejects ambiguous input, unauthorized addresses and illegal ports',()=>{
  const env={QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS:'debug.internal'};
  const endpoint=resolveGdbDapRemoteEndpoint({host:'debug.internal',port:4444,policyEnv:env});
  assert.equal(endpoint.target,'debug.internal:4444');
  assert.equal(endpoint.loopback,false);
  assert.equal(resolveGdbDapRemoteEndpoint({target:'[::1]:1234',policyEnv:{}}).target,'[::1]:1234');
  assert.throws(()=>resolveGdbDapRemoteEndpoint({host:'localhost',port:2222,target:'localhost:2222'}),/either target or host/);
  assert.throws(()=>resolveGdbDapRemoteEndpoint({host:'localhost'}),/requires host and port/);
  assert.throws(()=>resolveGdbDapRemoteEndpoint({target:'192.0.2.2:4444',policyEnv:{}}),/not allowed/);
  assert.throws(()=>resolveGdbDapRemoteEndpoint({host:'localhost',port:65536}),/port/);
});

test('GDB TCP configuration never puts raw command text in generated DAP request',()=>{
  fixture(({program})=>{
    const config=buildGdbDapRemoteAttachConfiguration({target:'[::1]:4567',program});
    assert.deepEqual(config,{target:'[::1]:4567',program:resolve(program)});
    assert.equal(config.attachCommands,undefined);
    const core=buildGdbDapCoreConfiguration({coreFile:program});
    assert.deepEqual(core,{coreFile:resolve(program)});
  });
});

test('GDB discovery fails closed when none of explicitly permitted discovery sources exist',()=>{
  assert.throws(()=>discoverGdbDap({env:{},allowPathFallback:false}),/GDB with DAP support was not found/);
});

test('LLDB launch and PID attach have adapter-specific DAP shapes and validated program',()=>{
  fixture(({root,program})=>{
    const launched=buildLldbDapLaunchConfiguration({program,args:['--go'],cwd:root});
    assert.equal(launched.type,'lldb-dap');
    assert.equal(launched.request,'launch');
    assert.equal(launched.program,resolve(program));
    assert.equal(launched.stopOnEntry,false);
    assert.deepEqual(launched.args,['--go']);
    const attached=buildLldbDapAttachConfiguration({pid:36,program});
    assert.equal(attached.request,'attach');
    assert.equal(attached.pid,36);
    assert.equal(attached.stopOnEntry,true);
    for(const pid of [0,-1,1.5,'36',NaN,Infinity]){
      assert.throws(()=>buildLldbDapAttachConfiguration({pid}),/positive safe integer/);
    }
  });
});

test('LLDB remote commands are constructed from validated TCP endpoints only',()=>{
  fixture(({program})=>{
    const endpoint=resolveLldbDapRemoteEndpoint({host:'[::1]',port:3214,policyEnv:{}});
    assert.equal(endpoint.target,'[::1]:3214');
    const config=buildLldbDapRemoteAttachConfiguration({host:'localhost',port:3333,program});
    assert.deepEqual(config.attachCommands,['gdb-remote localhost:3333']);
    assert.equal(config.program,resolve(program));
    assert.throws(()=>buildLldbDapRemoteAttachConfiguration({host:'bad.example.org',port:3333,policyEnv:{}}),/not allowed/);
    assert.throws(()=>buildLldbDapRemoteAttachConfiguration({host:'localhost;process launch',port:3333}),/whitespace or control characters|Invalid remote debugger hostname/);
  });
});

test('LLDB postmortem attaches a core and converts source maps without running the target',()=>{
  fixture(({program,dump})=>{
    const config=buildLldbDapCoreConfiguration({program,coreFile:dump,sourceMap:{'/build':'/source'}});
    assert.equal(config.request,'attach');
    assert.equal(config.coreFile,resolve(dump));
    assert.deepEqual(config.sourceMap,[['/build','/source']]);
    assert.equal(config.processCreateCommands,undefined);
    assert.throws(()=>buildLldbDapCoreConfiguration({program,coreFile:dump+'-missing'}),/not found|does not exist|file/i);
  });
});

test('LLDB adapter discovery uses explicit, environment and toolchain sources without executing binaries',()=>{
  fixture(({root,program})=>{
    const explicit=discoverLldbDap({explicitPath:program});
    assert.equal(explicit.source,'explicit');
    assert.equal(explicit.command,resolve(program));
    const env=discoverLldbDap({env:{LLDB_DAP_PATH:program},allowPathFallback:false,allowToolchainFallback:false,allowXcrunFallback:false});
    assert.equal(env.source,'environment');
    const toolchain=discoverLldbDap({env:{},allowPathFallback:false,toolchainCandidates:[join(root,'missing'),program],allowXcrunFallback:false});
    assert.equal(toolchain.source,'toolchain');
    assert.equal(toolchain.searched.length,2);
    assert.throws(()=>discoverLldbDap({env:{},allowPathFallback:false,allowToolchainFallback:false,allowXcrunFallback:false}),/lldb-dap was not found/);
  });
});

test('CodeLLDB launch uses console I/O and PID attach validates safe integers',()=>{
  fixture(({root,program})=>{
    const config=buildCodeLldbLaunchConfiguration({program,cwd:root,args:['-arg'],env:{LANG:'C'}});
    assert.equal(config.terminal,'console');
    assert.equal(config.request,'launch');
    assert.deepEqual(config.env,{LANG:'C'});
    assert.deepEqual(config.args,['-arg']);
    assert.equal(buildCodeLldbAttachConfiguration({pid:24,program}).stopOnEntry,true);
    for(const pid of [0,-1,1.8,'24',NaN,Infinity]){
      assert.throws(()=>buildCodeLldbAttachConfiguration({pid}),/positive safe integer/);
    }
  });
});

test('CodeLLDB extension discovery chooses newest compatible version and refuses outdated extensions',()=>{
  fixture(({root})=>{
    const adapterExe=process.platform==='win32'?'codelldb.exe':'codelldb';
    function addExtension(version){
      const dir=join(root,'vadimcn.vscode-lldb-'+version,'adapter');
      mkdirSync(dir,{recursive:true});
      const candidate=join(dir,adapterExe);
      writeFileSync(candidate,'not an executable, only a discovery fixture');
      return candidate;
    }
    addExtension('1.10.9');
    const newer=addExtension('1.11.0');
    const found=discoverCodeLldb({env:{},extensionRoots:[root],allowPathFallback:false});
    assert.equal(found.command,resolve(newer));
    assert.equal(found.source,'extension');
    const newest=addExtension('1.12.1');
    const foundNewest=discoverCodeLldb({env:{},extensionRoots:[root],allowPathFallback:false});
    assert.equal(foundNewest.command,resolve(newest));
    assert.throws(()=>discoverCodeLldb({env:{},extensionRoots:[join(root,'missing')],allowPathFallback:false}),/CodeLLDB was not found/);
  });
});

test('CodeLLDB discovery respects explicit path and environment override',()=>{
  fixture(({program})=>{
    assert.equal(discoverCodeLldb({explicitPath:program}).source,'explicit');
    const result=discoverCodeLldb({env:{CODELLDB_PATH:program},extensionRoots:[],allowPathFallback:false});
    assert.equal(result.source,'environment');
    assert.equal(result.command,resolve(program));
  });
});

test('CodeLLDB dump builder escapes spaces and keeps attach strictly postmortem',()=>{
  fixture(({program,dump})=>{
    const config=buildCodeLldbDumpConfiguration({dumpPath:dump,program,sourceMap:{'/source':'/newsrc'}});
    assert.equal(config.type,'lldb');
    assert.equal(config.request,'attach');
    assert.equal(config.processCreateCommands.length,0);
    assert.equal(config.targetCreateCommands.length,1);
    assert.ok(config.targetCreateCommands[0].startsWith('target create -c "'));
    assert.ok(config.targetCreateCommands[0].includes('test dump.dmp'));
    assert.ok(config.targetCreateCommands[0].includes('test program.exe'));
    assert.deepEqual(config.sourceMap,{'/source':'/newsrc'});
  });
});

test('CodeLLDB dump builder rejects command-breaking newlines before resolving paths',()=>{
  for(const path of ['bad\nprocess launch','bad\rprocess attach','bad\u0000path']){
    assert.throws(()=>buildCodeLldbDumpConfiguration({dumpPath:path}),/must not contain/,JSON.stringify(path));
    assert.throws(()=>buildCodeLldbDumpConfiguration({dumpPath:'missing.dmp',program:path}),/must not contain/,JSON.stringify(path));
  }
});
