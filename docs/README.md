# Qwen DAP MCP documentation

This fork includes editable JavaScript sources in src/ and runtime files in dist/. The original TypeScript sources, their tests, and their build configuration were not included in the imported repository snapshot. Exact TypeScript reconstruction is not possible from the available source maps.

## Development

Requires Node.js 20 or later.

    npm install
    npm run build
    npm test
    npm run check

The build copies src/**/*.js into dist/**/*.js. Existing declaration files originate from the imported compiled package. To test the stdio entrypoint without a debugger:

    node dist/index.js --help

To install this fork in Qwen Code:

    qwen extensions install spk-c/Qwen-dap-mcp

Native debugger integration tests should only run against owned/authorized targets in a controlled environment. Unit and smoke tests do not launch applications or attach to processes.

## Security

QWEN_DAP_MCP_PROFILE=inspect selects inspect-only DAP transport policy. A permitted core/minidump attach must match a strict, known postmortem configuration. Live attach, launch, evaluate and execution-control commands are denied.

Running any external debugger binary is still privileged: use trusted adapters and HOL Guard if you require explicit action approvals. Do not enable QWEN_DAP_MCP_TOOLSET=full for untrusted agents.

Remote debugging is loopback-only by default, with QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS for explicitly trusted remote hosts.

The npm scope @slp-dev1 belongs to the upstream project and does not publish this fork's fixes.
