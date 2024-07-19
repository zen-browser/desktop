
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

 "use strict";

/* INCLUDE THIS FILE AS:
 *   <script src="chrome://browser/content/zenThemeModifier.js"></script>
 *
 * FOR ANY WEBSITE THAT WOULD NEED TO USE THE ACCENT COLOR, ETC
 */

{
  const kZenThemeAccentColorPref = "zen.theme.accent-color";

  /**
  * ZenThemeModifier controls the application of theme data to the browser,
  * for examplem, it injects the accent color to the document. This is used
  * because we need a way to apply the accent color without having to worry about
  * shadow roots not inheriting the accent color.
  * 
  * note: It must be a firefox builtin page with access to the browser's configuration
  *  and services.
  */
  const ZenThemeModifier = {
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
      addEventListener("LightweightTheme:Set", this);
      Services.prefs.addObserver(kZenThemeAccentColorPref, this.handleEvent.bind(this));
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
      document.documentElement.style.setProperty("--zen-appcontent-separator-from-window-single", "0px");
      document.documentElement.style.setProperty("--zen-appcontent-border-radius", "0px");
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
    },

    _zenInitBrowserLayout() {
      if (!this._inMainBrowserWindow) return;
      this.openWatermark();
      console.log("ZenThemeModifier: init browser layout");
      const kNavbarItems = [
        "nav-bar",
        "PersonalToolbar",
        "tab-notification-deck-template"
      ];
      const kSeparatorId = "zen-website-and-native-separator";
      const kNewContainerId = "zen-appcontent-navbar-container";
      let newContainer = document.getElementById(kNewContainerId);
      for (let id of kNavbarItems) {
        const node = document.getElementById(id);
        console.assert(node, "Could not find node with id: " + id);
        if (!node) continue;
        newContainer.appendChild(node);
      }
      // Add the separator
      const separator = document.createElement("span");
      separator.id = kSeparatorId;
      newContainer.appendChild(separator);

      // move the security button to the right
      const securityButton = document.getElementById("tracking-protection-icon-container");
      document.getElementsByClassName("urlbar-input-container")[0].insertBefore(securityButton, document.getElementById("page-action-buttons"));
    
      const mainWindowEl = document.documentElement;
      // Dont override the sync avatar if it's already set
      if (mainWindowEl.style.hasOwnProperty("--avatar-image-url")) {
        return;
      }
      let profile = ProfileService.currentProfile;
      if (!profile || profile.zenAvatarPath == "") return;
      // TODO: actually use profile data to generate the avatar, instead of just using the name
      let avatarUrl = profile.zenAvatarPath;
      if (document.documentElement.hasAttribute("privatebrowsingmode")) {
        avatarUrl = "chrome://global/skin/icons/indicator-private-browsing.svg";
      }
      console.log("ZenThemeModifier: setting avatar image to", avatarUrl);
      mainWindowEl.style.setProperty("--zen-avatar-image-url", `url(${avatarUrl})`);
      mainWindowEl.style.setProperty("--avatar-image-url", `var(--zen-avatar-image-url)`, "important");
      this.closeWatermark();
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
}