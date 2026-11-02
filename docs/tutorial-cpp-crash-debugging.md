# Debug a native C/C++ crash with Qwen Code and DAP MCP

Use **Qwen DAP MCP** to collect native runtime evidence before asking a coding agent to change code. The server connects Qwen Code to a separately installed **GDB**, **LLDB** or **CodeLLDB** DAP adapter.

## Prerequisites

- Node.js 20+ and the [Qwen Code CLI](https://github.com/QwenLM/qwen-code).
- A supported DAP adapter; see [GDB/LLDB setup](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-gdb-lldb-mcp.md) and [debugger compatibility](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/README.md).
- A native program you own or are authorized to debug, with a reliable reproduction and matching debug symbols.

For a small **Linux** test binary, build this *intentional demonstration crash* (never run it against production data):

```cpp
// crash-demo.cpp
#include <cstdlib>
int main() { std::abort(); }
```

```bash
g++ -g -O0 crash-demo.cpp -o crash-demo
./crash-demo
```

The program terminates deliberately; it is only a fixture, not a claim that the debugger fixes it automatically.

## Install and discover the MCP server

```bash
qwen extensions install @slp-dev1/qwen-dap-mcp
```

Run `/mcp` and `/skills` inside Qwen Code to verify that `qwen-dap-mcp` and the `native-runtime-debug` skill are available. If installing unreleased code, use `qwen extensions install spk-c/Qwen-dap-mcp`.

## Debug with runtime evidence

Ask your agent to reproduce the failure with the appropriate DAP adapter and use `debug_this_crash` to collect evidence. An example prompt:

> Reproduce the crash of my local debug build. Use Qwen DAP MCP to collect the faulting thread's stack trace, registers and project-owned frames, explain the likely cause with supporting evidence, and propose a minimal fix. Rebuild and repeat the identical reproduction before declaring success.

A useful investigation records the executable, symbol identity, crash signal/exception, exact reproduction, relevant stack frames and comparison after the proposed fix. The agent's own authorized tools handle file changes and builds; the MCP server is the debugger bridge.

## Common issues

- **No tools found:** check `/mcp`, extension installation and Node.js version.
- **Adapter unavailable:** install the chosen debugger separately and confirm its DAP launcher.
- **No useful source frames:** rebuild with debug symbols and ensure the executable matches the binary being investigated.
- **No successful reproduction:** describe the failure as inconclusive instead of guessing a root cause.

See [crash and hang workflows](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/runtime-debugging-v2.md) and [security policy](https://github.com/spk-c/Qwen-dap-mcp/blob/main/SECURITY.md).
