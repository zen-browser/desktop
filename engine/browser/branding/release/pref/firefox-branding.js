
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

pref("startup.homepage_override_url", "https://zen-browser.app/whatsnew?v=%VERSION%");
pref("startup.homepage_welcome_url", "https://zen-browser.app/welcome/");
pref("startup.homepage_welcome_url.additional", "https://zen-browser.app/privacy-policy/");

// Give the user x seconds to react before showing the big UI. default=192 hours
pref("app.update.promptWaitTime", 691200);
// app.update.url.manual: URL user can browse to manually if for some reason
// all update installation attempts fail.
// app.update.url.details: a default value for the "More information about this
// update" link supplied in the "An update is available" page of the update
// wizard.
pref("app.update.url.manual", "https://zen-browser.app/download/");
pref("app.update.url.details", "https://zen-browser.app/release-notes/latest/");
pref("app.releaseNotesURL", "https://zen-browser.app/whatsnew/");
pref("app.releaseNotesURL.aboutDialog", "https://www.zen-browser.app/release-notes/%VERSION%/");
pref("app.releaseNotesURL.prompt", "https://zen-browser.app/release-notes/%VERSION%/");

// Number of usages of the web console.
// If this is less than 5, then pasting code into the web console is disabled
pref("devtools.selfxss.count", 5);
