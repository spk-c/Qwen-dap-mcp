# Set up a GDB or LLDB DAP debugger for Qwen Code and MCP

Qwen DAP MCP bridges a **Debug Adapter Protocol (DAP)** debugger to a local **Model Context Protocol (MCP)** coding agent. It does **not** ship with GDB, LLDB or CodeLLDB; install your adapter separately.

## 1. Choose an adapter

| Native debugger | Typical scenario | Guidance |
| --- | --- | --- |
| GNU GDB 14+ with DAP | Native Linux debugging, local or validated `gdbserver` | [GDB DAP guide](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/gdb-dap.md) |
| LLVM `lldb-dap` | macOS/Linux native debugging and supported core files | [LLDB DAP guide](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/lldb-dap.md) |
| CodeLLDB | Native debugging and supported Windows minidumps | [Windows CodeLLDB guide](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/CODELLDB_WINDOWS.md) |

Confirm the adapter binary is on PATH or configure its explicit executable location according to the corresponding guide. Support varies by platform and adapter release; experimental macOS compatibility is not a guarantee for every scenario.

## 2. Install the extension

```bash
qwen extensions install @slp-dev1/qwen-dap-mcp
```

Check `/mcp` and `/skills` inside Qwen Code. The maintained GitHub development version can be installed using `qwen extensions install spk-c/Qwen-dap-mcp` and may contain changes not yet on npm.

For another stdio MCP client:

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

See your client's own documentation for the correct config location and startup protocol.

## 3. Verify adapter discovery and safe operation

Start with `debug_status` or `debug_adapter_doctor` (forensics toolset) and a **local program you own**. Ask the agent to collect stacks, locals and source/disassembly correlations only after the adapter is confirmed.

- GDB/LLDB **CLI installation alone does not prove the DAP adapter is available**.
- If symbols are missing, rebuild with symbols or use the correct PDB/DWARF data.
- Remote native debugging is loopback-first and requires explicit trusted host configuration for non-loopback endpoints. See [remote debugging](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/remote-debugging.md).
- For untrusted binaries or unknown agent instructions, prefer the `inspect` security profile; the full DAP toolset permits potentially mutating operations.

## Related guides

- [C/C++ crash debugging with Qwen Code](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-cpp-crash-debugging.md)
- [Windows minidump triage](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-windows-minidump.md)
- [Toolsets](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/toolsets.md)
- [Security](https://github.com/spk-c/Qwen-dap-mcp/blob/main/SECURITY.md)
