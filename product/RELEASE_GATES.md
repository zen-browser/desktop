# Release Gates

## Gate 1 - Internal macOS Alpha

Required:

- macOS artifact exists
- macOS QA passes
- checksum exists
- updater disabled
- known issues recorded

Status:

- passed for Stage 1 baseline

## Gate 2 - Desktop Cross-Platform Internal Alpha

Required:

- macOS artifact exists
- Linux artifact exists
- Windows artifact exists
- checksums exist for all artifacts
- basic QA passes on all claimed platforms
- updater disabled on all platforms

Status:

- not passed
- blocked on Linux and Windows build artifacts

## Gate 3 - Public Alpha

Required:

- target-platform artifact passes QA
- release notes exist
- known issues exist
- privacy policy draft exists
- license attribution checklist is reviewed
- security reporting path points to Nevai
- download page matches actual artifacts

Status:

- not passed

## Gate 4 - Public Cross-Platform Alpha

Required:

- Gate 2 passed
- Gate 3 passed
- platform-specific known issues published
- support workflow ready

Status:

- not passed

## Gate 5 - Beta

Required:

- signing strategy implemented or explicitly scoped
- update strategy implemented or explicitly disabled
- repeated artifact builds are stable
- serious alpha blockers are fixed

Status:

- not started

## Gate 6 - Stable

Required:

- signed/trusted artifacts
- update/security process
- privacy/legal review
- support process
- release cadence

Status:

- not started
