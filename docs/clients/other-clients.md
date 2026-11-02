# Gemini CLI, Cursor, VS Code Copilot and other MCP clients

Qwen DAP MCP is a **local stdio MCP server**. It does not require a Qwen model: the client must be able to spawn the server as a process with Node.js 20+, and a supported native DAP debugger must be available where the process runs.

## Gemini CLI

Configure `~/.gemini/settings.json` or the project's `.gemini/settings.json`:

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

Then check `gemini mcp list` and use `/mcp` in an interactive session. See [Gemini example](https://github.com/spk-c/Qwen-dap-mcp/blob/main/examples/clients/gemini.settings.json) and [Gemini CLI MCP guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md).

## Cursor

Merge the [Cursor configuration example](https://github.com/spk-c/Qwen-dap-mcp/blob/main/examples/clients/cursor.mcp.json) into your Cursor MCP configuration (typically `~/.cursor/mcp.json`), then check that the MCP tools are connected and enabled. Each client may require an app or session restart.

## GitHub Copilot in Visual Studio Code

For VS Code's MCP-supported agent mode, merge the [VS Code example](https://github.com/spk-c/Qwen-dap-mcp/blob/main/examples/clients/vscode.mcp.json) into `.vscode/mcp.json`, enable the server and select its debugging tools in Agent mode. The top-level `servers` key for VS Code is intentionally **different** from Claude/Cursor/Gemini's `mcpServers` key. This is a configuration example, not a guarantee of compatibility with every Copilot subscription or VS Code release.

## Claude Desktop and arbitrary stdio MCP clients

A compatible desktop client can launch `npx -y @slp-dev1/qwen-dap-mcp` as a local stdio server. Consult its own MCP config schema; there is no single universal JSON format.

## Capability and security matrix

| Client environment | Local stdio registration | Can debug a process on your Windows PC? |
| --- | --- | --- |
| Qwen Code (local) | Qwen extension or MCP config | Yes, when running locally with a supported debugger |
| Claude Code (local CLI) | `claude mcp add` | Yes, same prerequisites |
| Codex CLI (local) | `codex mcp add` | Yes, same prerequisites |
| Gemini CLI (local) | `settings.json` | Yes, same prerequisites |
| Cursor (desktop) | MCP settings | Yes, same prerequisites |
| VS Code Copilot (desktop Agent mode) | `.vscode/mcp.json` | Yes, when tools are enabled |
| Claude.ai / ChatGPT web / remote-only coding tasks | No direct local stdio connection | **Not automatically**; requires a secure, independently deployed execution path |

The model provider (cloud vs local model) is separate from where the MCP server executes. **Never forward unprotected GDB/LLDB debug interfaces to the internet.** See [remote-debugging security guidance](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/remote-debugging.md).

## Verification

`npm run test:clients` validates example configurations and performs a real MCP **stdio initialize + tools/list handshake** with synthetic client identities (Claude Code, Codex, Gemini CLI). The test proves the shared protocol endpoint behaves correctly; it does **not** impersonate genuine commercial clients, log into them, install proprietary CLIs, or attach to a native process. Dedicated adapter E2E tests cover local debugger integrations separately.
