# Stage 2 Artifact Review

Use this after CI or local scripts produce a desktop alpha artifact.

## Required Files

Each platform artifact should ship with:

- archive
- SHA-256 file
- README-alpha

Expected names:

- `Nevai-macos-alpha-dev.zip`
- `Nevai-macos-alpha-dev.SHA256.txt`
- `Nevai-linux-alpha-dev.tar.gz`
- `Nevai-linux-alpha-dev.SHA256.txt`
- `Nevai-windows-alpha-dev.zip`
- `Nevai-windows-alpha-dev.SHA256.txt`
- `README-alpha.txt`

## Review Steps

1. Download the artifact and SHA-256 file.
2. Verify the checksum.
3. Extract the archive into a clean temporary directory.
4. Confirm the executable exists.
5. Confirm alpha README exists and says updater is disabled.
6. Run the platform QA checklist.
7. Record results in `product/STAGE2_STATUS.md` or the release notes draft.

## macOS Quick Commands

```bash
shasum -a 256 Nevai-macos-alpha-dev.zip
unzip -q Nevai-macos-alpha-dev.zip -d test-unzip
plutil -p test-unzip/Nevai.app/Contents/Info.plist
```

## Linux Quick Commands

```bash
sha256sum Nevai-linux-alpha-dev.tar.gz
mkdir -p test-linux
tar -xzf Nevai-linux-alpha-dev.tar.gz -C test-linux
find test-linux -maxdepth 3 -type f -name application.ini -print
```

## Windows Quick Checks

Use PowerShell:

```powershell
Get-FileHash .\Nevai-windows-alpha-dev.zip -Algorithm SHA256
Expand-Archive .\Nevai-windows-alpha-dev.zip .\test-windows
Get-ChildItem .\test-windows -Recurse -Filter application.ini
```

## Blockers

- checksum mismatch
- archive does not extract
- app does not launch
- `Nightly` visible in normal UI
- active updater points at Zen infrastructure
- actor load errors for `ZenBoostsChild` or `ZenGlanceChild`
- missing README-alpha

