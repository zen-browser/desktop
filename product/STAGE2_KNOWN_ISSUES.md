# Stage 2 Known Issues

This file tracks Stage 2 desktop cross-platform alpha issues. Keep it factual and update it after each CI or manual QA result.

## Open

### Linux Build Result Pending

Status: pending CI result

The Linux discovery workflow currently runs without internal build timeout or stall guard. It should either:

- complete the build and upload `Nevai-linux-alpha-dev`, or
- fail with the first real Linux build blocker, or
- hit GitHub Actions job timeout.

### Linux Artifact QA Pending

Status: blocked by Linux build result

After Linux artifact upload, run Stage 2 artifact review and Linux QA.

### Windows Real Build Pending

Status: not started

Windows source discovery passes. Windows QA/package scripts and a real-build discovery runbook exist. The next Windows step is real build discovery using MozillaBuild or the repo's existing Linux-hosted Windows cross-build pattern.

### Windows Artifact Pending

Status: blocked by Windows real build discovery

No Windows portable alpha artifact exists yet.

### Stage 3 Packaging Decisions Pending

Status: planned after Stage 2 artifacts

Stage 3 packaging polish should start only after Stage 2 has macOS, Linux, and Windows internal alpha artifacts.

## Closed

### macOS Stage 1 Alpha Complete

Status: closed

Protected by:

- branch `nevai/stage1-macos-alpha-baseline`
- tag `stage1-macos-alpha-v0.1`

### Windows Source Discovery Passed

Status: closed

Windows checkout, Node setup, Stage 2 source smoke, and `npm ci --ignore-scripts` passed on GitHub Actions.
