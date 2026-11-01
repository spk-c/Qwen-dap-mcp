import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {createServer as netServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {GuardedDapSession} from '../src/dap/guarded-session.js';
import {buildGdbDapRemoteAttachConfiguration} from '../src/adapters/gdb-dap.js';

const active=process.env.RUN_REMOTE_DEBUGGER_TESTS==='1';
const debuggerPath=process.env.NATIVE_DAP_PATH;
const gdbserverPath=process.env.GDBSERVER_PATH;
const program=process.env.NATIVE_DAP_BINARY;
const source=fileURLToPath(new URL('./fixture/native-debug.cpp',import.meta.url));
const line=readFileSync(source,'utf8').split(/\r?\n/).findIndex(s=>s.includes('NATIVE_BREAKPOINT'))+1;
if(active)for(const p of [debuggerPath,gdbserverPath,program])assert.ok(p&&existsSync(p),'Missing test fixture executable: '+p);

async function availablePort(){
  const s=netServer();
  await new Promise((resolve,reject)=>s.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=s.address().port;
  await new Promise(resolve=>s.close(resolve));
  return port;
}
function startGdbServer(port){
  return new Promise((resolve,reject)=>{
    const child=spawn(gdbserverPath,['--once','127.0.0.1:'+port,program],{stdio:['ignore','pipe','pipe']});
    let done=false,stderr='';
    const timer=setTimeout(()=>finish(new Error('gdbserver did not become ready: '+stderr.slice(-1000))),10000);
    function finish(err){if(done)return;done=true;clearTimeout(timer);if(err){child.kill();reject(err);}else resolve(child);}
    child.once('error',finish);
    child.once('exit',(code,signal)=>finish(new Error('gdbserver exited early: '+code+'/'+signal+' '+stderr.slice(-1000))));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data',chunk=>{
      stderr=(stderr+chunk).slice(-5000);
      if(/Listening on port|Listening on .*port/i.test(stderr))finish();
    });
  });
}
async function stopGdbServer(child){
  if(!child || child.exitCode!==null || child.signalCode!==null)return;
  const exited=new Promise(resolve=>child.once('exit',resolve));
  child.kill();
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,1500))]);
  if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL');
}
test('remote target policy permits loopback and rejects unallowlisted hosts',{skip:!active},()=>{
  const valid=buildGdbDapRemoteAttachConfiguration({host:'127.0.0.1',port:12345,program,policyEnv:{}});
  assert.equal(valid.target,'127.0.0.1:12345');
  assert.throws(()=>buildGdbDapRemoteAttachConfiguration({host:'203.0.113.10',port:12345,program,policyEnv:{}}),/not allowed/i);
  assert.throws(()=>buildGdbDapRemoteAttachConfiguration({host:'127.0.0.1',port:65536,program}),/port/i);
  assert.throws(()=>buildGdbDapRemoteAttachConfiguration({target:'127.0.0.1:12345',host:'127.0.0.1',port:12345,program}),/either target or host/i);
});
test('real loopback gdbserver attach, breakpoint and full cleanup',{skip:!active,timeout:85000},async()=>{
  const port=await availablePort();
  let server;
  const session=new GuardedDapSession({dapPolicyMode:'standard',holGuardEvaluator:{enabled:false,evaluate:async()=>({allow:true})}});
  try{
    server=await startGdbServer(port);
    await session.start({command:debuggerPath,args:['--interpreter=dap','--quiet','--nx'],adapterId:'gdb',requestTimeoutMs:15000});
    const stopped=session.connection.waitForEvent('stopped',25000);
    void stopped.catch(()=>{});
    const config=buildGdbDapRemoteAttachConfiguration({host:'127.0.0.1',port,program,policyEnv:{}});
    const attached=await session.attach(config,[{source,lines:[line]}]);
    assert.equal(attached.request,'attach');
    assert.equal(session.snapshot().configured,true);
    const first=await stopped;
    assert.ok(first.event==='stopped','Must see a true remote stop');
    let threadId=first.body?.threadId??(await session.threads())[0]?.id;
    assert.ok(Number.isInteger(threadId));
    if(first.body?.reason!=='breakpoint'){
      const next=session.connection.waitForEvent('stopped',25000);
      void next.catch(()=>{});
      await session.continueExecution(threadId,false);
      const later=await next;
      assert.equal(later.body?.reason,'breakpoint','Expected actual debug_probe breakpoint');
      threadId=later.body.threadId??threadId;
    }
    const stack=await session.stackTrace(threadId);
    assert.ok(stack.some(x=>/debug_probe/i.test(x.name)), 'Stack must include debug_probe');
  }finally{
    await session.disconnect(true);
    await stopGdbServer(server);
    assert.equal(session.connection.pending.size,0);
    assert.equal(session.connection.isRunning,false);
  }
});
