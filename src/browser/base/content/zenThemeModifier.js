/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* INCLUDE THIS FILE AS:
 *   <script src="chrome://browser/content/zenThemeModifier.js"></script>
 *
 * FOR ANY WEBSITE THAT WOULD NEED TO USE THE ACCENT COLOR, ETC
 */

const kZenThemePrefsList = ['zen.theme.accent-color', 'zen.theme.border-radius', 'zen.theme.content-element-separation'];
const kZenMaxElementSeparation = 12;

/**
 * ZenThemeModifier controls the application of theme data to the browser,
 * for examplem, it injects the accent color to the document. This is used
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

    window.addEventListener('unload', () => {
      for (let pref of kZenThemePrefsList) {
        Services.prefs.removeObserver(pref, handleEvent);
      }
    });
  },

  handleEvent(event) {
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
    const borderRadius = Services.prefs.getIntPref('zen.theme.border-radius');
    document.documentElement.style.setProperty('--zen-border-radius', borderRadius + 'px');
  },

  updateElementSeparation() {
    let separation = this.elementSeparation;
    document.documentElement.style.setProperty('--zen-element-separation', separation + 'px');
    if (separation == 0) {
      document.documentElement.setAttribute('zen-no-padding', true);
    } else {
      document.documentElement.removeAttribute('zen-no-padding');
    }
  },

  get elementSeparation() {
    return Math.min(Services.prefs.getIntPref('zen.theme.content-element-separation'), kZenMaxElementSeparation);
  },

  /**
   * Update the accent color.
   */
  updateAccentColor() {
    const accentColor = Services.prefs.getStringPref('zen.theme.accent-color');
    document.documentElement.style.setProperty('--zen-primary-color', accentColor);
    // Notify the page that the accent color has changed, only if a function
    // handler is defined.
    if (typeof window.zenPageAccentColorChanged === 'function') {
      window.zenPageAccentColorChanged(accentColor);
    }
  },
};

if (typeof Services !== 'undefined') ZenThemeModifier.init();
