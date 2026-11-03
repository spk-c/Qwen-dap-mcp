import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessProjectFrames, selectProjectFrame, analyzeInstructionOperands,
  analyzeCallChain, createVerificationBaseline, compareVerificationBaseline,
  buildIntelligentDiagnosis
} from '../src/diagnostics/intelligent-diagnosis.js';
import { analyzeRuntimeSnapshot } from '../src/diagnostics/analyze-snapshot.js';

const runtime = {name:'__libc_start_main',moduleId:'libc.so.6',source:{path:'/usr/lib/libc/entry.cpp'},line:10};
const app = {name:'handlePacket',moduleId:'gateway',source:{path:'/project/src/packet.cpp'},line:45,instructionPointerReference:'0x1004'};
const caller = {name:'dispatch',moduleId:'gateway',source:{path:'/project/src/main.cpp'},line:71};

function evidence(index,frame,variables=[],instruction='mov rax, [rbx + rcx*4]') {
  return {index, frame, locals:variables,registers:[{name:'rbx',value:'0'},{name:'rcx',value:'0'},{name:'rax',value:'0x88'}],
    disassembly:[{address:'0x1004',instruction}]};
}
function diagnosis() {
  const frame={...app};
  const snapshot={frame, stopped:{reason:'exception',description:'access violation'},exception:{exceptionId:'SIGSEGV',breakMode:'unhandled'},
    locals:[{name:'ownerPtr',type:'Widget*',value:'0'}],registers:[],disassembly:[]};
  const base=analyzeRuntimeSnapshot(snapshot);
  const selection=selectProjectFrame([frame,caller],{projectRoots:['/project']});
  return buildIntelligentDiagnosis(snapshot,base,selection,[evidence(0,frame,[{name:'ownerPtr',type:'Widget*',value:'0'}])]);
}

test('frame selection skips system runtime boundaries and scores project root hints',()=>{
  const scores=assessProjectFrames([runtime,app,caller],{projectRoots:['/project']});
  assert.equal(scores[0].projectControlled,false);
  assert.equal(scores[0].runtimeLikely,true);
  assert.equal(scores[1].projectControlled,true);
  assert.ok(scores[1].score>scores[0].score);
  const result=selectProjectFrame([runtime,app,caller],{projectRoots:['/project']});
  assert.equal(result.selected.index,1);
  assert.equal(result.skippedRuntimeFrames,1);
  assert.equal(result.usedExplicitProjectHint,true);
});

test('runtime module hints cannot falsely mark system frames as project owned',()=>{
  const r=assessProjectFrames([runtime],{projectModules:['libc.so.6']})[0];
  assert.equal(r.projectControlled,false);
  assert.equal(r.runtimeLikely,true);
});

test('path comparison preserves POSIX case and does not match sibling directories',()=>{
  const frames=[{name:'work',source:{path:'/project-extra/a.cpp'},line:1},{name:'work',source:{path:'/Project/a.cpp'},line:2}];
  const scores=assessProjectFrames(frames,{projectRoots:['/project']});
  assert.ok(scores.every(x=>x.projectControlled===false));
});

test('Windows drive path hints and module identity correctly identify own frames',()=>{
  const frame={name:'run',moduleId:'APP.EXE',source:{path:'c:\\Work\\Code\\run.cpp'},line:2};
  const score=assessProjectFrames([frame],{program:'C:\\Work\\APP.EXE'})[0];
  assert.equal(score.projectControlled,true);
  assert.ok(score.reasons.some(x=>x.includes('project')));
});

test('empty and all-runtime stacks are handled conservatively',()=>{
  assert.throws(()=>selectProjectFrame([]),/empty stack/);
  const r=selectProjectFrame([runtime],{});
  assert.equal(r.selected.index,0);
  assert.equal(r.selected.projectControlled,false);
});

test('project frame selection falls back to source-backed nonruntime frame without explicit hints',()=>{
  const r=selectProjectFrame([{name:'noSymbols'}, {name:'compute',source:{path:'/random/compute.cpp'},line:2}]);
  assert.equal(r.selected.index,1);
});

test('x86 memory operand parser aliases 32-bit registers to 64-bit base, index and register values',()=>{
  const r=analyzeInstructionOperands(evidence(0,app,[{name:'ptr',type:'char*',value:'0'}],'mov eax, [ebx + ecx*4]'));
  assert.equal(r.mnemonic,'mov');
  assert.ok(r.referencedRegisters.some(x=>x.canonicalRegister==='rbx' && x.memoryRole==='base'));
  assert.ok(r.referencedRegisters.some(x=>x.canonicalRegister==='rcx' && x.memoryRole==='index'));
  assert.equal(r.likelyFaultOperand?.register,'rbx');
  assert.equal(r.likelyFaultOperand?.faultingFrame,true);
  assert.ok(r.variableBindings.some(x=>x.variable==='ptr'));
});

test('null index register is not misclassified as a null memory base',()=>{
  const e=evidence(0,app,[],'mov rax, [rbx + rcx*4]');
  e.registers=[{name:'rbx',value:'0x1000'},{name:'rcx',value:'0'}];
  const r=analyzeInstructionOperands(e);
  assert.equal(r.likelyFaultOperand,undefined);
});

