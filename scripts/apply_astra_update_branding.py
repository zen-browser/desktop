#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Re-apply Astra update/marketing branding prefs after surfer branding generation.

Surfer's branding-patch.js historically hardcodes zen-browser.app URLs. This
script overwrites the generated firefox-branding.js files (and optionally the
installed surfer template) with Astra's live GitHub stopgap URLs.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BRANDING_JS = """
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Temporary stopgap: point marketing/update links at live GitHub URLs until
// astra-browser.app pages exist. Do not use zen-browser.app.
pref("startup.homepage_override_url", "https://github.com/Hrishikeshmind/astradesktop/releases");
pref("startup.homepage_welcome_url", "");
pref("startup.homepage_welcome_url.additional", "");

// Give the user x seconds to react before showing the big UI. default=192 hours
pref("app.update.promptWaitTime", 691200);
// app.update.url.manual: URL user can browse to manually if for some reason
// all update installation attempts fail.
// app.update.url.details: a default value for the "More information about this
// update" link supplied in the "An update is available" page of the update
// wizard.
pref("app.update.url.manual", "https://github.com/Hrishikeshmind/astradesktop/releases");
pref("app.update.url.details", "https://github.com/Hrishikeshmind/astradesktop/releases");
pref("app.releaseNotesURL", "https://github.com/Hrishikeshmind/astradesktop/releases");
pref("app.releaseNotesURL.aboutDialog", "https://github.com/Hrishikeshmind/astradesktop/releases");
pref("app.releaseNotesURL.prompt", "https://github.com/Hrishikeshmind/astradesktop/releases/tag/%VERSION%");

// Number of usages of the web console.
// If this is less than 5, then pasting code into the web console is disabled
pref("devtools.selfxss.count", 5);
"""

TARGETS = [
    ROOT / "engine" / "browser" / "branding" / "release" / "pref" / "firefox-branding.js",
    ROOT / "engine" / "browser" / "branding" / "twilight" / "pref" / "firefox-branding.js",
]


def main() -> None:
    for path in TARGETS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(BRANDING_JS.lstrip("\n"), encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
