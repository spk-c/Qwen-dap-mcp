import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {GuardedDapSession} from '../src/dap/guarded-session.js';
import {createGuardedDapRequestPolicy} from '../src/dap/hol-guard-policy.js';
import {createDapRequestPolicy} from '../src/dap/request-policy.js';

const adapter=fileURLToPath(new URL('../fixtures/fake-dap-adapter.mjs',import.meta.url));

test('inspect-only policy denies live attach, launch, evaluate and write',()=>{
    const policy=createDapRequestPolicy('inspect-only');
    for(const command of ['launch','evaluate','writeMemory','continue','setExpression','setVariable']) {
        assert.equal(policy({command,args:{}}).allow,false,command);
    }
    for(const args of [
        {pid:1234},{coreFile:'/tmp/core',pid:1234},
        {coreFile:'/tmp/core',attachCommands:['process attach -p 1']},
        {type:'lldb',request:'attach',targetCreateCommands:['target create -c "core"; process launch'],processCreateCommands:[]}
    ])assert.equal(policy({command:'attach',args}).allow,false);
    assert.equal(policy({command:'attach',args:{coreFile:'/tmp/core'}}).allow,true);
});
test('HOL guard rejects protected commands when denied or bridge errors',async()=>{
    const deny=createGuardedDapRequestPolicy({enabled:true,evaluate:async()=>({allow:false,reason:'test denied'})},'standard');
    assert.equal((await deny({command:'continue',args:{threadId:1}})).allow,false);
    const explode=createGuardedDapRequestPolicy({enabled:true,evaluate:async()=>{throw Error('policy failed');}},'standard');
    await assert.rejects(explode({command:'continue',args:{threadId:1}}),/policy failed/);
    const deniedByProfile=createGuardedDapRequestPolicy({enabled:true,evaluate:async()=>{throw Error('must not invoke');}},'inspect-only');
    assert.equal((await deniedByProfile({command:'launch',args:{program:'/bin/echo'}})).allow,false);
});
test('inspect-only session blocks launch after a real stdio initialization',{timeout:15000},async()=>{
    const session=new GuardedDapSession({
        dapPolicyMode:'inspect-only',
        holGuardEvaluator:{enabled:false,evaluate:async()=>({allow:true})}
    });
    try {
        await session.start({command:process.execPath,args:[adapter],adapterId:'lldb',requestTimeoutMs:5000});
        await assert.rejects(session.launch({program:'native-test'}),/blocked by policy/);
        assert.equal(session.connection.pending.size,0);
        assert.equal(session.snapshot().configured,false);
    }finally{
        await session.reset();
        assert.equal(session.connection.isRunning,false);
    }
});
test('HOL guard denial prevents adapter process spawn',{timeout:10000},async()=>{
    let calls=0;
    const session=new GuardedDapSession({
        dapPolicyMode:'standard',
        holGuardEvaluator:{enabled:true,evaluate:async()=>{calls++;return {allow:false,reason:'controlled-denial'};}}
    });
    await assert.rejects(session.start({command:process.execPath,args:[adapter],adapterId:'lldb'}),/HOL Guard blocked/);
    assert.equal(calls,1);
    assert.equal(session.connection.isRunning,false);
});
