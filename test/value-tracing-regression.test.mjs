import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { findObservedValue,traceValue,registerValueTracingTool } from '../src/tools/value-tracing.js';

function mockSession(outcomes=['data breakpoint']) {
 const connection=new EventEmitter();
 let value=0,continueCount=0,snapshotCount=0;
 const prior=[{dataId:'previous-watch',accessType:'write'}];
 let active=prior;
 const snapshots=[];
 return {
   connection,
   isPostmortem(){return false;},
   async runExclusiveLifecycle(_name,fn){return fn();},
   snapshot(){return {adapterId:'lldb',capabilities:{supportsDataBreakpoints:true},continueCount};},
   async runtimeSnapshot(opts){
     snapshotCount++;
     snapshots.push(opts);
     return {
       thread:{id:7,name:'worker'},
       frame:{id:3,name:'mutate',source:{path:'/project/worker.cpp'},line:12,instructionPointerReference:'0x1010'},
       locals:[{name:'count',evaluateName:'this->count',type:'int',value:String(value)}],
       registers:[],disassembly:[{address:'0x1010',instruction:'mov [rax], rbx'}]
     };
   },
   async dataBreakpointInfo(){return {dataId:'count-watch',accessTypes:['write']};},
   dataBreakpointConfiguration(){return active;},
   async setDataBreakpoints(items){active=items;return {breakpoints:items.map(()=>({verified:true}))};},
   async continueExecution(){
      const outcome=outcomes[continueCount++]??'data breakpoint';
      value++;
      queueMicrotask(()=>{
        if(outcome==='exit') connection.emit('event',{event:'exited',body:{exitCode:0}});
        else if(outcome==='adapterExit') connection.emit('adapterExit');
        else connection.emit('event',{event:'stopped',body:{reason:outcome,threadId:7}});
      });
   },
   async pause(){},
   get tests(){return {snapshotCount,continueCount,active,snapshots};}
 };
}

test('exact observed variable matching normalizes this-> and dereference prefix',()=>{
 const snapshot={locals:[{name:'count',evaluateName:'this->count',value:'12',type:'int'}],registers:[{name:'rax',value:'0xff'}]};
 assert.equal(findObservedValue(snapshot,'*count').value,'12');
 assert.equal(findObservedValue(snapshot,'this->count').value,'12');
 assert.equal(findObservedValue(snapshot,'rax').value,'0xff');
 assert.equal(findObservedValue(snapshot,'counter'),undefined);
});

test('live value timeline observes confirmed writes and restores preexisting data breakpoints',async()=>{
 const session=mockSession(['data breakpoint','data breakpoint']);
 const result=await traceValue(session,{name:'count',maxStops:2,timeoutMs:6000,perStopTimeoutMs:2000});
 assert.equal(result.stopReason,'max-stops');
 assert.equal(result.events.length,2);
 assert.equal(result.events[0].hitConfirmed,true);
 assert.equal(result.events[0].valueChanged,true);
 assert.equal(result.events[0].beforeValue.value,'0');
 assert.equal(result.events[0].afterValue.value,'1');
 assert.equal(result.events[1].afterValue.value,'2');
 assert.deepEqual(session.tests.active,[{dataId:'previous-watch',accessType:'write'}]);
 assert.equal(session.tests.continueCount,2);
});

test('unexpected debugger stop terminates tracing rather than silently continuing',async()=>{
 const s=mockSession(['breakpoint','data breakpoint']);
 const result=await traceValue(s,{name:'count',maxStops:8,timeoutMs:6000});
 assert.equal(result.stopReason,'unrelated-stop');
 assert.equal(result.events.length,1);
 assert.equal(result.events[0].hitConfirmed,false);
 assert.equal(s.tests.continueCount,1);
 assert.equal(s.tests.active.length,1);
});

test('a target exit ends the trace without claiming a writer frame',async()=>{
 const s=mockSession(['exit']);
 const result=await traceValue(s,{name:'count',maxStops:4,timeoutMs:6000});
 assert.equal(result.stopReason,'target-exited');
 assert.equal(result.events.length,1);
 assert.equal(result.events[0].hitConfirmed,false);
 assert.equal(result.events[0].afterValue,undefined);
 assert.equal(s.tests.active.length,1);
});

test('adapter exit during resumed watch results in a bounded error and cleanup',async()=>{
 const s=mockSession(['adapterExit']);
 const result=await traceValue(s,{name:'count',maxStops:3,timeoutMs:6000});
 assert.equal(result.stopReason,'error');
 assert.match(result.terminalError,/adapter exited/);
 assert.equal(result.events.length,0);
 assert.deepEqual(s.tests.active,[{dataId:'previous-watch',accessType:'write'}]);
});

test('postmortem sessions cannot generate fabricated write timelines',async()=>{
 const s=mockSession();
 s.isPostmortem=()=>true;
 await assert.rejects(()=>traceValue(s,{name:'count'}),/requires a live stopped target/);
 assert.equal(s.tests.continueCount,0);
});

test('value-tracing tool schema rejects unsafe and unbounded requests',()=>{
 let registered;
 const server={registerTool(name,meta,handler){registered={name,meta,handler};}};
 const s=mockSession();
 registerValueTracingTool(server,s);
 assert.equal(registered.name,'debug_trace_value');
 assert.equal(registered.meta.inputSchema.safeParse({name:'count',maxStops:2,timeoutMs:1000}).success,true);
 assert.equal(registered.meta.inputSchema.safeParse({name:'',maxStops:2}).success,false);
 assert.equal(registered.meta.inputSchema.safeParse({name:'count',maxStops:17}).success,false);
 assert.equal(registered.meta.inputSchema.safeParse({name:'count',timeoutMs:999}).success,false);
 assert.equal(registered.meta.inputSchema.safeParse({name:'count',perStopTimeoutMs:30001}).success,false);
});

test('registered tool reports postmortem errors as structured MCP error results',async()=>{
 let handler;
 const server={registerTool(_name,_meta,fn){handler=fn;}};
 const s=mockSession();
 s.isPostmortem=()=>true;
 registerValueTracingTool(server,s);
 const r=await handler({name:'count',maxStops:1});
 assert.equal(r.isError,true);
 assert.match(r.content[0].text,/requires a live stopped target/);
});
