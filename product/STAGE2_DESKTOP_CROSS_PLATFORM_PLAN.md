# Stage 2 - Desktop Cross-Platform Alpha

## Current Baseline

Stage 1 is complete for a local unsigned macOS alpha.

Protected baseline:

- Branch: `nevai/stage1-macos-alpha-baseline`
- Tag: `stage1-macos-alpha-v0.1`
- Output: `Nevai-macos-alpha-dev.zip`
- Scope: local/manual macOS alpha, unsigned and not notarized

Stage 2 must build from this baseline without reopening broad Stage 1 rebrand work.

## Goal

Produce internal unsigned Nevai Browser Desktop alpha artifacts for all desktop operating systems:

- macOS: `Nevai-macos-alpha-dev.zip`
- Linux: `Nevai-linux-alpha-dev.tar.gz`
- Windows: `Nevai-windows-alpha-dev.zip`

The goal is cross-platform proof and repeatable internal artifacts. Stage 2 is not a public release.

## Product Rules

- Keep Android and iOS out of this repo and out of Stage 2.
- Keep updater disabled for alpha on every OS.
- Do not add fake `updates.nevai.app` update infrastructure.
- Do not rename internal `src/zen` modules, classes, actors, or storage names in Stage 2.
- Do not start installers, signing, notarization, or package-manager publishing yet.
- Do not globally replace `Zen` with `Nevai`.
- Prefer small branches and checkpoint commits.
- Keep macOS Stage 1 scripts working while adding Linux and Windows.

## Out Of Scope

- Android
- iOS
- accounts or sync
- real updater server
- public release
- macOS signing or notarization
- Windows code signing
- Linux AppImage, deb, rpm, Flatpak, Snap
- Windows installer
- default browser registration
- large UI redesigns
- mods marketplace infrastructure

## Stage 2 Definition Of Done

Stage 2 is complete only when:

- macOS artifact still builds from the Stage 1 scripts.
- Linux portable artifact exists.
- Windows portable artifact exists.
- Each artifact has a checksum file.
- Each artifact has a README-alpha file.
- Updater is disabled in every artifact.
- Normal UI has no visible `Nightly` blockers.
- Normal UI has no visible `Zen` blockers except known internal/dev names.
- Basic launch/runtime checks pass per OS.
- Runtime blocker grep is clean where logs are available.
- Stage 2 completion tag exists, for example `stage2-desktop-alpha-v0.2`.

## Risk Register

### Heavy Browser Builds

Firefox/Zen builds are expensive. Stage 2 should not begin with a full CI build matrix. Start with smoke checks, then one OS at a time.

### Runner Limits

GitHub-hosted runners may fail from disk, RAM, package, or timeout limits. A failed build is acceptable if it identifies the first real blocker.

### macOS Post-Build Fixes

Stage 1 currently has macOS post-build actor-file handling. Stage 2 must verify whether Linux and Windows need the same fix, a different fix, or no fix.

### Generated Engine Checkout

Some scripts patch files under `engine/` before building. Stage 2 scripts must stay idempotent and must not depend on manually edited generated output.

### Platform Identity

macOS identity is `.app` and `Info.plist`. Linux and Windows need separate checks for binary names, icons, desktop metadata, executable names, and visible branding.

## Phase 2.0 - Planning And Baseline Protection

Goal:

Protect Stage 1 and define Stage 2 before adding workflows or platform build code.

Actions:

- Keep `nevai/stage1-macos-alpha-baseline` as the Stage 1 branch.
- Keep `stage1-macos-alpha-v0.1` pointing at the verified Stage 1 completion commit.
- Add this plan file on `nevai/stage2-planning`.
- Do not change build logic in this phase.

Success:

- Stage 1 branch is clean.
- Stage 1 tag is correct.
- Stage 2 plan is committed and pushed.

## Phase 2.1 - CI Smoke

Goal:

Prove GitHub Actions can run basic repo checks without doing full browser builds.

Checks:

- Checkout works.
- Node/npm install step works.
- `surfer.json` is valid JSON.
- Stage 1 scripts exist and pass shell syntax checks.
- Product plan files exist.
- No generated `engine/obj-*` or local build artifact is committed.
- Branding audit script can run if it is lightweight.

Success:

- A smoke workflow passes on at least Ubuntu.
- A follow-up matrix smoke workflow passes on macOS, Linux, and Windows.

Notes:

- Use the current supported major version of GitHub actions at implementation time.
- Do not add full Firefox builds in the first CI workflow.

## Phase 2.2 - Linux Build Discovery

Goal:

Attempt Linux build work in a controlled way and identify the first real blocker.

Actions:

- Start from a dedicated branch, for example `nevai/linux-build-discovery`.
- Run the smallest Linux setup that reaches surfer/bootstrap/build discovery.
- Capture the first blocker clearly.
- Avoid packaging until a Linux build shape is understood.

