// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import createSidebarNotification from 'chrome://browser/content/zen-components/ZenSidebarNotification.mjs';

const ZEN_UPDATE_PREF = 'zen.updates.last-version';
const ZEN_BUILD_ID_PREF = 'zen.updates.last-build-id';
const ZEN_UPDATE_SHOW = 'zen.updates.show-update-notification';

export default function checkForZenUpdates() {
  const version = Services.appinfo.version;
  const lastVersion = Services.prefs.getStringPref(ZEN_UPDATE_PREF, '');
  Services.prefs.setStringPref(ZEN_UPDATE_PREF, version);
  if (
    version !== lastVersion &&
    !gZenUIManager.testingEnabled &&
    Services.prefs.getBoolPref(ZEN_UPDATE_SHOW, true)
  ) {
    const updateUrl = Services.prefs.getStringPref('app.releaseNotesURL.prompt', '');
    createSidebarNotification({
      headingL10nId: 'zen-sidebar-notification-updated-heading',
      links: [
        {
          url: Services.urlFormatter.formatURL(updateUrl.replace('%VERSION%', version)),
          l10nId: 'zen-sidebar-notification-updated',
          special: true,
          icon: 'chrome://browser/skin/zen-icons/heart-circle-fill.svg',
        },
        {
          action: () => {
            Services.obs.notifyObservers(window, 'restart-in-safe-mode');
          },
          l10nId: 'zen-sidebar-notification-restart-safe-mode',
          icon: 'chrome://browser/skin/zen-icons/security-broken.svg',
        },
      ],
    });
  }
}

export async function createWindowUpdateAnimation() {
  const appID = Services.appinfo.appBuildID;
  if (
    Services.prefs.getStringPref(ZEN_BUILD_ID_PREF, '') === appID ||
    gZenUIManager.testingEnabled
  ) {
    return;
  }
  Services.prefs.setStringPref(ZEN_BUILD_ID_PREF, appID);
  await gZenWorkspaces.promiseInitialized;
  const appWrapper = document.getElementById('zen-main-app-wrapper');
  const element = document.createElement('div');
  element.id = 'zen-update-animation';
  const elementBorder = document.createElement('div');
  elementBorder.id = 'zen-update-animation-border';
  requestIdleCallback(() => {
    if (gReduceMotion) {
      return;
    }
    appWrapper.appendChild(element);
    appWrapper.appendChild(elementBorder);
    Promise.all([
      gZenUIManager.motion.animate(
        '#zen-update-animation',
        {
          top: ['100%', '-50%'],
          opacity: [0.5, 1],
        },
        {
          duration: 0.35,
        }
      ),
      gZenUIManager.motion.animate(
        '#zen-update-animation-border',
        {
          '--background-top': ['150%', '-50%'],
        },
        {
          duration: 0.35,
          delay: 0.08,
        }
      ),
    ]).then(() => {
      element.remove();
      elementBorder.remove();
    });
  });
}
