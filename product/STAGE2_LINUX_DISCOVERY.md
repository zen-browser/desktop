# Stage 2 - Linux Build Discovery

## Goal

Find the first real Linux blocker or confirm that a Linux build can complete.

This phase is discovery. Do not package Linux yet unless the build succeeds and the output layout is understood.

## Branch

Use a dedicated branch after the smoke workflow is green:

```bash
git switch nevai/stage2-ci-smoke
git switch -c nevai/linux-build-discovery
```

## What To Run

Run these on a Linux machine or Linux CI runner. Prefer Ubuntu first.

```bash
git status --short --branch
./scripts/check-nevai-stage2-source.sh
npm ci
npm run download
npm run bootstrap
npm run import
npm run surfer -- build --skip-patch-check
```

If `npm run import` fails because the engine checkout already contains a conscious local diff, stop and paste the output before using `--skip-patch-check` in a new place.

## What To Capture

Paste back:

- OS and version
- CPU architecture
- free disk before build
- command that failed
- first error block
- last 80 lines of output
- whether `engine/obj-*` exists
- whether any `dist` browser output exists

## Expected Blockers

- Missing Linux system packages
- GitHub runner disk limits
- Firefox/Zen dependency bootstrap failure
- Surfer platform assumptions
- Shell path assumptions
- Actor packaging differences
- Linux icon or desktop metadata gaps

## Success

One of these is enough:

- Linux build succeeds.
- Linux build fails and the first real blocker is documented clearly enough to fix.

## Do Not Do Yet

- Do not create `.deb`, AppImage, Flatpak, Snap, or rpm.
- Do not add Linux package scripts until the output layout is known.
- Do not redirect updater URLs.
- Do not rename internal Zen modules.
