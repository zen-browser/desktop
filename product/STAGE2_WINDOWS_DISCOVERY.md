# Stage 2 - Windows Build Discovery

## Goal

Find the first real Windows blocker or confirm that a Windows build can complete.

This phase is discovery. Do not package Windows yet unless the build succeeds and the output layout is understood.

## Branch

Use a dedicated branch after the smoke workflow is green:

```bash
git switch nevai/stage2-ci-smoke
git switch -c nevai/windows-build-discovery
```

## What To Run

Run these on a Windows machine, Windows VM, or Windows CI runner with the required Mozilla build environment.

Start with source checks:

```powershell
git status --short --branch
bash ./scripts/check-nevai-stage2-source.sh
```

Then attempt the build through the shell/environment that Mozilla/Zen expects on Windows:

```powershell
npm ci
npm run download
npm run bootstrap
npm run import
npm run surfer -- build --skip-patch-check
```

If the shell changes from PowerShell to MozillaBuild bash, record that explicitly.

## What To Capture

Paste back:

- Windows version
- shell used for each command
- CPU architecture
- free disk before build
- whether MozillaBuild is installed
- command that failed
- first error block
- last 80 lines of output
- whether `engine/obj-*` exists
- whether any `dist` browser output exists

## Expected Blockers

- MozillaBuild setup
- path length
- antivirus or filesystem slowdown
- PowerShell vs bash assumptions
- Node/npm shell behavior
- VisualElements or icon asset gaps
- binary name / `.exe` identity
- updater UI when updater is disabled
- actor packaging differences
- disk limits

## Success

One of these is enough:

- Windows build succeeds.
- Windows build fails and the first real blocker is documented clearly enough to fix.

## Do Not Do Yet

- Do not create an installer.
- Do not attempt Windows code signing.
- Do not add default-browser registry integration.
- Do not redirect updater URLs.
- Do not rename internal Zen modules.
