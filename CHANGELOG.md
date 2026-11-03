# Changelog

## [0.19.4] - 2026-11-03 — MCP discovery and native debugger demo

- Updated official MCP Registry title/description to explicitly describe Claude Code, Codex CLI, Qwen Code, local stdio MCP, C/C++, GDB/LLDB/CodeLLDB, crash, hang and dump debugging.
- Added an honest, accessible vector workflow illustration, a reproducible Linux GDB crash → evidence → temporary fix → verification script and step-by-step demo guide.
- Integrated the real GDB demo in the native Linux CI workflow; added canonical source/npm/official-registry links and a directory-ready maintained-fork listing.
- Synced package, lockfile, Qwen extension and registry metadata to 0.19.4. No native debugger runtime behavior changes.

## [0.19.3] - 2026-11-02 — Multi-client MCP integration

- Documented Claude Code, OpenAI Codex CLI/IDE, Gemini CLI, Cursor and VS Code Copilot local stdio setup with explicit cloud/local security boundaries.
- Added example MCP configurations for each client, client-identity stdio initialize/tools-list smoke tests and a dedicated `npm run test:clients` entrypoint.
- Updated README and npm keywords to reflect cross-client compatibility; no change to the native debugger runtime or supported adapters.


## [0.19.2] - 2026-11-02

### Discovery and documentation

- Reworked README opening and use-case navigation for native crash, hang and postmortem MCP debugging.
- Added focused C/C++ crash, Windows minidump and GDB/LLDB DAP setup tutorials.
- Added `mcpName` and a versioned `server.json` for the maintained `io.github.spk-c/qwen-dap-mcp` MCP Registry namespace.
- Prepared OIDC-backed release automation to publish npm metadata to the official MCP Registry after the npm artifact is available.
- Included updated package and extension discovery descriptions; no runtime debugger behavior changes in this release.


## Historical development tooling updates

- Completed full strict TypeScript migration of all 51 runtime modules (PRs #52–#56; zero strict diagnostics); restored precise documentation after earlier release notes described the in-progress migration.
- Updated GitHub Actions checkout/setup-node/CodeQL major versions and development-only typing/compiler dependencies. No new package has been published for these unreleased changes.

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
