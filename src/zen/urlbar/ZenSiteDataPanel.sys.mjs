/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const ADDONS_BUTTONS_HIDDEN = Services.prefs.getBoolPref(
  "zen.theme.hide-unified-extensions-button",
  true
);

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  FeatureCallout: "resource:///modules/asrouter/FeatureCallout.sys.mjs",
});

export class nsZenSiteDataPanel {
  #iconMap = {
    install: "extension",
    "site-protection": "shield",
    "3rdPartyStorage": "cookie",
  };

  constructor(window) {
    this.window = window;
    this.document = window.document;

    this.unifiedPanel = this.#initUnifiedPanel();
    this.unifiedPanelView = "unified-extensions-view";
    this.extensionsPanelView = "original-unified-extensions-view";

    if (ADDONS_BUTTONS_HIDDEN) {
      this.window.gUnifiedExtensions._panel = this.unifiedPanel;

      // Remove the old permissions dialog
      this.document.getElementById("unified-extensions-panel-template")?.remove();
    } else {
      this.extensionsPanel = this.#initExtensionsPanel();
    }

    this.#init();
  }

  #init() {
    // Add a new button to the urlbar popup
    const button = this.window.MozXULElement.parseXULToFragment(`
      <box id="zen-site-data-icon-button" role="button" align="center" class="identity-box-button" delegatesanchor="true">
        <image />
      </box>
    `);
    this.anchor = button.querySelector("#zen-site-data-icon-button");
    this.document.getElementById("identity-icon-box").before(button);

    this.extensionsPanelButton = this.document.getElementById("unified-extensions-button");
    this.window.gUnifiedExtensions._button = ADDONS_BUTTONS_HIDDEN
      ? this.anchor
      : this.extensionsPanelButton;

    this.document
      .getElementById("nav-bar")
      .setAttribute("addon-webext-overflowbutton", "zen-site-data-icon-button");

    this.#initCopyUrlButton();
    this.#initEventListeners();
    this.#initUnifiedExtensionsManageHook();
    this.#maybeShowFeatureCallout();
  }

  #initEventListeners() {
    this.unifiedPanel.addEventListener("popupshowing", this);
    this.document.getElementById("zen-site-data-manage-addons").addEventListener("click", this);
    this.document.getElementById("zen-site-data-settings-more").addEventListener("click", this);
    this.anchor.addEventListener("click", this);
    const kCommandIDs = [
      "zen-site-data-header-share",
      "zen-site-data-header-bookmark",
      "zen-site-data-security-info",
      "zen-site-data-actions",
      "zen-site-data-new-addon-button",
    ];

    for (let id of kCommandIDs) {
      this.document.getElementById(id).addEventListener("command", this);
    }

    this.#initContextMenuEventListener();
  }

  #initCopyUrlButton() {
    // This function is a bit out of place, but it's related enough to the panel
    // that it's easier to do it here than in a separate module.
    const container = this.document.getElementById("page-action-buttons");
    const fragment = this.window.MozXULElement.parseXULToFragment(`
      <hbox id="zen-copy-url-button"
            class="urlbar-page-action"
            role="button"
            data-l10n-id="zen-urlbar-copy-url-button"
            disabled="true">
        <image class="urlbar-icon"/>
      </hbox>
    `);
    container.after(fragment);

    const aElement = this.document.getElementById("zen-copy-url-button");
    aElement.addEventListener("click", () => {
      if (aElement.hasAttribute("disabled")) {
        return;
      }
      this.document.getElementById("cmd_zenCopyCurrentURL").doCommand();
    });

    this.window.gBrowser.addProgressListener({
      onLocationChange: (aWebProgress, aRequest, aLocation) => {
        if (aWebProgress.isTopLevel) {
          const disabled = !this.#canCopyUrl(aLocation);
          if (disabled) {
            aElement.setAttribute("disabled", true);
          } else {
            aElement.removeAttribute("disabled");
          }
        }
      },
    });
  }

  #initContextMenuEventListener() {
    const kCommands = {
      context_zenClearSiteData: (event) => {
        this.window.gIdentityHandler.clearSiteData(event);
      },
      context_zenOpenGetAddons: () => {
        this.#openGetAddons();
      },
      context_zenOpenSiteSettings: () => {
        const { BrowserCommands } = this.window;
        BrowserCommands.pageInfo(null, "permTab");
      },
    };

    for (let [id, handler] of Object.entries(kCommands)) {
      this.document.getElementById(id).addEventListener("command", handler);
    }
  }

  #initUnifiedExtensionsManageHook() {
    const manageExtensionItem = this.document.getElementById(
      "unified-extensions-context-menu-manage-extension"
    );

    manageExtensionItem.addEventListener("command", () => {
      this.unifiedPanel.hidePopup();
    });
  }

  #initExtensionsPanel() {
    const panel = this.window.gUnifiedExtensions.panel;

    const extensionsView = panel?.querySelector("#unified-extensions-view");
    extensionsView.setAttribute("id", this.extensionsPanelView);

    const panelMultiView = panel?.querySelector("panelmultiview");
    panelMultiView.setAttribute("mainViewId", this.extensionsPanelView);

    return panel;
  }

  #initUnifiedPanel() {
    const panel = this.document.getElementById("zen-unified-site-data-panel");
    this.window.gUnifiedExtensions.initializePanel(panel);
    return panel;
  }

  #preparePanel() {
    this.#setSitePermissions();
    this.#setSiteSecurityInfo();
    this.#setSiteHeader();
    this.#setAddonsOverflow();
  }

  #setAddonsOverflow() {
    const addons = this.document.getElementById("zen-site-data-addons");
    if (addons.getBoundingClientRect().height > 420) {
      addons.setAttribute("overflowing", "true");
    } else {
      addons.removeAttribute("overflowing");
    }
  }

  get #currentPageIsBookmarked() {
    // A hacky way to check if the current page is bookmarked, but
    // it works for our purposes.
    return this.window.BookmarkingUI.star?.hasAttribute("starred");
  }

  #setSiteHeader() {
    {
      const button = this.document.getElementById("zen-site-data-header-reader-mode");
      const urlbarButton = this.window.document.getElementById("reader-mode-button");
      const isActive = urlbarButton?.hasAttribute("readeractive");
      const isVisible = !urlbarButton?.hidden || isActive;

      button.disabled = !isVisible;
      if (isActive) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
      this.document.l10n.setAttributes(button, urlbarButton?.getAttribute("data-l10n-id"));
    }
    {
      const button = this.document.getElementById("zen-site-data-header-bookmark");
      const isPageBookmarked = this.#currentPageIsBookmarked;

      if (isPageBookmarked) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    }
    {
      const button = this.document.getElementById("zen-site-data-header-share");
      if (this.#canCopyUrl(this.window.gBrowser.currentURI)) {
        button.removeAttribute("disabled");
      } else {
        button.setAttribute("disabled", "true");
      }
    }
  }

  /**
   * Determines whether the copy URL button should be hidden for the given URI.
   *
   * @param {nsIURI} uri - The URI to check.
   * @returns {boolean} True if the button should be hidden, false otherwise.
   */
  #canCopyUrl(uri) {
    if (!uri) {
      return false;
    }

    return uri.scheme.startsWith("http");
  }

  #setSiteSecurityInfo() {
    const { gIdentityHandler } = this.window;
    const button = this.document.getElementById("zen-site-data-security-info");

    if (gIdentityHandler._isSecureInternalUI) {
      button.parentNode.hidden = true;
      return;
    }

    let identity;
    if (gIdentityHandler._pageExtensionPolicy) {
      this.document.l10n.setAttributes(button, "zen-site-data-security-info-extension");
      identity = "extension";
    } else if (
      gIdentityHandler._uriHasHost &&
      gIdentityHandler._isSecureConnection &&
      !gIdentityHandler._isCertUserOverridden &&
      !gIdentityHandler._isCertErrorPage &&
      !gIdentityHandler._isAboutHttpsOnlyErrorPage
    ) {
      this.document.l10n.setAttributes(button, "zen-site-data-security-info-secure");
      identity = "secure";
    } else {
      this.document.l10n.setAttributes(button, "zen-site-data-security-info-not-secure");
      identity = "not-secure";
    }

    button.parentNode.hidden = false;
    button.setAttribute("identity", identity);
  }

  #setSitePermissions() {
    const { gBrowser, SitePermissions } = this.window;
    const list = this.document.getElementById("zen-site-data-settings-list");
    const section = list.closest(".zen-site-data-section");

    // show permission icons
    let permissions = SitePermissions.getAllPermissionDetailsForBrowser(gBrowser.selectedBrowser);

    // Don't display origin-keyed 3rdPartyStorage permissions that are covered by
    // site-keyed 3rdPartyFrameStorage permissions.
    let thirdPartyStorageSites = new Set(
      permissions
        .map(function (permission) {
          let [id, key] = permission.id.split(SitePermissions.PERM_KEY_DELIMITER);
          if (id == "3rdPartyFrameStorage" || id == "3rdPartyStorage") {
            return key;
          }
          return null;
        })
        .filter(function (key) {
          return key != null;
        })
    );
    permissions = permissions.filter(function (permission) {
      let [id, key] = permission.id.split(SitePermissions.PERM_KEY_DELIMITER);
      if (id != "3rdPartyStorage") {
        return true;
      }
      try {
        let origin = Services.io.newURI(key);
        let site = Services.eTLD.getSite(origin);
        return !thirdPartyStorageSites.has(site);
      } catch {
        return false;
      }
    });

    this._sharingState = gBrowser.selectedTab._sharingState;

    if (this._sharingState?.geo) {
      let geoPermission = permissions.find((perm) => perm.id === "geo");
      if (!geoPermission) {
        permissions.push({
          id: "geo",
          state: SitePermissions.ALLOW,
          scope: SitePermissions.SCOPE_REQUEST,
          sharingState: true,
        });
      }
    }

    if (this._sharingState?.xr) {
      let xrPermission = permissions.find((perm) => perm.id === "xr");
      if (!xrPermission) {
        permissions.push({
          id: "xr",
          state: SitePermissions.ALLOW,
          scope: SitePermissions.SCOPE_REQUEST,
          sharingState: true,
        });
      }
    }

    if (this._sharingState?.webRTC) {
      let webrtcState = this._sharingState.webRTC;
      // If WebRTC device or screen are in use, we need to find
      // the associated ALLOW permission item to set the sharingState field.
      for (let id of ["camera", "microphone", "screen"]) {
        if (webrtcState[id]) {
          let found = false;
          for (let permission of permissions) {
            let [permId] = permission.id.split(SitePermissions.PERM_KEY_DELIMITER);
            if (permId != id || permission.state != SitePermissions.ALLOW) {
              continue;
            }
            found = true;
          }
          if (!found) {
            // If the ALLOW permission item we were looking for doesn't exist,
            // the user has temporarily allowed sharing and we need to add
            // an item in the permissions array to reflect this.
            permissions.push({
              id,
              state: SitePermissions.ALLOW,
              scope: SitePermissions.SCOPE_REQUEST,
              sharingState: webrtcState[id],
            });
          }
        }
      }
    }

    // Add site protection permissions if needed.
    const { gProtectionsHandler } = this.window;
    if (
      gBrowser.currentURI.schemeIs("http") ||
      gBrowser.currentURI.schemeIs("https") ||
      gBrowser.currentURI.schemeIs("ftp")
    ) {
      permissions.push({
        id: "site-protection",
        state: gProtectionsHandler.hasException ? SitePermissions.BLOCK : SitePermissions.ALLOW,
        scope: SitePermissions.SCOPE_PERSISTENT,
      });
    }

    const separator = this.document.createXULElement("toolbarseparator");
    list.innerHTML = "";
    list.appendChild(separator);
    const settingElements = [];
    const crossSiteCookieElements = [];
    for (let permission of permissions) {
      let [id, key] = permission.id.split(SitePermissions.PERM_KEY_DELIMITER);

      if (id == "storage-access") {
        // Ignore storage access permissions here, they are made visible inside
        // the Content Blocking UI.
        continue;
      }

      if (permission.state == SitePermissions.PROMPT) {
        // We don't display "ask" permissions in the site data panel.
        continue;
      }

      let [item, isCrossSiteCookie] = this.#createPermissionItem(id, key, permission);
      if (item) {
        if (isCrossSiteCookie) {
          crossSiteCookieElements.push(item);
        } else {
          settingElements.push(item);
        }
      }
    }

    for (let elem of settingElements) {
      separator.before(elem);
    }
    for (let elem of crossSiteCookieElements) {
      separator.after(elem);
    }

    separator.hidden = !settingElements.length || !crossSiteCookieElements.length;
    section.hidden = list.childElementCount < 2; // only the separator
  }

  #getPermissionStateLabelId(permission) {
    const { SitePermissions } = this.window;
    switch (permission.state) {
      // There should only be these types being displayed in the panel.
      case SitePermissions.ALLOW:
        if (permission.id === "site-protection") {
          return "zen-site-data-protections-enabled";
        }
        return "zen-site-data-setting-allow";
      case SitePermissions.BLOCK:
      case SitePermissions.AUTOPLAY_BLOCKED_ALL:
        if (permission.id === "site-protection") {
          return "zen-site-data-protections-disabled";
        }
        return "zen-site-data-setting-block";
      default:
        return null;
    }
  }

  #createPermissionItem(id, key, permission) {
    const { SitePermissions } = this.window;
    const isCrossSiteCookie = id === "3rdPartyStorage";

    // Create a permission item for the site data panel.
    let container = this.document.createXULElement("hbox");
    const idNoSuffix = permission.id;
    container.classList.add(
      "permission-popup-permission-item",
      `permission-popup-permission-item-${idNoSuffix}`
    );
    container.setAttribute("align", "center");
    container.setAttribute("role", "group");

    container.setAttribute("state", permission.state == SitePermissions.ALLOW ? "allow" : "block");

    let img = this.document.createXULElement("toolbarbutton");
    img.classList.add("permission-popup-permission-icon", "zen-site-data-permission-icon");
    img.setAttribute("closemenu", "none");
    if (this.#iconMap[id]) {
      img.classList.add(`zen-permission-${this.#iconMap[id]}-icon`);
    }

    let labelContainer = this.document.createXULElement("vbox");
    labelContainer.setAttribute("flex", "1");
    labelContainer.setAttribute("align", "start");
    labelContainer.classList.add("permission-popup-permission-label-container");
    labelContainer._permission = permission;

    let nameLabel = this.document.createXULElement("label");
    nameLabel.setAttribute("flex", "1");
    nameLabel.setAttribute("class", "permission-popup-permission-label");
    if (isCrossSiteCookie) {
      this.document.l10n.setAttributes(nameLabel, "zen-site-data-setting-cross-site");
    } else {
      let label = SitePermissions.getPermissionLabel(permission.id);
      if (label) {
        nameLabel.textContent = label;
      } else {
        this.document.l10n.setAttributes(nameLabel, "zen-site-data-setting-" + idNoSuffix);
      }
    }
    labelContainer.appendChild(nameLabel);

    let stateLabel = this.document.createXULElement("label");
    stateLabel.setAttribute("class", "zen-permission-popup-permission-state-label");
    if (isCrossSiteCookie) {
      // The key should be the site for cross-site cookies.
      stateLabel.textContent = key;
    } else {
      stateLabel.setAttribute("data-l10n-id", this.#getPermissionStateLabelId(permission));
    }
    labelContainer.appendChild(stateLabel);

    container.appendChild(img);
    container.appendChild(labelContainer);

    container.addEventListener("click", this);
    return [container, isCrossSiteCookie];
  }

  #openGetAddons() {
    const { switchToTabHavingURI } = this.window;
    let amoUrl = Services.urlFormatter.formatURLPref("extensions.getAddons.link.url");
    switchToTabHavingURI(amoUrl, true);
  }

  #onCommandEvent(event) {
    const id = event.target.id;
    switch (id) {
      case "zen-site-data-new-addon-button": {
        this.#openGetAddons();
        break;
      }
      case "zen-site-data-security-info": {
        this.window.gIdentityHandler._openPopup(event);
        break;
      }
      case "zen-site-data-actions": {
        const button = this.document.getElementById("zen-site-data-actions");
        const popup = this.document.getElementById("zenSiteDataActions");
        popup.openPopup(
          button,
          "after_start",
          0,
          0,
          /* context menu */ true,
          false,
          this.window.event
        );
        break;
      }
      case "zen-site-data-header-bookmark": {
        this.window.BookmarkingUI.onStarCommand(event);
        break;
      }
      case "zen-site-data-header-share": {
        /* eslint-disable mozilla/valid-services */
        if (Services.zen.canShare()) {
          const buttonRect = event.target.getBoundingClientRect();
          const currentUrl = this.window.gBrowser.currentURI;
          /* eslint-disable mozilla/valid-services */
          Services.zen.share(
            currentUrl,
            "",
            "",
            buttonRect.left,
            this.window.innerHeight - buttonRect.bottom,
            buttonRect.width,
            buttonRect.height
          );
        } else {
          this.window.gZenCommonActions.copyCurrentURLToClipboard();
        }
        if (AppConstants.platform !== "macosx") {
          this.unifiedPanel.hidePopup();
        }
      }
    }
  }

  #onPermissionClick(label) {
    const { SitePermissions, gBrowser } = this.window;
    const permission = label._permission;

    let newState;
    switch (permission.state) {
      case SitePermissions.ALLOW:
        newState = SitePermissions.BLOCK;
        break;
      case SitePermissions.BLOCK:
      case SitePermissions.AUTOPLAY_BLOCKED_ALL:
        newState = SitePermissions.ALLOW;
        break;
      default:
        return;
    }

    if (permission.id === "site-protection") {
      const { gProtectionsHandler } = this.window;
      if (newState === SitePermissions.BLOCK) {
        gProtectionsHandler.disableForCurrentPage();
      } else {
        gProtectionsHandler.enableForCurrentPage();
      }
    } else {
      SitePermissions.setForPrincipal(gBrowser.contentPrincipal, permission.id, newState);
    }

    const isCrossSiteCookie = permission.id.startsWith("3rdPartyStorage");
    label.parentNode.setAttribute("state", newState == SitePermissions.ALLOW ? "allow" : "block");
    label._permission.state = newState;
    if (!isCrossSiteCookie) {
      label
        .querySelector(".zen-permission-popup-permission-state-label")
        .setAttribute("data-l10n-id", this.#getPermissionStateLabelId(label._permission));
    }
  }

  #onClickEvent(event) {
    const id = event.target.id;
    switch (id) {
      case "zen-site-data-manage-addons": {
        const { BrowserAddonUI } = this.window;
        BrowserAddonUI.openAddonsMgr("addons://list/extension");
        this.unifiedPanel.hidePopup();
        break;
      }
      case "zen-site-data-settings-more": {
        const { BrowserCommands } = this.window;
        BrowserCommands.pageInfo(null, "permTab");
        break;
      }
      case "zen-site-data-icon-button": {
        this.window.gUnifiedExtensions.togglePanel(
          event,
          null,
          this.unifiedPanel,
          this.unifiedPanelView,
          this.anchor
        );
        break;
      }
      default: {
        const item = event.target.closest(".permission-popup-permission-item");
        if (!item) {
          break;
        }
        const label = item.querySelector(".permission-popup-permission-label-container");
        if (label?._permission) {
          this.#onPermissionClick(label);
        }
        break;
      }
    }
  }

  handleEvent(event) {
    const type = event.type;
    switch (type) {
      case "click":
        this.#onClickEvent(event);
        break;
      case "command":
        this.#onCommandEvent(event);
        break;
      case "popupshowing":
        this.#preparePanel();
        break;
    }
  }

  async #maybeShowFeatureCallout() {
    const kPref = "zen.site-data-panel.show-callout";
    if (!Services.prefs.getBoolPref(kPref, false)) {
      return;
    }
    Services.prefs.setBoolPref(kPref, false);
    const { gBrowser, gZenWorkspaces } = this.window;
    await gZenWorkspaces.promiseInitialized;
    await new Promise((resolve) => {
      const checkEmptyTab = () => {
        if (!gBrowser.selectedTab.hasAttribute("zen-empty-tab")) {
          resolve();
          return;
        }
        this.window.addEventListener("TabSelect", checkEmptyTab, { once: true });
      };
      checkEmptyTab();
    });
    const callout = new lazy.FeatureCallout({
      win: this.window,
      location: "chrome",
      context: "chrome",
      browser: gBrowser.selectedBrowser,
      theme: { preset: "chrome" },
    });
    this.window.setTimeout(() => {
      callout.showFeatureCallout({
        id: "ZEN_EXTENSIONS_PANEL_MOVE_CALLOUT",
        template: "feature_callout",
        groups: ["cfr"],
        content: {
          id: "ZEN_EXTENSIONS_PANEL_MOVE_CALLOUT",
          template: "multistage",
          backdrop: "transparent",
          transitions: true,
          screens: [
            {
              id: "ZEN_EXTENSIONS_PANEL_MOVE_CALLOUT",
              anchors: [
                {
                  selector: "#zen-site-data-icon-button",
                  panel_position: {
                    anchor_attachment: "bottomcenter",
                    callout_attachment: "topleft",
                  },
                },
              ],
              content: {
                position: "callout",
                width: "355px",
                title: {
                  string_id: "zen-site-data-panel-feature-callout-title",
                },
                subtitle: {
                  string_id: "zen-site-data-panel-feature-callout-subtitle",
                },
                dismiss_button: {
                  action: {
                    dismiss: true,
                  },
                  background: true,
                  size: "small",
                },
              },
            },
          ],
        },
      });
    }, 1000);
  }
}
