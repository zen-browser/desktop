
pref("app.normandy.api_url", "", locked);

pref("app.normandy.enabled", false);

pref("app.shield.optoutstudies.enabled", false, locked);

#if defined(MOZILLA_OFFICIAL)
pref("app.update.checkInstallTime.days", 6);
#endif
pref("browser.aboutwelcome.enabled", false);

pref("browser.attribution.enabled", false);

pref("browser.contentblocking.report.hide_vpn_banner", true, locked);

pref("browser.contentblocking.report.show_mobile_app", false, locked);

pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);

pref("browser.discovery.enabled", false);

pref("browser.download.alwaysOpenPanel", false);

pref("browser.download.autohideButton", false);

pref("browser.download.manager.addToRecentDocs", false);

pref("browser.formfill.enable", false);

pref("browser.helperApps.deleteTempFileOnExit", true);

#if defined(XP_MACOSX)
pref("browser.lowMemoryResponseMask", 3);
#endif
pref("browser.ml.chat.enabled", false);

pref("browser.ml.chat.menu", false);

pref("browser.ml.chat.shortcuts", false);

pref("browser.ml.chat.shortcuts.custom", false);

pref("browser.ml.chat.sidebar", false);

pref("browser.ml.enable", false);

pref("browser.ml.linkPreview.enabled", false);

pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);

pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);

pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);

pref("browser.newtabpage.activity-stream.feeds.telemetry", false, locked);

pref("browser.newtabpage.activity-stream.feeds.topsites", false);

pref("browser.newtabpage.activity-stream.newtabWallpapers.enabled", true);

pref("browser.newtabpage.activity-stream.newtabWallpapers.v2.enabled", true);

pref("browser.newtabpage.activity-stream.showSponsoredCheckboxes", false);

pref("browser.newtabpage.activity-stream.system.showWeather", false);

pref("browser.newtabpage.activity-stream.telemetry", false, locked);

pref("browser.ping-centre.telemetry", false);

pref("browser.preferences.aiControls", false);

pref("browser.preferences.experimental", true);

pref("browser.preferences.moreFromMozilla", false, locked);

pref("browser.privatebrowsing.forceMediaMemoryCache", true);

pref("browser.privatebrowsing.resetPBM.enabled", false);

pref("browser.privatebrowsing.vpnpromourl", "", locked);

pref("browser.profiles.enabled", false);

pref("browser.search.serpEventTelemetryCategorization.enabled", false, locked);

pref("browser.search.suggest.enabled", false);

pref("browser.search.suggest.enabled.private", false);

pref("browser.search.widget.new", true);

pref("browser.sessionstore.max_windows_undo", 2);

pref("browser.sessionstore.restore_pinned_tabs_on_demand", true);

pref("browser.settings-redesign.enabled", true);

pref("browser.startup.page", 3);

pref("browser.startup.preXulSkeletonUI", false);

pref("browser.tabs.closeWindowWithLastTab", false);

pref("browser.tabs.crashReporting.sendReport", false);

pref("browser.tabs.dragDrop.dragToPin.enabled", false, locked);

pref("browser.tabs.dragDrop.moveOverThresholdPercent", 50);

pref("browser.tabs.dragDrop.multiselectStacking", false, locked);

pref("browser.tabs.fadeOutExplicitlyUnloadedTabs", true);

pref("browser.tabs.groups.enabled", false);

pref("browser.tabs.groups.hoverPreview.enabled", false, locked);

pref("browser.tabs.hoverPreview.enabled", false);

pref("browser.tabs.notes.enabled", false);

pref("browser.tabs.splitView.enabled", false, locked);

pref("browser.tabs.unloadTabInContextMenu", true);

pref("browser.taskbarTabs.enabled", false);

pref("browser.toolbars.bookmarks.visibility", "never");

pref("browser.topsites.contile.enabled", false);

pref("browser.translations.newSettingsUI.enable", true);

pref("browser.uitour.enabled", false);

pref("browser.urlbar.clipboard.featureGate", true);

pref("browser.urlbar.closeOnWindowBlur", false);

pref("browser.urlbar.groupLabels.enabled", false);

pref("browser.urlbar.keepPanelOpenDuringImeComposition", true);

pref("browser.urlbar.quickactions.enabled", true);

pref("browser.urlbar.quicksuggest.enabled", false, locked);

pref("browser.urlbar.scotchBonnet.enableOverride", false);

pref("browser.urlbar.shortcuts.workspaces", true);

pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false, locked);

pref("browser.urlbar.suggest.quicksuggest.sponsored", false, locked);

pref("browser.urlbar.suggest.topsites", true, locked);

pref("browser.urlbar.trending.featureGate", false);

