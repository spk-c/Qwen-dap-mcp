# TypeScript source migration

The recovered v0.12.0 project contains 21 original TypeScript modules and 26 original TypeScript tests. The npm v0.18.2 archive contains 51 compiled JavaScript runtime modules and declaration/source-map metadata, but not the original TypeScript source.

## Build and source of truth

All **51** runtime modules now have a corresponding `src/**/*.ts` file. Run `npm ci && npm run check`. TypeScript emits `dist/**/*.js` and `dist/**/*.d.ts`; the build also mirrors the generated JavaScript to `src/**/*.js` for Node's existing test imports and `npm run dev`. Edit `.ts`, never the generated `.js` mirror. CI rejects generated-file drift.

This is a behavior-preserving source-language migration based on the **current 0.19.0 JavaScript** code. Old 0.12.0 implementations must not replace newer debugger safety fixes.

## Static typing status

The initial migration left 14 modules under `// @ts-nocheck`. The follow-up now gives all **51 runtime modules compiler coverage**, with no `@ts-nocheck` opt-outs. `npm run check:types` enforces that coverage in CI.

The DAP transport uses the published `@vscode/debugprotocol` response/event interfaces. Its `body` is intentionally dynamic at the protocol boundary, while operation deadlines, request-local session ownership, HOL Guard configuration, rr options, hang observations, runtime snapshot bounds and report structures now have explicit types.

**Full strict TypeScript checking is now enabled and enforced.** PRs #52–#56 completed the migration on November 2, 2026; [issue #24](https://github.com/spk-c/Qwen-dap-mcp/issues/24) is closed. `tsconfig.json` sets `strict: true`, with no permissive override, and `npm run check:strict-budget` requires **zero** diagnostics. The original baseline was 1,084 errors; it was reduced to zero without blanket `any` or `@ts-ignore` suppression. CI runs the full build, package integrity and Windows/Linux native debugger tests.

## Strict regression protection

`npm run check:strict-budget` retains its historical command name for compatibility, but its current maximum is **0 diagnostics**, not a transitional allowance. It checks the actual compiler with `--strict --noEmit` and now asserts that the checked-in TypeScript configuration also enables `strict: true`. New type errors fail CI. Avoid reintroducing old, unfinished strict-migration work branches.
