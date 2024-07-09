// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref("browser.tabs.cardPreview.enabled", true);
pref("browser.tabs.cardPreview.delayMs", 100);

pref("browser.urlbar.suggest.calculator", true);

#ifdef MOZ_UPDATE_CHANNEL
pref("devtools.debugger.prompt-connection", false);
#endif

// Mozilla Services
pref('browser.privatebrowsing.vpnpromourl', '');
pref("browser.vpn_promo.enabled", false);
pref("browser.contentblocking.report.show_mobile_app", false);
pref("browser.protections_panel.infoMessage.seen", true);
pref('extensions.getAddons.showPane', false);
pref('extensions.htmlaboutaddons.recommendations.enabled', false);
pref('browser.discovery.enabled', false);
pref('browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons', false);
pref(
  'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features',
  false
);
pref('browser.preferences.moreFromMozilla', false);
pref('browser.aboutwelcome.enabled', true);
pref("browser.aboutwelcome.showModal", false);
pref('browser.translations.select.enable', true);

// Theme
pref('toolkit.legacyUserProfileCustomizations.stylesheets', true);
pref('browser.compactmode.show', true);
pref('browser.display.focus_ring_on_anything', true);
pref('browser.display.focus_ring_style', 0);
pref('browser.display.focus_ring_width', 0);
pref('browser.privateWindowSeparation.enabled', false); // WINDOWS

pref('browser.newtabpage.activity-stream.newtabWallpapers.enabled', true);
pref('browser.translations.newSettingsUI.enable', true);

pref("browser.urlbar.trimHttps", true);
pref("browser.urlbar.untrimOnUserInteraction.featureGate", true);

// Cookie banner handling (reject by default)

pref('cookiebanners.service.mode', 1);
pref('cookiebanners.service.mode.privateBrowsing', 1);

// Url bar
pref('browser.urlbar.unitConversion.enabled', true);
pref('browser.urlbar.trending.featureGate', false);
pref('browser.urlbar.weather.featureGate', true);
pref('browser.urlbar.quickactions.enabled', true);
pref('browser.urlbar.clipboard.featureGate', true);

// new tab page
pref('browser.newtabpage.activity-stream.feeds.topsites', false);
pref('browser.newtabpage.activity-stream.feeds.section.topstories', false);
pref("browser.topsites.contile.enabled", false);

// Pocket
pref('extensions.pocket.enabled', false);

// Pdf
pref('browser.download.open_pdf_attachments_inline', true);
pref('pdfjs.enableHighlightEditor', true);
pref('pdfjs.enableHighlightFloatingButton', true);

// Tabs
pref('browser.bookmarks.openInTabClosesMenu', false);
pref('browser.menu.showViewImageInfo', true);
pref('findbar.highlightAll', true);
pref('layout.word_select.eat_space_to_next_word', false);
pref('privacy.userContext.enabled', true);
pref('privacy.userContext.ui.enabled', true);

// UA
pref('general.useragent.compatMode.firefox', true);


// Tracking protection

pref(
  'urlclassifier.trackingSkipURLs',
  '*.reddit.com, *.twitter.com, *.twimg.com, *.tiktok.com'
);
pref(
  'urlclassifier.features.socialtracking.skipURLs',
  '*.instagram.com, *.twitter.com, *.twimg.com'
);
pref('network.cookie.sameSite.noneRequiresSecure', true);
pref('browser.download.start_downloads_in_tmp_dir', true);
pref('browser.helperApps.deleteTempFileOnExit', true);
pref('privacy.globalprivacycontrol.enabled', true);

pref('gfx.canvas.accelerated.cache-items', 4096);
pref('gfx.canvas.accelerated.cache-size', 512);
pref('gfx.content.skia-font-cache-size', 20);
pref('gfx.webrender.all', true);
pref('layout.css.backdrop-filter.enabled', true);

pref("alerts.showFavicons", true);
pref('browser.toolbars.bookmarks.visibility', 'never');

// CUSTOM ZEN PREFS

pref('zen.welcomeScreen.enabled', true);
pref('zen.welcomeScreen.seen', false);
pref('zen.tabs.vertical', true);
pref('zen.theme.accent-color', "#aac7ff");
pref('zen.theme.toolbar-themed', true);
pref('zen.view.compact', false);

pref('browser.cache.jsbc_compression_level', 3);

pref('media.memory_cache_max_size', 65536);
pref('media.cache_readahead_limit', 7200);
pref('media.cache_resume_threshold', 3600);

pref('image.mem.decode_bytes_at_a_time', 32768);

pref('network.buffer.cache.size', 262144);
pref('network.buffer.cache.count', 128);
pref('network.http.max-connections', 1800);
pref('network.http.max-persistent-connections-per-server', 10);
pref('network.http.max-urgent-start-excessive-connections-per-host', 5);
pref('network.http.pacing.requests.enabled', false);
pref('network.dnsCacheExpiration', 3600);
pref('network.dns.max_high_priority_threads', 8);
pref('network.ssl_tokens_cache_capacity', 10240);

pref('network.dns.disablePrefetch', true);
pref('network.prefetch-next', false);
pref('network.predictor.enabled', false);

pref('layout.css.grid-template-masonry-value.enabled', true);
pref('dom.enable_web_task_scheduling', true);
pref('layout.css.has-selector.enabled', true);
pref('dom.security.sanitizer.enabled', true);

// Pref to enable the new profiles (TODO: Check this out!)
//pref("browser.profiles.enabled", true);

// Zen Sidebar
pref('zen.sidebar.data', "{\"data\":\n {\"p1\":{\n   \"url\":\"https://www.wikipedia.org/\"\n  },\n\"p2\":{\n   \"url\":\"https://m.twitter.com/\",\n\"ua\": true\n  },\n\"p3\": {\n   \"url\": \"https://www.youtube.com/\",\n\"ua\": true\n},\n\"p4\": {\n   \"url\": \"https://translate.google.com/\",\n\"ua\": true\n},\n\"p5\": {\n   \"url\": \"https://todoist.com/\",\n\"ua\": true\n}},\n\"index\":[\"p1\",\"p2\",\"p3\",\"p4\",\"p5\"]}");
pref('zen.sidebar.enabled', true);
pref('zen.sidebar.floating', true);

// Zen Split View
pref('zen.splitView.working', false);

// Zen Workspaces
pref('zen.workspaces.enabled', false);