pref("browser.urlbar.trimHttps", true);

pref("browser.urlbar.trustPanel.featureGate", false);

pref("browser.urlbar.untrimOnUserInteraction.featureGate", true);

pref("browser.urlbar.weather.featureGate", false);

pref("browser.vpn_promo.enabled", false);

pref("datareporting.healthreport.uploadEnabled", false, locked);

pref("datareporting.policy.dataSubmissionEnabled", false, locked);

pref("extensions.getAddons.cache.enabled", false);

pref("extensions.getAddons.showPane", false);

pref("extensions.htmlaboutaddons.recommendations.enabled", false);

// Chrome Web Store extension install support
pref("xpinstall.whitelist.required", false);
pref("extensions.chromewebstore.install.enabled", true);

#if !defined(XP_MACOSX)
pref("general.smoothScroll.currentVelocityWeighting", "0.15");
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.mouseWheel.durationMinMS", 80);
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.msdPhysics.continuousMotionMaxDeltaMS", 12);
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.msdPhysics.enabled", true);
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.msdPhysics.motionBeginSpringConstant", 600);
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.msdPhysics.regularSpringConstant", 650);
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.msdPhysics.slowdownMinDeltaMS", 25);
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.msdPhysics.slowdownSpringConstant", 250);
#endif
#if !defined(XP_MACOSX)
pref("general.smoothScroll.stopDecelerationWeighting", "0.6");
#endif
#if defined(XP_WIN) || defined(XP_DARWIN)
pref("gfx.webrender.compositor", true);
#else
pref("gfx.webrender.compositor", false);
#endif
pref("image.avif.enabled", true, locked);

pref("image.jxl.enabled", true);

pref("intl.multilingual.downloadEnabled", false);

pref("media.eme.enabled", true);

pref("media.videocontrols.picture-in-picture.enable-when-switching-tabs.enabled", false);

pref("media.videocontrols.picture-in-picture.urlbar-button.enabled", true, locked);

pref("media.videocontrols.picture-in-picture.video-toggle.enabled", true);

#if !defined(XP_MACOSX)
pref("mousewheel.default.delta_multiplier_y", 200);
#endif
#if !defined(XP_MACOSX)
pref("mousewheel.min_line_scroll_amount", 10);
#endif
pref("network.predictor.enable-hover-on-ssl", true);

pref("pdfjs.enableHighlightEditor", true);

pref("pdfjs.enableHighlightFloatingButton", true);

pref("pdfjs.enableScripting", false);

pref("privacy.globalprivacycontrol.enabled", true);

pref("privacy.userContext.enabled", true);

pref("privacy.userContext.ui.enabled", true);

pref("services.sync.engine.workspaces", false);

pref("sidebar.revamp", false, locked);

pref("sidebar.verticalTabs", false, locked);

pref("sidebar.verticalTabs.dragToPinPromo.dismissed", true, locked);

pref("svg.context-properties.content.enabled", true);

pref("termsofuse.bypassNotification", true);

pref("toolkit.coverage.endpoint.base", "", locked);

pref("toolkit.coverage.opt-out", true, locked);

pref("toolkit.telemetry.archive.enabled", false, locked);

pref("toolkit.telemetry.bhrPing.enabled", false, locked);

pref("toolkit.telemetry.coverage.opt-out", true, locked);

pref("toolkit.telemetry.enabled", false, locked);

pref("toolkit.telemetry.firstShutdownPing.enabled", false, locked);

pref("toolkit.telemetry.newProfilePing.enabled", false, locked);

pref("toolkit.telemetry.pioneer-new-studies-available", false);

pref("toolkit.telemetry.server", "data:,", locked);

pref("toolkit.telemetry.shutdownPingSender.enabled", false, locked);

pref("toolkit.telemetry.unified", false, locked);

pref("toolkit.telemetry.updatePing.enabled", false, locked);

#if defined(MOZ_WIDGET_GTK)
pref("widget.gtk.rounded-bottom-corners.enabled", true);
#endif
#if defined(XP_MACOSX)
pref("widget.macos.native-popovers", true);
#endif
#if defined(XP_MACOSX)
pref("widget.macos.sidebar-blend-mode.behind-window", true);
#endif
pref("widget.non-native-theme.scrollbar.style", 2);

pref("widget.non-native-theme.use-theme-accent", true);

#if defined(XP_WIN)
pref("widget.windows.mica", true);
#endif
#if defined(XP_WIN)
pref("widget.windows.mica.toplevel-backdrop", 2);
#endif
pref("xpinstall.signatures.required", true);

pref("zen.boosts.disable-on-anonymous-content", true);

