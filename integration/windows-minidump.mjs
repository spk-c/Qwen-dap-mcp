import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {GuardedDapSession} from '../src/dap/guarded-session.js';
import {openDump} from '../src/tools/register-dump-tools.js';

const run=process.env.RUN_WINDOWS_MINIDUMP_TESTS==='1';
const adapterPath=process.env.NATIVE_DAP_PATH;
const binary=process.env.NATIVE_DAP_BINARY;
const dump=process.env.NATIVE_DAP_DUMP;
if(run)for(const file of [adapterPath,binary,dump]){
    assert.ok(file&&existsSync(file),'Missing Windows dump test file '+file);
}
test('CodeLLDB opens authentic Windows minidump in inspect-only mode',{skip:!run,timeout:100000},async()=>{
    const session=new GuardedDapSession({
        dapPolicyMode:'inspect-only',
        holGuardEvaluator:{enabled:false,evaluate:async()=>({allow:true})}
    });
    try{
        const result=await openDump(session,{
            adapter:'codelldb',adapterPath,program:binary,dumpPath:dump,
            stackLevels:30,maxVariablesPerScope:30,
            includeDisassembly:false,includeModules:false,requestTimeoutMs:25000
        });
        assert.equal(result.mode,'postmortem');
        assert.equal(result.readOnlyTarget,true);
        assert.equal(session.isPostmortem(),true);
        const stack=result.snapshot?.stack??[];
        assert.ok(stack.length>0,'Minidump should contain crash thread frames');
        assert.ok(stack.some(f=>/crash_marker/i.test(f.name)),
          'Expected crash_marker in minidump stack: '+stack.map(f=>f.name).join(', '));
        await assert.rejects(session.continueExecution(1,false),/postmortem/i);
        await assert.rejects(session.step('next',1,false),/postmortem/i);
    }finally{
        await session.reset();
        assert.equal(session.connection.isRunning,false);
        assert.equal(session.connection.pending.size,0);
    }
});
