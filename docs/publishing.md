# Publishing and versioning

The npm name `@slp-dev1/qwen-dap-mcp` belongs to the original project; **do not publish this fork into that namespace**. This repository's GitHub install path is `spk-c/Qwen-dap-mcp`.

Preflight:
1. Update `package.json`, `qwen-extension.json` and `src/version.js` together.
2. Run `npm run check` and the native debugger E2E jobs on a clean branch.
3. Review `npm pack --dry-run --json` for missing runtime files, private machine data, and stale build outputs.
4. Verify Qwen extension installation and real stdio MCP tool discovery in a clean environment.
5. Create a Git tag and GitHub release only once all required checks pass; do not imply npm publication without ownership/authorization.

The former TypeScript sources were absent from the fork import. The checked-in `src/` is editable JavaScript; any declaration regeneration should be validated independently for downstream TypeScript consumers.
