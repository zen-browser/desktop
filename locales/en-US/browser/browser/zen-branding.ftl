# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Override Firefox-hardcoded product names that refer to this browser.
## Keep Mozilla-owned names (Monitor, Suggest, Focus, Relay, …) unchanged.

-firefoxlabs-brand-name = { -brand-short-name } Labs
-firefoxview-brand-name = { -brand-short-name } View
-firefox-home-brand-name = { -brand-short-name } Home

# Urlbar quick action: "labs" / "experiment"
quickactions-labs = Open { -brand-short-name } Labs
