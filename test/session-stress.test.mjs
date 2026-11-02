import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DapSessionRegistry} from '../src/dap/session-registry.js';

test('eight parallel logical DAP sessions remain request-local and clean up', async () => {
  const registry=new DapSessionRegistry({maxSessions:8});
  const ids=['default'];
  for(let i=1;i<8;i++)ids.push(registry.create('s'+i).sessionId);
  assert.throws(()=>registry.create('overflow'),/limit/);
  const result=await Promise.all(ids.map(id=>registry.runWithSession(id,async()=>{
    await Promise.resolve();
    assert.equal(registry.currentSessionId(),id);
    return registry.currentSessionId();
  })));
  assert.deepEqual(result,ids);
  for(const id of ids)assert.equal(registry.activeRequests(id),0);
  await registry.closeAll();
  assert.deepEqual(registry.list().map(x=>x.sessionId),['default']);
});
