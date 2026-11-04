# Authenticated Claude Code and Codex MCP E2E (manual and paid)

Normal CI is **credential-free**. Its CLI registration and wire-protocol checks do not prove that a cloud model actually chooses and invokes an MCP tool. The separate workflow `.github/workflows/authenticated-client-e2e.yml` addresses this gap **only after manual opt-in**.

## Safety and authorization

1. In **Settings → Environments**, configure the GitHub Actions environment `paid-ai-e2e`. Add required reviewers to enforce a second, human approval gate.
2. Store `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` as **environment secrets** for that environment, not in source files, issues, pull requests or public logs.
3. In **Actions → Authenticated Claude and Codex MCP E2E (manual, paid) → Run workflow**, select `claude`, `codex` or `both` and explicitly type `APPROVE_PAID_MCP_E2E`. Launch only when paid inference is approved.

The workflow never runs on push or pull_request. It starts from a clean checked-out repository with pinned CLI versions and uses isolated client configuration directories. The server uses `QWEN_DAP_MCP_PROFILE=inspect` and the restricted `agent` toolset, so it cannot launch or attach to a debuggee. Both clients are asked to invoke only the read-only `debug_status` MCP tool. Claude has a CLI-level `$0.10` maximum budget and three-turn limit; Codex has a single short prompt and a strict process timeout, but **its actual API charges are determined by the provider**.

## What proves success

The runner parses structured Claude Code `stream-json` or Codex `--json` events and checks for a real `qwen-dap-mcp/debug_status` call and a successful tool result. Model-generated prose saying that a tool was invoked does **not** count as evidence. The log prints only a brief pass/fail result; raw model transcripts and secrets are not uploaded.

The fixture-less operation does not prove a native GDB/LLDB debug session. Native adapter E2E remains in the dedicated debugger workflows; the `adapter-failure-stress` suite covers actual controlled adapter subprocess crashes, timeouts, degraded responses, malformed frames, and high request concurrency without an external debuggee.

Run the **offline** trace verifier without API credentials using:

```bash
node --test test/authenticated-client-trace.test.mjs
```

This workflow has **not** been executed with paid credentials merely by adding it to the repository. The issue should record a real approved workflow URL before marking authenticated provider E2E as complete.
