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
