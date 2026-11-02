#!/usr/bin/env node
// Deterministic transport microbenchmark, NOT a real debugger latency claim.
import {performance} from 'node:perf_hooks';
import {DapConnection} from '../src/dap/connection.js';

const n=Number(process.argv[2] ?? 1000);
if(!Number.isSafeInteger(n)||n<10||n>100000)throw Error('Iterations must be 10..100000');
const samples=[];
for(let i=0;i<Math.min(50,n);i++) {
  const msg={seq:i+1,type:'event',event:'output',body:{category:'console',output:'x'.repeat(1024)}};
  const payload=Buffer.from(JSON.stringify(msg),'utf8');
  const frame=Buffer.concat([Buffer.from('Content-Length: '+payload.length+'\r\n\r\n'),payload]);
  const connection=new DapConnection();
  const t0=performance.now();
  for(let j=0;j<Math.ceil(n/Math.min(50,n));j++)connection.onStdout(frame);
  samples.push((performance.now()-t0)/Math.ceil(n/Math.min(50,n)));
}
samples.sort((a,b)=>a-b);
const pick=p=>Number(samples[Math.min(samples.length-1,Math.ceil(samples.length*p)-1)].toFixed(4));
const report={kind:'synthetic DAP frame parser only',node:process.version,platform:process.platform,iterations:n,p50_ms:pick(.5),p95_ms:pick(.95),rss_mb:Number((process.memoryUsage().rss/1048576).toFixed(1))};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
