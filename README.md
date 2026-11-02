# Qwen DAP MCP — Native Debugger for Qwen Code and AI Coding Agents

**Debug native C/C++ crashes, hangs, deadlocks, Windows minidumps and core dumps with Qwen Code or another MCP-compatible coding agent.** Connect a real GDB, LLDB or CodeLLDB debugger through the Debug Adapter Protocol (DAP) and Model Context Protocol (MCP).

`qwen-dap-mcp` is a local **Debug Adapter Protocol (DAP) → Model Context Protocol (MCP)** bridge for native crash debugging, hang/deadlock triage, crash dumps, differential runtime analysis, remote targets, and bounded fix/verify workflows.

Built for **Qwen Code**, usable from any stdio MCP client, and designed to expose debugger evidence without turning MCP into a general-purpose shell.

[![npm version](https://img.shields.io/npm/v/%40slp-dev1%2Fqwen-dap-mcp.svg)](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp)
[![CI](https://github.com/spk-c/Qwen-dap-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/spk-c/Qwen-dap-mcp/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/spk-c/Qwen-dap-mcp/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://github.com/spk-c/Qwen-dap-mcp/blob/main/package.json)
[![GitHub stars](https://img.shields.io/github/stars/spk-c/Qwen-dap-mcp?style=social)](https://github.com/spk-c/Qwen-dap-mcp/stargazers)

**[Quick start](#quick-start) · [Capabilities](#what-it-does) · [Debugger support](#debugger-support) · [Safety](#safety-by-design) · [Docs](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/README.md) · [Contributing](https://github.com/spk-c/Qwen-dap-mcp/blob/main/CONTRIBUTING.md)**

> **Maintained Apache-2.0 fork of the original project by SLP-DEV1.** The maintained source is [spk-c/Qwen-dap-mcp](https://github.com/spk-c/Qwen-dap-mcp); npm distributes [`@slp-dev1/qwen-dap-mcp`](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp). GitHub's `main` may be ahead of the latest published npm version. See [fork notes](https://github.com/spk-c/Qwen-dap-mcp/blob/main/README-FORK-CHANGES.md) and [TypeScript migration status](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/typescript-migration.md).

## Why this exists

Coding agents can read source and propose patches, but native failures often cannot be diagnosed reliably from source alone. The useful evidence lives at runtime: thread stacks, registers, locals, disassembly, exception state, modules, memory, wait states, symbols, and crash dumps.

`qwen-dap-mcp` makes that evidence available through MCP and adds agent-oriented workflows on top of raw debugger primitives:

- **Evidence first** — inspect the actual failing process instead of guessing from source.
- **High-level workflows** — crash, hang, differential, causal tracing, progress probing, runtime-report, dump, and verification tools are designed for agents rather than humans driving a debugger console.
- **Bounded automation** — autonomous fix/verify state is explicit, serializable, iteration-limited, and re-checks the original reproduction.
- **Small default surface** — 18 core agent tools stay visible by default; forensic workflows and raw DAP controls are separate opt-in tiers.
- **Local by default** — the MCP server communicates over stdio and debugger adapters run locally unless you explicitly configure a validated remote target.

## Quick start

### Qwen Code

Install the current **published** npm version:

```bash
qwen extensions install @slp-dev1/qwen-dap-mcp
```

Or install the newest code directly from the maintained GitHub repository (this can be ahead of npm):

```bash
qwen extensions install spk-c/Qwen-dap-mcp
```

In Qwen Code, run `/mcp` and `/skills` to check that the `qwen-dap-mcp` server and the `native-runtime-debug` skill were discovered.

**Prerequisites:** Node.js **20+**, and a supported native DAP debugger installed separately (CodeLLDB, LLVM `lldb-dap`, or GNU GDB DAP). This package is a bridge, **not** a bundled debugger. See [platform setup](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/README.md).

### Other stdio MCP clients

Run the published package with `npx`:

```bash
npx -y @slp-dev1/qwen-dap-mcp --help
npx -y @slp-dev1/qwen-dap-mcp --version
```

Configure a trusted local MCP client with:

```json
{
  "mcpServers": {
    "qwen-dap-mcp": {
      "command": "npx",
      "args": ["-y", "@slp-dev1/qwen-dap-mcp"]
    }
  }
}
```

When started without `--help` or `--version`, the CLI operates as a local stdio MCP server. Client configuration syntax may vary.

### Update an existing installation

Update the npm-backed Qwen extension using the extension manager in your installed Qwen Code version, or reinstall the package with the command above. For `npx`, restart the MCP client to use newly resolved versions. npm releases are immutable: README changes appear on npmjs.com **only after publishing a new package version**, not when GitHub's README changes.

## 30-second example

```text
You: Debug why app.exe crashes with --repro

Coding agent
  ↓
qwen-dap-mcp starts a DAP debugger
  ↓
captures the native failure + project-controlled frame
  ↓
correlates stack + registers + locals + disassembly
  ↓
backtracks runtime evidence toward the likely producer
  ↓
agent applies a minimal source fix
  ↓
builds and repeats the original reproduction
  ↓
verifies whether the original crash fingerprint is gone
```

The MCP server supplies debugger evidence and bounded workflow state. Source editing, builds, tests, and source-control operations stay with the coding agent's normal authorized tools.

## What it does

| Problem | Agent-oriented capability |
| --- | --- |
| Native crash | Diagnose a stopped process, identify project frames, collect runtime evidence, and drive bounded fix/verify loops |
| Hang or deadlock | Observe, pause when needed, capture all-thread stacks, classify waits, and surface conservative deadlock candidates |
| Good run vs bad run | Compare stopped sessions semantically while suppressing raw ASLR/address noise |
| Suspicious value | Trace real writers with data breakpoints/watchpoints and bounded temporal tracing |
| Runtime causality | Build a bounded suspicious-value consumer → writer/producer chain with `debug_causal_trace` |
| Suspected busy loop | Resume/pause sample a live target with `debug_progress_probe` to distinguish repeated state from observed execution movement |
| Record/replay target | Move backward with capability-gated `debug_reverse_execution` using DAP `stepBack` / `reverseContinue` |
| Crash fleet triage | Build `debug_runtime_report` fingerprints, cluster them with `debug_cluster_crashes`, and classify regression reproductions with `debug_regression_oracle` |
| Child/fork signal | Inspect fail-closed adapter `startDebugging` requests with `debug_child_requests` without auto-spawning child sessions |
| Crash dump | Inspect Windows minidumps and supported LLDB/GDB postmortem targets without launching the failed program |
| Remote native target | Attach through validated `gdbserver` / `lldb-server gdbserver` endpoints with loopback-first policy |
| Multiple targets | Keep isolated DAP sessions and route requests by `sessionId` |
| Agent safety | Keep the default surface high-level and optionally gate executable/mutating DAP actions with HOL Guard |
| Object lifetime / UAF | Correlate pointer writers, sanitizer evidence, reverse stepping, and allocation/free hints |
| Symbol mismatch | Compare adapter symbol state with bounded local binary/PDB identity evidence |
| Crash fleets | Batch postmortem analysis plus exact/semantic/family grouping |
| Offline handoff | Export structured evidence and SARIF without keeping the target alive |

### Tool surfaces

The default `agent` toolset intentionally exposes **18 core tools** so coding models spend less context and selection effort on rarely needed forensic workflows.

| Core tool | Purpose |
| --- | --- |
| `debug_this_crash` | High-level native crash diagnosis and bounded autonomous verification |
| `debug_this_hang` | High-level hang/deadlock triage |
| `debug_compare_runs` | Semantic comparison of baseline and failing stopped sessions |
| `debug_trace_value` | Bounded temporal tracing of a suspicious value |
| `debug_causal_trace` | Consumer-to-writer producer evidence for suspicious runtime state |
| `debug_progress_probe` | Resume/pause sampling for no-progress and busy-loop triage |
| `debug_runtime_report` | Fingerprints, symbols, sanitizer evidence, memory hazards, ABI/API analysis, hypotheses, and breakpoint planning |
| `debug_trace_lifetime` | Object/pointer lifetime and writer provenance |
| `debug_adaptive_evidence` | Cheap → medium → full bounded evidence collection |
| `debug_diagnose_stop` | Diagnose the current debugger stop |
| `debug_source_disassembly` | Correlate source with nearby native instructions |
| `debug_find_writer` | Stop at the code that writes a watched value |
| `debug_run_to_stop` | Continue/launch toward a bounded meaningful stop |
| `debug_open_dump` | Open supported postmortem dump/core targets |
| `debug_snapshot` | Capture structured runtime evidence |
| `debug_status` | Inspect debugger/session state |
| `debug_disconnect` | Cleanly end a debugger session |
| `debug_sessions` | Create, inspect, and remove isolated sessions |

Set `QWEN_DAP_MCP_TOOLSET=forensics` when deeper investigation is needed. It keeps the raw manual DAP surface hidden while adding:

| Forensics-only tool | Purpose |
| --- | --- |
| `debug_reverse_execution` | Capability-gated reverseContinue / stepBack |
| `debug_cluster_crashes` | Cluster normalized crash reports |
| `debug_regression_oracle` | Classify original/changed/inconclusive reproductions |
| `debug_child_requests` | Inspect fail-closed child/fork reverse requests |
| `debug_adopt_child` | Explicitly adopt one reviewed `startDebugging` child into an isolated session when `QWEN_DAP_MCP_CHILD_DEBUG=1` |
| `debug_time_travel` | Bounded rr recording/replay planning and reverse workflows |
| `debug_thread_timeline` | Multi-thread progress and explicit-owner lock graph |
| `debug_symbol_doctor` | Binary identity, local symbols, and PDB/DWARF mismatch diagnosis |
| `debug_dump_batch` | Bounded crash-dump fleet analysis |
| `debug_crash_families` | Exact/semantic/family crash comparison |
| `debug_cpp_object` | Read-only C++ object/vtable inspection |
| `debug_evidence_bundle` | JSON/Markdown/SARIF evidence handoff |
| `debug_adapter_doctor` | Adapter capability, rr, and security-profile audit |

Set `QWEN_DAP_MCP_TOOLSET=full` only when raw stacks/scopes/variables, manual breakpoints/watchpoints, evaluate, memory reads, stepping, or adapter-specific controls are intentionally required. See [docs/toolsets.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/toolsets.md).

## Debugger support

| Adapter / target | Supported use |
| --- | --- |
| **CodeLLDB** | Local native launch/attach and Windows minidump workflows |
| **LLVM `lldb-dap`** | Native launch/attach, core-file inspection, and `lldb-server gdbserver` remote attach |
| **GNU GDB 14+ DAP** | Native launch/attach, core-file workflows, and hardened `gdbserver` remote attach |

Adapter discovery, prerequisites, and platform-specific setup are documented in [docs/README.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/README.md).

## More than raw DAP

Raw DAP is intentionally low level. `qwen-dap-mcp` keeps raw debugger access available in the full toolset, but its default surface focuses on workflows an agent can reason about directly.

| | Source only | Raw DAP | qwen-dap-mcp agent tools |
| --- | :---: | :---: | :---: |
| Runtime debugger evidence | — | ✓ | ✓ |
| High-level crash diagnosis | — | — | ✓ |
| All-thread hang triage | — | manual | ✓ |
| Good-vs-bad semantic diff | — | manual | ✓ |
| Explicit bounded fix/verify state | — | — | ✓ |
| Verification fingerprinting | — | — | ✓ |
| Causal writer chain | — | manual | ✓ |
| Progress sampling / busy-loop triage | — | manual | ✓ |
| Sanitizer + symbols + ABI report correlation | — | manual | ✓ |

## Safety by design

A debugger can execute and mutate target state, so the bridge treats that power explicitly.

- No arbitrary shell tool is exposed by the MCP server.
- No source-writing primitive is exposed by the MCP server.
- No general memory-write primitive is part of the default agent surface.
- Remote endpoints are validated and non-loopback access requires explicit allowlisting.
- Autonomous workflow state is explicit rather than hidden inside a background loop.
- Optional **HOL Guard 2.2+** integration can fail closed before protected adapter startup or executable/mutating DAP actions cross the debugger boundary.

Read the full policy and threat model in [docs/hol-guard.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/hol-guard.md) and [SECURITY.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/SECURITY.md).

## Development and reproducible verification

The repository includes native crash, hang, postmortem, Windows minidump, and remote-debugger fixtures. On a development checkout:

```bash
npm ci
npm run check
npm run check:pack
```

The checks include source/build integrity, MCP tests, document consistency, and inspection of the **actual npm tarball**. Native adapter end-to-end tests run in dedicated CI jobs and require their debugger/toolchain prerequisites. See the [integration tests](https://github.com/spk-c/Qwen-dap-mcp/tree/main/integration) and the [benchmark harness](https://github.com/spk-c/Qwen-dap-mcp/tree/main/benchmark); no performance claims are made without recorded, reproducible results.

## Practical debugging tutorials

These focused tutorials describe setup, expected debugger evidence and limitations with real native targets; the MCP bridge does not bundle a debugger.

- **[C/C++ crash debugging with Qwen Code](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-cpp-crash-debugging.md)** — reproduce a native crash, capture stack/register/local evidence and verify a fix.
- **[Windows minidump debugging with CodeLLDB](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-windows-minidump.md)** — inspect a crash dump with matching executable and symbols, without rerunning the crashing process.
- **[GDB/LLDB MCP setup and troubleshooting](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/tutorial-gdb-lldb-mcp.md)** — install a DAP-capable adapter, discover MCP tools and resolve common adapter issues.

## MCP Registry discovery

The maintained package publishes its MCP metadata under **`io.github.spk-c/qwen-dap-mcp`** when a matching npm version and official registry publication succeed. This is separate from any historical registry listing for the original author. See [publishing and registry verification](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/publishing.md); a listing is not proof of a particular feature until its exact package version is verified.

## Documentation

Start with the [documentation index](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/README.md).

| Topic | Guide |
| --- | --- |
| macOS experimental support | [docs/macos.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/macos.md) |
| CodeLLDB on Windows | [docs/CODELLDB_WINDOWS.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/CODELLDB_WINDOWS.md) |
| LLVM `lldb-dap` | [docs/lldb-dap.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/lldb-dap.md) |
| GNU GDB DAP | [docs/gdb-dap.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/gdb-dap.md) |
| Remote debugging | [docs/remote-debugging.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/remote-debugging.md) |
| Hang/deadlock analysis | [docs/hang-debugging.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/hang-debugging.md) |
| Differential debugging | [docs/differential-debugging.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/differential-debugging.md) |
| Runtime debugging v2 | [docs/runtime-debugging-v2.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/runtime-debugging-v2.md) |
| Agent vs full toolsets | [docs/toolsets.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/toolsets.md) |
| HOL Guard integration | [docs/hol-guard.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/hol-guard.md) |
| Publishing / releases | [docs/publishing.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/publishing.md) |

## Contributing and source build

Requirements: **Node.js 20+**.

```bash
git clone https://github.com/spk-c/Qwen-dap-mcp.git
cd qwen-dap-mcp
npm ci
npm run check
```

`src/**/*.ts` is the source of truth for 51 runtime modules; generated JavaScript mirrors and declarations are checked by CI. The **full** TypeScript `strict: true` migration is complete ([issue #24](https://github.com/spk-c/Qwen-dap-mcp/issues/24), PRs #52–#56). CI enforces zero strict compiler diagnostics; native debugger support remains limited to the adapters and scenarios tested in CI.

See [CONTRIBUTING.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/CONTRIBUTING.md) before opening a pull request.

## Distribution and release status

- **npm:** [`@slp-dev1/qwen-dap-mcp`](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp) — installable published versions; verify the npm version before assuming a GitHub change is included.
- **Maintained source and Qwen extension:** [`spk-c/Qwen-dap-mcp`](https://github.com/spk-c/Qwen-dap-mcp) — `qwen extensions install spk-c/Qwen-dap-mcp`.
- **Release archives and changelog:** [GitHub Releases](https://github.com/spk-c/Qwen-dap-mcp/releases) and [CHANGELOG.md](https://github.com/spk-c/Qwen-dap-mcp/blob/main/CHANGELOG.md).
- **Publishing:** Releases are triggered by an intentional `vX.Y.Z` tag on a verified `main` commit or by manual workflow dispatch; npm Trusted Publishing uses GitHub Actions OIDC without a long-lived npm publication token.

The npm listing is updated from the README **inside the published tarball**. The GitHub README and npm README can temporarily differ until the next release.

## Contributing

Bug reports, reproducible native failure cases, adapter compatibility findings, documentation fixes, and focused feature proposals are welcome. Please keep additions evidence-driven and prefer high-level agent workflows over expanding the default surface with raw debugger commands.

If this project saves you a debugging session, **consider starring the repository** — it helps other MCP and coding-agent users discover it.

## License

Apache-2.0. See [LICENSE](https://github.com/spk-c/Qwen-dap-mcp/blob/main/LICENSE) and [NOTICE](https://github.com/spk-c/Qwen-dap-mcp/blob/main/NOTICE).
