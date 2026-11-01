import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, linkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isInspectOnlyPostmortemAttach, createDapRequestPolicy } from '../src/dap/request-policy.js';
import { exportEvidenceBundle, importEvidenceBundle } from '../src/evidence-bundle.js';
import { DapConnection } from '../src/dap/connection.js';

test('inspect-only accepts only narrow postmortem attach shapes', () => {
  const goodGdb = { coreFile: '/tmp/crash.core', program: '/tmp/a.out' };
  const goodLldb = { type: 'lldb-dap', request: 'attach', name: 'core', coreFile: '/tmp/crash.core', program: '/tmp/a.out', sourceMap: [['/old', '/new']] };
  const goodCodeLldb = { type: 'lldb', request: 'attach', name: 'dump', targetCreateCommands: ['target create -c "/tmp/my core.dmp" "/tmp/app"'], processCreateCommands: [] };
  for (const config of [goodGdb, goodLldb, goodCodeLldb]) {
    assert.equal(isInspectOnlyPostmortemAttach(config), true);
    assert.equal(createDapRequestPolicy('inspect-only')({ command: 'attach', args: config }).allow, true);
  }
  const bad = [
    { ...goodGdb, pid: 123 },
    { ...goodGdb, attachCommands: ['process attach -p 123'] },
    { ...goodGdb, coreFile: '' },
    { ...goodGdb, coreFile: '/tmp/core\nscript' },
    { ...goodLldb, processCreateCommands: ['process launch'] },
    { ...goodCodeLldb, targetCreateCommands: ['target create -c "/tmp/core"; process launch'] },
    { ...goodCodeLldb, targetCreateCommands: ['target create -c "/tmp/core"\nprocess attach -p 123'] },
    { ...goodCodeLldb, processCreateCommands: ['process launch'] },
    { ...goodCodeLldb, targetCreateCommands: ['target create -c "/tmp/a"', 'target create -c "/tmp/b"'] },
  ];
  for (const config of bad) assert.equal(isInspectOnlyPostmortemAttach(config), false, JSON.stringify(config));
  for (const command of ['launch','evaluate','writeMemory','continue','setVariable'])
    assert.equal(createDapRequestPolicy('inspect-only')({ command, args: {} }).allow, false);
});
test('evidence export atomically creates and replaces only the destination entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qwen-dap-test-'));
  try {
    const path = join(dir, 'report.qwen-dap.json');
    const other = join(dir, 'hardlink.json');
    exportEvidenceBundle({path, evidence: { marker: 'first' }});
    linkSync(path, other);
    assert.throws(() => exportEvidenceBundle({path, evidence: {marker:'no'}, overwrite:false}));
    exportEvidenceBundle({path, evidence: {marker:'second'}, overwrite:true});
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), {marker:'second'});
    assert.deepEqual(JSON.parse(readFileSync(other, 'utf8')), {marker:'first'}, 'Existing hardlink content must not be overwritten');
    assert.deepEqual(importEvidenceBundle(path).evidence, {marker:'second'});
    const target = join(dir, 'external.txt');
    const link = join(dir, 'link.qwen-dap.json');
    writeFileSync(target, 'untouched');
    try {
      symlinkSync(target, link);
      assert.throws(() => exportEvidenceBundle({path:link, evidence:{x:1}, overwrite:true}));
      assert.equal(readFileSync(target, 'utf8'), 'untouched');
      assert.throws(() => importEvidenceBundle(link));
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
    }
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
test('DAP parser handles fragmented and coalesced messages', () => {
  const conn = new DapConnection();
  const received = [];
  conn.on('event:stopped', (message) => received.push(message));
  const data = Buffer.from(JSON.stringify({seq:1, type:'event', event:'stopped', body:{reason:'breakpoint'}}));
  const framed = Buffer.concat([Buffer.from('Content-Length: ' + data.length + '\r\n\r\n'), data]);
  conn.onStdout(framed.subarray(0, 8));
  conn.onStdout(Buffer.concat([framed.subarray(8), framed]));
  assert.equal(received.length, 2);
  assert.equal(conn.buffer.length, 0);
});
test('DAP sender refuses backpressure and oversized outgoing payloads', () => {
  const conn = new DapConnection();
  const sent = [];
  const stdin = { writableNeedDrain: false, write: (msg) => {sent.push(msg); return true;} };
  conn.child = { exitCode: null, signalCode: null, stdin };
  conn.writeMessage({type:'request',seq:1,command:'threads'});
  assert.equal(sent.length, 1);
  stdin.writableNeedDrain = true;
  assert.throws(() => conn.writeMessage({type:'request',seq:2,command:'threads'}), /backpressured/);
  stdin.writableNeedDrain = false;
  assert.throws(() => conn.writeMessage({data:'x'.repeat(16*1024*1024)}), /16 MiB/);
});
