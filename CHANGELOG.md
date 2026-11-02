# Changelog

## Unreleased — TypeScript source migration

- Migrated 51 runtime modules to source-of-truth TypeScript while retaining JS compatibility and safety fixes.
- Recovered legacy v0.12.0 TypeScript definitions as reference; 37 modules statically checked, 14 still require full annotations.

## 0.19.1 — npm publishing and documentation

- Updated the npm-facing README with current Qwen Code/npm install instructions, stdio MCP configuration, debugger prerequisites, security profiles, TypeScript migration limitations, and working GitHub documentation links.
- Reconnected the maintained fork to the `@slp-dev1/qwen-dap-mcp` package name and synchronized the npm lockfile and extension metadata.
- Prepared a manually triggered GitHub Actions release with npm Trusted Publishing (OIDC) and updated release integrity checks.
- No native-debugger runtime functionality changed in this patch.

## 0.19.0

- Rebuilt editable JavaScript sources after the imported TypeScript project was unavailable.
- Added Windows/Linux native C++ integration tests for GDB, LLDB-DAP, and CodeLLDB, real Linux core dumps (including GDB 18.1), Windows minidumps and loopback gdbserver remote debugging.
- Strengthened DAP request/response validation, adapter generations and evidence file handling.
- Added source-map and source/build cleanup, generated JS declarations, missing docs and MCP stdio/security regression tests.
- Added CodeQL, Dependabot, a committed npm lockfile, reproducible `npm ci` and actual package-tarball smoke tests.
- The fork package is marked private to avoid publishing into an upstream-owned npm scope.

**Publication:** The GitHub release is created only after a manual, CI-gated workflow. See `docs/publishing.md` and the Releases page for publication status.

## 0.18.2 — initial imported runtime

Initial fork snapshot of compiled DAP-to-MCP bridge; original TypeScript sources were not included.
