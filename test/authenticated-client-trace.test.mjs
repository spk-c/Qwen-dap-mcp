import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifiedClaudeInvocation, verifiedCodexInvocation} from '../integration/mcp-e2e-trace.mjs';

test('authenticated E2E trace verifier rejects model text without an MCP tool call', () => {
  assert.equal(verifiedClaudeInvocation([{type:'assistant',message:{content:[{type:'text',text:'I used debug_status'}]}}]), false);
  assert.equal(verifiedCodexInvocation([{type:'item.completed',item:{type:'agent_message',text:'MCP debug_status OK'}}]), false);
});

test('Claude requires matching structured tool invocation and successful tool result', () => {
  const invocation = {type:'assistant',message:{content:[{type:'tool_use',id:'tool-123',name:'mcp__qwen-dap-mcp__debug_status'}]}};
  assert.equal(verifiedClaudeInvocation([invocation]), false);
  assert.equal(verifiedClaudeInvocation([invocation,{type:'user',message:{content:[{type:'tool_result',tool_use_id:'other',content:'ok'}]}}]), false);
  assert.equal(verifiedClaudeInvocation([invocation,{type:'user',message:{content:[{type:'tool_result',tool_use_id:'tool-123',is_error:true}]}}]), false);
  assert.equal(verifiedClaudeInvocation([invocation,{type:'user',message:{content:[{type:'tool_result',tool_use_id:'tool-123',content:'status ok'}]}}]), true);
});

test('Codex requires a completed, error-free MCP tool call, not a started event', () => {
  const item = {type:'mcp_tool_call',server:'qwen-dap-mcp',tool:'debug_status'};
  assert.equal(verifiedCodexInvocation([{type:'item.started',item}]), false);
  assert.equal(verifiedCodexInvocation([{type:'item.completed',item:{...item,error:'failure'}}]), false);
  assert.equal(verifiedCodexInvocation([{type:'item.completed',item}]), true);
});