test('poisoned pointer index is suspicious even without a null base',()=>{
  const e=evidence(1,app,[],'mov rax, [rbx + rcx*4]');
  e.registers=[{name:'rbx',value:'0x1000'},{name:'rcx',value:'0xdeadbeef'}];
  const r=analyzeInstructionOperands(e);
  assert.equal(r.likelyFaultOperand?.register,'rcx');
  assert.equal(r.likelyFaultOperand?.confidence,'medium');
});

test('ARM-style memory operands recognize x and w register aliases',()=>{
  const e=evidence(0,app,[],'ldr x0, [x1, w2]');
  e.registers=[{name:'x1',value:'0'},{name:'x2',value:'4'}];
  const r=analyzeInstructionOperands(e);
  assert.ok(r.referencedRegisters.some(x=>x.canonicalRegister==='x2'));
  assert.equal(r.likelyFaultOperand?.register,'x1');
});

test('AT&T memory operands identify base and index without an Intel bracket',()=>{
  const e=evidence(0,app,[],'movq (%rbx,%rcx,4), %rax');
  e.registers=[{name:'rbx',value:'0'},{name:'rcx',value:'0'}];
  const r=analyzeInstructionOperands(e);
  assert.equal(r.likelyFaultOperand?.register,'rbx');
  assert.ok(r.referencedRegisters.some(x=>x.memoryRole==='index'));
});

test('no instruction or invalid disassembly does not fabricate faulty operands',()=>{
  const e={index:0,frame:app,locals:[],registers:[],disassembly:[]};
  const r=analyzeInstructionOperands(e);
  assert.deepEqual(r.referencedRegisters,[]);
  assert.deepEqual(r.variableBindings,[]);
  assert.equal(r.likelyFaultOperand,undefined);
});

test('nearest instruction selection tolerates missing exact instruction IP',()=>{
  const f={...app,instructionPointerReference:'0x1005'};
  const e={index:0,frame:f,locals:[],registers:[],disassembly:[{address:'0x1000',instruction:'nop'},{address:'0x1004',instruction:'mov eax, ebx'}]};
  assert.equal(analyzeInstructionOperands(e).instruction.address,'0x1004');
});

test('distinctive values shared through bounded project frames become provenance evidence',()=>{
  const frames=[app,caller];
  const selection=selectProjectFrame(frames,{projectRoots:['/project']});
  const ev=[evidence(0,app,[{name:'ownerPtr',type:'Widget*',value:'0x1234'}]),
    evidence(1,caller,[{name:'argument',type:'Widget*',value:'0x1234'}])];
  const chain=analyzeCallChain(selection,ev);
  assert.equal(chain.firstProjectFrame.function,'handlePacket');
  assert.equal(chain.provenance[0]?.frames.length,2);
  assert.ok(chain.projectCallerFrames.some(f=>f.function==='dispatch'));
});

test('repeated function frames identify recursion without implying a proven cause',()=>{
  const f={name:'recurse',source:{path:'/project/src/recurse.cpp'},line:1};
  const stack=[f,f,f,f];
  const selection=selectProjectFrame(stack,{projectRoots:['/project']});
  const chain=analyzeCallChain(selection,[]);
  assert.equal(chain.repeatedFunctions[0].count,4);
  assert.equal(chain.rootCauseCandidate.frame.function,'recurse');
});

test('verification comparison only claims fixed after clean exit',()=>{
  const d=diagnosis();
  const b=createVerificationBaseline(d);
  const fixed=compareVerificationBaseline(b,undefined,{event:'exited',exitCode:0});
  assert.equal(fixed.verdict,'fixed');
  assert.equal(fixed.confidence,'high');
  assert.equal(compareVerificationBaseline(b,undefined,{event:'exited',exitCode:1}).verdict,'inconclusive');
  assert.equal(compareVerificationBaseline(b,undefined,{event:'terminated'}).verdict,'inconclusive');
});

test('verification does not treat a breakpoint or entry stop as proof of a fix',()=>{
  const d=diagnosis();
  const result=compareVerificationBaseline(d.verificationBaseline,{classification:{category:'breakpoint',crashLikely:false}});
  assert.equal(result.verdict,'inconclusive');
});

test('reproduced crash signature is not fixed; changed function is a new failure',()=>{
  const d=diagnosis();
  const b=d.verificationBaseline;
  const repeated=compareVerificationBaseline(b,d);
  assert.equal(repeated.verdict,'not-fixed');
  const changed=structuredClone(d);
  changed.projectFrame.function='different';
  const verdict=compareVerificationBaseline(b,changed);
  assert.equal(verdict.verdict,'changed-failure');
});

test('full diagnosis retains frame selection, operand explanation and verification baseline',()=>{
  const d=diagnosis();
  assert.equal(d.projectFrame.index,0);
  assert.equal(d.projectFrame.function,'handlePacket');
  assert.equal(d.verificationBaseline.projectFunction,d.projectFrame.function);
  assert.ok(d.fixWorkflow);
  assert.ok(d.callChain.rootCauseCandidate);
});
