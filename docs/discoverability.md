# Discover Qwen DAP MCP — local C/C++ debugging for coding agents

**Canonical maintained source:** [spk-c/Qwen-dap-mcp](https://github.com/spk-c/Qwen-dap-mcp) (Apache-2.0). This is the actively maintained fork, **not** the historical `SLP-DEV1/qwen-dap-mcp` source listing.

The same stdio MCP server can be used by **Claude Code, OpenAI Codex CLI, Qwen Code, Gemini CLI, Cursor and VS Code Copilot**, provided that the client can start a local process with Node.js 20+ and the target system has a compatible native DAP debugger. Cloud-only chat apps do not automatically reach a local Windows process.

## Official, verifiable entry points

| Surface | Canonical reference |
| --- | --- |
| Source / installation / licensing | [GitHub repository](https://github.com/spk-c/Qwen-dap-mcp) |
| Published installation package | [npm @slp-dev1/qwen-dap-mcp](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp) |
| Standard server identifier | `io.github.spk-c/qwen-dap-mcp` |
| Official MCP Registry | [Exact maintained namespace](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.spk-c%2Fqwen-dap-mcp) |
| Release tarball and checksums | [GitHub Releases](https://github.com/spk-c/Qwen-dap-mcp/releases) |
| Reproducible native crash demo | [Crash → GDB evidence → rebuild → verification](demo-native-crash.md) |
| Client-specific setup | [Claude Code](clients/claude-code.md), [Codex](clients/codex.md), [Gemini/Cursor/VS Code](clients/other-clients.md) |

Do not confuse listing discovery with live security or quality certification. Verify the **same version** on npm, `server.json` and the official registry.

## Copy-ready, accurate third-party directory listing

**Name:** Qwen DAP MCP (maintained fork: spk-c)

**Category:** Coding Agents / Developer Tools / Debugging

**Summary:** Local stdio MCP server exposing native C/C++ crash, hang, core dump and Windows minidump debugging through GDB, LLDB and CodeLLDB to Claude Code, OpenAI Codex CLI, Qwen Code and other MCP-compatible coding agents. Requires Node.js and a separately installed native DAP debugger. Repository: https://github.com/spk-c/Qwen-dap-mcp

**Install (stdio):**

```json
{
  "mcpServers": {
    "qwen-dap-mcp": {
      "command": "npx",
      "args": ["-y", "@slp-dev1/qwen-dap-mcp"]
    }
  }
}
```

**Safety disclosure:** This bridge interacts with native debuggers and may inspect or control an *authorized local process*. It does **not** provide a hosted public HTTP MCP endpoint. Use `QWEN_DAP_MCP_PROFILE=inspect` for restricted postmortem-only analysis.

## Directory submission and verification

- The official MCP Registry is the canonical source of MCP metadata; publish updates with the repository's OIDC-backed release workflow. It does **not** accept a README PR as a publishing mechanism.
- Other community directories (e.g. Glama or curated GitHub "awesome" lists) have their **own acceptance rules and moderation**. Verify that the maintained fork does not already have a listing and never claim inclusion before the site confirms it.
- Do not replace or impersonate the upstream `SLP-DEV1` listing; submit `spk-c/Qwen-dap-mcp` as its own maintained fork where duplicate policy allows.
- Avoid mass-posting duplicate announcements and unverified benchmarks. A useful contribution should include a reproducible demo, supported platforms and clear local-debugging privileges.

## Search terms that accurately describe this project

`Claude Code debugger MCP`, `OpenAI Codex native debugging`, `C++ crash debugging MCP server`, `GDB DAP MCP`, `LLDB CodeLLDB MCP`, `Windows minidump debugging agent`, `Qwen Code native debugger`.

These are natural discovery phrases, not search ranking guarantees. Any third-party listing or acceptance requires separate confirmation.
