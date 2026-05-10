# Stage 2 Windows Real Build Discovery

Windows source discovery already passed. This file defines the next Windows step: real build discovery.

Do not run this automatically on every push. Windows real build discovery is heavy and should be manual until the first successful shape is known.

## Current Known Good

The `nevai/stage2-windows-discovery` branch has passed:

- checkout on `windows-latest`
- Node setup
- Stage 2 source smoke
- `npm ci --ignore-scripts`

That proves the repo can be checked and validated on Windows, but it does not prove a browser build yet.

## Goal

Find the first real Windows build blocker or confirm a Windows build can complete.

Success is one of:

- Windows build succeeds and produces a `dist/bin` output.
- Windows build fails with a specific blocker that can be fixed.

## Discovery Paths

There are two possible Windows build paths.

### Path A - Native Windows Runner

Use `windows-latest` and MozillaBuild.

Expected steps:

1. Install MozillaBuild.
2. Run `npm ci`.
3. Run `npm run download`.
4. Run `npm run import`.
5. Run Mozilla bootstrap from the MozillaBuild shell.
6. Attempt build.

Expected blockers:

- MozillaBuild shell setup
- path conversion between PowerShell, Git Bash, and MozillaBuild bash
- path length
- antivirus/filesystem slowdown
- missing Windows SDK or Visual Studio component
- Node/npm visibility inside MozillaBuild shell

### Path B - Linux-Hosted Windows Cross Build

Use the repo's existing Windows release workflow pattern, which cross-builds Windows artifacts from Linux with a downloaded Visual Studio toolchain and Wine.

This path may be closer to the upstream Zen release pipeline, but it is heavier and may depend on runner capacity, cache, and release-specific assumptions.

Expected blockers:

- missing secrets used by release workflows
- unavailable self-hosted or custom runners
- Visual Studio toolchain download time
- cross-compile mozconfig assumptions
- release-only packaging paths

## Recommended Next Step

Start with a manual native Windows discovery workflow or local Windows VM run.

Do not attempt:

- installer creation
- signing
- default browser registration
- updater infrastructure
- public release packaging

## If Windows Build Succeeds

Run:

```powershell
.\scripts\qa-nevai-windows-alpha.ps1
.\scripts\package-nevai-windows-alpha.ps1
```

Expected output:

```text
Nevai-windows-alpha-dev.zip
Nevai-windows-alpha-dev.SHA256.txt
README-alpha.txt
```

## What To Capture On Failure

Record:

- runner type
- shell used
- command that failed
- first meaningful error
- last 120 log lines
- whether `engine/obj-*` exists
- whether any `dist/bin` exists
- free disk after failure

