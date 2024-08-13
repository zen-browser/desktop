
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

 "use strict";

/* INCLUDE THIS FILE AS:
 *   <script src="chrome://browser/content/zenThemeModifier.js"></script>
 *
 * FOR ANY WEBSITE THAT WOULD NEED TO USE THE ACCENT COLOR, ETC
 */

const kZenThemeAccentColorPref = "zen.theme.accent-color";
const kZenThemeBorderRadiusPref = "zen.theme.border-radius";

/**
* ZenThemeModifier controls the application of theme data to the browser,
* for examplem, it injects the accent color to the document. This is used
* because we need a way to apply the accent color without having to worry about
* shadow roots not inheriting the accent color.
* 
* note: It must be a firefox builtin page with access to the browser's configuration
*  and services.
*/
var ZenThemeModifier = {
  _inMainBrowserWindow: false,

  /**
  * Listen for theming updates from the LightweightThemeChild actor, and
  * begin listening to changes in preferred color scheme.
  */
  init() {
    this._inMainBrowserWindow = window.location.href == "chrome://browser/content/browser.xhtml";
    this.listenForEvents();
    this.updateExtraBrowserStyles();
    this.updateAllThemeBasics();
    this._zenInitBrowserLayout();
  },

  listenForEvents() {
    Services.prefs.addObserver(kZenThemeAccentColorPref, this.handleEvent.bind(this));
    Services.prefs.addObserver(kZenThemeBorderRadiusPref, this.handleEvent.bind(this));
  },

  handleEvent(event) {
    // note: even might be undefined, but we shoudnt use it!
    this.updateAllThemeBasics();
  },

  /**
    * Update all theme basics, like the accent color.
    */
  updateAllThemeBasics() {
    this.updateAccentColor();
    this.updateBorderRadius();
  },

  updateBorderRadius() {
    const borderRadius = Services.prefs.getIntPref(kZenThemeBorderRadiusPref, 4);
    document.documentElement.style.setProperty("--zen-border-radius", borderRadius + "px");
  },

  /**
   * Update the accent color.
   */
  updateAccentColor() {
    const accentColor = Services.prefs.getStringPref(kZenThemeAccentColorPref, "#0b57d0");
    document.documentElement.style.setProperty("--zen-primary-color", accentColor);
    // Notify the page that the accent color has changed, only if a function
    // handler is defined.
    if (typeof window.zenPageAccentColorChanged === "function") {
      window.zenPageAccentColorChanged(accentColor);
    }
  },

  updateExtraBrowserStyles() {
    // If we are in the main browser window, we can add some extra styles.
    if (!this._inMainBrowserWindow) return;
    this._changeSidebarLocation();
  },

  _changeSidebarLocation() {
    const kElementsToAppend = [
      "sidebar-splitter",
      "sidebar-box",
      "navigator-toolbox",
    ];
    const wrapper = document.getElementById("zen-tabbox-wrapper");
    const appWrapepr = document.getElementById("zen-sidebar-box-container");
    for (let id of kElementsToAppend) {
      const elem = document.getElementById(id);
      if (elem) {
        wrapper.prepend(elem);
      }
    }
    appWrapepr.setAttribute("hidden", "true");

    // Set a splitter to navigator-toolbox
    const splitter = document.createXULElement("splitter");
    splitter.setAttribute("id", "zen-sidebar-splitter");
    splitter.setAttribute("orient", "horizontal");
    splitter.setAttribute("resizebefore", "sibling");
    splitter.setAttribute("resizeafter", "none");
    const titlebar = document.getElementById("navigator-toolbox");
    titlebar.insertAdjacentElement("afterend", splitter);
  },

  _zenInitBrowserLayout() {
    if (!this._inMainBrowserWindow) return;
    if (this.__hasInitBrowserLayout) return;
    this.__hasInitBrowserLayout = true;
    this.openWatermark();
    console.info("ZenThemeModifier: init browser layout");
    const kNavbarItems = [
      "nav-bar",
      "PersonalToolbar"
    ];
    const kNewContainerId = "zen-appcontent-navbar-container";
    let newContainer = document.getElementById(kNewContainerId);
    for (let id of kNavbarItems) {
      const node = document.getElementById(id);
      console.assert(node, "Could not find node with id: " + id);
      if (!node) continue;
      newContainer.appendChild(node);
    }

    // Fix notification deck
    document.getElementById("zen-appcontent-navbar-container")
      .appendChild(document.getElementById("tab-notification-deck-template"));

    gZenVerticalTabsManager.init();
    gZenCompactModeManager.init();
    gZenKeyboardShortcuts.init();

    this._updateZenAvatar();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this._onPrefersColorSchemeChange.bind(this));

    function throttle(f, delay) {
      let timer = 0;
      return function(...args) {
          clearTimeout(timer);
          timer = setTimeout(() => f.apply(this, args), delay);
      }
    }

    new ResizeObserver(throttle(
      this._updateTabsToolbar.bind(this), 1000
    )).observe(document.getElementById("tabbrowser-tabs"));

    this.closeWatermark();
  },

  _onPrefersColorSchemeChange(event) {
    this._updateZenAvatar();
  },

  _updateTabsToolbar() {
    // Set tabs max-height to the "toolbar-items" height
    const toolbarItems = document.getElementById("tabbrowser-tabs");
    const tabs = document.getElementById("tabbrowser-arrowscrollbox");
    tabs.style.maxHeight = '0px'; // reset to 0
    const toolbarRect = toolbarItems.getBoundingClientRect();
    // -5 for the controls padding
    tabs.style.maxHeight = toolbarRect.height - 5 + "px";
    console.info("ZenThemeModifier: set tabs max-height to", toolbarRect.height + "px");
  },

  _updateZenAvatar() {
    const mainWindowEl = document.documentElement;
    // Dont override the sync avatar if it's already set
    if (mainWindowEl.style.hasOwnProperty("--avatar-image-url")) {
      return;
    }
    let profile = ProfileService.currentProfile;
    if (!profile || profile.zenAvatarPath == "") return;
    // TODO: actually use profile data to generate the avatar, instead of just using the name
    let avatarUrl = this._getThemedAvatar(profile.zenAvatarPath);
    if (document.documentElement.hasAttribute("privatebrowsingmode")) {
      avatarUrl = "chrome://global/skin/icons/indicator-private-browsing.svg";
    }
    mainWindowEl.style.setProperty("--zen-avatar-image-url", `url(${avatarUrl})`);
    mainWindowEl.style.setProperty("--avatar-image-url", `var(--zen-avatar-image-url)`, "important");
  },

  _getThemedAvatar(avatarPath) {
    if (!avatarPath.startsWith("chrome://browser/content/zen-avatars/avatar-")
      || !avatarPath.endsWith(".svg")) {
      return avatarPath;
    }
    let withoutExtension = avatarPath.slice(0, -4);
    let scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
    return `${withoutExtension}-${scheme}.svg`;
  },

  openWatermark() {
    if (!Services.prefs.getBoolPref("zen.watermark.enabled", false)) {
      return;
    }
    const watermark = document.getElementById("zen-watermark");
    if (watermark) {
      watermark.removeAttribute("hidden");
    }
  },

  closeWatermark() {
    const watermark = document.getElementById("zen-watermark");
    if (watermark) {
      watermark.setAttribute("hidden", "true");
    }
  },
};

if (typeof Services !== "undefined")
  ZenThemeModifier.init();
