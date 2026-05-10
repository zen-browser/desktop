# Stage 1 — macOS Local Unsigned Alpha

## Status

Stage 1 is complete for a local unsigned macOS alpha.

## Baseline branch

`nevai/stage1-macos-alpha-baseline`

## Build

```bash
./scripts/build-nevai-macos-alpha.sh
```

## QA

```bash
./scripts/qa-nevai-macos-alpha.sh
```

## Package

```bash
./scripts/package-nevai-macos-alpha.sh
```

## Acceptance

- `Nevai.app` builds and launches locally on macOS.
- Bundle identity uses Nevai app metadata.
- Runtime profile path uses `nevai`.
- Automatic updater is disabled for alpha.
- Zen JSWindowActor files are present as real files in the built app bundle.
- Basic manual browsing smoke tests pass.

## Limits

- This is an unsigned, local macOS alpha baseline.
- Code signing, notarization, public update infrastructure, and cross-platform desktop builds are later-stage work.
