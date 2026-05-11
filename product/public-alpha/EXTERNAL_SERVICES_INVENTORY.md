# External Services Inventory

This inventory must be reviewed before public alpha.

## Current Alpha Policy

- Do not use Zen update infrastructure.
- Keep automatic updates disabled.
- Do not enable Nevai account or sync services.
- Document inherited upstream service behavior before release.

## Services To Audit

### Updates

Expected alpha state:

- disabled
- no `updates.zen-browser.app`
- no fake `updates.nevai.app`

### Search

Record:

- default search engine
- search suggestions behavior
- whether typed text is sent before submission

### Safe Browsing

Record:

- whether inherited safe-browsing features are enabled
- provider hostnames
- API key source

### Certificates And Revocation

Record:

- inherited certificate services
- OCSP/CRLite behavior
- provider hostnames if user-visible/privacy-relevant

### Extensions

Record:

- extension discovery source
- extension update source
- whether Mozilla add-ons infrastructure is contacted

### Telemetry

Expected alpha state:

- must be explicitly documented as enabled or disabled

### Crash Reporting

Expected alpha state:

- must be explicitly documented as enabled or disabled

## Release Requirement

Before public alpha, every active network service that is not obvious browsing traffic must be documented or intentionally disabled.
