import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DapSession} from '../src/dap/session.js';

const adapter = fileURLToPath(new URL('../fixtures/fake-dap-adapter.mjs',import.meta.url));

test('real stdio DAP transport initializes, launches, stops and detaches', {timeout:15000}, async () => {
  const session = new DapSession();
  try {
    const capabilities = await session.start({command:process.execPath,args:[adapter],adapterId:'lldb',requestTimeoutMs:5000});
    assert.equal(capabilities.supportsConfigurationDoneRequest,true);
    const info = await session.launch({program:'fake-debuggee'});
    assert.equal(info.request,'launch');
    assert.equal(session.snapshot().configured,true);
    const stop = await session.connection.waitForEvent('stopped',5000,undefined,true);
    assert.equal(stop.body.reason,'entry');
    const threads=await session.threads();
    assert.deepEqual(threads.map(t=>t.id),[1]);
  } finally {
    await session.disconnect(false);
  }
  assert.equal(session.snapshot().adapterRunning,false);
});

test('initialized waiter is not reused from old event history', {timeout:15000}, async () => {
  const session = new DapSession();
  try {
    await session.start({command:process.execPath,args:[adapter],adapterId:'lldb',requestTimeoutMs:5000});
    // First completed launch leaves initialized in eventHistory.
    await session.launch({program:'fake-debuggee'});
    await assert.rejects(
      session.connection.waitForEvent('initialized',50,undefined,false),
      /timed out/i
    );
  } finally { await session.disconnect(false); }
});
