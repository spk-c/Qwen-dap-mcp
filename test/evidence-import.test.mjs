import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportEvidenceBundle,importEvidenceBundle} from '../src/evidence-bundle.js';
test('imports only dedicated bounded structured evidence files', () => {
  const dir=mkdtempSync(join(tmpdir(),'qwen-evidence-'));
  try {
    const unrelated=join(dir,'credentials.json');
    writeFileSync(unrelated,JSON.stringify({private:'do not reveal'}));
    assert.throws(()=>importEvidenceBundle(unrelated),/restricted to/);
    const valid=join(dir,'evidence.qwen-dap.json');
    const output=exportEvidenceBundle({path:valid,evidence:{marker:'verified'}});
    assert.equal(output.format,'json');
    assert.deepEqual(importEvidenceBundle(valid).evidence,{marker:'verified'});
    const sarif=join(dir,'report.qwen-dap.sarif');
    exportEvidenceBundle({path:sarif,format:'sarif',evidence:{hypotheses:[]}});
    assert.equal(importEvidenceBundle(sarif).evidence.version,'2.1.0');
    const invalid=join(dir,'invalid.qwen-dap.sarif.json');
    writeFileSync(invalid,JSON.stringify({version:'2.1.0'}));
    assert.throws(()=>importEvidenceBundle(invalid),/requires a SARIF/);
    const scalar=join(dir,'scalar.qwen-dap.json');
    writeFileSync(scalar,'"secret"');
    assert.throws(()=>importEvidenceBundle(scalar),/structured JSON object/);
    const oversized=join(dir,'oversized.qwen-dap.json');
    writeFileSync(oversized,Buffer.alloc(8*1024*1024+1,0x20));
    assert.throws(()=>importEvidenceBundle(oversized),/8 MiB/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
