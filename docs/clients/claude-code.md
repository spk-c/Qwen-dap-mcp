# Native C/C++ debugging with Claude Code and Qwen DAP MCP

**Claude Code** supports local MCP servers over stdio. Although this package is named Qwen DAP MCP, its debugger tools use the open MCP protocol: the model can run in the cloud while the Claude Code CLI launches the debugger bridge **on the machine running the CLI**.

## Setup

Install Node.js 20+ and a supported DAP-capable debugger (GDB 14+, LLVM `lldb-dap`, or CodeLLDB). Then register the **published npm package** in a trusted local terminal:

```bash
claude mcp add --transport stdio --scope user qwen-dap-mcp -- npx -y @slp-dev1/qwen-dap-mcp
claude mcp list
```

Inside Claude Code, use `/mcp` to confirm that the server connected and exposes `debug_status`, `debug_this_crash` and other tools. The registration command **does not** validate a debugger installation or an actual crash investigation.

Prefer project-scoped installation only for repositories whose collaborators trust the MCP configuration. For a shareable example, see [Claude Code MCP JSON](https://github.com/spk-c/Qwen-dap-mcp/blob/main/examples/clients/claude-code.mcp.json). Never silently modify a user's existing `~/.claude.json` or `.mcp.json`.

## Example agent request

> Debug this C++ crash using the qwen-dap-mcp server. First verify the available local DAP adapter. Reproduce the failure with my authorized debug build, collect the crashing thread stack and project-controlled frames, and distinguish evidence from hypotheses. Do not claim the fix works until the same reproduction succeeds after rebuilding.

The agent edits/builds through its own separately approved tools. Qwen DAP MCP deliberately does not provide a general-purpose shell or source-writing capability.

## Windows tips

When an MCP client cannot resolve `npx`, use the **absolute executable path** to the Node/npm launcher (for example `npx.cmd` on Windows) in the MCP client configuration. Avoid shell wrappers and verify the exact invocation in your terminal first. Keep the native debugger executable available on the PATH visible to Claude Code.

## Limitations and security

This is a **local stdio** server, not a remote Claude.ai browser connector. Claude Code running on a remote machine sees that machine's processes, not your PC by default. For cloud-hosted agents, provide a trusted local execution environment or a separately authenticated tunnel; do not expose debugger ports to the public internet.

For dump-only work, set `QWEN_DAP_MCP_PROFILE=inspect` in the MCP configuration to disallow live launch/attach or state-changing DAP requests. Choose the default local-debug profile only when live debugging of an authorized target is required. Approval of MCP tools is a separate client decision.

See [CodeLLDB Windows](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/CODELLDB_WINDOWS.md), [GDB/LLDB setup](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-gdb-lldb-mcp.md), and [security](https://github.com/spk-c/Qwen-dap-mcp/blob/main/SECURITY.md).

Official client reference: [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).
