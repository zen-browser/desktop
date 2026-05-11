# Stage 5 - Update Infrastructure Plan

## Goal

Define and implement a real update strategy for Nevai Browser Desktop.

Alpha builds must keep automatic updates disabled until this exists.

## Current Policy

- Do not use `updates.zen-browser.app`.
- Do not point builds at a fake `updates.nevai.app`.
- Use an inert placeholder such as `updates.invalid` only when tooling requires a hostname.
- Keep updater disabled for local/internal alpha artifacts.

## Options

### Option A - No Automatic Updates For Alpha

Use manual downloads and checksums.

Pros:

- safest early path
- avoids broken update promises
- avoids accidental Zen infrastructure traffic

Cons:

- users must install new builds manually
- issue reports may come from stale builds

### Option B - Real Firefox-Style Update Pipeline

Build update metadata, MAR packages, signing, hosting, and validation.

Pros:

- proper desktop update experience
- closer to real browser distribution

Cons:

- more infrastructure
- more signing requirements
- higher release risk

### Option C - External Installer/Package Manager Updates

Use platform packaging systems later where appropriate.

Pros:

- may reduce custom update server work

Cons:

- platform-specific
- not enough for all desktop OSes

## Required Decisions

- update channel names
- production update hostname
- staging update hostname
- MAR signing approach
- rollback approach
- minimum supported old version
- emergency update process

## Done Criteria

Stage 5 is complete when:

- update strategy is selected
- alpha updater policy is documented
- production update host exists or updater remains disabled
- test update path works in staging
- no build contacts Zen update infrastructure
