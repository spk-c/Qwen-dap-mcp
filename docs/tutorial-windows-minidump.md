# Analyze a Windows minidump with CodeLLDB and MCP

**Qwen DAP MCP** supports native crash-dump triage without relaunching the crashed process. A Windows minidump is useful for investigating production crashes when you have a crash file and the matching executable and symbols.

## Required files and tools

1. The `.dmp` minidump from an authorized application.
2. The exact corresponding executable and PDB/debug symbols, where available.
3. Node.js 20+, an MCP client such as Qwen Code, and a supported CodeLLDB DAP installation.

Start with [CodeLLDB on Windows](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/CODELLDB_WINDOWS.md) to configure the adapter. **Not every debugger/version supports every dump format**; compatibility depends on the installed adapter.

## Connect the agent

```powershell
qwen extensions install @slp-dev1/qwen-dap-mcp
```

In Qwen Code check `/mcp` for the server. Ask the agent:

> Inspect my authorized Windows minidump with CodeLLDB using Qwen DAP MCP. First confirm the dump, executable and PDB identities. Use `debug_open_dump` where supported, collect thread stacks and faulting frames, and distinguish observed evidence from hypotheses. Do not launch or mutate the target.

Provide local paths through the appropriate authorized MCP tool parameters rather than placing sensitive paths in public logs.

## Investigate and report

- Identify the exception/fault and the crashing thread if the dump contains that information.
- Compare loaded module and symbol identities, then inspect project-owned frames.
- Record missing memory, symbol and module data as explicit limitations.
- If the dump is insufficient, request a richer authorized reproduction or matching symbols rather than inventing missing evidence.

A dump-only workflow cannot prove that a source fix works. Verify fixes by rebuilding and reproducing the original failure in a separate, controlled test.

See [postmortem debugging documentation](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/README.md), [Windows CodeLLDB setup](https://github.com/spk-c/Qwen-dap-mcp/blob/main/docs/CODELLDB_WINDOWS.md), and [security guidance](https://github.com/spk-c/Qwen-dap-mcp/blob/main/SECURITY.md).
