# Native debugger end-to-end tests

These tests compile and launch **only** the repository's dedicated C++ fixture.
They exercise a real DAP adapter process and an actual debuggee: source
breakpoint, native frames and C++ locals, memory reads (when advertised),
normal exit, deliberate access violation/SIGSEGV, and adapter cleanup.

They do not attach to arbitrary user processes or require admin privileges.

GitHub Actions:
- Ubuntu 24.04, GNU GDB with the built-in DAP interpreter.
- Ubuntu 24.04, upstream LLVM lldb-dap 18.
- Windows 2022, official Windows-x64 CodeLLDB VSIX with an MSVC fixture.

To run locally, build integration/fixture/native-debug.cpp with debug symbols.
Set RUN_NATIVE_DEBUGGER_TESTS=1, NATIVE_DAP_ADAPTER,
NATIVE_DAP_PATH and NATIVE_DAP_BINARY. Then run:

    node --test integration/native-debug.mjs

The standard npm test command covers fast offline/protocol tests. Native integration
runs only in an explicit CI job and never silently skips a missing debugger.
The fixture crashes intentionally in its own process; never use production targets.
