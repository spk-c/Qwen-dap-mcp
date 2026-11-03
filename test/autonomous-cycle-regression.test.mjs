import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 baselineFingerprint, validateAutonomousAgentState, evidenceReady,
 buildRootCauseBacktrack, verificationQuality, startAutonomousCycle,
 refreshAutonomousEvidence, advanceAutonomousCycle
} from '../src/diagnostics/autonomous-cycle.js';

function makeDiagnosis(options={}) {
 const sourcePath=options.sourcePath===undefined?'/project/main.cpp':options.sourcePath;
 const baseline={
   classification:'access-violation',crashLikely:true,faultFunction:'main',
   projectFunction:'main',...(sourcePath?{projectSourcePath:sourcePath}:{}),
   projectLine:10,hypothesisKinds:['invalid-lifetime','null-pointer'],
   suspiciousNames:['this','owner']
 };
 const projectFrame={index:0,function:'main',sourcePath:sourcePath??undefined,line:10,confidence:options.confidence??'high'};
 const frame={index:0,function:'main',line:10,projectControlled:true,...(sourcePath?{sourcePath}:{})};
 const diagnosis={
   verificationBaseline:{...baseline,...(options.baseline??{})},
   classification:{category:'access-violation',crashLikely:options.crashLikely??true},
   projectFrame,
   hypotheses:options.hypotheses??[{kind:'invalid-lifetime',confidence:'high'}],
   summary:'Access violation at main',
   operandAnalysis:{likelyFaultOperand:{register:'rax',value:'0x001234'},variableBindings:[{register:'rax',variable:'owner',variableType:'Obj*',variableValue:'0x1234'}],rawInstruction:'mov rax, [rbx]'},
   callChain:{rootCauseCandidate:{confidence:options.rootConfidence??'medium',frame},
     frames:[frame,{index:1,function:'factory',line:25,sourcePath:'/project/factory.cpp',projectControlled:true}],
     provenance:[{value:'0x1234',confidence:'medium',frames:[{index:0,function:'main',variables:['owner']},{index:1,function:'factory',variables:['obj']}]}]},
   fixWorkflow:{suggestedChanges:['inspect object lifetime','use owner validation']},
 };
 return diagnosis;
}
const verdict=(name, confidence='high')=>({verdict:name,confidence,evidence:['controlled repro observed']});

test('fingerprints normalize Windows source paths and canonicalize hypothesis ordering',()=>{
 const d=makeDiagnosis();
 const b=d.verificationBaseline;
 const f=baselineFingerprint(b);
 assert.match(f,/^[0-9a-f]{16}$/);
 assert.equal(f,baselineFingerprint({...b,hypothesisKinds:[...b.hypothesisKinds].reverse(),suspiciousNames:[...b.suspiciousNames].reverse()}));
 assert.notEqual(f,baselineFingerprint({...b,projectLine:11}));
 assert.equal(baselineFingerprint({...b,projectSourcePath:'C:\\Work\\Test.cpp'}),
   baselineFingerprint({...b,projectSourcePath:'c:/work/test.cpp'}));
});

test('autonomous evidence gate requires actual crash, project source and causal evidence',()=>{
 const d=makeDiagnosis();
 assert.equal(evidenceReady(d),true);
 assert.equal(evidenceReady(makeDiagnosis({crashLikely:false})),false);
 assert.equal(evidenceReady(makeDiagnosis({sourcePath:null})),false);
 assert.equal(evidenceReady(makeDiagnosis({confidence:'low'})),false);
 assert.equal(evidenceReady(makeDiagnosis({hypotheses:[],rootConfidence:'low'})),false);
 assert.equal(evidenceReady(makeDiagnosis({hypotheses:[],rootConfidence:'high'})),true);
});

test('backtrack distinguishes runtime matching pointer trail from source-proven assignments',()=>{
 const d=makeDiagnosis();
 const r=buildRootCauseBacktrack(d);
 assert.equal(r.confidence,'medium');
 assert.equal(r.runtimeTrail.length,2);
 assert.equal(r.runtimeTrail[0].role,'consumer');
 assert.equal(r.runtimeTrail[1].role,'producer-candidate');
 assert.ok(r.producerCandidates.some(x=>x.function==='factory'));
 assert.match(r.limitation,/runtime provenance/i);
});

