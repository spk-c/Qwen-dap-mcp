import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareRuntimeSnapshots} from '../src/diagnostics/runtime-diff.js';
import {classifyThreadWait, analyzeHang} from '../src/diagnostics/hang-analysis.js';
import {correlateSourceDisassembly, analyzeRuntimeSnapshot} from '../src/diagnostics/analyze-snapshot.js';

function sample(overrides = {}) {
  return {
    stack: [{name:'main',line:12,source:{path:'C:\\Src\\App.cpp'},moduleId:'app.exe'}],
    locals: [{name:'ptr',type:'int*',value:'0x1234abcd'}, {name:'counter',type:'int',value:'1'}],
    registers: [{name:'rax',value:'0x1111aaaa'}],
    symbolHealth: {status:'good'},
    modules: [{id:1,name:'app.exe',path:'C:\\Bin\\App.exe'}],
    exception: {exceptionId:'EXCEPTION_ACCESS_VIOLATION', description:'read failure'},
    ...overrides
  };
}

test('semantic comparison ignores ASLR-only pointer changes and normalizes Windows paths', () => {
  const diff = compareRuntimeSnapshots(sample(), sample({
    stack: [{name:'main',line:12,source:{path:'c:/src/app.cpp'},moduleId:'app.exe'}],
    locals: [{name:'ptr',type:'int*',value:'0x9876abcd'}, {name:'counter',type:'int',value:'1'}],
    registers: [{name:'rax',value:'0x2222aaaa'}],
    modules: [{id:7,name:'app.exe',path:'c:/bin/app.exe'}]
  }));
  assert.equal(diff.summary.meaningfulDifferences, 0);
  assert.equal(diff.summary.unstableValues, 2);
  assert.equal(diff.stack.status, 'same');
  assert.equal(diff.modules.status, 'same');
  assert.equal(diff.firstMeaningfulDifference, undefined);
  assert.equal(diff.locals.find(v=>v.name==='ptr').status, 'unstable');
});

test('nullability transition is meaningful even when the other value is a raw address', () => {
  for (const empty of ['nullptr','0x000000','(nil)','NULL']) {
    const diff = compareRuntimeSnapshots(sample({locals:[{name:'ptr',type:'int*',value:'0x1234abcd'}]}),
      sample({locals:[{name:'ptr',type:'int*',value:empty}]}));
    assert.equal(diff.summary.changedLocals, 1);
    assert.equal(diff.locals[0].status, 'changed');
    assert.match(diff.locals[0].reason, /Nullability/);
    assert.equal(diff.firstMeaningfulDifference.category, 'local');
  }
});

test('local variables report added, removed, same and changed without duplicate keys', () => {
  const a = sample({locals: [{name:'b',value:'3'}, {name:'a',value:'old'}, {name:'same',value:'1'}, {name:'b',value:'ignored'}]});
  const b = sample({locals: [{name:'c',value:'1'}, {name:'a',value:'new'}, {name:'same',value:'1'}]});
  const diff = compareRuntimeSnapshots(a,b);
  assert.deepEqual(diff.locals.map(x=>[x.name,x.status]), [['a','changed'],['b','removed'],['c','added'],['same','same']]);
  assert.equal(diff.summary.changedLocals,3);
  assert.equal(diff.firstMeaningfulDifference.category,'local');
});

test('exception property ordering is canonical; adding/removing exceptions is explicit', () => {
  const a=sample({locals:[],registers:[],exception:{a:1,deep:{x:2,y:3}}});
  const b=sample({locals:[],registers:[],exception:{deep:{y:3,x:2},a:1}});
  assert.equal(compareRuntimeSnapshots(a,b).exception.status,'same');
  assert.equal(compareRuntimeSnapshots(sample({exception:undefined}),b).exception.status,'added');
  assert.equal(compareRuntimeSnapshots(a,sample({exception:undefined})).exception.status,'removed');
  assert.equal(compareRuntimeSnapshots(sample({exception:undefined}),sample({exception:undefined})).exception.status,'unavailable');
});

test('source path changes remain meaningful on case-sensitive POSIX filesystems', () => {
  const a=sample({stack:[{name:'main',line:12,source:{path:'/Project/main.cpp'}}],locals:[],registers:[],exception:undefined});
  const b=sample({stack:[{name:'main',line:12,source:{path:'/project/main.cpp'}}],locals:[],registers:[],exception:undefined});
  const diff=compareRuntimeSnapshots(a,b);
  assert.equal(diff.stack.status,'changed');
  assert.equal(diff.summary.stackChanges,1);
  assert.equal(diff.firstMeaningfulDifference.category,'stack');
});

