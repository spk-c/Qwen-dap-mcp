import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 crashFingerprintsV2, moduleForAddress, analyzeStackIntegrity, analyzeKnownApiCall,
 buildFailureHypotheses, buildBreakpointPlan, classifyThreadObservation,
 buildLockOwnerGraph, compareCrashFamilies
} from '../src/diagnostics/runtime-v2.js';

function snapshot(overrides={}) {
  return {
    stack:[{name:'handleFailure',line:12,source:{path:'/build/main.cpp'},instructionPointerReference:'0x1010'}],
    frame:{name:'handleFailure',line:12,source:{path:'/build/main.cpp'}},
    stopped:{reason:'exception',description:'SIGSEGV'},
    exception:{exceptionId:'SIGSEGV'},
    locals:[],registers:[],
    modules:[{id:1,name:'app',addressRange:'0x1000 - 0x2000'}],
    ...overrides
  };
}

test('semantic crash fingerprint survives path and source-line changes but exact fingerprint does not',()=>{
  const a=crashFingerprintsV2(snapshot());
  const b=crashFingerprintsV2(snapshot({stack:[{name:'handleFailure',line:19,source:{path:'C:\\Work\\main.cpp'},instructionPointerReference:'0x5555'}]}));
  assert.equal(a.version,2);
  assert.equal(a.semantic,b.semantic);
  assert.equal(a.family,b.family);
  assert.notEqual(a.exact,b.exact);
  assert.equal(a.exact.length,64);
});

test('fingerprints preserve sanitizer and poison evidence instead of just the top-level exception',()=>{
  const state=snapshot({locals:[{name:'owner',type:'Widget*',value:'0xfeeefeee'}, {name:'arg',type:'Widget*',value:'0x000'}]});
  const result=crashFingerprintsV2(state,['ERROR: AddressSanitizer: heap-use-after-free']);
  assert.ok(result.materials.exact.hazards.includes('freed-heap-pattern'));
  assert.ok(result.materials.exact.hazards.includes('null-like-pointer'));
  assert.ok(result.materials.exact.sanitizers.includes('asan'));
  assert.ok(result.materials.exact.sanitizers.includes('use-after-free'));
});

test('moduleForAddress parses module ranges with exclusive end and rejects malformed values',()=>{
  const modules=[{name:'bad',addressRange:'unknown'}, {name:'app',addressRange:'0x1000-0x2000'}];
  assert.equal(moduleForAddress(modules,'0x1000')?.name,'app');
  assert.equal(moduleForAddress(modules,'0x1fff')?.name,'app');
  assert.equal(moduleForAddress(modules,'0x2000'),undefined);
  assert.equal(moduleForAddress(modules,'not an address'),undefined);
  assert.equal(moduleForAddress(undefined,'0x1100'),undefined);
  assert.equal(moduleForAddress([{name:'reversed',addressRange:'0x3000-0x2000'}],'0x2500'),undefined);
});

test('stack integrity flags out-of-range instruction pointers without declaring them proof of corruption',()=>{
  const r=analyzeStackIntegrity(snapshot({stack:[
    {name:'first',instructionPointerReference:'0x4000'},
    {name:'second',instructionPointerReference:'0x5000'}
  ]}));
  assert.equal(r.severity,'medium');
  assert.equal(r.findings.filter(x=>x.kind==='instruction-pointer-outside-known-modules').length,2);
  assert.match(r.limitations.join(' '),/unwinding/i);
});

test('stack integrity records possible recursion, misaligned SP and explicit stack protector output',()=>{
  const r=analyzeStackIntegrity(snapshot({
    stack:Array.from({length:4},(_,i)=>({name:'recursive',instructionPointerReference:'0x1010',line:i})),
    registers:[{name:'rsp',value:'0x1235'}]
  }),['*** stack smashing detected ***']);
  assert.equal(r.severity,'high');
  assert.ok(r.findings.some(x=>x.kind==='highly-repeated-return-or-instruction-address'));
  assert.ok(r.findings.some(x=>x.kind==='non-16-byte-aligned-stack-pointer'));
  assert.ok(r.findings.some(x=>x.kind==='runtime-stack-protector-evidence'));
});

test('healthy stack remains unclassified when module and alignment evidence is clean',()=>{
  const r=analyzeStackIntegrity(snapshot({registers:[{name:'sp',value:'0x2000'}]}));
  assert.equal(r.severity,'none');
  assert.equal(r.findings.length,0);
});

test('known API catalog maps ABI argument carriers and identifies null-risk arguments',()=>{
  const r=analyzeKnownApiCall(snapshot({frame:{name:'memcpy'}}),[
    {register:'rdi',value:'0x0000'},{register:'rsi',value:'0x1234'}, {register:'rdx',value:'8'}
  ]);
  assert.equal(r.recognized,true);
  assert.equal(r.function,'memcpy');
  assert.equal(r.arguments[0].parameter,'destination');
  assert.equal(r.arguments[0].register,'rdi');
  assert.equal(r.risks[0].kind,'null-destination');
  assert.equal(r.risks.length,1);
});

test('unrecognized API does not invent parameters or null-risk diagnosis',()=>{
  const r=analyzeKnownApiCall(snapshot({frame:{name:'myCustomFunction'}}),[]);
  assert.equal(r.recognized,false);
  assert.equal(r.arguments,undefined);
  assert.match(r.note,/not in the bounded/);
});

