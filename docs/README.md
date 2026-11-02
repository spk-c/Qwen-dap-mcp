# Qwen DAP MCP documentation

This fork now uses **src/**/*.ts as the authoritative runtime sources** (51 modules). The generated src/**/*.js mirrors preserve existing Node ESM imports, while dist/ contains the compiled runtime and generated declarations. The recovered v0.12.0 source snapshot provides original TypeScript references for 21 modules; the later v0.18.2 npm release did not contain its original .ts files. See [migration status](typescript-migration.md) for the completed strict TypeScript migration.

## Development

Requires Node.js 20 or later.

    npm ci
    npm run build
    npm test
    npm run check

The build compiles src/**/*.ts with tsc to dist/**/*.js and dist/**/*.d.ts, then mirrors the JavaScript into src/ for compatibility. To test the stdio entrypoint without a debugger:

    node dist/index.js --help

To install this fork in Qwen Code:

    qwen extensions install spk-c/Qwen-dap-mcp

Native debugger integration tests should only run against owned/authorized targets in a controlled environment. Unit and smoke tests do not launch applications or attach to processes.

## Security

QWEN_DAP_MCP_PROFILE=inspect selects inspect-only DAP transport policy. A permitted core/minidump attach must match a strict, known postmortem configuration. Live attach, launch, evaluate and execution-control commands are denied.

Running any external debugger binary is still privileged: use trusted adapters and HOL Guard if you require explicit action approvals. Do not enable QWEN_DAP_MCP_TOOLSET=full for untrusted agents.

Remote debugging is loopback-only by default, with QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS for explicitly trusted remote hosts.

The maintained fork is configured to publish the `@slp-dev1/qwen-dap-mcp` npm package using OIDC Trusted Publishing. Only published npm versions include released fork changes; unreleased changes remain on GitHub. See [publishing](publishing.md).

## Guided setup and debugging

- [Debug a native C/C++ crash with Qwen Code](tutorial-cpp-crash-debugging.md)
- [Analyze a Windows minidump with CodeLLDB](tutorial-windows-minidump.md)
- [Set up GDB/LLDB DAP debugging for MCP](tutorial-gdb-lldb-mcp.md)

These examples describe intended debugger workflows for trusted, owned test programs. Refer to the platform-specific setup guides for exact adapter support and limitations.

## Claude Code, Codex and other MCP clients

The native debugger bridge is compatible with local **stdio MCP** clients and is not tied to the Qwen model. The model may run in a cloud provider, but the MCP process and native debugger must run in an environment with access to the target binary.

- [Claude Code installation and native crash debugging](clients/claude-code.md)
- [OpenAI Codex CLI and IDE integration](clients/codex.md)
- [Gemini CLI, Cursor, VS Code Copilot, other clients and compatibility matrix](clients/other-clients.md)
- [Client-specific example configurations](https://github.com/spk-c/Qwen-dap-mcp/tree/main/examples/clients)

Run `npm run test:clients` to validate sample configurations and perform real stdio MCP initialize/tool-discovery smoke tests with multiple client identities (not proprietary client binaries). For native debugger coverage, review dedicated adapter E2E workflows.

## Real CLI configuration checks

The Real CLI MCP registration GitHub Actions workflow installs pinned official Claude Code and Codex executables and verifies that each can register and list the local MCP server in isolated temporary configuration directories without user credentials. The existing cross-client initialize/tools-list tests verify the live stdio protocol, and native debugger E2E tests check GDB/LLDB execution. This does not prove a model-driven tool call in an authenticated Claude/Codex session; that remains a separately authorized manual E2E check.
