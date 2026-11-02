# Reproducible benchmarks

Performance benchmarks against **real native debuggers** have not yet been established for this fork. Correctness CI is not a latency benchmark.

Run a deterministic **synthetic DAP parser microbenchmark** locally:

```bash
npm ci
npm run build
npm run bench:transport -- 5000
```

The benchmark reports median and p95 parser time per framed message and process RSS. It is **not** representative of full debugger launch, crash collection or model latency. For real comparisons, record the adapter/version, OS, CPU, Node version, target binary, toolset, security profile, source commit, sample count and test failures. Compare GDB, LLVM LLDB-DAP, CodeLLDB, small vs large dumps and 1/4/8 sessions. Report peak RSS, p50/p95 latency, throughput and error rate. Do not describe synthetic benchmark results as full debugger speed.
