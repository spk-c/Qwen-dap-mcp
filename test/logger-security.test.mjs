import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '../src/logger.js';

test('structured logger redacts nested credentials and bearer headers', () => {
  const entries = [];
  const log = createLogger({level:'debug',sink:(line)=>entries.push(JSON.parse(line))});
  const nested = {apiKey:'abc-key-123',authorization:'Bearer another-secret',ok:'debugger connected'};
  const cyc = {note:'password=hunter2'};cyc.self=cyc;
  const error = new Error('request failed: token=topsecret');
  log.warn('Authorization: Bearer live-secret', {password:'secret-123',nested,items:[cyc],error});
  assert.equal(entries.length,1);
  const record = entries[0];
  const raw = JSON.stringify(record);
  for(const secret of ['secret-123','abc-key-123','another-secret','hunter2','topsecret','live-secret'])
    assert.ok(!raw.includes(secret),'Sensitive log value leaked: '+secret);
  assert.equal(record.fields.password,'[REDACTED]');
  assert.equal(record.fields.nested.apiKey,'[REDACTED]');
  assert.equal(record.fields.nested.ok,'debugger connected');
  assert.equal(record.fields.items[0].self,'[Circular]');
  assert.match(raw,/\[REDACTED\]/);
});
