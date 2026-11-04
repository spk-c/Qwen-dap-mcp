import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAddress} from '../src/diagnostics/address-parser.js';

// Fixed table from the audit (docs/bug-audit-2026-11-04.md, F-3) plus
// boundary cases that pin each mode's normalization behavior.
// [input, lenient, hex-only, exact]
const CASES = [
  ['0x10', 16n, 16n, 16n],
  ['16', 16n, undefined, undefined],
  ['-1', -1n, undefined, undefined],
  ['0x10', 16n, 16n, 16n],
  ['16x', undefined, undefined, undefined],
  ['', undefined, undefined, undefined],
  // Normalization / match-strictness boundaries:
  [' 0x10 ', 16n, 16n, 16n],
  ["'0x10'", 16n, 16n, 16n],
  ['`0x10`', 16n, 16n, 16n],
  ['0x_10', 16n, undefined, 16n],
  ['0x10x', 16n, 16n, undefined],
  ['4096', 4096n, undefined, undefined],
  ['-0x10', 16n, 16n, undefined],
  ['0x', undefined, undefined, undefined],
];

test('shared parseAddress: fixed expectations per mode', () => {
  for (const [input, lenient, hexOnly, exact] of CASES) {
    assert.equal(parseAddress(input, 'lenient'), lenient, `lenient ${JSON.stringify(input)}`);
    assert.equal(parseAddress(input, 'hex-only'), hexOnly, `hex-only ${JSON.stringify(input)}`);
    assert.equal(parseAddress(input, 'exact'), exact, `exact ${JSON.stringify(input)}`);
  }
});

test('modes never interpret the same hex value differently', () => {
  for (const [input] of CASES) {
    const defined = ['lenient', 'hex-only', 'exact']
      .map((mode) => parseAddress(input, mode))
      .filter((value) => value !== undefined);
    assert.equal(new Set(defined).size <= 1, true, `conflicting values for ${JSON.stringify(input)}`);
  }
});

test('lenient intentionally accepts signed decimals the other modes reject', () => {
  for (const input of ['16', '-1', '4096', ' 42 ']) {
    assert.notEqual(parseAddress(input, 'lenient'), undefined, `lenient should parse ${JSON.stringify(input)}`);
    assert.equal(parseAddress(input, 'hex-only'), undefined, `hex-only must reject ${JSON.stringify(input)}`);
    assert.equal(parseAddress(input, 'exact'), undefined, `exact must reject ${JSON.stringify(input)}`);
  }
});
