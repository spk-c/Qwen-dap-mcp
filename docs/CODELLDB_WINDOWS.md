# CodeLLDB on Windows

Install the official vadimcn.vscode-lldb extension (version 1.11.0 or newer). The resolver searches VS Code/Insiders/Cursor extension roots; override it with `CODELLDB_PATH` or a tool's `adapterPath`.

For native symbols build the C++ program with MSVC `/Zi /Od /DEBUG` and keep the matching PDB next to the executable. The debugger adapter is a local executable, not a remote web service.

Use `debug_start_codelldb` and `debug_launch_codelldb` in the full toolset, or higher-level `debug_run_to_stop` in agent mode after initialization. Core/minidump analysis uses `debug_open_dump` with `adapter: "codelldb"`.

The Windows GitHub Action in `.github/workflows/native-debug.yml` compiles a dedicated C++ test program and verifies breakpoints, locals, crash stops and cleanup against the actual CodeLLDB adapter. Do not use privileged/protected third-party processes as test targets.
