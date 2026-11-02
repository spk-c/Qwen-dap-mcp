# Native debugger MCP for OpenAI Codex CLI and IDE

**Codex CLI** supports local stdio MCP servers. Qwen DAP MCP is model-independent: the tool calls are standard MCP, while the DAP debugger runs on the machine where the MCP server is launched.

## Setup

Install Node.js 20+, a supported GDB/LLDB/CodeLLDB DAP debugger, and Codex CLI.

```bash
codex mcp add qwen-dap-mcp -- npx -y @slp-dev1/qwen-dap-mcp
codex mcp list
```

The CLI and supported IDE integration share the Codex MCP configuration. Alternatively, merge this snippet into `~/.codex/config.toml`:

```toml
[mcp_servers.qwen-dap-mcp]
command = "npx"
args = ["-y", "@slp-dev1/qwen-dap-mcp"]
startup_timeout_sec = 30
```

A versioned copy is available at [examples/clients/codex.config.toml](https://github.com/spk-c/Qwen-dap-mcp/blob/main/examples/clients/codex.config.toml).

In Codex's interactive interface, use `/mcp` and check that `debug_status` and `debug_this_crash` appear. A successful `mcp list` alone proves registration, **not** that a specific native debugger or cloud sandbox can access your binary.

## Example request

> Use qwen-dap-mcp to triage a crash in this local authorized C++ debug build. Capture the exception or signal and thread stack before proposing changes. After a minimal code change, rebuild and verify the original reproduction; report incomplete evidence explicitly.

## Local vs cloud Codex

**Codex CLI running locally:** its stdio MCP child can see the local debugger installation, local binary and any authorized local paths.

**Codex cloud task environment:** a remote task does not automatically gain access to an MCP server registered only on your Windows desktop. The task's own environment would need an appropriately configured MCP runner and access to the target. Do **not** expose unauthenticated DAP or debugger ports publicly.

The bridge has no hosted HTTP endpoint built into its default invocation. Treat remote deployment as a separate security architecture.

## Safety and troubleshooting

- Node.js 20+ must be installed in the environment where Codex starts the MCP server.
- On Windows, if `npx` cannot launch, use an absolute path to `npx.cmd` or equivalent supported executable in `config.toml`.
- For postmortem inspection only, set `QWEN_DAP_MCP_PROFILE=inspect` in the server's environment; live debugging requires an authorized debugger and a compatible profile.
- Review tool permissions before giving any coding agent live debugger control.

See [GDB/LLDB guide](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-gdb-lldb-mcp.md), [Windows minidump](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-windows-minidump.md), and [Codex MCP documentation](https://developers.openai.com/codex/mcp).
