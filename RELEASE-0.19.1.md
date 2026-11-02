# Qwen DAP MCP 0.19.1 — npm package and README refresh

This is a documentation and distribution maintenance patch for [spk-c/Qwen-dap-mcp](https://github.com/spk-c/Qwen-dap-mcp), based on the maintained Apache-2.0 project originally by SLP-DEV1.

## Changes

- Restored the verified npm package identity: [`@slp-dev1/qwen-dap-mcp`](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp).
- Rewrote the npm-facing README to document npm and GitHub installation, supported native DAP adapters, MCP client configuration, high-level tools, security profiles and complete documentation links.
- Replaced outdated claims that the npm package cannot contain this fork's improvements, while distinguishing published package versions from unreleased repository changes.
- Synchronized package version, lockfile and Qwen extension version; retained build and real debugger test gates.
- Configured npm publication through GitHub Actions OIDC Trusted Publishing without an npm token.

No changes to native debugger runtime features are claimed in this patch.

## Install

```bash
qwen extensions install @slp-dev1/qwen-dap-mcp
```

Alternatively, install source from `spk-c/Qwen-dap-mcp` when you specifically need the newest repository state. For other stdio MCP clients, use `npx -y @slp-dev1/qwen-dap-mcp`. Node.js 20+ and a separately installed compatible native debugger are required.

Please check the [npm package](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp) for the currently published version before assuming this release is live.

See [the documentation](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/README.md), [the changelog](https://github.com/spk-c/Qwen-dap-mcp/blob/main/CHANGELOG.md), and [the security policy](https://github.com/spk-c/Qwen-dap-mcp/blob/main/SECURITY.md).
