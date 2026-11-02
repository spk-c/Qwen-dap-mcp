import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRemoteDebugHost, isLoopbackRemoteDebugHost, assertRemoteDebugHostAllowed, buildRemoteTcpEndpoint, parseRemoteTcpTarget } from '../src/remote-endpoint.js';
import { normalizePostmortemSnapshot } from '../src/dap/postmortem-normalization.js';
import { assessSymbolHealth } from '../src/dap/symbol-health.js';
import { normalizeEnvironmentOverrides, mergeEnvironment } from '../src/dap/environment.js';
import { normalizeDiagnosticPath, diagnosticPathWithinRoot } from '../src/diagnostics/path-normalization.js';
import { currentDapOperationContext, runWithDapOperationContext } from '../src/dap/operation-context.js';

test('remote hostname normalization and loopback classification are precise', () => {
  assert.equal(normalizeRemoteDebugHost(' Example.COM '), 'example.com');
  for (const host of ['localhost', '127.0.0.1', '127.81.20.3', '[::1]', '0:0:0:0:0:0:0:1']) {
    assert.equal(isLoopbackRemoteDebugHost(host), true, host);
  }
  for (const host of ['127.example.com', '128.0.0.1', '::2', 'example.com']) {
    assert.equal(isLoopbackRemoteDebugHost(host), false, host);
  }
});

test('remote host normalization rejects malformed and unsafe values', () => {
  for (const host of ['', ' ', 'host name', 'a..b', '.host', 'host.', '-bad.com', 'bad-.com', 'host\nname', 'host/path', 'a'.repeat(64) + '.com', 'a'.repeat(254)]) {
    assert.throws(() => normalizeRemoteDebugHost(host), Error, host);
  }
});

test('explicit remote allowlist remains exact rather than suffix based', () => {
  const env = { QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS: ' EXAMPLE.com, [::2],other.example.org ' };
  assert.equal(assertRemoteDebugHostAllowed('example.com', env), 'example.com');
  assert.equal(assertRemoteDebugHostAllowed('[::2]', env), '::2');
  assert.equal(assertRemoteDebugHostAllowed('localhost', {}), 'localhost');
  for (const host of ['sub.example.com', 'example.com.evil.org', '::3', '192.0.2.3']) {
    assert.throws(() => assertRemoteDebugHostAllowed(host, env), /not allowed/);
  }
});

test('remote endpoints enforce port range, IPv6 brackets and exact syntax', () => {
  assert.deepEqual(buildRemoteTcpEndpoint('127.0.0.1', 1234, {}), { host:'127.0.0.1', port:1234, target:'127.0.0.1:1234', loopback:true });
  assert.deepEqual(parseRemoteTcpTarget('[::1]:65535', {}), { host:'::1', port:65535, target:'[::1]:65535', loopback:true });
  for (const target of ['', '::1:1234', 'localhost', '[::1]1234', 'localhost:0', 'localhost:65536', 'localhost:-1', 'localhost:12.3', 'localhost:12\n34']) {
    assert.throws(() => parseRemoteTcpTarget(target, {}), Error, target);
  }
  for (const port of [0, 65536, 1.5, -3, NaN, Infinity]) {
    assert.throws(() => buildRemoteTcpEndpoint('localhost', port, {}), /port must/);
  }
});

test('postmortem normalization preserves original snapshots and classifies SEH', () => {
  const snapshot = { stopped: { reason:'exception', description:'SEH 0xc0000005' }, exception: { exceptionId:'c0000005' }, threads:[{id:2}] };
  const original = structuredClone(snapshot);
  const normalized = normalizePostmortemSnapshot(snapshot);
  assert.equal(normalized.postmortem, true);
  assert.match(normalized.stopped.description, /access violation/i);
  assert.match(normalized.exception.description, /access violation/i);
  assert.deepEqual(snapshot, original, 'normalization must not mutate the input');
  assert.deepEqual(normalized.threads, snapshot.threads);
  const twice = normalizePostmortemSnapshot(normalized);
  assert.equal(twice.stopped.description, normalized.stopped.description, 'classification must be idempotent');
});

test('postmortem classification handles other codes, absent evidence and existing descriptions', () => {
  const table = [
    ['c00000fd', 'stack overflow'],
    ['c0000094', 'integer divide by zero'],
    ['c000008e', 'floating point division by zero'],
    ['c000001d', 'illegal instruction'],
    ['c0000374', 'heap corruption'],
  ];
  for (const [code, hint] of table) {
    const out = normalizePostmortemSnapshot({ stopped:{description:code} });
    assert.match(out.stopped.description, new RegExp(hint));
  }
  assert.deepEqual(normalizePostmortemSnapshot({ stopped:{reason:'unknown'} }), { stopped:{reason:'unknown'}, postmortem:true });
  assert.equal(normalizePostmortemSnapshot({ exception:{description:'access violation 0xc0000005'} }).exception.description, 'access violation 0xc0000005');
});

