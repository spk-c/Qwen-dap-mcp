# Security policy

This project starts local native debuggers that may launch, attach to, pause, or inspect processes. **Use only on targets you own or are authorized to debug.**

## Reporting vulnerabilities

Use the GitHub repository's **Security → Report a vulnerability** private reporting feature if enabled. If unavailable, open a GitHub issue **without exploit payloads, secrets, private dumps, or credentials** to request a private contact method. Never post a working exploit publicly.

## Supported version

The maintained GitHub fork on `main` is supported. Historical upstream npm packages under `@slp-dev1` are not maintained by this fork.

## Security defaults and boundaries

- `QWEN_DAP_MCP_PROFILE=local-debug` is the current default and **can execute/debug local programs**. Use `QWEN_DAP_MCP_PROFILE=inspect` for read-oriented DAP policy.
- `QWEN_DAP_MCP_HOL_GUARD` is **disabled unless explicitly enabled**. It provides external approvals, not sandbox isolation.
- `QWEN_DAP_MCP_TOOLSET=full` exposes manual DAP capabilities and should not be used with untrusted agents.
- Remote host access is loopback-only unless explicitly allowed; remote servers need SSH/VPN or equivalent protection.
- Core dumps and minidumps may contain passwords, personal data, source paths, and application secrets.
- Do not expose the stdio MCP bridge over an unauthenticated network or pass untrusted adapter binaries as commands.

## Maintainer checklist

Keep dependencies and GitHub Actions up to date, use `npm run check`, review real debugger integration results, and never commit core dumps, PDBs, tokens, workstation reports, or generated evidence.
