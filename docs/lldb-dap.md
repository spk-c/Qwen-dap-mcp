# LLVM lldb-dap

Use upstream LLVM `lldb-dap` (on Ubuntu 24.04: `lldb-dap-18`). Set `LLDB_DAP_PATH` if it is not on PATH. The adapter communicates via stdin/stdout DAP; do not wrap it in a shell.

Launch a locally owned binary with `debug_run_to_stop` or manually use the full toolset. For a frozen core file supply **both** dump and matching executable to `debug_open_dump` with `adapter: "lldb-dap"`.

An automated Linux native fixture tests real LLDB-DAP launch, stop, stack, locals, crash and teardown. See `integration/README.md`. Remote attach behavior varies by LLVM version; use the documented validated host/port builder and prefer an SSH/VPN tunnel.
