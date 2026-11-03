import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {
 buildHolGuardBridgeEnvironment,buildHolGuardEnvironmentFingerprint,
 sanitizeAdapterArgsForHolGuard,sanitizeDapArgumentsForHolGuard,
 resolveAdapterExecutable,createHolGuardEvaluator,shouldConsultHolGuard,
 createGuardedDapRequestPolicy,requireHolGuardAdapterStart
} from '../src/dap/hol-guard-policy.js';
import {resolveSecurityProfile,securityProfileDefaults,securityProfileSnapshot} from '../src/security-profile.js';

test('inspect profile denies implicit execution/control while overrides remain visible',()=>{
 assert.equal(resolveSecurityProfile(' INSPECT '),'inspect');
 assert.equal(resolveSecurityProfile('read-only'),'inspect');
 assert.equal(resolveSecurityProfile('local'),'local-debug');
 assert.equal(resolveSecurityProfile('full'),'advanced');
 assert.equal(securityProfileDefaults('inspect').dapPolicy,'inspect-only');
 const snapshot=securityProfileSnapshot({
   QWEN_DAP_MCP_PROFILE:'advanced',
   QWEN_DAP_MCP_TOOLSET:'full',
   QWEN_DAP_MCP_DAP_POLICY:'standard',
   QWEN_DAP_MCP_HOL_GUARD:'yes',
   QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS:'127.0.0.2',
   QWEN_DAP_MCP_SYMBOL_SERVERS:'https://example.org'
 });
 assert.equal(snapshot.profile,'advanced');
 assert.equal(snapshot.overrides.holGuardEnabled,true);
 assert.equal(snapshot.overrides.remoteHostsConfigured,true);
 assert.equal(snapshot.overrides.symbolServersConfigured,true);
 assert.throws(()=>resolveSecurityProfile('allow-everything'),/Unsupported/);
});

test('HOL Guard bridge strips unrelated environment variables and interpreter injection',()=>{
 const source={HOME:'/safe',PATH:'/bin',LANG:'C',HOL_GUARD_POLICY:'approval',
   PYTHONPATH:'/untrusted',PYTHONHOME:'/untrusted-home',API_TOKEN:'secret',npm_config_registry:'secret'};
 const result=buildHolGuardBridgeEnvironment(source);
 assert.equal(result.HOME,'/safe');
 assert.equal(result.HOL_GUARD_POLICY,'approval');
 assert.equal(result.PYTHONPATH,undefined);
 assert.equal(result.PYTHONHOME,undefined);
 assert.equal(result.API_TOKEN,undefined);
 assert.equal(result.npm_config_registry,undefined);
});

test('adapter args redact both token=value and token value without exposing their content',()=>{
 const raw=['--token=supersecret1','--api-key','supersecret2','--password=supersecret3',
    '--config','safe.yml','--auth','supersecret4'];
 const out=sanitizeAdapterArgsForHolGuard(raw);
 const serialized=out.join(' ');
 for(const token of ['supersecret1','supersecret2','supersecret3','supersecret4']) assert.ok(!serialized.includes(token));
 assert.ok(serialized.includes('sha256:'));
 assert.ok(serialized.includes('safe.yml'));
 assert.equal(raw[0],'--token=supersecret1','original input must not be modified');
});

test('nested DAP arguments redact credential maps, arrays and CLI argv securely',()=>{
 const original={
   env:{DB_PASSWORD:'supersecret5',PATH:'/bin'},
   environmentVariables:['TOKEN=supersecret6',{name:'API_TOKEN',value:'supersecret7'}],
   nested:{apiKey:'supersecret8',args:['--password','supersecret9','--mode=inspect']},
   harmless:{level:2}
 };
 const filtered=sanitizeDapArgumentsForHolGuard(original);
 const text=JSON.stringify(filtered);
 for(const secret of ['supersecret5','supersecret6','supersecret7','supersecret8','supersecret9','/bin']) assert.ok(!text.includes(secret));
 assert.equal(filtered.harmless.level,2);
 assert.ok(text.includes('sha256:'));
 assert.equal(original.env.PATH,'/bin');
});

test('argument sanitizer rejects cyclic structures instead of looping or leaking raw tokens',()=>{
 const obj={password:[]};
 obj.password.push(obj);
 assert.throws(()=>sanitizeDapArgumentsForHolGuard(obj),/cycle/);
});

test('HMAC redaction preserves stable in-process value equivalence without leaking the value',()=>{
 const a=sanitizeDapArgumentsForHolGuard({token:'secret-secret'});
 const b=sanitizeDapArgumentsForHolGuard({token:'secret-secret'});
 const c=sanitizeDapArgumentsForHolGuard({token:'other-secret'});
 assert.deepEqual(a,b);
 assert.notDeepEqual(a,c);
 assert.equal(JSON.stringify(a).includes('secret-secret'),false);
});

