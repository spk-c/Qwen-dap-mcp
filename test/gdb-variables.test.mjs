import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DapSession} from '../src/dap/session.js';
import {DapRequestError} from '../src/dap/errors.js';

test('GDB variable paging retries list-index errors without paging',async()=>{
    const s=new DapSession();
    s.initialized=true;
    s.configured=true;
    s.adapterId='gdb';
    s.connection.child={exitCode:null,signalCode:null};
    const calls=[];
    s.connection.sendRequest=async(command,args)=>{
        calls.push({command,args});
        if (Object.hasOwn(args,'count'))throw new DapRequestError('variables','list index out of range');
        return {body:{variables:[{name:'a'},{name:'b'},{name:'c'}]}};
    };
    const result=await s.variables(3,1,10);
    assert.deepEqual(result.map(x=>x.name),['b','c']);
    assert.equal(calls.length,2);
    assert.deepEqual(calls[1].args,{variablesReference:3});
});
test('Variable paging does not retry other failures or other adapters',async()=>{
    for(const [adapter,message] of [['gdb','access denied'],['lldb-dap','list index out of range']]){
        const s=new DapSession();
        s.initialized=true;
        s.configured=true;
        s.adapterId=adapter;
        s.connection.child={exitCode:null,signalCode:null};
        let calls=0;
        s.connection.sendRequest=async()=>{
            calls++;
            throw new DapRequestError('variables',message);
        };
        await assert.rejects(s.variables(3,0,20),new RegExp(message));
        assert.equal(calls,1);
    }
});
