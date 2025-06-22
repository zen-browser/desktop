// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref('zen.mods.updated-value-observer', false);

pref('zen.mods.auto-update-days', 20); // In days

#ifdef MOZILLA_OFFICIAL
  pref('zen.mods.auto-update', true);
  pref('zen.rice.api.url', 'https://share.zen-browser.app', locked);
  pref('zen.injections.match-urls', 'https://zen-browser.app/*,https://share.zen-browser.app/*', locked);
#else
  pref('zen.mods.auto-update', false);
  pref('zen.rice.api.url', "http://localhost", locked);
  pref('zen.injections.match-urls', 'http://localhost/*', locked);
#endif

pref('zen.rice.share.notice.accepted', false);
