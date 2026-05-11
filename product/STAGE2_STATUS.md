# Stage 2 Status

## Current Stage

Stage 2 - Desktop Cross-Platform Alpha

Current active phase:

- Phase 2.2 - Linux Build Discovery

Completed:

- Stage 1 macOS local unsigned alpha
- Stage 2.0 planning and baseline protection
- Stage 2.1 source smoke CI

## Branches

- Stage 1 baseline: `nevai/stage1-macos-alpha-baseline`
- Stage 1 tag: `stage1-macos-alpha-v0.1`
- Stage 2 plan: `nevai/stage2-planning`
- Stage 2 smoke: `nevai/stage2-ci-smoke`
- Linux discovery: `nevai/stage2-linux-discovery`

## Current Findings

- Stage 2 smoke passes on the Linux discovery branch.
- Linux setup, dependency install, source download, bootstrap, prefs, service dumps, and surfer import have passed in CI.
- Linux build starts and compiles real Firefox/Zen components.
- Prior Linux discovery failures were workflow-imposed stops, not confirmed source failures:
  - A 45 minute build timeout stopped the first long run.
  - A 15 minute quiet/stall guard stopped the next run during a quiet Rust/link-heavy phase.
- A later run was cancelled externally by GitHub while still compiling normal Firefox modules; no source/compiler error was captured.
- The current Linux discovery workflow has no internal build timeout and no stall-kill guard. GitHub Actions `timeout-minutes: 360` remains the outer job limit.
- Linux discovery now uses sccache and release-style cache variables to improve repeat attempts on GitHub-hosted runners.
- Linux discovery now uses the same `blacksmith-8vcpu-ubuntu-2404` runner class used by the existing Linux release workflow instead of raw `ubuntu-latest`.

## Current Workflow Strategy

- Let the Linux build run until it succeeds, fails with a real build error, or hits the GitHub job limit.
- Keep heartbeat output and log upload so failures are diagnosable.
- If the Linux build succeeds, run Linux QA and package `Nevai-linux-alpha-dev.tar.gz` automatically.
- Do not claim Linux artifact completion until the artifact is uploaded and QA passes.
- Do not auto-cancel in-progress Linux discovery runs on push; avoid stacking pushes while a long run is active.
- Run `mach build` in the foreground and use a sidecar heartbeat, so the build process itself is not hidden behind a background shell wrapper.

## Next Decision

After the next Linux discovery run:

- If build fails with a source error, fix that specific error.
- If build hits the 6 hour GitHub job limit, decide between caching, lower-cost build options, a larger runner, or a self-hosted runner.
- If build succeeds and `dist/bin` exists, use the uploaded Linux artifact and record the QA result.