pref("zen.boosts.dissolve-on-zap", true);

pref("zen.boosts.enabled", true);

pref("zen.boosts.invert-channel-floor", 15);

pref("zen.ctrlTab.show-pending-tabs", false);

pref("zen.downloads.download-animation", true);

pref("zen.downloads.download-animation-duration", 1000);

pref("zen.downloads.icon-popup-position", 0);

pref("zen.folders.max-subfolders", 5);

pref("zen.folders.owned-tabs-in-folder", false);

pref("zen.folders.search.enabled", true);

pref("zen.folders.search.hover-delay", 500);

pref("zen.glance.activation-method", "alt");

pref("zen.glance.animation-duration", 350);

pref("zen.glance.deactivate-docshell-during-animation", false);

pref("zen.glance.enable-contextmenu-search", true);

pref("zen.glance.enabled", true);

pref("zen.glance.open-essential-external-links", true);

pref("zen.haptic-feedback.enabled", true);

pref("zen.haptic-feedback.enabled", true);

#if defined(MOZILLA_OFFICIAL)
pref("zen.injections.match-urls", "https://zen-browser.app/*", locked);
#endif
#if !defined(MOZILLA_OFFICIAL)
pref("zen.injections.match-urls", "http://localhost/*");
#endif
pref("zen.keyboard.shortcuts.disable-mainkeyset-clear", false);

pref("zen.keyboard.shortcuts.version", 0);

pref("zen.live-folders.github.skip-new-pr-ui-check", false);

pref("zen.mediacontrols.enabled", true);

#if defined(MOZILLA_OFFICIAL)
pref("zen.mods.auto-update", true);
#else
pref("zen.mods.auto-update", false);
#endif
pref("zen.mods.auto-update-days", 20);

pref("zen.mods.updated-value-observer", false);

pref("zen.pinned-tab-manager.close-shortcut-behavior", "reset-unload-switch");

pref("zen.pinned-tab-manager.debug", false);

pref("zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url", false);

pref("zen.pinned-tab-manager.wheel-close-if-pending", true);

pref("zen.session-store.backup-file", true);

pref("zen.session-store.log", true);

pref("zen.session-store.restore-unsynced-windows", true);

pref("zen.share.enabled", true);

pref("zen.splitView.drag-over-split-delayMC", 500);

pref("zen.splitView.drag-over-split-threshold", 40);

pref("zen.splitView.enable-drag-over-split", true);

pref("zen.splitView.enable-tab-click-split", true);

pref("zen.splitView.enable-tab-drop", true);

pref("zen.splitView.min-resize-width", 7);

pref("zen.splitView.rearrange-hover-size", 24);

pref("zen.startup.smooth-scroll-in-tabs", true);
# Hidden preference: zen.swipe.is-fast-swipe = true
pref("zen.tabs.close-on-back-with-no-history", true);

pref("zen.tabs.close-window-with-empty", true);

pref("zen.tabs.ctrl-tab.ignore-essential-tabs", false);

pref("zen.tabs.ctrl-tab.ignore-pending-tabs", false);

pref("zen.tabs.dnd-switch-space-delay", 500);

pref("zen.tabs.essentials.max", 12);

pref("zen.tabs.folder-dragover-threshold-percent", 20);

pref("zen.tabs.open-pinned-in-new-tab", true);

pref("zen.tabs.rename-tabs", true);

pref("zen.tabs.select-recently-used-on-close", true);

pref("zen.tabs.show-newtab-vertical", true);

pref("zen.tabs.vertical", true);

pref("zen.tabs.vertical.right-side", false);

pref("zen.theme.accent-color", "AccentColor");

pref("zen.theme.acrylic-elements", true);

pref("zen.theme.border-radius", -1);

pref("zen.theme.content-element-separation", 8);

pref("zen.theme.dark-mode-bias", "0.3");

pref("zen.theme.disable-lightweight", true);

pref("zen.theme.essentials-favicon-bg", true);

pref("zen.theme.gradient.show-custom-colors", false);

pref("zen.theme.hide-tab-throbber", true);

pref("zen.theme.hide-unified-extensions-button", true);

pref("zen.theme.styled-status-panel", true);

#if defined(XP_MACOSX)
pref("zen.theme.styled-status-panel", true);
#endif
pref("zen.theme.use-system-colors", false);

pref("zen.updates.show-update-notification", true);

pref("zen.urlbar.behavior", "floating-on-type");

pref("zen.urlbar.enable-overrides", false);

pref("zen.urlbar.hide-one-offs", true);

pref("zen.urlbar.open-on-startup", true);

pref("zen.urlbar.replace-newtab", true);

pref("zen.urlbar.show-contextual-id", false);

