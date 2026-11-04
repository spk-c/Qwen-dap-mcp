// Opt-in, paid model-driven MCP E2E. Never run in ordinary CI.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {eventsFrom, verifiedClaudeInvocation, verifiedCodexInvocation} from './mcp-e2e-trace.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = join(root, 'dist', 'index.js');
const serverName = 'qwen-dap-mcp';
const prompt = 'Call the qwen-dap-mcp debug_status MCP tool exactly once with empty arguments. Do not use Bash, shell, file edits, or any other tools. Summarize the returned status briefly. Do not claim success without calling the tool.';

function runCli(binary, args, env, timeoutMs = 150000, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {cwd, env, shell: false, windowsHide: true, stdio: ['ignore','pipe','pipe']});
    let stdout = '';
    let stderr = '';
    let exceeded = false;
    let expired = false;
    const timer = setTimeout(() => {expired = true; child.kill('SIGKILL');}, timeoutMs);
    const collect = (kind, text) => {
      const combined = kind === 'stdout' ? stdout + text : stderr + text;
      if (combined.length > 2_000_000) {
        exceeded = true;
        child.kill('SIGKILL');
      } else if (kind === 'stdout') stdout = combined;
      else stderr = combined;
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => collect('stdout', chunk));
    child.stderr.on('data', chunk => collect('stderr', chunk));
    child.once('error', error => {clearTimeout(timer); reject(error);});
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (expired) reject(new Error(binary + ' exceeded its 150s timeout'));
      else if (exceeded) reject(new Error(binary + ' output exceeded 2 MB'));
      else if (code !== 0) reject(new Error(binary + ' exited with ' + String(code) + '/' + String(signal) + ' (output intentionally not printed)'));
      else resolve(stdout);
    });
  });
}

async function runClaude(temp, env) {
  const config = join(temp, 'claude-mcp.json');
  await writeFile(config, JSON.stringify({mcpServers: {
    [serverName]: {type: 'stdio', command: process.execPath, args: [server]},
  }}));
  const output = await runCli('claude', [
    '-p', '--mcp-config', config, '--strict-mcp-config',
    '--allowedTools', 'mcp__qwen-dap-mcp__debug_status',
    '--tools', '', // Disable built-in Claude tools; --tools does not select MCP tools.
    '--max-turns', '3', '--max-budget-usd', '0.10',
    '--output-format', 'stream-json', '--verbose', prompt,
  ], {...env, CLAUDE_CONFIG_DIR: join(temp, 'claude-home')}, 150000, temp);
  assert.ok(verifiedClaudeInvocation(eventsFrom(output)),
    'Claude did not produce a successful structured MCP debug_status tool result');
}

async function runCodex(temp, env) {
  const codexHome = join(temp, 'codex-home');
  await mkdir(codexHome, {recursive: true});
  const isolated = {...env, CODEX_HOME: codexHome};
  await runCli('codex', ['mcp', 'add', serverName, '--', process.execPath, server], isolated, 20000, temp);
  const output = await runCli('codex', [
    'exec', '--json', '--ephemeral', '--sandbox', 'read-only',
    '--skip-git-repo-check', prompt,
  ], isolated, 150000, temp);
  assert.ok(verifiedCodexInvocation(eventsFrom(output)),
    'Codex did not produce a successful structured MCP debug_status tool completion');
}

async function main() {
  assert.equal(process.env.QWEN_PAID_E2E_APPROVAL, 'APPROVE_PAID_MCP_E2E',
    'Paid model E2E requires explicit workflow_dispatch approval');
  const choice = process.env.QWEN_PAID_E2E_CLIENT;
  assert.ok(['claude', 'codex', 'both'].includes(choice), 'Choose claude, codex, or both');
  if (choice !== 'codex') assert.ok(process.env.ANTHROPIC_API_KEY,
    'ANTHROPIC_API_KEY is required for authenticated Claude E2E');
  if (choice !== 'claude') assert.ok(process.env.OPENAI_API_KEY,
    'OPENAI_API_KEY is required for authenticated Codex E2E');
  const temp = await mkdtemp(join(tmpdir(), 'qwen-paid-e2e-'));
  try {
    const env = {...process.env,
      QWEN_DAP_MCP_PROFILE: 'inspect', QWEN_DAP_MCP_TOOLSET: 'agent',
      DISABLE_TELEMETRY: '1', CI: '1',
    };
    if (choice !== 'codex') {
      await runClaude(temp, env);
      process.stdout.write('Claude Code: authenticated MCP tool invocation verified\n');
    }
    if (choice !== 'claude') {
      await runCodex(temp, env);
      process.stdout.write('Codex: authenticated MCP tool invocation verified\n');
    }
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Never print CLI transcripts, prompts, keys or model-generated output in CI.
    process.stderr.write('Authenticated MCP E2E failed: ' + error.message + '\n');
    process.exitCode = 1;
  });
}
