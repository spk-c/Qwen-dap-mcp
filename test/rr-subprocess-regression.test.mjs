import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {discoverRr, buildRrReplayPlan, recordWithRr} from '../src/adapters/rr.js';
import {ManagedRrReplay} from '../src/adapters/rr-replay.js';

function ownedFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'qwen-rr-owned-'));
  const rr = join(root, 'fake-rr');
  const program = join(root, 'owned-program');
  const trace = join(root, 'trace');
  const script = [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then echo "rr version 5.9.0"; exit 0; fi',
    'if [ "$1" = "record" ]; then echo "fixture recording completed"; exit 0; fi',
    'if [ "$1" = "replay" ]; then echo "Waiting for GDB connection" >&2; while :; do sleep 1; done; fi',
    'exit 9',
  ].join('\n') + '\n';
  writeFileSync(rr, script, {mode:0o700});
  chmodSync(rr, 0o700);
  writeFileSync(program, 'fixture only - never executed');
  mkdirSync(trace);
  return Promise.resolve().then(() => callback({root, rr, program, trace}))
    .finally(() => rmSync(root, {recursive:true, force:true}));
}

test('rr discovery and loopback replay plan use only an owned, explicitly selected executable',
  {skip: process.platform !== 'linux'}, async () => {
  await ownedFixture(({rr, trace}) => {
    const discovered = discoverRr({explicitPath:rr});
    assert.equal(discovered.source, 'explicit');
    assert.equal(discovered.command, resolve(rr));
    assert.match(discovered.version, /rr version 5\.9/);
    const plan = buildRrReplayPlan({rrPath:rr, traceDir:trace, port:27182});
    assert.deepEqual(plan.args, ['replay', '-s', '27182', resolve(trace)]);
    assert.deepEqual(plan.gdbRemote, {host:'127.0.0.1',port:27182,target:'127.0.0.1:27182'});
    for (const port of [0,65536,1.5,NaN,'2222']) {
      assert.throws(() => buildRrReplayPlan({rrPath:rr,traceDir:trace,port}), /port must be an integer/);
    }
  });
});

test('rr record validates timeouts and does not overwrite an existing evidence directory',
  {skip: process.platform !== 'linux'}, async () => {
  await ownedFixture(({root,rr,program,trace}) => {
    assert.throws(() => recordWithRr({rrPath:rr,program,timeoutMs:999}), /timeoutMs/);
    assert.throws(() => recordWithRr({rrPath:rr,program,traceDir:trace}), /already exists/);
    const fresh = join(root, 'new-trace');
    const result = recordWithRr({rrPath:rr,program,traceDir:fresh,args:['--fixture-mode']});
    assert.equal(result.success, true);
    assert.equal(result.requestedTraceDir, resolve(fresh));
    assert.equal(result.commandIdentity.shell, false);
    assert.deepEqual(result.commandIdentity.args,
      ['record','-o',resolve(fresh),resolve(program),'--fixture-mode']);
    assert.match(result.stdout, /fixture recording completed/);
  });
});

test('managed replay reports real process readiness and terminates owned fixture cleanly',
  {skip: process.platform !== 'linux',timeout:15000}, async () => {
  await ownedFixture(async ({rr,trace}) => {
    const managed = new ManagedRrReplay();
    try {
      const started = await managed.start({rrPath:rr,traceDir:trace,port:28361,readyTimeoutMs:1500});
      assert.equal(started.running,true);
      assert.equal(started.port,28361);
      assert.ok(started.pid > 0);
      assert.ok(started.stderrTail.some(line=>/Waiting for GDB/.test(line)));
    } finally {
      const stopped = await managed.stop();
      assert.equal(stopped.running,false);
    }
  });
});
