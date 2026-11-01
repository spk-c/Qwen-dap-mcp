# Differential native debugging

`debug_compare_runs` compares two independent, stopped debugger sessions: one known-good baseline and one failing candidate. Pass both `baselineSessionId` and `candidateSessionId`; never silently mix evidence from sessions.

Compare semantic values, call stacks, module identity and normalized crash fingerprints. Absolute addresses may vary due to ASLR, so an address difference alone is not proof of causality. Treat `firstMeaningfulDifference` as a prioritization hint.

For authorized live tracing, `debug_trace_value` can identify writer candidates using bounded watchpoints. Stop rather than blindly continue through unrelated debugger events. Follow up with an ordinary code change, rebuild and complete terminal reproduction.
