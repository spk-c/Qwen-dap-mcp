# TypeScript source migration

The recovered v0.12.0 project contains 21 original TypeScript modules and 26 original TypeScript tests. The npm v0.18.2 archive contains 51 compiled JavaScript runtime modules and declaration/source-map metadata, but not the original TypeScript source.

## Build and source of truth

All **51** runtime modules now have a corresponding `src/**/*.ts` file. Run `npm ci && npm run check`. TypeScript emits `dist/**/*.js` and `dist/**/*.d.ts`; the build also mirrors the generated JavaScript to `src/**/*.js` for Node's existing test imports and `npm run dev`. Edit `.ts`, never the generated `.js` mirror. CI rejects generated-file drift.

This is a behavior-preserving source-language migration based on the **current 0.19.0 JavaScript** code. Old 0.12.0 implementations must not replace newer debugger safety fixes.

## Static typing status

The initial migration left 14 modules under `// @ts-nocheck`. The follow-up now gives all **51 runtime modules compiler coverage**, with no `@ts-nocheck` opt-outs. `npm run check:types` enforces that coverage in CI.

The DAP transport uses the published `@vscode/debugprotocol` response/event interfaces. Its `body` is intentionally dynamic at the protocol boundary, while operation deadlines, request-local session ownership, HOL Guard configuration, rr options, hang observations, runtime snapshot bounds and report structures now have explicit types.

**Partial strict checking is enforced in CI.** `strictFunctionTypes`, `strictBindCallApply`, `alwaysStrict`, and `useUnknownInCatchVariables` are enabled. The current `tsconfig.json` still has `strict: false` because a complete strict pass reported 1,084 compiler diagnostics, mostly implicit `any` from the npm-derived code. No one should confuse removal of opt-outs with a passing full `strict: true` compile. Strengthen remaining API surfaces, turn on strict flags only after compiler errors are fixed, and keep all real debugger/MCP integration checks as release gates.
