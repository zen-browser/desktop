# Stage 4 - Signing And Release Trust Plan

## Goal

Make Nevai Browser Desktop artifacts trustworthy enough for broader distribution.

Stage 4 starts after Stage 2 artifacts exist and Stage 3 packaging candidates are stable.

## Out Of Scope

- Android and iOS
- real updater service implementation
- public stable release
- store publishing
- changing internal Zen module names

## macOS

Target output:

- signed `Nevai.app`
- notarized macOS package
- reproducible signing instructions

Prerequisites:

- stable bundle ID
- stable executable name
- stable app name
- stable hardened runtime policy
- Apple Developer account
- signing certificate and secure secret storage

Checks:

- app launches after signing
- notarization succeeds
- Gatekeeper accepts the package
- permissions prompts still say Nevai
- updater remains disabled unless real update infrastructure exists

## Windows

Target output:

- signed executable or package
- documented certificate strategy
- repeatable signing workflow

Prerequisites:

- selected Windows artifact format
- stable executable identity
- stable icon resources
- code signing certificate decision
- secure secret storage

Checks:

- executable launches after signing
- app title and icon remain Nevai
- package checksum is published
- updater remains disabled unless real update infrastructure exists

## Linux

Target output:

- checksum policy
- optional detached signatures
- documented package metadata

Prerequisites:

- selected Linux package format
- stable executable path
- stable desktop entry
- stable icon path

Checks:

- checksum validates
- package metadata says Nevai
- updater remains disabled unless real update infrastructure exists

## Done Criteria

Stage 4 is complete when:

- signing/trust requirements are documented per OS
- at least macOS signing/notarization has a tested path
- Windows signing decision is recorded
- Linux integrity policy is recorded
- no signing secrets are committed
- release artifacts can be verified by users
