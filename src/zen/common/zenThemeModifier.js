/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* INCLUDE THIS FILE AS:
 *   <script src="chrome://browser/content/zenThemeModifier.js"></script>
 *
 * FOR ANY WEBSITE THAT WOULD NEED TO USE THE ACCENT COLOR, ETC
 */

const kZenThemePrefsList = [
  'zen.theme.accent-color',
  'zen.theme.border-radius',
  'zen.theme.content-element-separation',
];
const kZenMaxElementSeparation = 12;

/**
 * ZenThemeModifier controls the application of theme data to the browser,
 * for example, it injects the accent color to the document. This is used
 * because we need a way to apply the accent color without having to worry about
 * shadow roots not inheriting the accent color.
 *
 * note: It must be a Firefox builtin page with access to the browser's configuration
 *  and services.
 */
var ZenThemeModifier = {
  _inMainBrowserWindow: false,

  /**
   * Listen for theming updates from the LightweightThemeChild actor, and
   * begin listening to changes in preferred color scheme.
   */
  init() {
    this._inMainBrowserWindow = window.location.href == 'chrome://browser/content/browser.xhtml';
    this.listenForEvents();
    this.updateAllThemeBasics();
  },

  listenForEvents() {
    var handleEvent = this.handleEvent.bind(this);
    // Listen for changes in the accent color and border radius
    for (let pref of kZenThemePrefsList) {
      Services.prefs.addObserver(pref, handleEvent);
    }

    // Add fullscreen listener to update the theme when going in and out of fullscreen
    const eventsForSeparation = [
      'ZenViewSplitter:SplitViewDeactivated',
      'ZenViewSplitter:SplitViewActivated',
      'fullscreen',
      'ZenCompactMode:Toggled',
    ];
    const separationHandler = this.updateElementSeparation.bind(this);
    for (let eventName of eventsForSeparation) {
      window.addEventListener(eventName, separationHandler);
    }

    window.addEventListener(
      'unload',
      () => {
        for (let pref of kZenThemePrefsList) {
          Services.prefs.removeObserver(pref, handleEvent);
        }
        for (let eventName of eventsForSeparation) {
          window.removeEventListener(eventName, separationHandler);
        }
      },
      { once: true }
    );
  },

  handleEvent() {
    // note: even might be undefined, but we shoudnt use it!
    this.updateAllThemeBasics();
  },

  /**
   * Update all theme basics, like the accent color.
   */
  async updateAllThemeBasics() {
    this.updateAccentColor();
    this.updateBorderRadius();
    this.updateElementSeparation();
  },

  updateBorderRadius() {
    const borderRadius = Services.prefs.getIntPref('zen.theme.border-radius', -1);

    // -1 is the default value, will use platform-native values
    // otherwise, use the custom value
    if (borderRadius == -1) {
      if (AppConstants.platform == 'macosx') {
        const targetRadius = window.matchMedia('(-moz-mac-tahoe-theme)').matches ? 15 : 10;
        document.documentElement.style.setProperty('--zen-border-radius', targetRadius + 'px');
      } else if (AppConstants.platform == 'linux') {
        // Linux uses GTK CSD titlebar radius, default to 8px
        document.documentElement.style.setProperty(
          '--zen-border-radius',
          'env(-moz-gtk-csd-titlebar-radius, 8px)'
        );
      } else {
        // Windows defaults to 8px
        document.documentElement.style.setProperty('--zen-border-radius', '8px');
      }
    } else {
      // Use the overridden value
      document.documentElement.style.setProperty('--zen-border-radius', borderRadius + 'px');
    }
  },

  updateElementSeparation() {
    const kMinElementSeparation = 0.1; // in px
    let separation = this.elementSeparation;
    if (
      document.documentElement.hasAttribute('inFullscreen') &&
      window.gZenCompactModeManager?.preference &&
      !document.getElementById('tabbrowser-tabbox')?.hasAttribute('zen-split-view') &&
      Services.prefs.getBoolPref('zen.view.borderless-fullscreen', true)
    ) {
      separation = 0;
    }
    // In order to still use it on fullscreen, even if it's 0px, add .1px (almost invisible)
    separation = Math.max(kMinElementSeparation, separation);
    document.documentElement.style.setProperty('--zen-element-separation', separation + 'px');
    if (separation == kMinElementSeparation) {
      document.documentElement.setAttribute('zen-no-padding', true);
    } else {
      document.documentElement.removeAttribute('zen-no-padding');
    }
  },

  get elementSeparation() {
    return Math.min(
      Services.prefs.getIntPref('zen.theme.content-element-separation'),
      kZenMaxElementSeparation
    );
  },

  /**
   * Update the accent color.
   */
  updateAccentColor() {
    const accentColor = Services.prefs.getStringPref('zen.theme.accent-color');
    document.documentElement.style.setProperty('--zen-primary-color', accentColor);
  },
};

if (typeof Services !== 'undefined') ZenThemeModifier.init();