test('environment fingerprint changes when a debugging-relevant override changes',()=>{
 const before=buildHolGuardEnvironmentFingerprint({QWEN_TEST_NONSECRET:'a'});
 const same=buildHolGuardEnvironmentFingerprint({QWEN_TEST_NONSECRET:'a'});
 const changed=buildHolGuardEnvironmentFingerprint({QWEN_TEST_NONSECRET:'b'});
 assert.equal(before.envHash,same.envHash);
 assert.notEqual(before.envHash,changed.envHash);
 assert.match(before.envHash,/^sha256:[0-9a-f]{64}$/);
 assert.ok(before.envKeys.includes('QWEN_TEST_NONSECRET'));
});

test('adapter executable resolution requires a real existing executable, not a shell command',()=>{
 assert.equal(resolveAdapterExecutable(process.execPath,undefined,process.env)!==undefined,true);
 assert.equal(resolveAdapterExecutable('no-such-executable-20261103',undefined,{PATH:''}),undefined);
 assert.equal(resolveAdapterExecutable('not-real/does-not-exist',process.cwd(),process.env),undefined);
 const bin=dirname(process.execPath);
 const name=basename(process.execPath);
 const resolved=resolveAdapterExecutable(name,undefined,{PATH:bin});
 assert.ok(resolved);
});

test('HOL Guard is not consulted for pure inspection DAP calls',()=>{
 for(const name of ['threads','stackTrace','variables','modules','scopes']) assert.equal(shouldConsultHolGuard(name),false);
 for(const name of ['continue','launch','evaluate','writeMemory','setDataBreakpoints','disconnect']) assert.equal(shouldConsultHolGuard(name),true);
});

test('disabled HOL Guard evaluator returns an explicit allow decision without running subprocesses',async()=>{
 const guard=createHolGuardEvaluator({enabled:false});
 assert.equal(guard.enabled,false);
 assert.equal((await guard.evaluate({kind:'test'})).allow,true);
});

test('built-in inspect policy blocks disallowed commands before consulting any external guard',async()=>{
 let calls=0;
 const evaluator={enabled:true,async evaluate(){calls++;return {allow:true};}};
 const policy=createGuardedDapRequestPolicy(evaluator,'inspect-only');
 const result=await policy({command:'continue',args:{threadId:1}});
 assert.equal(result.allow,false);
 assert.equal(calls,0);
});

test('guard decision disallows unsafe request and preserves denial reason',async()=>{
 const evaluator={enabled:true,async evaluate(){return {allow:false,action:'deny',reason:'not approved'};}};
 const policy=createGuardedDapRequestPolicy(evaluator,'standard');
 const result=await policy({command:'continue',args:{threadId:1}});
 assert.equal(result.allow,false);
 assert.match(result.reason,/not approved/);
});

test('guarded policy redacts secret arguments before evaluating access',async()=>{
 let action;
 const evaluator={enabled:true,async evaluate(a){action=a;return {allow:true};}};
 const policy=createGuardedDapRequestPolicy(evaluator,'standard');
 const result=await policy({command:'evaluate',args:{expression:'x',password:'supersecret10'}});
 assert.equal(result.allow,true);
 assert.equal(action.command,'evaluate');
 assert.equal(JSON.stringify(action).includes('supersecret10'),false);
});

test('pending approval is invalidated when the active session changes',async()=>{
 let resolve;
 const decision=new Promise(r=>{resolve=r;});
 const evaluator={enabled:true,evaluate(){return decision;}};
 let current={sessionId:'one'};
 const policy=createGuardedDapRequestPolicy(evaluator,'standard',()=>current);
 const pending=policy({command:'continue',args:{threadId:1}});
 current={sessionId:'two'};
 resolve({allow:true});
 const result=await pending;
 assert.equal(result.allow,false);
 assert.match(result.reason,/session changed/);
});

test('disabled adapter-start guard emits a redacted but usable command context',async()=>{
 const evaluator={enabled:false};
 const ctx=await requireHolGuardAdapterStart(evaluator,{
   command:'debugger-bin',args:['--token','supersecret11','--safe','yes'],env:{PROFILE:'debug'}
 });
 assert.equal(ctx.adapterCommand,'debugger-bin');
 assert.equal(JSON.stringify(ctx).includes('supersecret11'),false);
 assert.match(ctx.envHash,/^sha256:/);
 assert.equal(ctx.adapterIdentityHash,undefined);
});

test('enabled adapter-start policy fails closed when policy evaluation errors or denies',async()=>{
 const opts={command:'missing-debugger-2026',args:['--safe'],cwd:process.cwd(),env:{PATH:''}};
 await assert.rejects(()=>requireHolGuardAdapterStart({enabled:true,evaluate:async()=>{throw Error('network timeout');}},opts),/policy failed closed/);
 await assert.rejects(()=>requireHolGuardAdapterStart({enabled:true,evaluate:async()=>({allow:false,action:'deny',reason:'blocked'})},opts),/blocked DAP adapter start/);
});

