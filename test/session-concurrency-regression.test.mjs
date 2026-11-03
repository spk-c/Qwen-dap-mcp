import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DapSessionRegistry } from '../src/dap/session-registry.js';
import { runWithDapOperationContext, currentDapOperationContext } from '../src/dap/operation-context.js';

function deferred() {
 let resolve,reject;
 const promise = new Promise((res,rej)=>{resolve=res;reject=rej;});
 return {promise,resolve,reject};
}
function factory() {
 let next=0;
 return ()=>({
   id:++next,hits:0,
   snapshot(){return {id:this.id,hits:this.hits};},
   record(){this.hits++;return this.id;},
   async disconnect(){this.disconnected=true;}
 });
}
function registry(count=8) {
 return new DapSessionRegistry({maxSessions:count,sessionFactory:factory()});
}

test('registry rejects invalid session identifiers and maxSessions bounds',async()=>{
 assert.throws(()=>new DapSessionRegistry({maxSessions:0}),/maxSessions/);
 assert.throws(()=>new DapSessionRegistry({maxSessions:65}),/maxSessions/);
 const r=registry();
 for(const id of ['bad id','.bad','a'.repeat(65),'../etc/passwd','bad\nid'])assert.throws(()=>r.create(id),/Invalid DAP session ID/);
 assert.throws(()=>r.create('default'),/already exists/);
 await r.closeAll();
});

test('routed request state stays isolated under 32 overlapping requests',async()=>{
 const r=registry();
 const ids=['default','a','b','c'];
 for(const id of ids.slice(1))r.create(id);
 const gate=deferred();
 let reached=0;
 const jobs=Array.from({length:32},(_,i)=>r.runWithSession(ids[i%ids.length],async()=>{
   reached++;
   const before=r.currentSessionId();
   await gate.promise;
   await Promise.resolve();
   assert.equal(r.currentSessionId(),before);
   return before;
 }));
 assert.equal(reached,32);
 for(const id of ids)assert.equal(r.activeRequests(id),8);
 gate.resolve();
 const results=await Promise.all(jobs);
 for(const id of ids)assert.equal(results.filter(x=>x===id).length,8);
 for(const id of ids)assert.equal(r.activeRequests(id),0);
 await r.closeAll();
});

test('routed proxy methods bind to the correct session, never a shared global target',async()=>{
 const r=registry();
 r.create('work');
 const routed=r.createRoutedSession();
 const defaultId=routed.id;
 assert.equal(routed.record(),defaultId);
 await r.runWithSession('work',async()=>{
   assert.notEqual(routed.id,defaultId);
   assert.equal(routed.record(),r.get('work').id);
   routed.hits=7;
 });
 assert.equal(routed.id,defaultId);
 assert.equal(r.get('work').hits,7);
 assert.equal(r.get('default').hits,1);
 await r.closeAll();
});

test('synchronous return, synchronous throw and rejected async work all decrement active counters',async()=>{
 const r=registry();
 assert.equal(r.runWithSession('default',()=>42),42);
 assert.equal(r.activeRequests('default'),0);
 assert.throws(()=>r.runWithSession('default',()=>{throw Error('sync failure');}),/sync failure/);
 assert.equal(r.activeRequests('default'),0);
 await assert.rejects(()=>r.runWithSession('default',async()=>{throw Error('async failure');}),/async failure/);
 assert.equal(r.activeRequests('default'),0);
 await r.closeAll();
});

test('malformed thenable getter cannot leak a session active-request count',async()=>{
 const r=registry();
 const invalid={get then(){throw Error('bad then getter');}};
 assert.throws(()=>r.runWithSession('default',()=>invalid),/bad then getter/);
 assert.equal(r.activeRequests('default'),0);
 await r.closeAll();
});

test('busy sessions cannot close while a request is in flight',async()=>{
 const r=registry();
 r.create('busy');
 const gate=deferred();
 const job=r.runWithSession('busy',()=>gate.promise);
 assert.equal(r.activeRequests('busy'),1);
 await assert.rejects(()=>r.close('busy'),/still active/);
 assert.equal(r.has('busy'),true);
 gate.resolve('ok');
 assert.equal(await job,'ok');
 const closed=await r.close('busy');
 assert.deepEqual(closed,{sessionId:'busy',removed:true});
 assert.equal(r.has('busy'),false);
 await r.closeAll();
});

