// No network requests, credentials, model inference or MCP launches.
// Check CLI versions installed in CI can parse flags used by the gated paid E2E.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function help(binary, args) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8', shell: false, windowsHide: true,
    timeout: 15_000, maxBuffer: 1024 * 1024,
    env: {...process.env, CI: '1', DISABLE_TELEMETRY: '1'},
  });
  if (result.error || result.status !== 0) {
    throw new Error(binary + ' ' + args.join(' ') + ' help is unavailable');
  }
  return (result.stdout ?? '') + '\n' + (result.stderr ?? '');
}

function verifyHelp(name, output, expected) {
  for (const flag of expected) {
    assert.ok(output.includes(flag), name + ' is missing required CLI option ' + flag);
  }
  process.stdout.write(name + ': command line E2E options supported (no inference)\n');
}

verifyHelp('Claude Code', help('claude', ['--help']), [
  '--mcp-config', '--strict-mcp-config', '--allowedTools', '--tools',
  '--output-format', '--verbose',
]);
verifyHelp('Codex', help('codex', ['exec', '--help']), [
  '--json', '--ephemeral', '--sandbox', '--skip-git-repo-check',
]);

// Some print-mode-only Claude switches are documented but not listed in this
// pinned CLI's general --help output. They cannot be conclusively tested
// without initiating a paid -p run, which ordinary CI must never do.
process.stdout.write('Claude print-mode --max-turns/--max-budget-usd: live verification remains opt-in only\n');