test('symbol health distinguishes no evidence, poor, partial, good and explicit missing', () => {
  assert.equal(assessSymbolHealth([], undefined).status, 'unknown');
  assert.equal(assessSymbolHealth([{name:'??', line:0}], undefined).status, 'poor');
  assert.equal(assessSymbolHealth([{name:'main'}], []).status, 'partial');
  const named = [{name:'main',source:{path:'/project/main.cpp'},line:24}];
  const good = assessSymbolHealth(named, [{symbolStatus:'Symbols loaded'}]);
  assert.equal(good.status, 'good');
  assert.equal(good.stack.topFrameSourceMapped, true);
  assert.equal(good.modules.symbolsAvailable, 1);
  const partial = assessSymbolHealth(named, [{symbolStatus:'not loaded'}]);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.modules.symbolsMissing, 1, 'negative status must beat the word loaded');
  assert.equal(assessSymbolHealth([{name:'??'}],[{symbolStatus:'missing'}]).status, 'poor');
});

test('environment overrides avoid Windows case-insensitive variable collisions', () => {
  const base = { Path:'original', HOME:'home' };
  const overrides = { PATH:'first', path:'second', TEST:'a' };
  assert.deepEqual(normalizeEnvironmentOverrides(overrides, base, 'win32'), { Path:'second', TEST:'a' });
  assert.deepEqual(mergeEnvironment(base, overrides, 'win32'), { Path:'second', HOME:'home', TEST:'a' });
  assert.deepEqual(normalizeEnvironmentOverrides(overrides, base, 'linux'), overrides);
  assert.deepEqual(normalizeEnvironmentOverrides(undefined, base, 'win32'), {});
});

test('diagnostic path normalization keeps POSIX case and scopes Windows roots safely', () => {
  assert.equal(normalizeDiagnosticPath('C:\\Work\\File.cpp'), 'c:/work/file.cpp');
  assert.equal(normalizeDiagnosticPath('C:\\'), 'c:/');
  assert.equal(normalizeDiagnosticPath('/Project/a.cpp'), '/Project/a.cpp');
  assert.equal(normalizeDiagnosticPath('/Project/a.cpp///'), '/Project/a.cpp');
  assert.equal(normalizeDiagnosticPath('/'), '/');
  assert.equal(normalizeDiagnosticPath(''), undefined);
  assert.equal(diagnosticPathWithinRoot('/project/a', '/project'), true);
  assert.equal(diagnosticPathWithinRoot('/project-sibling/a', '/project'), false);
  assert.equal(diagnosticPathWithinRoot('/Project/a', '/project'), false);
});

test('operation context nests deadlines and isolates async execution', async () => {
  assert.equal(currentDapOperationContext(), undefined);
  let parentId;
  await runWithDapOperationContext({label:'parent', timeoutMs:250}, async (parent) => {
    parentId = parent.id;
    assert.equal(currentDapOperationContext(), parent);
    await runWithDapOperationContext({label:'child', timeoutMs:1000}, async (child) => {
      assert.notEqual(child.id, parentId);
      assert.equal(currentDapOperationContext(), child);
      assert.ok(child.remainingMs(1000) <= parent.remainingMs(1000) + 10);
      assert.equal(child.signal.aborted, false);
    });
    assert.equal(currentDapOperationContext(), parent);
  });
  assert.equal(currentDapOperationContext(), undefined);
});

test('parent cancellation and explicit AbortSignal propagate to nested operations', async () => {
  const controller = new AbortController();
  await runWithDapOperationContext({label:'parent'}, async (parent) => {
    await runWithDapOperationContext({label:'child', signal:controller.signal}, async (child) => {
      controller.abort('cancelled on purpose');
      assert.equal(child.signal.aborted, true);
      assert.throws(() => child.throwIfAborted(), /cancelled on purpose/);
      assert.equal(parent.signal.aborted, false);
    });
    await runWithDapOperationContext({label:'sibling'}, async (child) => {
      parent.abort('parent stopped');
      assert.equal(child.signal.aborted, true);
      assert.throws(() => child.throwIfAborted(), /parent stopped/);
    });
  });
});

test('operation exceptions unwind storage rather than leaking active context', async () => {
  await assert.rejects(() => runWithDapOperationContext({label:'failure'}, async () => {
    throw new Error('expected operation failure');
  }), /expected operation failure/);
  assert.equal(currentDapOperationContext(), undefined);
});