Expected blockers:

- Missing system packages
- Disk limits
- Cache size
- Linux-specific shell assumptions
- Surfer platform assumptions
- Icon or desktop metadata gaps
- Actor packaging differences

Success:

- Linux build succeeds, or
- Linux build fails with a documented first blocker and next fix.

Current CI rule:

- Heavy Linux discovery runs are manual-only. Normal pushes should run source smoke, not a full browser build.
- Do not kill quiet Linux build phases from workflow logic. Let the build finish, fail naturally, or hit the GitHub job limit.
- If the build succeeds, run Linux QA and package/upload the portable artifact in the same workflow run.

## Phase 2.3 - Linux Portable Artifact

Goal:

Produce the first internal Linux portable artifact.

Target:

- `Nevai-linux-alpha-dev.tar.gz`

Likely files after discovery:

- `scripts/build-nevai-linux-alpha.sh`
- `scripts/qa-nevai-linux-alpha.sh`
- `scripts/package-nevai-linux-alpha.sh`

Checks:

- Nevai executable launches.
- App name is Nevai.
- Icon assets are present.
- Profile path is Nevai-like.
- Updater is disabled.
- No actor load errors.
- No visible `Nightly` blockers.
- No user-facing `Zen` blockers except accepted internal/dev names.

Success:

- Linux portable artifact exists with checksum and README-alpha.

## Phase 2.4 - Windows Build Discovery

Goal:

Attempt Windows build work in a controlled way and identify the first real blocker.

Actions:

- Start from a dedicated branch, for example `nevai/windows-build-discovery`.
- Identify whether the repo can build through GitHub Actions, a VM, or a local Windows machine.
- Capture path, shell, dependency, and disk failures clearly.

Expected blockers:

- MozillaBuild setup
- Path length
- PowerShell vs bash assumptions
- Node/npm shell behavior
- Windows icon and VisualElements assets
- Binary name and `.exe` identity
- Updater UI when updater is disabled
- Actor packaging differences
- Disk limits

Success:

- Windows build succeeds, or
- Windows build fails with a documented first blocker and next fix.

## Phase 2.5 - Windows Portable Artifact

Goal:

Produce the first internal Windows portable artifact.

Target:

- `Nevai-windows-alpha-dev.zip`

Likely files after discovery:

- `scripts/build-nevai-windows-alpha.ps1` or `.sh`
- `scripts/qa-nevai-windows-alpha.ps1`
- `scripts/package-nevai-windows-alpha.ps1`

Checks:

- `nevai.exe` exists, or the accepted Windows executable name is documented.
- Browser launches.
- Taskbar icon is Nevai.
- App title is Nevai.
- About dialog is Nevai.
- Settings opens.
- Updater is disabled.
- No actor load errors.
- No visible `Nightly` blockers.
- No user-facing `Zen` blockers except accepted internal/dev names.

Success:

- Windows portable artifact exists with checksum and README-alpha.

Current prep:

- Windows source discovery passes.
- Windows real build discovery runbook exists.
- Windows QA and package scripts are ready for the first successful `dist/bin` output.

## Phase 2.6 - Cross-Platform CI Matrix

Goal:

Make checks repeatable across macOS, Linux, and Windows.

Start with:

- Source checks
- Script existence
- Shell syntax where applicable
- JSON validation
- No generated build artifacts committed

Then add:

- macOS package job
- Linux package job
- Windows package job
- Artifact upload
- Checksum upload

Success:

- CI either uploads all internal alpha artifacts or documents exact runner limitations.

## Phase 2.7 - Stage 2 Completion

Goal:

Close the desktop cross-platform alpha stage cleanly.

Actions:

- Run per-OS QA scripts.
- Create checksums.
- Produce README-alpha files.
- Record known issues.
- Create Stage 2 completion tag.

Suggested tag:

- `stage2-desktop-alpha-v0.2`

## Immediate Next Step After This Plan

Start Phase 2.1 only:

- Add a lightweight GitHub Actions smoke workflow.
- Do not add full builds yet.
- Do not add Linux or Windows packaging scripts until discovery proves the build shape.

Repo-side Phase 2.1 files:

- `.github/workflows/nevai-stage2-smoke.yml`
- `scripts/check-nevai-stage2-source.sh`
- `product/STAGE2_LINUX_DISCOVERY.md`
- `product/STAGE2_WINDOWS_DISCOVERY.md`
- `product/STAGE2_BUILD_RESULTS_TEMPLATE.md`

Linux and Windows discovery prep files:

- `.github/workflows/nevai-linux-discovery.yml`
- `.github/workflows/nevai-windows-discovery.yml`
- `scripts/qa-nevai-linux-alpha.sh`
- `scripts/package-nevai-linux-alpha.sh`
- `product/STAGE2_STATUS.md`
