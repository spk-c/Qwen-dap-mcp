# TypeScript source migration

The recovered v0.12.0 project contains 21 original TypeScript modules and 26 original TypeScript tests. The npm v0.18.2 archive contains 51 compiled JavaScript runtime modules and declaration/source-map metadata, but not the original TypeScript source.

## Build and source of truth

All **51** runtime modules now have a corresponding `src/**/*.ts` file. Run `npm ci && npm run check`. TypeScript emits `dist/**/*.js` and `dist/**/*.d.ts`; the build also mirrors the generated JavaScript to `src/**/*.js` for Node's existing test imports and `npm run dev`. Edit `.ts`, never the generated `.js` mirror. CI rejects generated-file drift.

This is a behavior-preserving source-language migration based on the **current 0.19.0 JavaScript** code. Old 0.12.0 implementations must not replace newer debugger safety fixes.

## Static typing debt

The initial conversion checks **37 modules** with TypeScript, while **14 modules** temporarily use `// @ts-nocheck` because original API interfaces were lost during npm compilation. These markers are stripped from emitted JavaScript. The project is TypeScript-built, **not yet fully statically type-safe**. Restore interfaces incrementally from the older source reference, remove the opt-outs, then enable strict mode after the full tree passes.

All live debugger, postmortem, remote and MCP integration checks remain required before merging or publishing.
