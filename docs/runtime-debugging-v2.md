# Runtime forensics v2

Available workflows include `debug_runtime_report`, `debug_trace_lifetime`, `debug_thread_timeline`, `debug_symbol_doctor`, `debug_crash_families`, `debug_dump_batch`, `debug_cpp_object` and `debug_evidence_bundle` (some require the forensics toolset).

`debug_this_crash` and `debug_this_hang` are the preferred high-level workflows. Every runtime conclusion should distinguish direct debugger observations, correlated clues and unverified hypotheses.

Use bounded snapshots, verify executable/PDB/build identity, and keep loaded module/stack data separate from user-code source correlations. A completed reproduction of the intended fixed behavior is stronger evidence than an initial breakpoint or a changed crash signature.

Evidence imports accept dedicated `.qwen-dap.json` or `.qwen-dap.sarif` files only and are read-only context. Live state cannot be resumed from exported evidence.