test('enabled adapter-start guard requires a validated executable identity after an allow',async()=>{
 const r=await requireHolGuardAdapterStart({
   enabled:true,async evaluate(){return {allow:true,action:'allow',reason:'signed policy'};}
 },{command:process.execPath,args:['--help'],env:{}});
 assert.match(r.adapterIdentityHash,/^sha256:[0-9a-f]{64}$/);
 assert.match(r.adapterExecutableHash,/^sha256:[0-9a-f]{64}$/);
 assert.ok(r.adapterResolvedCommand);
});

test('tampering with a policy bridge file after initialization invalidates approval before execution',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'holguard-verify-'));
 const file=join(dir,'fake-policy-bridge.py');
 try{
    writeFileSync(file,'# initial bridge\n');
    const evaluator=createHolGuardEvaluator({enabled:true,pythonCommand:process.execPath,bridgePath:file});
    assert.equal(evaluator.enabled,true);
    writeFileSync(file,'# altered policy bridge\n');
    await assert.rejects(()=>evaluator.evaluate({kind:'test'}),/bridge script changed/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});


test('environment-driven HOL Guard toggles reject unknown values instead of silently disabling',()=>{
 const key='QWEN_DAP_MCP_HOL_GUARD';
 const original=process.env[key];
 try{
   for(const value of ['off','false','0','disabled','']) {
     process.env[key]=value;
     assert.equal(createHolGuardEvaluator().enabled,false);
   }
   process.env[key]='silent-fail-open';
   assert.throws(()=>createHolGuardEvaluator(),/Unsupported QWEN_DAP_MCP_HOL_GUARD/);
 }finally{
   if(original===undefined)delete process.env[key];
   else process.env[key]=original;
 }
});

test('HOL Guard timeout configuration rejects partial numeric strings and out-of-range values',()=>{
 const dir=mkdtempSync(join(tmpdir(),'holguard-timeout-'));
 const file=join(dir,'policy.py');
 const key='QWEN_DAP_MCP_HOL_GUARD_TIMEOUT_MS';
 const original=process.env[key];
 try{
   writeFileSync(file,'# no execution in validation test\n');
   const opts={enabled:true,pythonCommand:process.execPath,bridgePath:file};
   for(const value of ['99','60001','timeout','5000garbage','500.5','-1']) {
     process.env[key]=value;
     assert.throws(()=>createHolGuardEvaluator(opts),/Invalid QWEN_DAP_MCP_HOL_GUARD_TIMEOUT_MS/,value);
   }
   process.env[key]=' 1000 ';
   assert.equal(createHolGuardEvaluator(opts).enabled,true);
 }finally{
   if(original===undefined)delete process.env[key];
   else process.env[key]=original;
   rmSync(dir,{recursive:true,force:true});
 }
});

test('failed guard subprocess denies approval and never treats nonzero exit as allow',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'holguard-fail-'));
 const file=join(dir,'policy.py');
 try{
   writeFileSync(file,'# fixture: node -I does not support this Python flag\n');
   const evaluator=createHolGuardEvaluator({enabled:true,pythonCommand:process.execPath,bridgePath:file,timeoutMs:5000});
   await assert.rejects(()=>evaluator.evaluate({kind:'dap-request',command:'continue'}),/policy process failed|timed out|stdin failed|policy process/i);
 }finally{
   rmSync(dir,{recursive:true,force:true});
 }
});


test('disabled approval policy bypasses external guard only after built-in DAP checks pass',async()=>{
 let calls=0;
 const evaluator={enabled:false,async evaluate(){calls++;throw Error('should not run');}};
 const policy=createGuardedDapRequestPolicy(evaluator,'standard');
 assert.equal((await policy({command:'continue',args:{threadId:1}})).allow,true);
 assert.equal((await policy({command:'threads',args:{}})).allow,true);
 assert.equal(calls,0);
});

test('approval from an unchanged session context can be accepted after explicit checking',async()=>{
 const stable={sessionId:'current-session'};
 let action;
 const evaluator={enabled:true,async evaluate(x){action=x;return {allow:true,action:'allow',reason:'approved'};}};
 const policy=createGuardedDapRequestPolicy(evaluator,'standard',()=>stable);
 const approved=await policy({command:'continue',args:{threadId:3}});
 assert.equal(approved.allow,true);
 assert.equal(action.sessionId,'current-session');
 assert.equal(action.kind,'dap-request');
});

test('allow decision cannot launch an adapter with unresolved executable identity',async()=>{
 const evaluator={enabled:true,async evaluate(){return {allow:true,action:'allow',reason:'ok'};}};
 await assert.rejects(()=>requireHolGuardAdapterStart(evaluator,
    {command:'missing-binary-20261103',args:[],env:{PATH:''}}),/executable identity could not be resolved/);
});
