# Toolsets and security

- agent (default): compact high-level debugger workflows
- forensics: additional dump, tracing, and diagnostic workflows
- full: manual DAP debugger tools including launch, attach and evaluate

Set QWEN_DAP_MCP_TOOLSET=agent|forensics|full and QWEN_DAP_MCP_PROFILE=inspect|local-debug|advanced before starting the MCP server.

QWEN_DAP_MCP_DAP_POLICY=inspect-only enforces a read-oriented transport policy. This does not sandbox arbitrary adapter executables, and the local MCP server should not be exposed to untrusted clients. HOL Guard can add per-action approval decisions when configured explicitly.
