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
- Latest blocker is Linux build completion on GitHub-hosted runner, with prior runs ending from termination or stall behavior during the build.

## Current Workflow Strategy

- Keep Linux discovery bounded with a timeout and stall guard.
- Upload logs and partial output inspection before failing the job.
- Do not claim Linux artifact completion until `dist/bin` output is produced and QA passes.

## Next Decision

After the next Linux discovery run:

- If build fails with a source error, fix that specific error.
- If build times out or stalls again, tune runner resources or build parallelism.
- If build succeeds and `dist/bin` exists, run Linux QA and then package `Nevai-linux-alpha-dev.tar.gz`.