test('stack growth, shrinkage, and missing module data retain explicit status', () => {
  const f={name:'handler',line:7};
  const a=sample({stack:[f],locals:[],registers:[],modules:undefined,exception:undefined});
  const b=sample({stack:[f,{name:'extra',line:15}],locals:[],registers:[],modules:undefined,exception:undefined});
  assert.equal(compareRuntimeSnapshots(a,b).stack.frames[1].status,'added');
  assert.equal(compareRuntimeSnapshots(b,a).stack.frames[1].status,'removed');
  assert.equal(compareRuntimeSnapshots(a,a).modules.status,'unavailable');
});

test('module additions and removals are sorted, without treating module ids as identity when path exists', () => {
  const a=sample({locals:[],registers:[],stack:[],exception:undefined,modules:[{id:5,path:'/lib/libb.so'},{id:10,path:'/lib/liba.so'}]});
  const b=sample({locals:[],registers:[],stack:[],exception:undefined,modules:[{id:11,path:'/lib/libc.so'},{id:12,path:'/lib/libb.so'}]});
  const diff=compareRuntimeSnapshots(a,b);
  assert.deepEqual(diff.modules.added,['/lib/libc.so']);
  assert.deepEqual(diff.modules.removed,['/lib/liba.so']);
  assert.equal(diff.firstMeaningfulDifference.category,'module');
});

test('first meaningful difference prioritizes local, exception, stack, register, symbol and module evidence', () => {
  const base=sample({locals:[],registers:[],stack:[],modules:undefined,exception:undefined,symbolHealth:{status:'good'}});
  const withModule=sample({...base,modules:[{name:'new.so'}]});
  assert.equal(compareRuntimeSnapshots(base,withModule).firstMeaningfulDifference.category,'module');
  const withSymbol=sample({...withModule,symbolHealth:{status:'poor'}});
  assert.equal(compareRuntimeSnapshots(base,withSymbol).firstMeaningfulDifference.category,'symbol-health');
  const withRegister=sample({...withSymbol,registers:[{name:'rax',value:'7'}]});
  assert.equal(compareRuntimeSnapshots(base,withRegister).firstMeaningfulDifference.category,'register');
  const withStack=sample({...withRegister,stack:[{name:'foo'}]});
  assert.equal(compareRuntimeSnapshots(base,withStack).firstMeaningfulDifference.category,'stack');
  const withException=sample({...withStack,exception:{exceptionId:'SIGSEGV'}});
  assert.equal(compareRuntimeSnapshots(base,withException).firstMeaningfulDifference.category,'exception');
  const withLocal=sample({...withException,locals:[{name:'n',value:'99'}]});
  assert.equal(compareRuntimeSnapshots(base,withLocal).firstMeaningfulDifference.category,'local');
});

test('runtime comparisons do not change source evidence', () => {
  const before=sample(), after=sample({locals:[{name:'ptr',value:'nullptr'}]});
  const beforeCopy=structuredClone(before),afterCopy=structuredClone(after);
  compareRuntimeSnapshots(before,after);
  assert.deepEqual(before,beforeCopy);
  assert.deepEqual(after,afterCopy);
});

test('wait primitive classifier distinguishes lock, I/O, timer and event states', () => {
  const cases=[
    ['pthread_cond_wait','condition-variable'],['futex_wait','futex'],['pthread_rwlock_rdlock','rwlock'],
    ['pthread_mutex_lock','mutex'],['sem_wait','semaphore'],['pthread_join','thread-join'],
    ['epoll_wait','io'],['nanosleep','sleep-timer'],['WaitForSingleObject','event'],
    ['parking_lot','scheduler-park']
  ];
  for (const [fn,expected] of cases) {
    const wait=classifyThreadWait({stack:[{name:fn}]});
    assert.equal(wait.kind,expected,fn);
    assert.equal(wait.blocked,true,fn);
    assert.equal(wait.matchedFrameIndex,0,fn);
  }
});

