# Mobile Shared Requirements

These requirements apply later to `nevai-browser-android` and `nevai-browser-ios`.

## Product Identity

- app name: Nevai Browser
- brand assets come from a shared source
- platform-specific icons are generated from approved sources
- package/bundle identifiers are Nevai-owned

## Privacy Defaults

- document telemetry behavior
- document crash reporting behavior
- document search suggestion behavior
- document external services
- do not inherit update or support URLs silently

## Release Requirements

- separate release notes per mobile platform
- separate known issues per mobile platform
- TestFlight/Internal testing before public store release
- store listing text reviewed for attribution and accuracy

## Desktop Boundary

Do not copy desktop build scripts into mobile repos.

Do not make mobile implementation depend on desktop artifact output.

Shared assets and policy text should move into a future shared product source when needed.
