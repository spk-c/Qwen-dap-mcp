import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectPdbIdentity} from '../src/diagnostics/symbol-doctor.js';

test('symbol inspector parses the output of an owned inspection subprocess without guessing identity',
  {skip: process.platform !== 'linux'}, () => {
  const root = mkdtempSync(join(tmpdir(), 'qwen-symbol-probe-owned-'));
  const executable = join(root, 'fake-pdbutil');
  const pdb = join(root, 'sample.pdb');
  const previous = process.env.QWEN_DAP_MCP_LLVM_PDBUTIL;
  try {
    writeFileSync(pdb, 'not a real PDB - owned fixture');
    writeFileSync(executable, [
      '#!/bin/sh',
      'echo "GUID: {ABCDEF01-2345-6789-ABCD-ABCDEF012345}"',
      'echo "Age: 7"',
    ].join('\n') + '\n', {mode:0o700});
    chmodSync(executable,0o700);
    process.env.QWEN_DAP_MCP_LLVM_PDBUTIL=executable;
    const inspected=inspectPdbIdentity(pdb);
    assert.equal(inspected.guid,'abcdef0123456789abcdabcdef012345');
    assert.equal(inspected.age,'7');
    assert.equal(inspected.probe.error,undefined);
    writeFileSync(executable, '#!/bin/sh\necho "probe failure" >&2\nexit 17\n',{mode:0o700});
    const failed=inspectPdbIdentity(pdb);
    assert.equal(failed.guid,undefined);
    assert.equal(failed.age,undefined);
    assert.equal(failed.probe.error,'exit-17');
    assert.match(failed.probe.output,/probe failure/);
  } finally {
    if(previous === undefined) delete process.env.QWEN_DAP_MCP_LLVM_PDBUTIL;
    else process.env.QWEN_DAP_MCP_LLVM_PDBUTIL=previous;
    rmSync(root,{recursive:true,force:true});
  }
});
