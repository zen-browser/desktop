# Alpha Release Checklist

Use this checklist before publishing any Nevai Browser Desktop alpha.

## Scope

Release type:

- [ ] internal alpha
- [ ] macOS public alpha
- [ ] desktop cross-platform alpha

Platforms included:

- [ ] macOS
- [ ] Linux
- [ ] Windows

## Artifact Gate

- [ ] artifact exists for every platform claimed
- [ ] artifact launches on every platform claimed
- [ ] artifact has SHA-256 checksum
- [ ] artifact has README-alpha
- [ ] artifact version is recorded
- [ ] artifact source commit is recorded

## Identity Gate

- [ ] app name says Nevai
- [ ] About dialog says Nevai
- [ ] app icon is Nevai
- [ ] profile path is Nevai-specific
- [ ] normal UI has no visible `Nightly`
- [ ] normal UI has no user-facing Zen branding except documented internal/dev names

## Update Gate

- [ ] automatic updater is disabled for alpha
- [ ] no runtime request to `updates.zen-browser.app`
- [ ] release notes say updates are manual

## Privacy And Legal Gate

- [ ] privacy policy draft exists
- [ ] telemetry/crash-reporting decision is recorded
- [ ] external services inventory is reviewed
- [ ] license attribution checklist is reviewed
- [ ] security reporting path points to Nevai

## Support Gate

- [ ] known issues file exists
- [ ] issue template says Nevai
- [ ] support workflow is documented
- [ ] release notes link to known issues

## Final Decision

- [ ] approved for release
- [ ] blocked

Blocking reason:

```text

```
