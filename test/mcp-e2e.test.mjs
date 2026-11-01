import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';

const serverPath=fileURLToPath(new URL('../src/index.js',import.meta.url));

function launchServer(env={}) {
    const child=spawn(process.execPath,[serverPath],{stdio:['pipe','pipe','pipe'],env:{
        ...process.env,QWEN_DAP_MCP_PROFILE:'inspect',QWEN_DAP_MCP_HOL_GUARD:'0',QWEN_DAP_MCP_TOOLSET:'agent',...env
    },windowsHide:true});
    const pending=new Map();
    const diagnostics=[];
    let nextId=1;
    const rl=createInterface({input:child.stdout,crlfDelay:Infinity});
    rl.on('line',line=>{
        let msg;
        try{msg=JSON.parse(line);}catch(error){diagnostics.push('invalid stdout: '+line.slice(0,300));return;}
        if(msg.id===undefined)return;
        const entry=pending.get(msg.id);
        if(!entry){diagnostics.push('unexpected id '+msg.id);return;}
        pending.delete(msg.id);
        clearTimeout(entry.timer);
        if(msg.error)entry.reject(new Error(JSON.stringify(msg.error)));
        else entry.resolve(msg.result);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data',chunk=>diagnostics.push(chunk.slice(0,1000)));
    child.on('exit',(code,signal)=>{
        for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(new Error('MCP child exited: '+code+'/'+signal));}
        pending.clear();
    });
    const send=(method,params,timeout=15000)=>{
        const id=nextId++;
        return new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP timeout '+method+': '+diagnostics.join('').slice(-1000)));},timeout);
            pending.set(id,{resolve,reject,timer});
            child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
        });
    };
    const notify=(method,params={})=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\n');
    const close=async()=>{
        for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(new Error('MCP client closing'));}
        pending.clear();
        rl.close();child.stdin.end();child.kill();
        if(child.exitCode===null&&child.signalCode===null){
            await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);
        }
        if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
    };
    return {child,send,notify,close,diagnostics};
}
async function handshake(client) {
    const result=await client.send('initialize',{
        protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'qwen-dap-test',version:'0.19.0'}
    });
    assert.equal(result.serverInfo?.name,'qwen-dap-mcp');
    assert.equal(typeof result.serverInfo?.version,'string');
    client.notify('notifications/initialized');
}

test('real MCP stdio: handshake, listing, read status and isolated sessions',{timeout:60000},async()=>{
    const client=launchServer();
    try{
        await handshake(client);
        const listed=await client.send('tools/list',{});
        const names=listed.tools.map(t=>t.name);
        assert.ok(names.includes('debug_sessions'));
        assert.ok(names.includes('debug_status'));
        assert.ok(!names.includes('debug_evaluate'),'Read-oriented agent toolset must exclude raw evaluate');
        const status=await client.send('tools/call',{name:'debug_status',arguments:{}});
        assert.ok(!status.isError, 'Status tool must succeed');
        const a=await Promise.all([
            client.send('tools/call',{name:'debug_sessions',arguments:{action:'create',sessionId:'mcp-a'}}),
            client.send('tools/call',{name:'debug_sessions',arguments:{action:'create',sessionId:'mcp-b'}})
        ]);
        for(const item of a)assert.ok(!item.isError,'Session creation failed '+JSON.stringify(item));
        const list=await client.send('tools/call',{name:'debug_sessions',arguments:{action:'list'}});
        const text=JSON.stringify(list);
        assert.match(text,/mcp-a/);
        assert.match(text,/mcp-b/);
        const statusPair=await Promise.all([
            client.send('tools/call',{name:'debug_status',arguments:{sessionId:'mcp-a'}}),
            client.send('tools/call',{name:'debug_status',arguments:{sessionId:'mcp-b'}})
        ]);
        for(const item of statusPair)assert.ok(!item.isError);
        const close=await Promise.all([
            client.send('tools/call',{name:'debug_sessions',arguments:{action:'close',sessionId:'mcp-a'}}),
            client.send('tools/call',{name:'debug_sessions',arguments:{action:'close',sessionId:'mcp-b'}})
        ]);
        for(const item of close)assert.ok(!item.isError);
    }finally{await client.close();}
});

test('MCP inspect profile rejects raw debugger mutations even in full toolset',{timeout:30000},async()=>{
    const client=launchServer({QWEN_DAP_MCP_TOOLSET:'full'});
    try{
        await handshake(client);
        const listed=await client.send('tools/list',{});
        assert.ok(listed.tools.some(t=>t.name==='debug_launch'));
        assert.ok(listed.tools.some(t=>t.name==='debug_status'));
        // A call without initializing an adapter fails closed before executing anything.
        const launch=await client.send('tools/call',{name:'debug_launch',arguments:{configuration:{program:'/no-such-program'}}});
        assert.equal(launch.isError,true);
        const after=await client.send('tools/call',{name:'debug_status',arguments:{}});
        assert.ok(!after.isError);
    }finally{await client.close();}
});
