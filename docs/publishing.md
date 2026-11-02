# Publishing and versioning

The maintained source repository is [spk-c/Qwen-dap-mcp](https://github.com/spk-c/Qwen-dap-mcp). The npm package is [`@slp-dev1/qwen-dap-mcp`](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp), published through GitHub Actions **npm Trusted Publishing** with OIDC (no long-lived npm write token). SLP-DEV1 remains credited as the original project author under Apache-2.0.

The GitHub source tree and npm listing are **not automatically synchronized**: npm displays the `README.md` from the latest published tarball. A new version must be published to update the npm README. Never overwrite an existing version.

## Patch release 0.19.1

This patch release updates the npm-facing README, installation and documentation links, ownership/distribution wording, and release metadata without claiming new debugger runtime features.

1. Verify matching `package.json`, `package-lock.json`, and `qwen-extension.json` versions (`0.19.1`), npm scope, and `private: false`.
2. Confirm the npm package [Trusted Publisher](https://docs.npmjs.com/trusted-publishers/) configuration: **GitHub Actions**, owner `spk-c`, repository `Qwen-dap-mcp`, workflow filename `release.yml`, environment blank, and `Allow npm publish` enabled.
3. Merge the release PR. Wait until all **six** required GitHub Actions workflows have succeeded on the exact merge commit: CI, Native debugger end-to-end, Native postmortem E2E, Loopback GDB remote E2E, Windows CodeLLDB minidump E2E, and CodeQL.
4. From **Actions → Publish verified npm and GitHub release → Run workflow**, select `main` and enter `0.19.1`. This workflow is **manual**, not a push-triggered auto-release.
5. The workflow reruns `npm ci`, `npm run check`, and `npm run check:pack`; creates the npm archive and SHA256 manifest; publishes a new version with npm OIDC; then tags and creates the GitHub release.
6. Verify that [npm](https://www.npmjs.com/package/@slp-dev1/qwen-dap-mcp) reports version `0.19.1`, shows the new README, and links to the maintained GitHub repository. Also inspect [GitHub Releases](https://github.com/spk-c/Qwen-dap-mcp/releases).

If the npm version already exists, **do not republish it**. Prepare a new patch version. If npm succeeds but GitHub release creation fails, recover the matching GitHub tag/release separately without publishing the same npm version again.

## Maintainer checklist

- Check package archive with `npm run check:pack` and ensure `README.md`, `LICENSE`, `NOTICE`, extension metadata, and built runtime are included, but no developer secrets, dumps, or machine-specific paths.
- Test clean Qwen extension installation and stdio MCP discovery.
- Keep live launch/attach capabilities distinct from `QWEN_DAP_MCP_PROFILE=inspect` and preserve fail-closed DAP policies.
- Run native adapter integration tests only on owned test targets.
- TypeScript `strict: true` is still tracked in [issue #24](https://github.com/spk-c/Qwen-dap-mcp/issues/24); the released package does not claim full strict compliance.

The historical [v0.19.0 GitHub release](https://github.com/spk-c/Qwen-dap-mcp/releases/tag/v0.19.0) was created before npm publishing was reconnected. Its release archive is not evidence that npm was updated.
