import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DapConnection} from '../src/dap/connection.js';

const adapter = fileURLToPath(new URL('../fixtures/fault-injection-dap-adapter.mjs', import.meta.url));
const makeConnection = () => new DapConnection({requestPolicy: () => ({allow: true})});

async function launch(connection, mode, id = 'fixture') {
  await connection.start({
    command: process.execPath,
    args: [adapter],
    env: {QWEN_TEST_DAP_MODE: mode, QWEN_TEST_DAP_ID: id},
  });
}

test('96 concurrent requests through four real DAP subprocesses stay isolated', {timeout: 20000}, async () => {
  const connections = Array.from({length: 4}, makeConnection);
  try {
    await Promise.all(connections.map((connection, i) => launch(connection, 'healthy', String(i))));
    await Promise.all(connections.map(async (connection, i) => {
      const results = await Promise.all(Array.from({length: 24}, (_, marker) =>
        connection.sendRequest('threads', {marker}, 5000)));
      assert.equal(results.length, 24);
      results.forEach((result, marker) => {
        assert.equal(result.success, true);
        assert.equal(result.body.threads[0].name, 'adapter-' + i);
        assert.equal(result.body.marker, marker);
      });
      assert.equal(connection.pending.size, 0);
    }));
  } finally {
    await Promise.allSettled(connections.map(connection => connection.stop()));
  }
});

test('a subprocess crash rejects pending requests and a fresh adapter can restart', {timeout: 15000}, async () => {
  const connection = makeConnection();
  try {
    await launch(connection, 'crash');
    await assert.rejects(connection.sendRequest('threads', {}, 5000), /adapter exited/i);
    assert.equal(connection.pending.size, 0);
    await connection.stop();
    await launch(connection, 'healthy', 'replacement');
    const response = await connection.sendRequest('threads', {marker: 7}, 3000);
    assert.equal(response.body.threads[0].name, 'adapter-replacement');
    assert.equal(response.body.marker, 7);
  } finally {
    await connection.stop();
  }
});

test('a hung real adapter times out without leaking a pending request or blocking restart', {timeout: 15000}, async () => {
  const connection = makeConnection();
  try {
    await launch(connection, 'timeout');
    await assert.rejects(connection.sendRequest('threads', {}, 90), /timed out/i);
    assert.equal(connection.pending.size, 0);
    await connection.stop();
    await launch(connection, 'healthy');
    const response = await connection.sendRequest('threads', {marker: 8}, 3000);
    assert.equal(response.body.marker, 8);
  } finally {
    await connection.stop();
  }
});

test('a degraded adapter fails the request, not the entire transport', {timeout: 15000}, async () => {
  const connection = makeConnection();
  try {
    await launch(connection, 'degraded');
    await assert.rejects(connection.sendRequest('threads', {}, 3000), /simulated adapter failure/);
    assert.equal(connection.pending.size, 0);
    const response = await connection.sendRequest('initialize', {}, 3000);
    assert.equal(response.success, true);
  } finally {
    await connection.stop();
  }
});

test('malformed data from a real adapter fails closed and clears pending requests', {timeout: 15000}, async () => {
  const connection = makeConnection();
  const failures = [];
  connection.on('adapterError', error => failures.push(error.message));
  try {
    await launch(connection, 'malformed');
    await assert.rejects(connection.sendRequest('threads', {}, 3000), /Invalid DAP header/);
    assert.equal(connection.pending.size, 0);
    assert.ok(failures.some(message => /Invalid DAP header/.test(message)));
  } finally {
    await connection.stop();
  }
});
