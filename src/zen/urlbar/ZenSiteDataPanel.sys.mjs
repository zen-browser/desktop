/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from 'resource://gre/modules/AppConstants.sys.mjs';

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  FeatureCallout: 'resource:///modules/asrouter/FeatureCallout.sys.mjs',
});

export class nsZenSiteDataPanel {
  #iconMap = {
    install: 'extension',
    'site-protection': 'shield',
    '3rdPartyStorage': 'cookie',
  };

  constructor(window) {
    this.window = window;
    this.document = window.document;

    this.panel = this.document.getElementById('zen-unified-site-data-panel');
    this.#init();
  }

  #init() {
    // Add a new button to the urlbar popup
    const button = this.window.MozXULElement.parseXULToFragment(`
      <box id="zen-site-data-icon-button" role="button" align="center" class="identity-box-button" delegatesanchor="true">
        <image />
      </box>
    `);
    this.anchor = button.querySelector('#zen-site-data-icon-button');
    this.document.getElementById('identity-icon-box').before(button);
    this.window.gUnifiedExtensions._button = this.anchor;

    this.document
      .getElementById('nav-bar')
      .setAttribute('addon-webext-overflowbutton', 'zen-site-data-icon-button');

    // Remove the old permissions dialog
    this.document.getElementById('unified-extensions-panel-template').remove();
    try {
      const TRANSLATE_IMAGE_IDS = [
        'translations-button-icon',
        'translations-button-circle-arrows',
        'translations-button-locale',
      ];
      const TRANSLATE_CONTAINER_ID = 'translations-button';

      function ensureCollapsedStub() {.
        let container = this.document.getElementById(TRANSLATE_CONTAINER_ID);
        if (!container) {
          try {
            const insertAfter =
              this.document.getElementById('page-action-buttons') ||
              this.document.getElementById('identity-icon-box') ||
              this.document.documentElement;

            container = this.document.createXULElement
              ? this.document.createXULElement('hbox')
              : this.document.createElement('hbox');
            container.id = TRANSLATE_CONTAINER_ID;

            container.setAttribute('role', 'button');

            container.setAttribute('collapsed', 'true');
            container.setAttribute('hidden', 'true');

            try {
              container.style.setProperty('display', 'none', 'important');
            } catch (e) {
            }

            if (typeof container.contains !== 'function') {
              container.contains = function () {
                return false;
              };
            }

            container.setAttribute('data-zen-legacy-stub', 'true');

            insertAfter.appendChild(container);
          } catch (e) {
            Cu.reportError?.(`translations: failed to create stub container: ${e}`);
            return;
          }
        } else {
          try {
            try {
              container.classList.remove && container.classList.remove('urlbar-page-action');
              container.classList.remove && container.classList.remove('some-other-urlbar-class');
            } catch (e) { }

            container.setAttribute('collapsed', 'true');
            container.setAttribute('hidden', 'true');

            try {
              container.style.setProperty('display', 'none', 'important');
            } catch (e) { }

            if (typeof container.contains !== 'function') {
              container.contains = function () {
                return false;
              };
            }
          } catch (e) {
            Cu.reportError?.(`translations: failed to collapse existing container: ${e}`);
          }
        }
      }

      const removeInlineTranslateUI = () => {
        for (const id of TRANSLATE_IMAGE_IDS) {
          const el = this.document.getElementById(id);
          if (el) {
            try {
              el.remove();
            } catch (e) {
              try {
                el.setAttribute && el.setAttribute('collapsed', 'true');
                el.setAttribute && el.setAttribute('hidden', 'true');
              } catch { }
            }
          }
        }

        ensureCollapsedStub.call(this);

        const cmdTranslateElements = this.document.querySelectorAll('[command="cmd_translate"]');
        for (const el of cmdTranslateElements) {
          if (!el || el.id === 'zen-site-data-header-translate') {
            continue; 
          }

          const isLegacyId = el.id && (TRANSLATE_IMAGE_IDS.includes(el.id) || el.id === TRANSLATE_CONTAINER_ID);

          const inUrlbar =
            el.closest && (
              el.closest('#urlbar') ||
              el.closest('#identity-icon-box') ||
              el.closest('#page-action-buttons') ||
              el.closest('.urlbar-page-action')
            );

          if (isLegacyId || inUrlbar) {
            try {
              el.removeAttribute('command');
            } catch (e) {
              Cu.reportError?.(`translations: failed to remove cmd_translate from ${el.id}: ${e}`);
            }
          }
        }
      };

      if (this.document.readyState === 'complete' || this.document.readyState === 'interactive') {
        removeInlineTranslateUI();
      } else {
        this.window.addEventListener('DOMContentLoaded', removeInlineTranslateUI, { once: true });
      }

      const mo = new this.window.MutationObserver((mutations, observer) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof this.window.Element)) {
              continue;
            }
            if (
              (node.id && (TRANSLATE_IMAGE_IDS.includes(node.id) || node.id === TRANSLATE_CONTAINER_ID)) ||
              TRANSLATE_IMAGE_IDS.some((tid) => node.querySelector && node.querySelector(`#${tid}`))
            ) {
              try {
                removeInlineTranslateUI();
              } finally {
                observer.disconnect();
                return;
              }
            }
          }
        }
      });
      mo.observe(this.document, { childList: true, subtree: true });
    } catch (ex) {
      Cu.reportError(`Error removing inline translate UI: ${ex}`);
    }

    this.#initCopyUrlButton();
    this.#initEventListeners();
    this.#maybeShowFeatureCallout();
  }

  #initEventListeners() {
    this.panel.addEventListener('popupshowing', this);
    this.document.getElementById('zen-site-data-manage-addons').addEventListener('click', this);
    this.document.getElementById('zen-site-data-settings-more').addEventListener('click', this);
    this.anchor.addEventListener('click', this);
    try {
      const panelTranslateBtn = this.document.getElementById('zen-site-data-header-translate');
      if (panelTranslateBtn) {
        panelTranslateBtn.addEventListener('command', (event) => {
          try {
            const legacyBtn = this.window.document.getElementById('translations-button');
            if (legacyBtn) {
              try {
                const cmdEvent = new this.window.Event('command', { bubbles: true, cancelable: true });
                legacyBtn.dispatchEvent(cmdEvent);
                return;
              } catch (e) {
                try {
                  legacyBtn.click && legacyBtn.click();
                  return;
                } catch { }
              }
            }
          } catch (e) {
          }

          try {
            const globals = [
              this.window.FullPageTranslationsPanel,
              this.window.fullPageTranslationsPanel,
              this.window.TranslationsPanel,
              this.window.Translations,
              this.window.TranslationsPanelShared,
            ];
            for (const g of globals) {
              if (g && typeof g.toggle === 'function') {
                try {
                  g.toggle();
                  return;
                } catch { }
              }
              if (g && typeof g.open === 'function') {
                try {
                  g.open();
                  return;
                } catch { }
              }
            }
          } catch (e) {
          }

          try {
            const cmd = this.document.getElementById('cmd_translate') || this.window.document.getElementById('cmd_translate');
            if (cmd && typeof cmd.doCommand === 'function') {
              try {
                cmd.doCommand();
                return;
              } catch { }
            }
          } catch (e) { }

          Cu.reportError?.('zen-site-data: translate button clicked but no translate handler found');
        });
      }
    } catch (e) {
      Cu.reportError?.(`zen-site-data: failed to wire translate forwarder: ${e}`);
    }
    const kCommandIDs = [
      'zen-site-data-header-share',
      'zen-site-data-header-bookmark',
      'zen-site-data-security-info',
      'zen-site-data-actions',
      'zen-site-data-new-addon-button',
    ];

    for (let id of kCommandIDs) {
      this.document.getElementById(id).addEventListener('command', this);
    }

    this.#initContextMenuEventListener();
  }

  #initCopyUrlButton() {
    // This function is a bit out of place, but it's related enough to the panel
    // that it's easier to do it here than in a separate module.
    const container = this.document.getElementById('page-action-buttons');
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

    const aElement = this.document.getElementById('zen-copy-url-button');
    aElement.addEventListener('click', () => {
      if (aElement.hasAttribute('disabled')) {
        return;
      }
      this.document.getElementById('cmd_zenCopyCurrentURL').doCommand();
    });

    this.window.gBrowser.addProgressListener({
      onLocationChange: (aWebProgress, aRequest, aLocation) => {
        if (aWebProgress.isTopLevel) {
          const disabled = !this.#canCopyUrl(aLocation);
          if (disabled) {
            aElement.setAttribute('disabled', true);
          } else {
            aElement.removeAttribute('disabled');
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
        BrowserCommands.pageInfo(null, 'permTab');
      },
    };

    for (let [id, handler] of Object.entries(kCommands)) {
      this.document.getElementById(id).addEventListener('command', handler);
    }
  }

  #preparePanel() {
    this.#setSitePermissions();
    this.#setSiteSecurityInfo();
    this.#setSiteHeader();
    this.#setAddonsOverflow();
  }

  #setAddonsOverflow() {
    const addons = this.document.getElementById('zen-site-data-addons');
    if (addons.getBoundingClientRect().height > 420) {
      addons.setAttribute('overflowing', 'true');
    } else {
      addons.removeAttribute('overflowing');
    }
  }

  get #currentPageIsBookmarked() {
    // A hacky way to check if the current page is bookmarked, but
    // it works for our purposes.
    return this.window.BookmarkingUI.star?.hasAttribute('starred');
  }

  #setSiteHeader() {
    {
      const button = this.document.getElementById('zen-site-data-header-reader-mode');
      const urlbarButton = this.window.document.getElementById('reader-mode-button');
      const isActive = urlbarButton?.hasAttribute('readeractive');
      const isVisible = !urlbarButton?.hidden || isActive;

      button.disabled = !isVisible;
      if (isActive) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
      this.document.l10n.setAttributes(button, urlbarButton?.getAttribute('data-l10n-id'));
    }
    {
      const button = this.document.getElementById('zen-site-data-header-bookmark');
      const isPageBookmarked = this.#currentPageIsBookmarked;

      if (isPageBookmarked) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
    {
      const button = this.document.getElementById('zen-site-data-header-share');
      if (this.#canCopyUrl(this.window.gBrowser.currentURI)) {
        button.removeAttribute('disabled');
      } else {
        button.setAttribute('disabled', 'true');
      }
    }
  }

  /*
   * Determines whether the copy URL button should be hidden for the given URI.
   * @param {nsIURI} uri - The URI to check.
   * @returns {boolean} True if the button should be hidden, false otherwise.
   */
  #canCopyUrl(uri) {
    if (!uri) {
      return false;
    }

    return uri.scheme.startsWith('http');
  }

  #setSiteSecurityInfo() {
    const { gIdentityHandler } = this.window;
    const button = this.document.getElementById('zen-site-data-security-info');

    if (gIdentityHandler._isSecureInternalUI) {
      button.parentNode.hidden = true;
      return;
    }

    let identity;
    if (gIdentityHandler._pageExtensionPolicy) {
      this.document.l10n.setAttributes(button, 'zen-site-data-security-info-extension');
      identity = 'extension';
    } else if (gIdentityHandler._uriHasHost && gIdentityHandler._isSecureConnection) {
      this.document.l10n.setAttributes(button, 'zen-site-data-security-info-secure');
      identity = 'secure';
    } else {
      this.document.l10n.setAttributes(button, 'zen-site-data-security-info-not-secure');
      identity = 'not-secure';
    }

    button.parentNode.hidden = false;
    button.setAttribute('identity', identity);
  }

  #setSitePermissions() {
    const { gBrowser, SitePermissions } = this.window;
    const list = this.document.getElementById('zen-site-data-settings-list');
    const section = list.closest('.zen-site-data-section');

    // show permission icons
    let permissions = SitePermissions.getAllPermissionDetailsForBrowser(gBrowser.selectedBrowser);

    // Don't display origin-keyed 3rdPartyStorage permissions that are covered by
    // site-keyed 3rdPartyFrameStorage permissions.
    let thirdPartyStorageSites = new Set(
      permissions
        .map(function (permission) {
          let [id, key] = permission.id.split(SitePermissions.PERM_KEY_DELIMITER);
          if (id == '3rdPartyFrameStorage' || id == '3rdPartyStorage') {
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
      if (id != '3rdPartyStorage') {
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
      let geoPermission = permissions.find((perm) => perm.id === 'geo');
      if (!geoPermission) {
        permissions.push({
          id: 'geo',
          state: SitePermissions.ALLOW,
          scope: SitePermissions.SCOPE_REQUEST,
          sharingState: true,
        });
      }
    }

    if (this._sharingState?.xr) {
      let xrPermission = permissions.find((perm) => perm.id === 'xr');
      if (!xrPermission) {
        permissions.push({
          id: 'xr',
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
      for (let id of ['camera', 'microphone', 'screen']) {
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
      gBrowser.currentURI.schemeIs('http') ||
      gBrowser.currentURI.schemeIs('https') ||
      gBrowser.currentURI.schemeIs('ftp')
    ) {
      permissions.push({
        id: 'site-protection',
        state: gProtectionsHandler.hasException ? SitePermissions.BLOCK : SitePermissions.ALLOW,
        scope: SitePermissions.SCOPE_PERSISTENT,
      });
    }

    const separator = this.document.createXULElement('toolbarseparator');
    list.innerHTML = '';
    list.appendChild(separator);
    const settingElements = [];
    const crossSiteCookieElements = [];
    for (let permission of permissions) {
      let [id, key] = permission.id.split(SitePermissions.PERM_KEY_DELIMITER);

      if (id == 'storage-access') {
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
        if (permission.id === 'site-protection') {
          return 'zen-site-data-protections-enabled';
        }
        return 'zen-site-data-setting-allow';
      case SitePermissions.BLOCK:
      case SitePermissions.AUTOPLAY_BLOCKED_ALL:
        if (permission.id === 'site-protection') {
          return 'zen-site-data-protections-disabled';
        }
        return 'zen-site-data-setting-block';
      default:
        return null;
    }
  }

  #createPermissionItem(id, key, permission) {
    const { SitePermissions } = this.window;
    const isCrossSiteCookie = id === '3rdPartyStorage';

    // Create a permission item for the site data panel.
    let container = this.document.createXULElement('hbox');
    const idNoSuffix = permission.id;
    container.classList.add(
      'permission-popup-permission-item',
      `permission-popup-permission-item-${idNoSuffix}`
    );
    container.setAttribute('align', 'center');
    container.setAttribute('role', 'group');

    container.setAttribute('state', permission.state == SitePermissions.ALLOW ? 'allow' : 'block');

    let img = this.document.createXULElement('toolbarbutton');
    img.classList.add('permission-popup-permission-icon', 'zen-site-data-permission-icon');
    img.setAttribute('closemenu', 'none');
    if (this.#iconMap[id]) {
      img.classList.add(`zen-permission-${this.#iconMap[id]}-icon`);
    }

    let labelContainer = this.document.createXULElement('vbox');
    labelContainer.setAttribute('flex', '1');
    labelContainer.setAttribute('align', 'start');
    labelContainer.classList.add('permission-popup-permission-label-container');
    labelContainer._permission = permission;

    let nameLabel = this.document.createXULElement('label');
    nameLabel.setAttribute('flex', '1');
    nameLabel.setAttribute('class', 'permission-popup-permission-label');
    if (isCrossSiteCookie) {
      this.document.l10n.setAttributes(nameLabel, 'zen-site-data-setting-cross-site');
    } else {
      let label = SitePermissions.getPermissionLabel(permission.id);
      if (label) {
        nameLabel.textContent = label;
      } else {
        this.document.l10n.setAttributes(nameLabel, 'zen-site-data-setting-' + idNoSuffix);
      }
    }
    labelContainer.appendChild(nameLabel);

    let stateLabel = this.document.createXULElement('label');
    stateLabel.setAttribute('class', 'zen-permission-popup-permission-state-label');
    if (isCrossSiteCookie) {
      // The key should be the site for cross-site cookies.
      stateLabel.textContent = key;
    } else {
      stateLabel.setAttribute('data-l10n-id', this.#getPermissionStateLabelId(permission));
    }
    labelContainer.appendChild(stateLabel);

    container.appendChild(img);
    container.appendChild(labelContainer);

    container.addEventListener('click', this);
    return [container, isCrossSiteCookie];
  }

  #openGetAddons() {
    const { switchToTabHavingURI } = this.window;
    let amoUrl = Services.urlFormatter.formatURLPref('extensions.getAddons.link.url');
    switchToTabHavingURI(amoUrl, true);
  }

  #onCommandEvent(event) {
    const id = event.target.id;
    switch (id) {
      case 'zen-site-data-new-addon-button': {
        this.#openGetAddons();
        break;
      }
      case 'zen-site-data-security-info': {
        this.window.gIdentityHandler._openPopup(event);
        break;
      }
      case 'zen-site-data-actions': {
        const button = this.document.getElementById('zen-site-data-actions');
        const popup = this.document.getElementById('zenSiteDataActions');
        popup.openPopup(
          button,
          'after_start',
          0,
          0,
          /* context menu */ true,
          false,
          this.window.event
        );
        break;
      }
      case 'zen-site-data-header-bookmark': {
        this.window.BookmarkingUI.onStarCommand(event);
        break;
      }
      case 'zen-site-data-header-share': {
        if (Services.zen.canShare()) {
          const buttonRect = event.target.getBoundingClientRect();
          const currentUrl = this.window.gBrowser.currentURI;
          Services.zen.share(
            currentUrl,
            '',
            '',
            buttonRect.left,
            this.window.innerHeight - buttonRect.bottom,
            buttonRect.width,
            buttonRect.height
          );
        } else {
          this.window.gZenCommonActions.copyCurrentURLToClipboard();
        }
        if (AppConstants.platform !== 'macosx') {
          this.panel.hidePopup();
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

    if (permission.id === 'site-protection') {
      const { gProtectionsHandler } = this.window;
      if (newState === SitePermissions.BLOCK) {
        gProtectionsHandler.disableForCurrentPage();
      } else {
        gProtectionsHandler.enableForCurrentPage();
      }
    } else {
      SitePermissions.setForPrincipal(gBrowser.contentPrincipal, permission.id, newState);
    }

    const isCrossSiteCookie = permission.id.startsWith('3rdPartyStorage');
    label.parentNode.setAttribute('state', newState == SitePermissions.ALLOW ? 'allow' : 'block');
    label._permission.state = newState;
    if (!isCrossSiteCookie) {
      label
        .querySelector('.zen-permission-popup-permission-state-label')
        .setAttribute('data-l10n-id', this.#getPermissionStateLabelId(label._permission));
    }
  }

  #onClickEvent(event) {
    const id = event.target.id;
    switch (id) {
      case 'zen-site-data-manage-addons': {
        const { BrowserAddonUI } = this.window;
        BrowserAddonUI.openAddonsMgr('addons://list/extension');
        break;
      }
      case 'zen-site-data-settings-more': {
        const { BrowserCommands } = this.window;
        BrowserCommands.pageInfo(null, 'permTab');
        break;
      }
      case 'zen-site-data-icon-button': {
        this.window.gUnifiedExtensions.togglePanel(event);
        break;
      }
      default: {
        const item = event.target.closest('.permission-popup-permission-item');
        if (!item) {
          break;
        }
        const label = item.querySelector('.permission-popup-permission-label-container');
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
      case 'click':
        this.#onClickEvent(event);
        break;
      case 'command':
        this.#onCommandEvent(event);
        break;
      case 'popupshowing':
        this.#preparePanel();
        break;
    }
  }

  async #maybeShowFeatureCallout() {
    const kPref = 'zen.site-data-panel.show-callout';
    if (!Services.prefs.getBoolPref(kPref, false)) {
      return;
    }
    Services.prefs.setBoolPref(kPref, false);
    const { FeatureCallout } = lazy;
    const { gBrowser, gZenWorkspaces } = this.window;
    await gZenWorkspaces.promiseInitialized;
    await new Promise((resolve) => {
      const checkEmptyTab = () => {
        if (!gBrowser.selectedTab.hasAttribute('zen-empty-tab')) {
          resolve();
          return;
        }
        this.window.addEventListener('TabSelect', checkEmptyTab, { once: true });
      };
      checkEmptyTab();
    });
    const callout = new FeatureCallout({
      win: this.window,
      location: 'chrome',
      context: 'chrome',
      browser: gBrowser.selectedBrowser,
      theme: { preset: 'chrome' },
    });
    this.window.setTimeout(() => {
      callout.showFeatureCallout({
        id: 'ZEN_EXTENSIONS_PANEL_MOVE_CALLOUT',
        template: 'feature_callout',
        groups: ['cfr'],
        content: {
          id: 'ZEN_EXTENSIONS_PANEL_MOVE_CALLOUT',
          template: 'multistage',
          backdrop: 'transparent',
          transitions: true,
          screens: [
            {
              id: 'ZEN_EXTENSIONS_PANEL_MOVE_CALLOUT',
              anchors: [
                {
                  selector: '#zen-site-data-icon-button',
                  panel_position: {
                    anchor_attachment: 'bottomcenter',
                    callout_attachment: 'topleft',
                  },
                },
              ],
              content: {
                position: 'callout',
                width: '355px',
                title: {
                  string_id: 'zen-site-data-panel-feature-callout-title',
                },
                subtitle: {
                  string_id: 'zen-site-data-panel-feature-callout-subtitle',
                },
                dismiss_button: {
                  action: {
                    dismiss: true,
                  },
                  background: true,
                  size: 'small',
                },
              },
            },
          ],
        },
      });
    }, 1000);
  }
}