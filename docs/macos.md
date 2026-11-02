# macOS development and debugger support

The maintained source is tested on macOS 15 CI (Node.js 24) for build, tests, packaging and a compiled C++ fixture.

**Native LLDB-DAP support is experimental:** the CI job tries a real LLDB-DAP launch and breakpoint/exception test when an `lldb-dap` executable is present. These native tests are explicitly non-gating until platform adapter permissions and reliability are verified. A green macOS build alone is not proof that debugger attach or core-file inspection works.

For local use:

```bash
npm ci
npm run check
npm run check:pack
xcrun --find lldb-dap  # on some Xcode installations
```

Alternatively install LLVM through Homebrew and locate `lldb-dap` in that toolchain. Use the trusted native debug adapter for your target and review local macOS debugger entitlements. Only debug owned or authorized programs.
