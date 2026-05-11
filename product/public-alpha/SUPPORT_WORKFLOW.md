# Public Alpha Support Workflow

## Goal

Make alpha feedback useful without promising production-level support.

## Issue Types

Use GitHub issues for:

- reproducible bugs
- crashes
- packaging failures
- visible branding mistakes
- update-policy mistakes
- platform-specific launch failures

Use discussions or planning docs for:

- feature ideas
- product direction
- mobile roadmap
- design proposals

## Required Bug Report Fields

- exact version
- artifact name
- platform and architecture
- steps to reproduce
- expected behavior
- actual behavior
- logs or screenshots when useful

## Triage Labels

Recommended labels:

- `platform: macOS`
- `platform: linux`
- `platform: windows`
- `component: branding`
- `component: packaging`
- `component: updater`
- `component: profile`
- `component: runtime`
- `alpha-blocker`
- `needs-repro`

## Alpha Response Policy

- security reports go through private advisories
- reproducible alpha blockers are prioritized
- broad feature requests are deferred
- unsupported platforms are closed or moved to planning

## Release Feedback Loop

For each alpha:

1. publish known issues
2. collect issues by artifact and platform
3. fix blockers
4. publish a follow-up alpha
5. update known issues and release notes
