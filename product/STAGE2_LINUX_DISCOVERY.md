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

The GitHub Actions discovery workflow currently runs the build through a generated Linux mozconfig and a direct `./mach build` after surfer import. It intentionally has no internal build timeout and no quiet-output stall killer, because Firefox/Rust link phases can be quiet for a long time. The only outer cap is the GitHub Actions job timeout.

The workflow also uses the repo's stronger Linux release runner class, sccache, and GitHub Actions cache variables. If the runner cancels before the first full build, repeat runs should have a better chance of reusing compiled work instead of starting completely cold.

The build runs in the foreground with a sidecar heartbeat. This avoids hiding `mach build` behind a background wrapper while still keeping regular CI output visible.

Do not push repeatedly to the Linux discovery branch while a long run is active. The workflow is configured not to auto-cancel in-progress runs, but stacked full browser builds still waste runner time.

If CI produces a successful `dist/bin`, it immediately runs:

```bash
./scripts/package-nevai-linux-alpha.sh
```

That package script runs Linux QA first, then creates:

```text
Nevai-linux-alpha-dev.tar.gz
Nevai-linux-alpha-dev.SHA256.txt
README-alpha.txt
```

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

Linux artifact success requires more than a completed compile:

- Linux QA passes.
- `Nevai-linux-alpha-dev.tar.gz` is uploaded by CI.
- SHA-256 and README-alpha are uploaded with the artifact.

## Do Not Do Yet

- Do not create `.deb`, AppImage, Flatpak, Snap, or rpm.
- Do not add Linux package scripts until the output layout is known.
- Do not redirect updater URLs.
- Do not rename internal Zen modules.
