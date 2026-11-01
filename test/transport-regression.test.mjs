import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DapConnection } from '../src/dap/connection.js';

function frame(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  return Buffer.concat([Buffer.from('Content-Length: ' + body.length + '\r\n\r\n', 'ascii'), body]);
}

test('invalid JSON envelopes fail closed without throwing out of stdout handler', () => {
  for (const invalid of [null, false, [], {}, {type:'event'}, {type:'response',request_seq:1,command:'threads',success:'true'}]) {
    const connection = new DapConnection();
    const errors = [];
    connection.on('adapterError', (error) => errors.push(error.message));
    assert.doesNotThrow(() => connection.onStdout(frame(invalid)));
    assert.equal(errors.length, 1, JSON.stringify(invalid));
    assert.equal(connection.buffer.length, 0);
  }
});

test('a response with a different command cannot settle a pending request', async () => {
  const connection = new DapConnection();
  const sent = [];
  connection.child = {exitCode:null,signalCode:null,stdin:{writableNeedDrain:false,write:msg=>sent.push(msg)}};
  let error;
  connection.on('adapterError', e => {error=e;});
  const pending = connection.sendRequest('threads',{},5000);
  await Promise.resolve();
  assert.equal(sent.length,1);
  connection.onStdout(frame({seq:2,type:'response',request_seq:1,command:'evaluate',success:true,body:{}}));
  await assert.rejects(pending,/response command mismatch/);
  assert.match(error.message,/response command mismatch/);
  assert.equal(connection.pending.size,0);
});

test('policy approval from retired adapter does not authorize new adapter', async () => {
  let resolvePolicy;
  const connection = new DapConnection({requestPolicy:() => new Promise(resolve=>{resolvePolicy=resolve;})});
  const makeChild = () => ({exitCode:null,signalCode:null,stdin:{writableNeedDrain:false,write:()=>{throw Error('Must not write');}}});
  connection.child = makeChild();
  const pending = connection.sendRequest('continue',{},5000);
  assert.equal(typeof resolvePolicy,'function');
  connection.transportGeneration++;
  connection.child = makeChild();
  resolvePolicy({allow:true});
  await assert.rejects(pending,/adapter changed/);
  assert.equal(connection.pending.size,0);
});

test('policy decision must explicitly be allow=true', async () => {
  const connection = new DapConnection({requestPolicy:()=>({allow:'true'})});
  connection.child = {exitCode:null,signalCode:null,stdin:{writableNeedDrain:false,write:()=>{throw Error('Must not write');}}};
  await assert.rejects(connection.sendRequest('continue',{}),/blocked by policy/);
});

test('event waiter cancellation cleans up its listeners', async () => {
  const connection = new DapConnection();
  const controller = new AbortController();
  const waiting = connection.waitForEvent('initialized',5000,undefined,false,controller.signal);
  assert.equal(connection.listenerCount('event:initialized'),1);
  controller.abort();
  await assert.rejects(waiting,/cancelled/);
  assert.equal(connection.listenerCount('event:initialized'),0);
  assert.equal(connection.listenerCount('adapterExit'),0);
});

test('stderr snapshot is bounded per line', () => {
  const connection = new DapConnection();
  connection.captureStderr('a'.repeat(100000));
  assert.ok(connection.recentStderr[0].length <= 4120);
  for (let i=0;i<200;i++) connection.captureStderr('b'.repeat(9000));
  assert.equal(connection.recentStderr.length,100);
});
