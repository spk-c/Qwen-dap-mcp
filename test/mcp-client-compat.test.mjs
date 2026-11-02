import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageName = '@slp-dev1/qwen-dap-mcp';
const example = (name) => readFileSync(join(root, 'examples', 'clients', name), 'utf8');

function checkStdio(value) {
  assert.equal(value.command, 'npx');
  assert.deepEqual(value.args, ['-y', packageName]);
  assert.ok(!value.url && !value.httpUrl, 'This server does not expose a remote HTTP endpoint');
  assert.ok(!value.env || !Object.values(value.env).some(v => /github_pat_|sk-[a-z0-9]/i.test(String(v))), 'Do not commit tokens to examples');
}

test('Claude Code project MCP example uses the documented stdio structure', () => {
  const config = JSON.parse(example('claude-code.mcp.json'));
  assert.deepEqual(Object.keys(config), ['mcpServers']);
  assert.equal(config.mcpServers['qwen-dap-mcp'].type, 'stdio');
  checkStdio(config.mcpServers['qwen-dap-mcp']);
});

test('Codex config.toml contains the stdio command/args pair', () => {
  const toml = example('codex.config.toml');
  assert.match(toml, /^\[mcp_servers\.qwen-dap-mcp\]$/m);
  assert.match(toml, /^command\s*=\s*"npx"$/m);
  assert.match(toml, /^args\s*=\s*\["-y",\s*"@slp-dev1\/qwen-dap-mcp"\]$/m);
  assert.doesNotMatch(toml, /\burl\s*=/);
});

test('Gemini CLI, Cursor and VS Code Copilot examples use their own config formats', () => {
  for (const name of ['gemini.settings.json', 'cursor.mcp.json']) {
    const config = JSON.parse(example(name));
    assert.deepEqual(Object.keys(config), ['mcpServers']);
    checkStdio(config.mcpServers['qwen-dap-mcp']);
  }
  const vscode = JSON.parse(example('vscode.mcp.json'));
  assert.deepEqual(Object.keys(vscode), ['servers']);
  assert.equal(vscode.servers['qwen-dap-mcp'].type, 'stdio');
  checkStdio(vscode.servers['qwen-dap-mcp']);
});

async function smokeInitializeAndList(clientName) {
  const child = spawn(process.execPath, [join(root, 'dist', 'index.js')], {
    cwd: root,
    env: { ...process.env, QWEN_DAP_MCP_TOOLSET: 'agent' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  let buffer = '';
  const waiting = new Map();
  let stopped = false;
  const failPending = (reason) => {
    for (const { reject } of waiting.values()) reject(reason);
    waiting.clear();
  };
  child.on('error', failPending);
  child.on('exit', (code, signal) => {
    stopped = true;
    failPending(new Error('MCP subprocess stopped before responding: ' + code + '/' + signal + ' ' + stderr.slice(-800)));
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 2_000_000) {
      failPending(new Error('Unexpectedly large MCP response'));
      child.kill();
      return;
    }
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch {
        failPending(new Error('Non-JSON output on MCP stdout: ' + line.slice(0, 150)));
        child.kill();
        return;
      }
      if (!Object.hasOwn(message, 'id')) continue;
      const pending = waiting.get(message.id);
      if (!pending) continue;
      waiting.delete(message.id);
      if (message.error) pending.reject(new Error('MCP error: ' + JSON.stringify(message.error)));
      else pending.resolve(message.result);
    }
  });
  let requestId = 0;
  const send = (method, params = {}) => {
    if (stopped) throw new Error('MCP subprocess already stopped');
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  };
  const timeout = setTimeout(() => {
    failPending(new Error(clientName + ' MCP handshake timed out; stderr: ' + stderr.slice(-800)));
    child.kill();
  }, 15000);
  try {
    const hello = await send('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: clientName, version: 'mcp-smoke-test' },
    });
    assert.equal(hello.serverInfo.name, 'qwen-dap-mcp');
    assert.ok(hello.capabilities.tools, 'Server must advertise MCP tools');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const tools = await send('tools/list');
    const names = tools.tools?.map(tool => tool.name) ?? [];
    assert.ok(names.length >= 10, 'Expected at least ten core debugger tools');
    assert.ok(names.includes('debug_status'));
    assert.ok(names.includes('debug_this_crash'));
    assert.ok(names.includes('debug_sessions'));
  } finally {
    clearTimeout(timeout);
    failPending(new Error('MCP smoke test closed'));
    if (!stopped) child.kill();
  }
}

for (const client of ['claude-code', 'codex-cli', 'gemini-cli']) {
  test('MCP stdio initialize + tools/list using ' + client + ' client identity', { timeout: 20000 }, async () => {
    await smokeInitializeAndList(client);
  });
}

// These tests exercise the actual stdio MCP wire protocol, not the proprietary
// Claude/Codex/Gemini executables or native debugger adapters. They require no
// account credentials, model API calls, or user-level client configuration.
