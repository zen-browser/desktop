# Stage 6 - Public Alpha Readiness Plan

## Goal

Prepare Nevai Browser Desktop for a limited public alpha without pretending it is stable.

Stage 6 can be prepared before Stage 2 is complete, but public alpha cannot ship until the release gate passes.

## Required Public Alpha Materials

- download page
- release notes
- checksums
- README-alpha
- known issues
- privacy policy draft
- license attribution review
- support and issue workflow
- security reporting path

## Release Gate

Public alpha requires:

- at least one tested desktop artifact
- no active updater hit to Zen infrastructure
- clear platform support statement
- known issues published
- source/license obligations reviewed
- privacy policy draft published
- security reporting path points to Nevai repo

For cross-platform alpha, also require:

- Linux artifact passes basic QA
- Windows artifact passes basic QA

## Messaging Rules

Allowed:

- "early alpha"
- "internal test build"
- "macOS-only alpha" if only macOS is ready
- "known issues"

Not allowed:

- "stable"
- "secure by default" without review
- "cross-platform" before Linux and Windows artifacts pass
- "automatic updates supported" before real update infrastructure exists

## Done Criteria

Stage 6 is ready when:

- public-alpha templates are filled for the target release
- issue templates mention Nevai
- security policy points to Nevai
- release checklist passes
- download instructions match the artifacts that actually exist
