# Publishing and versioning

The maintained source repository is [spk-c/Qwen-dap-mcp](https://github.com/spk-c/Qwen-dap-mcp). The package [`@slp-dev1/qwen-dap-mcp`](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp) is published by GitHub Actions using npm Trusted Publishing (OIDC). npm versions are immutable; the npm README changes only with a new package version.

## Releasing a new version

1. Prepare and review a version bump in `package.json`, `package-lock.json` (top-level and root package) and `qwen-extension.json`. Add changelog notes.
2. Merge to `main`, then verify **all six** workflows passed on that exact commit: CI, CodeQL, Native debugger end-to-end, Native postmortem E2E, Loopback GDB remote E2E and Windows CodeLLDB minidump E2E.
3. For tag-driven release, push an annotated tag `vX.Y.Z` at the verified `main` commit. The workflow runs automatically on `v*` tags.
4. Alternatively run **Actions → Publish verified npm and GitHub release → Run workflow** on `main`; leave the optional version input empty or match `package.json`.

The workflow validates semver, Git ancestry, versions, existing tags/releases, CI status, reproducible `npm ci`, full tests and the packed archive. It signs the publication provenance through npm OIDC, publishes **the exact tested tarball**, then creates the GitHub release and SHA256 manifest.

If npm was published successfully but GitHub release creation failed, rerunning verifies that the npm registry's `dist.integrity` equals the built tarball and then finishes the GitHub release. Mismatched archive contents are rejected. Once a GitHub release exists, the workflow refuses to overwrite it. Never reuse a published npm version or move a release tag.

**Only intentional version tags or manual workflow dispatches publish.** Normal `main` pushes do not automatically release.

## Maintainer checklist

- Keep Node runtime compatibility (>=20) and npm package metadata consistent.
- Verify `npm run check`, `npm run check:pack` and real stdio MCP discovery.
- Check that npm packages contain no private dumps, customer code, secrets or machine-specific paths.
- Keep debugger transport policies and the completed TypeScript `strict: true` gate intact.
- Run native adapter integration tests only on owned fixtures.

Historical [v0.19.0](https://github.com/spk-c/Qwen-dap-mcp/releases/tag/v0.19.0) was published as a GitHub release before npm was reconnected; [v0.19.1](https://github.com/spk-c/Qwen-dap-mcp/releases/tag/v0.19.1) was successfully published to both registries.