pref("zen.urlbar.show-domain-only-in-sidebar", true);

pref("zen.urlbar.show-pip-button", false);

pref("zen.urlbar.show-protections-icon", false);

pref("zen.urlbar.single-toolbar-show-copy-url", true);

pref("zen.urlbar.suggestions.quick-actions", true);

pref("zen.urlbar.wait-to-clear", 45000);

pref("zen.view.borderless-fullscreen", true);

pref("zen.view.compact.animate-sidebar", true);

pref("zen.view.compact.debug", false);
# Hidden preference: zen.view.compact.enable-at-startup = false
pref("zen.view.compact.hide-tabbar", true);

pref("zen.view.compact.hide-toolbar", false);

pref("zen.view.compact.show-background-tab-toast", true);

pref("zen.view.compact.show-sidebar-and-toolbar-on-hover", true);

pref("zen.view.compact.sidebar-keep-hover.duration", 150);

pref("zen.view.compact.toolbar-flash-popup", false);

pref("zen.view.compact.toolbar-flash-popup.duration", 800);

pref("zen.view.compact.toolbar-hide-after-hover.duration", 1000);

pref("zen.view.context-menu.refresh", true);

pref("zen.view.draggable-sidebar", true);

pref("zen.view.enable-loading-indicator", true);

pref("zen.view.experimental-force-window-controls-left", false);

pref("zen.view.experimental-no-window-controls", false);

pref("zen.view.grey-out-inactive-windows", true);

pref("zen.view.hide-window-controls", true);

#if defined(XP_MACOSX)
pref("zen.view.mac.show-three-dot-menu", false);
#endif
pref("zen.view.overflow-webext-toolbar", true);

pref("zen.view.overflow-webext-toolbar-threshold", 55);

pref("zen.view.shift-down-site-on-hover", false);

pref("zen.view.show-clear-tabs-button", true);

pref("zen.view.show-newtab-button-top", true);

pref("zen.view.sidebar-expanded", true);

pref("zen.view.sidebar-expanded.max-width", 500);

pref("zen.view.sidebar-height-throttle", 0);

pref("zen.view.use-single-toolbar", true);

pref("zen.view.window.scheme", 2);

#if defined(MOZILLA_OFFICIAL)
pref("zen.watermark.enabled", true);
#else
pref("zen.watermark.enabled", false);
#endif
#if !defined(MOZILLA_OFFICIAL)
pref("zen.welcome-screen.seen", true);
#else
pref("zen.welcome-screen.seen", false);
#endif
#if defined(MOZ_WIDGET_GTK)
pref("zen.widget.linux.transparency", false);
#endif
#if defined(XP_MACOSX)
pref("zen.widget.mac.mono-window-controls", true);
#endif
#if defined(XP_MACOSX)
pref("zen.widget.macos.override-system-swipe-gestures", true);
#endif
#if defined(XP_MACOSX)
pref("zen.widget.macos.window-material", 1);
#endif
pref("zen.window-sync.enabled", true);

pref("zen.window-sync.log", false);

pref("zen.window-sync.open-link-in-new-unsynced-window", true);

pref("zen.window-sync.prefer-unsynced-windows", false);

pref("zen.window-sync.sync-only-pinned-tabs", false);

pref("zen.workspaces.continue-where-left-off", false);

#if !defined(MOZILLA_OFFICIAL)
pref("zen.workspaces.debug", true);
#else
pref("zen.workspaces.debug", false);
#endif
pref("zen.workspaces.dnd-switch-padding", 20);

pref("zen.workspaces.force-container-workspace", false);

pref("zen.workspaces.hide-default-container-indicator", true);

pref("zen.workspaces.natural-scroll", false);

pref("zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed", false);

pref("zen.workspaces.scroll-modifier-key", "ctrl");

pref("zen.workspaces.separate-essentials", true);

pref("zen.workspaces.swipe-actions", true);

pref("zen.workspaces.swipe-actions.delta-multiplier", 100);

pref("zen.workspaces.switch-animation-duration", 200);

pref("zen.workspaces.wrap-around-navigation", true);

// NIXO: Enhanced browser features
pref("nixo.brand.version", "1.21.0");
pref("nixo.brand.color", "#6C63FF");
pref("nixo.startup.behavior", "restore");
pref("nixo.extensions.chrome-store-enabled", true);
pref("nixo.extensions.auto-convert-safari", false);
pref("nixo.ui.compact-mode", true);
pref("nixo.ui.floating-urlbar", true);
pref("nixo.ui.workspace-indicator", true);
pref("nixo.theme.acrylic", true);
pref("nixo.theme.gradient", false);
// NIXO
