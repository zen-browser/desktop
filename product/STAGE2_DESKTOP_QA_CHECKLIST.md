# Stage 2 Desktop QA Checklist

Use this checklist for each internal desktop alpha artifact. Stage 2 QA is manual plus lightweight scripted checks; it is not public release certification.

## Scope

Platforms:

- macOS unsigned alpha zip
- Linux portable tar.gz
- Windows portable zip

Out of scope:

- code signing
- notarization
- installers
- updater service
- mobile
- store/package-manager publishing

## Artifact Checks

For each platform:

- Artifact archive exists.
- SHA-256 file exists.
- README-alpha exists.
- Archive extracts without errors.
- Expected executable exists.
- Executable name is Nevai-specific where Stage 2 supports it.
- No committed build outputs are required to reproduce the artifact.

Expected artifacts:

- macOS: `Nevai-macos-alpha-dev.zip`
- Linux: `Nevai-linux-alpha-dev.tar.gz`
- Windows: `Nevai-windows-alpha-dev.zip`

## Identity Checks

For each platform:

- App name displays as `Nevai`.
- About dialog displays `Nevai`.
- No visible `Nightly` branding appears in normal UI.
- No user-facing `Zen` branding appears except accepted internal/dev names.
- Updater is disabled for alpha.
- No active request is made to `updates.zen-browser.app`.
- Profile path is Nevai-specific where implemented.

macOS expected:

- `CFBundleName=Nevai`
- `CFBundleExecutable=nevai`
- `CFBundleIdentifier=app.nevai.browser.dev`
- `application.ini` has `Vendor=Nevai`, `Name=Nevai`, `Profile=nevai`

Linux expected:

- `application.ini` has `Vendor=Nevai`, `Name=Nevai`, `Profile=nevai`
- `dist/bin/nevai` exists and is executable, or the accepted Linux executable name is documented
- updater is disabled in `application.ini`

Windows expected:

- `application.ini` has `Vendor=Nevai`, `Name=Nevai`, `Profile=nevai`
- `nevai.exe` exists, or the accepted Windows executable name is documented
- updater is disabled in `application.ini`

## Runtime Checks

For each platform:

- App launches.
- New profile launch works.
- Existing profile relaunch works.
- Private window opens.
- Settings opens.
- Extensions page opens.
- About dialog opens.
- Download of a small file works.
- Google opens.
- GitHub opens.
- YouTube opens enough to verify page/media basics.

## Runtime Log Checks

Blockers:

- `Failed to load resource:///actors/ZenBoostsChild.sys.mjs`
- `Failed to load resource:///actors/ZenGlanceChild.sys.mjs`
- active `updates.zen-browser.app` request
- visible startup crash
- profile path collision with Zen in normal Stage 2 usage

Warnings that are not automatic blockers:

- internal class names such as `ZenSessionManager`
- internal module names under `src/zen`
- non-fatal JavaScript warnings from inherited Firefox/Zen code

## Pass Criteria

An artifact passes Stage 2 QA when:

- artifact and checksum exist
- archive extracts
- app launches
- identity checks pass
- updater is disabled
- blocker grep is clean
- basic browsing works