test('closing session rejects newly routed requests until disconnect finishes',async()=>{
 const wait=deferred();
 let created=0;
 const r=new DapSessionRegistry({sessionFactory:()=>({
   id:++created,snapshot(){return {id:this.id};},disconnect(){return wait.promise;}
 })});
 r.create('closing');
 const close=r.close('closing');
 assert.throws(()=>r.runWithSession('closing',()=>true),/is closing/);
 await assert.rejects(()=>r.close('closing'),/already closing/);
 wait.resolve();
 const result=await close;
 assert.equal(result.removed,true);
 await r.closeAll();
});

test('failed disconnect releases closing guard and allows clean retry',async()=>{
 let tries=0;
 const r=new DapSessionRegistry({sessionFactory:()=>({
   snapshot(){return {};},
   async disconnect(){if(++tries===1)throw Error('disconnect failed');}
 })});
 r.create('flaky');
 await assert.rejects(()=>r.close('flaky'),/disconnect failed/);
 assert.equal(r.has('flaky'),true);
 const res=await r.close('flaky');
 assert.equal(res.removed,true);
 await r.closeAll();
});

test('closeAll attempts all adapters even when one disconnect fails',async()=>{
 let created=0;
 const called=[];
 const r=new DapSessionRegistry({sessionFactory:()=>({
   id:++created,snapshot(){return {};},
   async disconnect(){called.push(this.id);if(this.id===2)throw Error('expected failure');}
 })});
 r.create('faulty');
 r.create('healthy');
 await assert.doesNotReject(()=>r.closeAll());
 assert.deepEqual(called.sort((a,b)=>a-b),[1,2,3]);
 assert.equal(r.has('default'),true);
 assert.equal(r.has('faulty'),true,'failed adapter cleanup remains listed rather than silently hidden');
 assert.equal(r.has('healthy'),false);
});

test('automatically generated session IDs remain unique after arbitrary user IDs',async()=>{
 const r=registry();
 r.create('session-1');
 assert.equal(r.create().sessionId,'session-2');
 assert.equal(r.create().sessionId,'session-3');
 await r.closeAll();
});

test('closing the default session disconnects it but retains its routing identity',async()=>{
 const r=registry();
 const closed=await r.close('default',false);
 assert.deepEqual(closed,{sessionId:'default',removed:false});
 assert.equal(r.has('default'),true);
 await r.closeAll();
});

test('unknown session IDs never fall back to default or reuse another request session',async()=>{
 const r=registry();
 assert.throws(()=>r.get('unknown'),/Unknown DAP session/);
 assert.throws(()=>r.runWithSession('unknown',()=>true),/Unknown DAP session/);
 assert.equal(r.currentSessionId(),'default');
 await r.closeAll();
});

test('nested cancellation across async operation contexts propagates but not to siblings',async()=>{
 await runWithDapOperationContext({label:'outer',timeoutMs:1000},async outer=>{
   const childGate=deferred();
   const child=runWithDapOperationContext({label:'nested'},async ctx=>{
     await childGate.promise;
     assert.equal(ctx.signal.aborted,true);
     assert.throws(()=>ctx.throwIfAborted(),/operation cancelled/);
   });
   outer.abort('operation cancelled');
   childGate.resolve();
   await child;
   assert.equal(outer.signal.aborted,true);
 });
 assert.equal(currentDapOperationContext(),undefined);
});

test('pre-aborted context rejects action without executing it',async()=>{
 let called=false;
 const c=new AbortController();
 c.abort('permission withdrawn');
 await assert.rejects(()=>runWithDapOperationContext({signal:c.signal,label:'denied'},async()=>{called=true;}),/permission withdrawn/);
 assert.equal(called,false);
 assert.equal(currentDapOperationContext(),undefined);
});

test('concurrent operation contexts do not leak identity between requests',async()=>{
 const gate=deferred();
 const tasks=Array.from({length:24},(_,i)=>runWithDapOperationContext({label:'op'+i},async ctx=>{
   await gate.promise;
   assert.equal(currentDapOperationContext()?.id,ctx.id);
   assert.equal(currentDapOperationContext()?.label,'op'+i);
   return ctx.id;
 }));
 gate.resolve();
 const results=await Promise.all(tasks);
 assert.equal(new Set(results).size,24);
 assert.equal(currentDapOperationContext(),undefined);
});
