import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GuardedDapSession } from '../src/dap/guarded-session.js';
import { openDump } from '../src/tools/register-dump-tools.js';
import { discoverGdbDap } from '../src/adapters/gdb-dap.js';

const run = process.env.RUN_POSTMORTEM_TESTS === '1';
const adapter = process.env.NATIVE_DAP_ADAPTER;
const adapterPath = process.env.NATIVE_DAP_PATH;
const core = process.env.NATIVE_DAP_CORE;
const binary = process.env.NATIVE_DAP_BINARY;
if (run) {
  assert.ok(['gdb', 'lldb-dap'].includes(adapter), 'Unsupported postmortem adapter');
  for (const file of [adapterPath, core, binary])
    assert.ok(file && existsSync(file), 'Missing postmortem fixture: ' + file);
}

test('open a real core in inspect-only policy and reject resume', {skip: !run, timeout: 100000}, async () => {
  const session = new GuardedDapSession({
    dapPolicyMode: 'inspect-only',
    holGuardEvaluator: {enabled: false, evaluate: async () => ({allow: true})}
  });
  try {
    const settings = {
      adapter, adapterPath, dumpPath: core, program: binary,
      requestTimeoutMs: 25000, includeDisassembly: false,
      includeModules: false, stackLevels: 20, maxVariablesPerScope: 20
    };
    if (adapter === 'gdb' && discoverGdbDap({explicitPath: adapterPath}).version.major < 16) {
      await assert.rejects(openDump(session, settings), /GDB 18\+/);
      assert.equal(session.connection.isRunning, false, 'Unsupported GDB must not spawn');
      return;
    }
    const evidence = await openDump(session, settings);
    assert.equal(evidence.mode, 'postmortem');
    assert.equal(evidence.readOnlyTarget, true);
    assert.equal(session.isPostmortem(), true);
    const stack = evidence.snapshot?.stack ?? [];
    assert.ok(stack.some(frame => /crash_marker/i.test(frame.name)),
      'Expected crash_marker in real core stack; received ' + stack.map(f => f.name).join(', '));
    await assert.rejects(session.continueExecution(1, false), /postmortem/i);
    await assert.rejects(session.step('next', 1, false), /postmortem/i);
  } finally {
    await session.reset();
    assert.equal(session.connection.isRunning, false);
    assert.equal(session.connection.pending.size, 0);
  }
});
