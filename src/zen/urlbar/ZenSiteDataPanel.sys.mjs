/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsZenSiteDataPanel {
  constructor(window) {
    this.window = window;
    this.document = window.document;

    this.panel = this.document.getElementById('zen-unified-site-data-panel');
    this.#init();
  }

  #init() {
    // Add a new button to the urlbar popup
    const button = this.window.MozXULElement.parseXULToFragment(`
      <box id="zen-site-data-icon" role="button" align="center" class="identity-box-button">
        <image id="zen-site-data-icon"/>
      </box>
    `);
    this.document.getElementById('identity-icon-box').after(button);
    button.addEventListener('command', this);

    // Remove the old permissions dialog
    this.document.getElementById('unified-extensions-panel-template').remove();
  }

  show() {
    this.#preparePanel();
  }

  #preparePanel() {
    this.#setSitePermissions();
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
      if (geoPermission) {
        geoPermission.sharingState = true;
      } else {
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
      if (xrPermission) {
        xrPermission.sharingState = true;
      } else {
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
            permission.sharingState = webrtcState[id];
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
    let totalBlockedPopups = gBrowser.selectedBrowser.popupBlocker.getBlockedPopupCount();
    for (let permission of permissions) {
      let [id, key] = permission.id.split(SitePermissions.PERM_KEY_DELIMITER);

      if (id == 'storage-access') {
        // Ignore storage access permissions here, they are made visible inside
        // the Content Blocking UI.
        continue;
      }

      let item = this.#createPermissionItem(id, key, permission);
      if (item) {
        list.appendChild(item);
      }
    }

    section.hidden = list.childElementCount == 0;
  }

  #createPermissionItem(id, key, permission) {}

  handleEvent(event) {
    const type = event.type;
    switch (type) {
      case 'command':
        this.show();
        break;
    }
  }
}
