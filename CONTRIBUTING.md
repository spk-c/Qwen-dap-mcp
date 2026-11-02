# Contributing

The authoritative implementation is now in src/**/*.ts (51 runtime modules). Generated src/**/*.js compatibility mirrors and dist/**/*.js must not be edited by hand. Original TypeScript reference sources from upstream v0.12.0 were recovered, but the later npm v0.18.2 omitted its .ts files. See docs/typescript-migration.md for completed strict typing and its zero-error regression gate.

Run npm ci, npm run check, and verify Windows/Linux CI before requesting a merge. For security-sensitive changes, add regression cases under test/ and check both src/ and generated dist/ for consistency.

Do not commit memory dumps, customer code, tokens, local workstation health reports, or personal MCP configuration.
