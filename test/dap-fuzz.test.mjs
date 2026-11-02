import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DapConnection} from '../src/dap/connection.js';

function framed(message) {
  const payload = Buffer.from(JSON.stringify(message),'utf8');
  return Buffer.concat([Buffer.from('Content-Length: '+payload.length+'\r\n\r\n','ascii'),payload]);
}
function randomGenerator() {
  let state = 0x1234ABCD;
  return (max) => {state=(Math.imul(state,1664525)+1013904223)>>>0;return state%max;};
}
test('DAP framing withstands deterministic fragmented Unicode and coalesced events', () => {
  const rand=randomGenerator();
  for(let iteration=0;iteration<125;iteration++) {
    const events=[];const errors=[];
    const conn=new DapConnection();
    conn.on('event:stopped',msg=>events.push(msg));
    conn.on('adapterError',err=>errors.push(err));
    const payload={seq:1,type:'event',event:'stopped',body:{reason:'breakpoint',value:'🐈'.repeat(rand(50))+'x'.repeat(rand(900))}};
    const data=Buffer.concat([framed(payload),framed({...payload,seq:2})]);
    for(let i=0;i<data.length;) {
      const width=1+rand(48);conn.onStdout(data.subarray(i,i+width));i+=width;
    }
    assert.equal(errors.length,0,'Transport error at iteration '+iteration);
    assert.equal(events.length,2,'Dropped event at iteration '+iteration);
    assert.equal(conn.buffer.length,0);
  }
});
test('DAP parser rejects malformed Content-Length headers without retaining buffered data', () => {
  for(const header of ['Content-Length: abc\r\n\r\n','Content-Length: 1\r\nContent-Length: 1\r\n\r\n','Content-Length: 99999999999\r\n\r\n']) {
    const conn=new DapConnection();
    const errors=[];conn.on('adapterError',err=>errors.push(err));
    assert.doesNotThrow(()=>conn.onStdout(Buffer.from(header,'ascii')));
    assert.equal(errors.length,1);
    assert.equal(conn.buffer.length,0);
  }
});