test('backtrack remains conservative without any matching register, local or trail',()=>{
 const d=makeDiagnosis();
 d.operandAnalysis={variableBindings:[]};
 d.callChain.provenance=[];
 const r=buildRootCauseBacktrack(d);
 assert.equal(r.confidence,'low');
 assert.deepEqual(r.runtimeTrail,[]);
 assert.ok(r.producerCandidates.length>0);
});

test('verification scores reflect verdict confidence but not external build/test proof',()=>{
 const fixed=verificationQuality(verdict('fixed','high'));
 assert.equal(fixed.grade,'strong');
 assert.equal(fixed.checks.rootCrash,'gone');
 assert.equal(fixed.checks.build,'external-unverified');
 const fail=verificationQuality(verdict('not-fixed'));
 assert.equal(fail.checks.rootCrash,'reproduced');
 const changed=verificationQuality(verdict('changed-failure'));
 assert.equal(changed.checks.newCrash,'present');
 const unresolved=verificationQuality(verdict('inconclusive','low'));
 assert.equal(unresolved.grade,'weak');
});

test('autonomous state validates fingerprints, iteration and history boundaries',()=>{
 const state=startAutonomousCycle(makeDiagnosis(),2).state;
 assert.doesNotThrow(()=>validateAutonomousAgentState(state));
 assert.throws(()=>validateAutonomousAgentState({...state,schemaVersion:2}),/schema/);
 assert.throws(()=>validateAutonomousAgentState({...state,maxIterations:0}),/maxIterations/);
 assert.throws(()=>validateAutonomousAgentState({...state,iteration:3}),/iteration/);
 assert.throws(()=>validateAutonomousAgentState({...state,rootFingerprint:'spoofed'}),/fingerprint mismatch/);
 assert.throws(()=>validateAutonomousAgentState({...state,activeFingerprint:'spoofed'}),/fingerprint mismatch/);
 assert.throws(()=>validateAutonomousAgentState({...state,history:Array(25).fill({iteration:0})}),/history length/);
 assert.throws(()=>validateAutonomousAgentState({...state,history:[{iteration:5}]}),/impossible iteration/);
});

test('cycle startup bounds iteration budget and builds a source-first fix pipeline',()=>{
 const start=startAutonomousCycle(makeDiagnosis(),999);
 assert.equal(start.state.maxIterations,10);
 assert.equal(start.state.iteration,1);
 assert.equal(start.state.status,'needs-fix');
 assert.equal(start.shouldContinue,true);
 const actions=start.nextActions;
 assert.ok(actions.find(x=>x.type==='inspect-source'));
 assert.ok(actions.find(x=>x.type==='propose-fix'));
 assert.ok(actions.find(x=>x.type==='apply-fix'));
 assert.ok(actions.find(x=>x.type==='build'));
 assert.ok(actions.find(x=>x.type==='reproduce'));
 assert.ok(actions.find(x=>x.type==='verify'));
 assert.equal(startAutonomousCycle(makeDiagnosis(),0).state.maxIterations,1);
 assert.equal(startAutonomousCycle(makeDiagnosis(),NaN).state.maxIterations,3);
});

test('insufficient causal evidence suspends source edits and requests better data',()=>{
 const d=makeDiagnosis({sourcePath:null});
 const start=startAutonomousCycle(d,2);
 assert.equal(start.state.status,'needs-evidence');
 assert.deepEqual(start.nextActions.map(x=>x.type),['collect-evidence']);
 assert.equal(start.nextActions[0].owner,'debugger');
});

test('evidence refresh can unlock fix planning without consuming a fix iteration',()=>{
 const started=startAutonomousCycle(makeDiagnosis({hypotheses:[],rootConfidence:'low'}),3);
 assert.equal(started.state.status,'needs-evidence');
 const refreshed=refreshAutonomousEvidence(started.state,makeDiagnosis());
 assert.equal(refreshed.state.iteration,1);
 assert.equal(refreshed.state.status,'needs-fix');
 assert.ok(refreshed.state.history.length>started.state.history.length);
 assert.ok(refreshed.nextActions.some(x=>x.type==='inspect-source'));
 assert.throws(()=>refreshAutonomousEvidence(refreshed.state,makeDiagnosis()),/requires status/);
});

