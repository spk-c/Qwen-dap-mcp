// Run explicitly with RUN_NATIVE_DEBUGGER_TESTS=1.
// Tests launch only the compiled fixture under a trusted local DAP adapter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GuardedDapSession } from '../src/dap/guarded-session.js';
import { buildGdbDapLaunchConfiguration } from '../src/adapters/gdb-dap.js';
import { buildLldbDapLaunchConfiguration } from '../src/adapters/lldb-dap.js';
import { buildCodeLldbLaunchConfiguration } from '../src/adapters/codelldb.js';

const integration = process.env.RUN_NATIVE_DEBUGGER_TESTS === '1';
const mode = process.env.NATIVE_DAP_ADAPTER;
const executable = process.env.NATIVE_DAP_PATH;
const binary = process.env.NATIVE_DAP_BINARY;
const fixturePath = fileURLToPath(new URL('./fixture/native-debug.cpp', import.meta.url));
const fixtureText = readFileSync(fixturePath, 'utf8');
const breakpointLine = fixtureText.split(/\r?\n/).findIndex(line => line.includes('NATIVE_BREAKPOINT')) + 1;

if (integration) {
    assert.ok(['gdb', 'lldb-dap', 'codelldb'].includes(mode), 'Set NATIVE_DAP_ADAPTER=gdb|lldb-dap|codelldb');
    assert.ok(executable && existsSync(executable), 'NATIVE_DAP_PATH must be a real debugger executable');
    assert.ok(binary && existsSync(binary), 'NATIVE_DAP_BINARY must be a compiled fixture');
    assert.ok(breakpointLine > 0, 'Fixture breakpoint marker missing');
}
function sessionOptions() {
    if (mode === 'gdb') return {command:executable,args:['--interpreter=dap','--quiet','--nx'],adapterId:'gdb',requestTimeoutMs:20_000};
    return {command:executable,adapterId:mode==='codelldb'?'lldb':'lldb-dap',requestTimeoutMs:20_000};
}
function launchConfig(kind) {
    const options={program:resolve(binary),cwd:dirname(resolve(binary)),args:kind==='crash'?['crash']:[],stopOnEntry:false};
    if (mode==='gdb') return buildGdbDapLaunchConfiguration(options);
    if (mode==='codelldb') return buildCodeLldbLaunchConfiguration(options);
    return buildLldbDapLaunchConfiguration(options);
}
function armEvent(session,name,timeout=30_000) {
    const promise=session.connection.waitForEvent(name,timeout);
    void promise.catch(()=>{});
    return promise;
}
async function withSession(fn) {
    const session=new GuardedDapSession({holGuardEvaluator:{enabled:false,evaluate:async()=>({allow:true})}});
    try {
        await session.start(sessionOptions());
        assert.ok(session.connection.pid>0,'A debugger process must start');
        await fn(session);
    } finally {
        await session.disconnect(true);
        assert.equal(session.connection.isRunning,false,'Debugger adapter should be stopped');
        assert.equal(session.connection.pending.size,0,'No outstanding DAP requests may survive shutdown');
    }
}
async function hitFixtureBreakpoint(session,kind='normal') {
    const stopped=armEvent(session,'stopped');
    const launched=await session.launch(launchConfig(kind),[{source:fixturePath,lines:[breakpointLine]}]);
    assert.equal(launched.request,'launch');
    assert.equal(session.snapshot().configured,true);
    const event=await stopped;
    assert.equal(event.body?.reason,'breakpoint','Expected the fixture source breakpoint');
    const threadId=event.body.threadId??(await session.threads())[0]?.id;
    assert.ok(Number.isInteger(threadId),'Stopped thread must have ID');
    const frames=await session.stackTrace(threadId);
    assert.ok(frames.length>0,'Need a native stack');
    assert.match(frames[0].name,/debug_probe/i,'Top frame should be the fixture');
    const scopes=await session.scopes(frames[0].id);
    assert.ok(Array.isArray(scopes)&&scopes.length>0,'Scopes should be populated at breakpoint');
    let vars=[];
    for (const scope of scopes.filter(s=>s.variablesReference>0).slice(0,3))
        vars.push(...await session.variables(scope.variablesReference,0,30));
    assert.ok(vars.some(v=>/value|observed/.test(v.name)),'Inspect C++ fixture variables');
    const snapshot=await session.runtimeSnapshot({includeDisassembly:false,includeModules:false,includeExceptionInfo:false});
    assert.match(snapshot.frame.name,/debug_probe/i);
    if (session.capabilities?.supportsReadMemoryRequest) {
        const memoryRef=frames[0].instructionPointerReference??vars.find(v=>v.memoryReference)?.memoryReference;
        assert.ok(memoryRef,'Adapter advertises memory read but did not expose an address');
        const memory=await session.readMemory(memoryRef,8);
        assert.ok(memory.data&&Buffer.from(memory.data,'base64').length>0,'Read target memory through DAP');
    }
    return threadId;
}
test('native breakpoint, C++ locals, memory and clean normal exit',{skip:!integration,timeout:100_000},async()=>{
    await withSession(async session=>{
        const threadId=await hitFixtureBreakpoint(session);
        const exit=armEvent(session,'exited');
        await session.continueExecution(threadId,false);
        const event=await exit;
        assert.equal(event.body?.exitCode,0,'Normal fixture must exit successfully');
    });
});
test('native crash produces fresh exception/signal stop with stack',{skip:!integration,timeout:100_000},async()=>{
    await withSession(async session=>{
        const threadId=await hitFixtureBreakpoint(session,'crash');
        const stop=armEvent(session,'stopped');
        await session.continueExecution(threadId,false);
        const event=await stop;
        assert.ok(['exception','signal'].includes(event.body?.reason),
            'Second stop must be a crash, not an old breakpoint: '+JSON.stringify(event.body));
        const crashThread=event.body.threadId??threadId;
        const frames=await session.stackTrace(crashThread);
        assert.ok(frames.length>0,'Crash must have stack frames');
        assert.ok(frames.some(f=>/crash_marker/i.test(f.name)),
            'Crash stack should contain crash_marker: '+frames.map(f=>f.name).join(', '));
        const snapshot=await session.runtimeSnapshot({includeDisassembly:false,includeModules:false,includeExceptionInfo:false});
        assert.ok(snapshot.frame,'Crash snapshot missing top frame');
    });
});
