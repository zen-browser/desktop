// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  webrtcUI: "resource:///modules/webrtcUI.sys.mjs",
});

// Browser ids that active tab captures were started with, mapped to the
// browser id each capture currently draws from.
const targets = new Map();

export const ZenTabCapture = {
  update() {
    const captured = new Set();
    for (const { state } of lazy.webrtcUI._streams) {
      for (const { mediaSource, rawId } of state.devices) {
        if (mediaSource == "browser") {
          captured.add(Number(rawId));
        }
      }
    }

    for (const id of targets.keys()) {
      if (!captured.has(id)) {
        targets.delete(id);
        // eslint-disable-next-line mozilla/valid-services
        Services.zen.setTabCaptureTarget(id, id);
      }
    }
    for (const id of captured) {
      if (!targets.has(id)) {
        targets.set(id, id);
      }
    }

    const shownIds = new Set(targets.values());
    for (const win of lazy.BrowserWindowTracker.orderedWindows) {
      win.document.documentElement.toggleAttribute(
        "zen-tab-capture-active",
        shownIds.size > 0
      );
      for (const tab of win.gBrowser?.tabs ?? []) {
        const isCaptured = shownIds.has(tab.linkedBrowser?.browserId);
        if (tab.hasAttribute("zen-tab-captured") == isCaptured) {
          continue;
        }
        tab.toggleAttribute("zen-tab-captured", isCaptured);
        win.document.l10n.setAttributes(
          tab.querySelector(".zen-tab-share-button"),
          isCaptured ? "zen-tab-sharing-indicator" : "zen-tab-share-button"
        );
      }
    }
  },

  shareTab(tab) {
    const browserId = tab.linkedBrowser?.browserId;
    if (!browserId) {
      return;
    }
    for (const id of targets.keys()) {
      targets.set(id, browserId);
      // eslint-disable-next-line mozilla/valid-services
      Services.zen.setTabCaptureTarget(id, browserId);
    }
    this.update();
  },
};
