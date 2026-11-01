# Fork maintenance notes

2026-11-01 security/build cleanup:
- Recovered editable JavaScript sources from the previously distributed dist/ files. Original upstream TypeScript cannot be recovered from source maps without sourcesContent.
- Added a source-to-dist JavaScript build, unit tests, and CI.
- Tightened inspect-only postmortem attach validation.
- Replaced destination-direct evidence writes with temporary-file atomic publication.
- Added bounded incremental DAP framing and outgoing backpressure checks.
- Removed a workstation-specific MCP health report from the current tree (it remains in earlier Git history).
- Updated fork documentation and package repository links.

Legacy .d.ts declarations and .js.map source maps originate from the compiled upstream package. They are historical; they do not contain the missing TypeScript sources.

2026-11-01 follow-up:
- Fail closed on stale asynchronous DAP policy decisions and malformed DAP envelopes, bind response command to request, remove obsolete event waiters, bound stderr history.
- Added real stdio DAP adapter fixture, protocol integration tests, and more transport regressions.
- Restricted evidence imports to dedicated extension names and bounded file-descriptor reads with identity checks.

2026-11-01 native debugger integration:
- Added a compiled C++ fixture and real GDB, LLDB-DAP and CodeLLDB CI jobs.
- Tests cover source breakpoints, native stack/scopes, optional memory reads, a clean exit, a deliberate crash and adapter cleanup.

## 0.19.0 stabilization

- Added the nine documents referenced by the README and a link-integrity check.
- Replaced imported stale TypeScript declarations and source maps with generated declarations from editable JavaScript; original TypeScript sources are still unavailable.
- Added real MCP stdio handshake/session tests and inspect-only/HOL Guard negative tests.
- Added dependency-update and CodeQL workflows.
- The fork now uses a distinct private package name to avoid publishing to the upstream npm scope. This does not imply an npm release.
- Native postmortem/remote E2E tests and package locking must be completed before tagging a release.