test('native API catalog covers common memory and synchronization functions',()=>{
  const cases=[
    ['memmove','null-source',1],
    ['memset','null-destination',0],
    ['strlen','null-string',0],
    ['pthread_mutex_lock','null-mutex',0],
    ['WaitForSingleObject','null-or-invalid-handle',0],
    ['read','null-buffer',1]
  ];
  for(const [name,risk,index] of cases){
    const args=[{value:'0x1000'},{value:'0x1000'},{value:'5'}];
    args[index]={value:'0'};
    const result=analyzeKnownApiCall(snapshot({frame:{name}}),args);
    assert.ok(result.recognized,name);
    assert.equal(result.risks[0]?.kind,risk,name);
  }
});

test('failure hypotheses are evidence-led, sorted and do not assign causes without evidence',()=>{
  const clean=snapshot({stopped:{reason:'entry',description:'startup'},exception:undefined});
  assert.equal(buildFailureHypotheses({snapshot:clean}).length,0);
  const infected=snapshot({stopped:{reason:'exception',description:'SIGSEGV use-after-free heap-buffer-overflow'}});
  const result=buildFailureHypotheses({
    snapshot:infected,
    memoryHazards:[{kind:'freed-heap-pattern'},{kind:'poison-or-guard-pattern'},{kind:'null-like-pointer'}],
    apiAnalysis:{risks:[{kind:'null-destination'}]},
    outputLines:['AddressSanitizer: heap-buffer-overflow', 'use-after-free']
  });
  assert.ok(result.some(x=>x.id==='use-after-free'));
  assert.ok(result.some(x=>x.id==='buffer-overflow'));
  assert.ok(result.some(x=>x.id==='null-dereference'));
  assert.ok(result.every(x=>x.evidenceScore<=100 && x.evidenceScore>=0));
  assert.ok(result.every((x,i)=>!i || result[i-1].evidenceScore>=x.evidenceScore));
});

test('breakpoint plans are plans only, bounded and exclude unknown frames',()=>{
  const cases=['use-after-free','buffer-overflow','data-race'].map(id=>({id}));
  const state=snapshot({stack:[{name:'failure'},{name:'worker'},{name:'??'},{name:'dispatch'}],
    locals:[{name:'ptr',type:'void*',value:'0x10',evaluateName:'p'},{name:'count',type:'int',value:'4'}]});
  const result=buildBreakpointPlan(cases,state);
  const functions=result.functionBreakpoints.map(x=>x.function);
  assert.ok(functions.includes('free'));
  assert.ok(functions.includes('memcpy'));
  assert.ok(functions.includes('pthread_mutex_lock'));
  assert.ok(functions.includes('worker'));
  assert.ok(!functions.includes('??'));
  assert.equal(result.dataBreakpointCandidates[0].name,'p');
  assert.ok(functions.length<=16);
});

test('thread observations attach lock-owner evidence only when debugger variables contain owner ids',()=>{
  const r=classifyThreadObservation(2,{id:11,name:'worker'},[{name:'pthread_mutex_lock',line:3}],
    [{name:'mutex_owner_thread_id',value:'15'}, {name:'mutex',value:'0xabc123'}]);
  assert.equal(r.waitKind,'lock');
  assert.equal(r.threadId,11);
  assert.ok(r.resources.some(x=>x.ownerThreadId===15));
  const unknown=classifyThreadObservation(3,{id:20},[{name:'work'}],[]);
  assert.equal(unknown.waitKind,'runnable-or-unknown');
  assert.deepEqual(unknown.resources,[]);
});

test('lock-owner graph requires explicit owner edges to declare cycles',()=>{
  const mk=(threadId,ownerThreadId)=>({threadId,resources:[{name:'mutex',value:'0xabc123',ownerThreadId,ownerEvidence:'mutex_owner_tid='+ownerThreadId}]});
  const cycle=buildLockOwnerGraph([mk(1,2),mk(2,1)]);
  assert.equal(cycle.cycleProven,true);
  assert.equal(cycle.edges.length,2);
  assert.equal(cycle.cycle.length,2);
  const noCycle=buildLockOwnerGraph([mk(1,2),{threadId:2,resources:[]}]);
  assert.equal(noCycle.cycleProven,false);
  assert.equal(buildLockOwnerGraph([{threadId:1,resources:[]}]).evidenceKind,'no-portable-owner-evidence');
});

test('crash family clustering separates exact differences from common families',()=>{
  const reports=[
    {label:'A',fingerprintsV2:{family:'shared',semantic:'sem1',exact:'exact1'}},
    {label:'B',fingerprintsV2:{family:'shared',semantic:'sem2',exact:'exact2'}},
    {label:'C',fingerprintsV2:{family:'other',semantic:'sem3',exact:'exact3'}}
  ];
  const result=compareCrashFamilies(reports);
  assert.equal(result.totalReports,3);
  assert.equal(result.sharedFamilyCount,1);
  assert.equal(result.families[0].family,'shared');
  assert.equal(result.families[0].semanticVariants,2);
  assert.equal(result.families[0].exactVariants,2);
  assert.deepEqual(result.families[0].members,['A','B']);
  assert.equal(compareCrashFamilies([]).sharedFamilyCount,0);
});