test('evidence refresh stays in safe collection mode when no new evidence arrived',()=>{
 const weak=makeDiagnosis({hypotheses:[],rootConfidence:'low'});
 const started=startAutonomousCycle(weak,3);
 const again=refreshAutonomousEvidence(started.state,weak);
 assert.equal(again.state.status,'needs-evidence');
 assert.deepEqual(again.nextActions.map(x=>x.type),['collect-evidence']);
});

test('clean reproduction marks cycle fixed and forbids further autonomous edits',()=>{
 const start=startAutonomousCycle(makeDiagnosis(),3);
 const after=advanceAutonomousCycle(start.state,verdict('fixed'),undefined);
 assert.equal(after.state.status,'fixed');
 assert.equal(after.shouldContinue,false);
 assert.equal(after.verificationQuality.grade,'strong');
 assert.deepEqual(after.nextActions.map(x=>x.type),['stop-and-report']);
 assert.throws(()=>advanceAutonomousCycle(after.state,verdict('not-fixed'),makeDiagnosis()),/terminal/);
});

test('inconclusive reproduction does not consume an edit iteration',()=>{
 const start=startAutonomousCycle(makeDiagnosis(),3);
 const again=advanceAutonomousCycle(start.state,verdict('inconclusive','low'));
 assert.equal(again.state.status,'needs-reproduction');
 assert.equal(again.state.iteration,start.state.iteration);
 assert.deepEqual(again.nextActions.map(x=>x.type),['reproduce','verify']);
 assert.equal(again.shouldContinue,true);
});

test('repeated crash without stopped-state diagnosis blocks unsafe blind edits',()=>{
 const start=startAutonomousCycle(makeDiagnosis(),3);
 const after=advanceAutonomousCycle(start.state,verdict('not-fixed'),undefined);
 assert.equal(after.state.status,'blocked');
 assert.equal(after.shouldContinue,false);
 assert.ok(after.stopReason.includes('no stopped-state diagnosis'));
});

test('failed verification consumes bounded budget, then stops',()=>{
 const d=makeDiagnosis();
 const start=startAutonomousCycle(d,1);
 const after=advanceAutonomousCycle(start.state,verdict('not-fixed'),d);
 assert.equal(after.state.status,'budget-exhausted');
 assert.equal(after.shouldContinue,false);
 assert.equal(after.nextActions[0].type,'stop-and-report');
});

test('same crash re-analysis advances iteration and retains root fingerprint',()=>{
 const d=makeDiagnosis();
 const start=startAutonomousCycle(d,3);
 const after=advanceAutonomousCycle(start.state,verdict('not-fixed'),d);
 assert.equal(after.state.status,'retry-fix');
 assert.equal(after.state.iteration,2);
 assert.equal(after.state.rootFingerprint,start.state.rootFingerprint);
 assert.equal(after.state.activeFingerprint,start.state.activeFingerprint);
 assert.ok(after.nextActions.some(x=>x.type==='inspect-source'));
});

test('changed failure requires a trustworthy replacement diagnosis before rebasing',()=>{
 const d=makeDiagnosis();
 const start=startAutonomousCycle(d,3);
 const bad=advanceAutonomousCycle(start.state,verdict('changed-failure'),undefined);
 assert.equal(bad.state.status,'blocked');
 assert.equal(bad.shouldContinue,false);
 const different=makeDiagnosis({baseline:{projectLine:34}});
 const ok=advanceAutonomousCycle(start.state,verdict('changed-failure'),different);
 assert.equal(ok.state.status,'changed-failure');
 assert.equal(ok.state.iteration,2);
 assert.notEqual(ok.state.activeFingerprint,ok.state.rootFingerprint);
});

test('changed failure with low-quality evidence reverts to evidence collection',()=>{
 const d=makeDiagnosis();
 const start=startAutonomousCycle(d,3);
 const changed=makeDiagnosis({sourcePath:null,baseline:{projectLine:14}});
 const r=advanceAutonomousCycle(start.state,verdict('changed-failure'),changed);
 assert.equal(r.state.status,'needs-evidence');
 assert.deepEqual(r.nextActions.map(x=>x.type),['collect-evidence']);
});

test('new source edits are forbidden when state still needs evidence',()=>{
 const weak=startAutonomousCycle(makeDiagnosis({hypotheses:[],rootConfidence:'low'}),3);
 assert.throws(()=>advanceAutonomousCycle(weak.state,verdict('not-fixed'),makeDiagnosis()),/Refresh the evidence state/);
});
