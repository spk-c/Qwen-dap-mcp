# Changelog

## 0.19.0 — release candidate (not yet published)

- Rebuilt editable JavaScript sources after the imported TypeScript project was unavailable.
- Added Windows/Linux native C++ integration tests for GDB, LLDB-DAP, and CodeLLDB.
- Strengthened DAP request/response validation, adapter generations and evidence file handling.
- Added source-map and source/build cleanup, generated JS declarations, missing docs and MCP stdio/security regression tests.
- Added CodeQL and dependency update automation.
- The fork package is marked private to avoid publishing into an upstream-owned npm scope.

**Release gating:** Verify this branch's GitHub Actions, postmortem/remote tests and reproducible dependency install before creating a 0.19.0 tag or GitHub release.

## 0.18.2 — initial imported runtime

Initial fork snapshot of compiled DAP-to-MCP bridge; original TypeScript sources were not included.
