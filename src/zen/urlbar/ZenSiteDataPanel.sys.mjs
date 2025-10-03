/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsZenSiteDataPanel {
  #iconMap = {
    install: 'extension',
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
    this.document.getElementById('identity-icon-box').after(button);
    this.window.gUnifiedExtensions._button = this.anchor;

    this.document
      .getElementById('nav-bar')
      .setAttribute('addon-webext-overflowbutton', 'zen-site-data-icon-button');

    // Remove the old permissions dialog
    this.document.getElementById('unified-extensions-panel-template').remove();

    this.#initEventListeners();
  }

  #initEventListeners() {
    this.panel.addEventListener('popupshowing', this);
    this.document.getElementById('zen-site-data-manage-addons').addEventListener('click', this);
    this.document.getElementById('zen-site-data-settings-more').addEventListener('click', this);
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
      const isPageBookmarked = this.window.BookmarkingUI.star?.hasAttribute('starred');

      if (isPageBookmarked) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
    {
      const button = this.document.getElementById('zen-site-data-header-share');
      if (
        this.window.gBrowser.currentURI.schemeIs('http') ||
        this.window.gBrowser.currentURI.schemeIs('https')
      ) {
        button.removeAttribute('disabled');
      } else {
        button.setAttribute('disabled', 'true');
      }
    }
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
          if (id == '3rdPartyFrameStorage') {
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

    list.innerHTML = '';
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

      let item = this.#createPermissionItem(id, key, permission);
      if (item) {
        list.appendChild(item);
      }
    }

    section.hidden = list.childElementCount == 0;
  }

  #getPermissionStateLabelId(permission) {
    const { SitePermissions } = this.window;
    switch (permission.state) {
      // There should only be these types being displayed in the panel.
      case SitePermissions.ALLOW:
        return 'zen-site-data-setting-allow';
      case SitePermissions.BLOCK:
      case SitePermissions.AUTOPLAY_BLOCKED_ALL:
        return 'zen-site-data-setting-block';
      default:
        return null;
    }
  }

  #createPermissionItem(id, key, permission) {
    const { SitePermissions } = this.window;

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
    if (this.#iconMap[id]) {
      img.classList.add(`zen-permission-${this.#iconMap[id]}-icon`);
    }

    let labelContainer = this.document.createXULElement('vbox');
    labelContainer.setAttribute('flex', '1');
    labelContainer.setAttribute('align', 'start');
    labelContainer.classList.add('permission-popup-permission-label-container');
    labelContainer._permission = permission;
    labelContainer.addEventListener('click', this);

    let nameLabel = this.document.createXULElement('label');
    nameLabel.setAttribute('flex', '1');
    nameLabel.setAttribute('class', 'permission-popup-permission-label');
    let label = SitePermissions.getPermissionLabel(permission.id);
    if (label === null) {
      return null;
    }
    nameLabel.textContent = label;
    labelContainer.appendChild(nameLabel);

    let stateLabel = this.document.createXULElement('label');
    stateLabel.setAttribute('class', 'zen-permission-popup-permission-state-label');
    stateLabel.setAttribute('data-l10n-id', this.#getPermissionStateLabelId(permission));
    labelContainer.appendChild(stateLabel);

    container.appendChild(img);
    container.appendChild(labelContainer);

    return container;
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
        this.window.displaySecurityInfo();
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

    SitePermissions.setForPrincipal(gBrowser.contentPrincipal, permission.id, newState);

    label.parentNode.setAttribute('state', newState == SitePermissions.ALLOW ? 'allow' : 'block');
    label
      .querySelector('.zen-permission-popup-permission-state-label')
      .setAttribute('data-l10n-id', this.#getPermissionStateLabelId({ state: newState }));
    label._permission.state = newState;
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
      default: {
        const label = event.target.closest('.permission-popup-permission-label-container');
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
}
