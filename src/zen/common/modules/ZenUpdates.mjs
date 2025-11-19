// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import createSidebarNotification from 'chrome://browser/content/zen-components/ZenSidebarNotification.mjs';

const ZEN_UPDATE_PREF = 'zen.updates.last-version';
const ZEN_BUILD_ID_PREF = 'zen.updates.last-build-id';

async function animate(...args) {
  await gZenUIManager.motion.animate(...args);
}

export default function checkForZenUpdates() {
  const version = Services.appinfo.version;
  const lastVersion = Services.prefs.getStringPref(ZEN_UPDATE_PREF, version);
  Services.prefs.setStringPref(ZEN_UPDATE_PREF, version);

  if (version !== lastVersion && !gZenUIManager.testingEnabled) {
    createSidebarNotification({
      headingL10nId: 'zen-sidebar-notification-updated-heading',
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
      animate(
        '#zen-update-animation',
        {
          top: ['100%', '-50%'],
          opacity: [0.5, 1],
        },
        {
          duration: 0.35,
        }
      ),
      animate(
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
