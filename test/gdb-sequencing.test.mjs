import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DapSession} from '../src/dap/session.js';
import {DapRequestError} from '../src/dap/errors.js';
function fakeSession(rejectEarlyConfiguration) {
  const s=new DapSession();
  s.initialized=true;
  s.adapterId='gdb';
  s.capabilities={supportsConfigurationDoneRequest:true};
  s.connection.child={exitCode:null,signalCode:null};
  const calls=[];
  let attached=false;
  s.sendStateChangingRequest=async(command,args)=>{
    calls.push(command);
    if(command==='configurationDone' && !attached && rejectEarlyConfiguration)
      throw new DapRequestError(command,'launch or attach not specified');
    if(command==='attach')attached=true;
    return {body:{}};
  };
  return {s,calls};
}
test('GDB 15 config-first attach semantics are retained',async()=>{
  const {s,calls}=fakeSession(false);
  await s.attach({pid:1});
  assert.deepEqual(calls,['configurationDone','attach']);
  assert.equal(s.snapshot().configured,true);
});
test('newer GDB defer-attach semantics retry after exact DAP error',async()=>{
  const {s,calls}=fakeSession(true);
  await s.attach({coreFile:'/fake/core'});
  assert.deepEqual(calls,['configurationDone','attach','configurationDone']);
  assert.equal(s.snapshot().configured,true);
});
