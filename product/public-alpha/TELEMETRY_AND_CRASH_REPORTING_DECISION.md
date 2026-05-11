# Telemetry And Crash Reporting Decision

## Alpha Decision

For early alpha planning:

- telemetry: not enabled unless explicitly documented in release notes
- crash reporting: not enabled unless explicitly documented in release notes
- account sync: not included
- automatic updates: disabled

## Required Before Public Alpha

Record the actual build behavior:

- whether telemetry code is compiled in
- whether telemetry upload is enabled
- whether crash reporter is compiled in
- whether crash upload is enabled
- which preferences control the behavior
- which hostnames are contacted if enabled

## User-Facing Requirement

Release notes and privacy policy must state the real behavior.

Do not use vague wording such as "privacy focused" as a substitute for documenting what the build does.

## Future Decision Points

If telemetry or crash reporting is introduced later:

- make it explicit
- use Nevai-controlled infrastructure or a documented provider
- provide user controls
- document retention and access
- document how to disable it
