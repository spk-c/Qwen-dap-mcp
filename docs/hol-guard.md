# HOL Guard

HOL Guard is an optional external approval boundary for adapter process start and protected DAP commands. It is **disabled by default**. A non-enabled guard does not authorize unsafe use.

Set `QWEN_DAP_MCP_HOL_GUARD=1` only after installing and reviewing the local Python policy bridge at `scripts/hol-guard-dap-policy.py`. You can specify `QWEN_DAP_MCP_HOL_GUARD_PYTHON` and `QWEN_DAP_MCP_HOL_GUARD_TIMEOUT_MS`.

The bridge hashes the approved adapter executable and script and rejects changed identities. HOL Guard decisions fail closed on errors or timeouts, but are not an operating-system sandbox. Use only trusted debugger executables and authorized targets.

The `inspect` profile applies DAP read-oriented policy; `local-debug` is the **default**, permitting execution. For untrusted requests set `QWEN_DAP_MCP_PROFILE=inspect` before startup. Inspect-only permits narrowly recognized core/minidump attach configurations, not live process attachment.

Tests: `npm test`; real debugger checks: `integration/README.md`.
