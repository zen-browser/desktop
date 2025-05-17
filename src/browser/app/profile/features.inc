
pref('zen.welcome-screen.seen', false, sticky);

pref('zen.tabs.vertical', true);
pref('zen.tabs.vertical.right-side', false);
pref('zen.tabs.rename-tabs', true);
pref('zen.tabs.show-newtab-vertical', true);

pref('zen.ctrlTab.show-pending-tabs', false);

pref('zen.theme.accent-color', "#ffb787");
pref('zen.theme.content-element-separation', 8); // In pixels
pref('zen.theme.gradient', true);
pref('zen.theme.gradient.show-custom-colors', false);
pref('zen.theme.essentials-favicon-bg', true);

pref('zen.view.show-newtab-button-border-top', false);
pref('zen.view.show-newtab-button-top', true);

pref('zen.mediacontrols.enabled', true);

// Exposure:
pref('zen.haptic-feedback.enabled', true);

#ifdef MOZILLA_OFFICIAL
pref('zen.rice.api.url', 'https://share.zen-browser.app', locked);
pref('zen.injections.match-urls', 'https://zen-browser.app/*,https://share.zen-browser.app/*', locked);
#else
pref('zen.rice.api.url', "http://localhost", locked);
pref('zen.injections.match-urls', 'http://localhost/*', locked);
#endif
pref('zen.rice.share.notice.accepted', false);

#ifdef XP_MACOSX
pref('zen.theme.border-radius', 10); // In pixels
#else
pref('zen.theme.border-radius', 8); // In pixels
#endif

#ifdef XP_MACOSX
pref('zen.theme.acrylic-elements', false);
#else
pref('zen.theme.acrylic-elements', false);
#endif

pref('zen.theme.color-prefs.use-workspace-colors', true);

pref('zen.view.compact.hide-tabbar', true);
pref('zen.view.compact.hide-toolbar', false);
pref('zen.view.compact.toolbar-flash-popup', false);
pref('zen.view.compact.toolbar-flash-popup.duration', 800);
pref('zen.view.compact.toolbar-hide-after-hover.duration', 1000);
pref('zen.view.compact.color-toolbar', true);
pref('zen.view.compact.color-sidebar', true);
pref('zen.view.compact.animate-sidebar', true);
pref('zen.view.compact.show-sidebar-and-toolbar-on-hover', true);
pref('zen.view.compact.show-background-tab-toast', true);

pref('zen.urlbar.replace-newtab', true);
pref('zen.urlbar.show-protections-icon', false);
pref('zen.urlbar.behavior', 'floating-on-type'); // default, floating-on-type, float
pref('zen.urlbar.wait-to-clear', 45000); // in ms (default 45s)
pref('zen.urlbar.show-domain-only-in-sidebar', true);
pref('zen.urlbar.hide-one-offs', true);
pref('zen.urlbar.enable-overrides', false);

// Exoerimental: Apply a blend mode to the websites so they can render rounded corners
// IMPORTANT: Remove once firefox 139 is released
#ifdef XP_MACOSX
pref('zen.view.experimental-rounded-view', false);
#else 
pref('zen.view.experimental-rounded-view', true);
#endif

// Glance
pref('zen.glance.enabled', true);
pref('zen.glance.hold-duration', 300); // in ms
pref('zen.glance.open-essential-external-links', true);
pref('zen.glance.activation-method', 'alt'); // ctrl, alt, shift, none, hold

pref('zen.view.sidebar-height-throttle', 200); // in ms
pref('zen.view.sidebar-expanded.max-width', 500);

#ifdef XP_MACOSX
pref('zen.view.mac.show-three-dot-menu', false);
pref('zen.widget.mac.mono-window-controls', true);
#endif
pref('zen.view.use-single-toolbar', true);
pref('zen.view.sidebar-expanded', true);
pref('zen.view.sidebar-collapsed.hide-mute-button', true);
pref('zen.view.experimental-force-window-controls-left', false);

#ifdef XP_MACOSX
pref('zen.view.grey-out-inactive-windows', false);
#else
pref('zen.view.grey-out-inactive-windows', true);
#endif

pref('zen.view.hide-window-controls', true);
pref('zen.view.experimental-no-window-controls', false);

pref('zen.tabs.dim-pending', true);

pref('zen.keyboard.shortcuts.enabled', true);
pref('zen.keyboard.shortcuts.version', 0); // Empty string means default shortcuts
pref('zen.keyboard.shortcuts.disable-mainkeyset-clear', false); // for debugging

pref('zen.themes.updated-value-observer', false);

pref('zen.tab-unloader.enabled', true);
pref('zen.tab-unloader.timeout-minutes', 40);
pref('zen.tab-unloader.excluded-urls', "example.com,example.org");

pref('zen.pinned-tab-manager.debug', false);
pref('zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url', false);
pref('zen.pinned-tab-manager.close-shortcut-behavior', 'reset-unload-switch');

#ifdef MOZILLA_OFFICIAL
pref('zen.watermark.enabled', true, sticky);
#else
pref('zen.watermark.enabled', false, sticky);
#endif

// Startup flags
pref('zen.startup.smooth-scroll-in-tabs', true);

// Zen Workspaces
pref('zen.workspaces.continue-where-left-off', false);
pref('zen.workspaces.hide-default-container-indicator', true);
pref('zen.workspaces.force-container-workspace', false);
pref('zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed', false);
pref('zen.workspaces.swipe-actions', true);
pref('zen.workspaces.wrap-around-navigation', true);
pref('zen.workspaces.natural-scroll', false);
pref('zen.workspaces.scroll-modifier-key','ctrl'); // can be ctrl, alt, shift, or a meta key
pref('services.sync.engine.workspaces', false);
pref('zen.workspaces.container-specific-essentials-enabled', false);

#ifdef MOZILLA_OFFICIAL
pref('zen.workspaces.debug', false);
#else
pref('zen.workspaces.debug', true);
#endif

// Zen Split View
pref('zen.splitView.enable-tab-drop', true);
pref('zen.splitView.min-resize-width', 7);
pref('zen.splitView.rearrange-hover-size', 24);

// Zen Download Animations
pref('zen.downloads.download-animation', true);
pref('zen.downloads.download-animation-duration', 1000); // ms
