# GNU GDB DAP

Requires GDB 14 or newer with the built-in `--interpreter=dap` support; the native CI currently verifies GDB 15. Start it with `--interpreter=dap --quiet --nx`. Unlike CodeLLDB/LLVM, GDB follows `initialize -> breakpoints -> configurationDone -> launch/attach`.

For native crashes, use `debug_open_dump` with `adapter: "gdb"` and `dumpPath`, plus the matching `program` when available. GDB 15 can reject paginated variables with a list-index error; the bridge retries those specific failures without paging.

Remote debugging requires an authorized gdbserver and an explicitly permitted host; see `docs/remote-debugging.md`. The Linux E2E workflow exercises breakpoint, stack, locals, optional memory, crash and teardown against a compiled test binary.
