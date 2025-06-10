// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref("datareporting.policy.dataSubmissionEnabled", false, locked);
pref("datareporting.healthreport.uploadEnabled", false, locked);
pref("toolkit.telemetry.unified", false, locked);
pref("toolkit.telemetry.enabled", false, locked);
pref("toolkit.telemetry.server", "data:,", locked);
pref("toolkit.telemetry.archive.enabled", false, locked);
pref("toolkit.telemetry.newProfilePing.enabled", false, locked);
pref("toolkit.telemetry.shutdownPingSender.enabled", false, locked);
pref("toolkit.telemetry.updatePing.enabled", false, locked);
pref("toolkit.telemetry.bhrPing.enabled", false, locked);
pref("toolkit.telemetry.firstShutdownPing.enabled", false, locked);
pref("toolkit.telemetry.coverage.opt-out", true, locked);
pref("toolkit.coverage.opt-out", true, locked);
pref("toolkit.coverage.endpoint.base", "", locked);
pref("browser.newtabpage.activity-stream.feeds.telemetry", false, locked);
pref("browser.newtabpage.activity-stream.telemetry", false, locked);
pref("browser.ping-centre.telemetry", false);
pref("browser.attribution.enabled", false);
pref("toolkit.telemetry.pioneer-new-studies-available", false);
pref("app.shield.optoutstudies.enabled", false, locked);
pref("app.normandy.enabled", false);
pref("app.normandy.api_url", "", locked);

// Crash reports
pref("breakpad.reportURL", "");
pref("browser.tabs.crashReporting.sendReport", false);
pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);

// Other privacy
pref("extensions.getAddons.cache.enabled", false);

// Disable cache for private browsing
pref("browser.privatebrowsing.forceMediaMemoryCache", true);

// Tracking protection
pref("browser.helperApps.deleteTempFileOnExit", true);
pref("browser.uitour.enabled", false);

pref("privacy.globalprivacycontrol.enabled", true);

// Contextual identity
pref('privacy.userContext.enabled', true);
pref('privacy.userContext.ui.enabled', true);