test('wait classification recognizes user-owned execution but does not guess from empty stack', () => {
  const running=classifyThreadWait({stack:[{name:'work',source:{path:'/myproject/worker.cpp'},line:10}]},{projectRoots:['/myproject']});
  assert.equal(running.kind,'running-user-code');
  assert.equal(running.blocked,false);
  const unknown=classifyThreadWait({stack:[]});
  assert.equal(unknown.kind,'unknown');
  assert.equal(unknown.confidence,'low');
});

test('hang triage preserves collection limits and shared pointer provenance, without inventing lock ownership', () => {
  const threads=[1,2].map(id=>({
    thread:{id,name:'worker-'+id},
    stack:[{name:'pthread_mutex_lock'},{name:'handle',source:{path:'/myproject/work.cpp'},line:10}],
    variableFrames:[{frameIndex:1,frame:{name:'handle'},variables:[{name:'mutex',type:'pthread_mutex_t*',value:'0xabc123'}]}],
    ...(id===2?{collectionErrors:['registers unavailable']}: {})
  }));
  const result=analyzeHang(threads,{projectRoots:['/myproject']});
  assert.equal(result.allThreadTriage.length,2);
  assert.equal(result.allThreadTriage[0].wait.kind,'mutex');
  assert.ok(result.pointerProvenance.groups.some(x=>x.sharedAcrossThreads));
  assert.match(result.limitations.join(' '),/registers unavailable/);
  assert.ok(result.nextActions.some(x=>x.includes('Pointer-Provenance')));
});

test('empty hang triage is conservative and never declares deadlock',()=>{
  const r=analyzeHang([]);
  assert.match(r.summary,/No thread evidence/);
  assert.notEqual(r.classification,'deadlock-candidate');
  assert.equal(r.allThreadTriage.length,0);
});

function crash(overrides={}) {
  return {
    frame:{name:'main',line:12,column:3,instructionPointerReference:'0x1004',source:{path:'/proj/main.cpp'}},
    stopped:{reason:'exception',description:'Access violation'},
    exception:{exceptionId:'EXCEPTION_ACCESS_VIOLATION',breakMode:'unhandled'},
    locals:[],registers:[],
    disassembly:[{address:'0x1000',instruction:'mov'},{address:'0x1004',instruction:'call'},{address:'0x1008',instruction:'ret'}],
    ...overrides
  };
}

test('crash diagnosis prioritizes real exception evidence and disassembly at instruction pointer', () => {
  const r=analyzeRuntimeSnapshot(crash({locals:[{name:'target',type:'Widget*',value:'nullptr'}]}));
  assert.equal(r.classification.category,'access-violation');
  assert.equal(r.classification.crashLikely,true);
  assert.equal(r.sourceDisassembly.exactInstructionMatch,true);
  assert.equal(r.sourceDisassembly.currentInstruction.address,'0x1004');
  assert.ok(r.suspiciousValues.some(x=>x.reason==='null-like-pointer'));
  assert.ok(r.hypotheses.length>0);
});

test('nonfatal first-chance exceptions and breakpoints are not asserted as crashes',()=>{
  const handled=analyzeRuntimeSnapshot(crash({exception:{exceptionId:'warn',breakMode:'always'},stopped:{reason:'exception',description:'temporary exception'}}));
  assert.equal(handled.classification.crashLikely,false);
  const bp=analyzeRuntimeSnapshot(crash({stopped:{reason:'breakpoint'},exception:undefined}));
  assert.equal(bp.classification.category,'breakpoint');
  assert.equal(bp.classification.crashLikely,false);
});

test('instruction correlation selects nearest address when exact IP is absent',()=>{
  const r=correlateSourceDisassembly(crash({frame:{name:'foo',instructionPointerReference:'0x1006'},disassembly:[{address:'0x1000',instruction:'a'},{address:'0x1004',instruction:'b'},{address:'0x1009',instruction:'c'}]}));
  assert.equal(r.exactInstructionMatch,false);
  assert.equal(r.currentInstruction.address,'0x1004');
  assert.equal(r.previousInstructions.length,1);
  assert.equal(r.nextInstructions.length,1);
});

test('absence of disassembly leaves no invented current instruction',()=>{
  const r=correlateSourceDisassembly(crash({disassembly:[],frame:{name:'foo'}}));
  assert.equal(r.exactInstructionMatch,false);
  assert.equal(r.currentInstruction,undefined);
  assert.deepEqual(r.previousInstructions,[]);
});
