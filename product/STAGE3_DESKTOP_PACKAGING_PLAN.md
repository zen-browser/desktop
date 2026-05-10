# Stage 3 Desktop Packaging Plan

Stage 3 starts after Stage 2 produces internal desktop alpha artifacts for macOS, Linux, and Windows.

## Goal

Turn Stage 2 portable/internal artifacts into better desktop packaging candidates.

Stage 3 is still not the public stable release.

## Inputs

Required Stage 2 outputs:

- macOS unsigned alpha artifact
- Linux portable alpha artifact
- Windows portable alpha artifact
- per-platform SHA-256 files
- per-platform README-alpha files
- Stage 2 known issues

## Out Of Scope

- Android
- iOS
- accounts and sync
- real updater infrastructure
- public stable release
- package-manager publishing
- default browser registration polish

## Phase 3.1 - macOS DMG Candidate

Goal:

Create a simple unsigned `Nevai.dmg` candidate from the existing `Nevai.app`.

Checks:

- DMG opens.
- Drag-install layout works.
- App launches after copy to `/Applications`.
- app identity remains Nevai.
- updater remains disabled.

Not included yet:

- Developer ID signing
- notarization
- auto-update integration

## Phase 3.2 - Linux Packaging Candidate

Goal:

Choose the first Linux packaging format after the portable tar.gz works.

Recommended order:

1. portable tar.gz hardening
2. AppImage candidate
3. `.deb` candidate
4. Flatpak candidate

Checks:

- desktop entry name is Nevai
- icon resolves correctly
- executable path is correct
- profile path is Nevai-specific
- updater remains disabled

## Phase 3.3 - Windows Portable Candidate

Goal:

Improve the Windows portable zip before creating an installer.

Checks:

- executable name is Nevai-specific or documented
- icon and app title are Nevai
- About dialog is Nevai
- updater remains disabled
- no `Nightly` visible in normal UI

## Phase 3.4 - Windows Installer Research

Goal:

Plan installer work without committing to it too early.

Research:

- installer branding
- uninstaller branding
- install path
- Start Menu shortcut name
- taskbar icon
- registry/default-browser scope
- unsigned installer warnings

## Phase 3.5 - Signing And Trust Plan

Goal:

Define what is required before public distribution.

macOS:

- Apple Developer account
- Developer ID certificate
- hardened runtime review
- notarization workflow

Windows:

- code signing certificate
- signed executable and installer
- SmartScreen reputation strategy

Linux:

- checksums
- release signing decision
- package metadata review

## Stage 3 Done Criteria

Stage 3 is complete when:

- macOS DMG candidate exists
- Linux packaging path is chosen and at least one candidate exists
- Windows portable candidate exists
- installer/signing requirements are documented
- updater remains disabled or a real update strategy is ready
- no public release claim is made before legal/privacy/release infrastructure is ready

