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
