# Temporal patches done to Firefox

**IMPORTANT**: Once they start failing (on new Firefox releases), they should be removed as these patches are imported from future versions of Firefox as temporary solutions while we wait.

## firefox_profile_migrator_scan_external.patch

adds _getExternalFirefoxProfiles to FirefoxProfileMigrator so it scans the standard firefox profiles.ini instead of only checking the toolkit profile service which doesnt know about firefox profiles on forks. backup for the runtime fix in ZenExternalFirefoxProfileScanner.sys.mjs
