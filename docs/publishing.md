# Publishing and versioning

The npm name `@slp-dev1/qwen-dap-mcp` belongs to the original project; **never publish this fork into that namespace**. The GitHub installation path is `spk-c/Qwen-dap-mcp`. The fork package is intentionally marked `private: true`; the 0.19.0 release is a **GitHub Release**, not an npm registry publication.

## Release 0.19.0

After the release workflow lands in `main`, open **Actions → Publish verified GitHub release → Run workflow**, select branch **main**, and keep version `0.19.0`. This requires a GitHub user with Actions and release permissions.

The workflow refuses to publish unless all six workflows were successful on that exact main commit: CI, Native debugger end-to-end, Native postmortem E2E, Loopback GDB remote E2E, Windows CodeLLDB minidump E2E, and CodeQL. It also runs `npm ci`, `npm run check` and `npm run check:pack` again.

Only after those checks succeed will the workflow create or validate an annotated tag `v0.19.0`, attach an npm-format source/runtime archive and `SHA256SUMS`, and publish the GitHub release with notes from `RELEASE-0.19.0.md`. A preexisting release or tag at another commit causes failure rather than overwrite.

This workflow is deliberately **manual only**: merging code or updating version metadata does not publish a release.

## Maintainer checklist

- Confirm `package.json`, `qwen-extension.json` and `src/version.js` agree on version.
- Review `npm pack --dry-run --json`: no old maps, dumps, machine reports or private data.
- Test clean Qwen extension installation and real stdio MCP discovery.
- Check support for local GDB 15, LLDB-DAP 18, Windows CodeLLDB, GDB 18 core and gdbserver remote with the dedicated CI fixture.
- Keep `private: true` unless the owner explicitly chooses and controls a new npm namespace.

Original TypeScript sources were absent from the imported repository. This fork retains editable JavaScript and regenerated declaration files.
