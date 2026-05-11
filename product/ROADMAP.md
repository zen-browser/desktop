# Nevai Browser Product Roadmap

## Current Position

Nevai Browser Desktop has a completed macOS local unsigned alpha baseline.

Stage 2 desktop cross-platform work is active but not complete. Linux and Windows must still produce real artifacts before the desktop product can be described as cross-platform.

## Stage 1 - macOS Foundation

Status: complete.

Output:

- `Nevai.app` local unsigned alpha
- Nevai app identity on macOS
- Nevai logo and dock icon
- Nevai executable name
- Nevai profile path
- updater disabled for alpha
- repeatable macOS build, QA, and packaging scripts

## Stage 2 - Desktop Cross-Platform Alpha

Status: active, runner-dependent.

Output target:

- `Nevai-macos-alpha-dev.zip`
- `Nevai-linux-alpha-dev.tar.gz`
- `Nevai-windows-alpha-dev.zip`

Current rule:

- Do not mark Stage 2 complete until Linux and Windows artifacts exist and pass basic QA.
- Heavy Linux and Windows builds are manual discovery jobs.
- Normal pushes should run lightweight smoke checks only.

## Stage 3 - Desktop Packaging Polish

Status: planned.

Output target:

- macOS DMG candidate
- hardened Linux portable package and selected next package format
- Windows portable candidate, then installer research

Stage 3 can be planned while Stage 2 is blocked, but packaging implementation depends on Stage 2 artifacts.

## Stage 4 - Signing And Release Trust

Status: planned.

Output target:

- macOS Developer ID signing and notarization plan
- Windows code signing plan
- Linux checksum/signature policy

Implementation waits until artifact identities and package formats are stable.

## Stage 5 - Update Infrastructure

Status: planned.

Output target:

- real update strategy
- MAR/update metadata plan if using Firefox updater
- alpha policy that keeps automatic updates disabled until infrastructure exists

Do not redirect updater traffic to a fake Nevai host.

## Stage 6 - Public Alpha Readiness

Status: planned.

Output target:

- release notes
- privacy policy draft
- license attribution checklist
- known issues
- support and issue workflow
- download page requirements

Public alpha is not allowed until the release gate passes.

## Stage 7 - Mobile Split

Status: planned only.

Repos:

- `nevai-browser-android`
- `nevai-browser-ios`

Mobile work should not be mixed into this desktop repo.

## Stage 8 - Product Ecosystem

Status: planned only.

Future work:

- website
- docs
- support
- crash reporting decision
- telemetry/privacy decision
- account/sync strategy
- update service

Planning file:

- `product/STAGE8_PRODUCT_ECOSYSTEM_PLAN.md`
