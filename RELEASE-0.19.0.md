# Qwen DAP MCP 0.19.0 — Maintained fork release

This release of [spk-c/Qwen-dap-mcp](https://github.com/spk-c/Qwen-dap-mcp) brings the originally compiled-only DAP-to-MCP bridge into a buildable, regression-tested fork.

## Highlights

- **Real debugger verification:** GDB 15 local launch and remote gdbserver, LLDB-DAP 18 native launch and core dumps, CodeLLDB 1.12.3 on Windows with C++ breakpoints, crashes and authentic minidumps, plus GDB 18.1 core dump import.
- **Improved DAP safety:** malformed frames and response mismatches fail closed, stale adapter approvals are rejected, asynchronous event waits are cleaned up, and GDB version-specific launch/attach ordering is handled.
- **Read-only postmortem inspection:** inspect-only DAP policy, protected evidence import/export, bounded reads, and real crash-dump tests that reject continue/step operations.
- **MCP integration:** real stdio handshake, tool listing, multi-session routing and parallel-session tests.
- **Maintainable distribution:** editable JavaScript in `src/`, generated TypeScript declarations, reproducible `npm ci`, clean package smoke tests, restored documentation and security policy.
- **Continuous verification:** Windows/Linux Node 22/24, GDB/LLDB/CodeLLDB native E2E, Linux GDB remote and postmortem tests, Windows minidump tests, CodeQL and Dependabot.

## Install

```sh
qwen extensions install spk-c/Qwen-dap-mcp
```

Start Qwen Code and use the debugger tools with a trusted local debugger adapter. By default `QWEN_DAP_MCP_PROFILE=local-debug` **can launch/attach to local processes**. For read-oriented postmortem inspection explicitly set `QWEN_DAP_MCP_PROFILE=inspect`; HOL Guard is opt-in.

## Important scope and compatibility

- The npm package `@slp-dev1/qwen-dap-mcp` is upstream and **does not contain this fork's fixes**. This fork is not published to npm; the release archive contains the runtime and metadata but does not bundle npm dependencies; users should use the GitHub Qwen extension installation workflow.
- The imported repository did not contain the original TypeScript source files. This fork maintains JavaScript source and regenerates declarations from JavaScript.
- GDB versions 14–17 can debug live targets, but its native DAP `coreFile` attach requires **GDB 18.1+**. Use LLDB-DAP for older GDB installations.
- No benchmark claims or guarantees of universal debugger compatibility are made. Only authorized, controlled test targets are used in CI.

See [CHANGELOG.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/CHANGELOG.md), [SECURITY.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/SECURITY.md) and the [integration test documentation](https://github.com/spk-c/Qwen-dap-mcp/blob/main/integration/README.md).
