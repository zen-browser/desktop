/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const CLEAR_SECONDS_PREF = "peppermint.vault.clipboard-clear-seconds";

const lazy = {};
ChromeUtils.defineLazyGetter(lazy, "helper", () =>
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper)
);
ChromeUtils.defineESModuleGetters(lazy, {
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
});

let pending = null;

function readText() {
  const trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  trans.init(null);
  trans.addDataFlavor("text/plain");
  try {
    Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
    const data = {};
    trans.getTransferData("text/plain", data);
    return data.value?.QueryInterface(Ci.nsISupportsString)?.data ?? null;
  } catch {
    return null;
  }
}

function cancelTimer() {
  if (pending?.timer) {
    lazy.clearTimeout(pending.timer);
  }
}

/**
 * Copies secrets so that clipboard history and cloud clipboards skip them, and
 * clears them again after a delay. The clear only happens when the clipboard
 * still holds exactly the copied text, so something the user copied afterwards
 * is never wiped.
 */
export const PeppermintVaultClipboard = {
  /**
   * @param {string} text
   * @param {object} [options]
   * @param {Function} [options.onCleared]  Called after the text was cleared.
   */
  copy(text, { onCleared = null } = {}) {
    cancelTimer();
    pending = null;

    lazy.helper.copyString(text, null, Ci.nsIClipboardHelper.Sensitive);

    const seconds = Services.prefs.getIntPref(CLEAR_SECONDS_PREF, 30);
    if (seconds <= 0) {
      return;
    }
    const entry = { text, onCleared, timer: null };
    entry.timer = lazy.setTimeout(() => {
      if (pending === entry) {
        this.clearPending();
      }
    }, seconds * 1000);
    pending = entry;
  },

  get hasPending() {
    return !!pending;
  },

  /**
   * Clears the clipboard if it still holds the last copied secret, and forgets
   * the secret. Safe to call at any time (lock, quit, timer).
   *
   * @returns {boolean} Whether the clipboard was cleared.
   */
  clearPending() {
    if (!pending) {
      return false;
    }
    const entry = pending;
    cancelTimer();
    pending = null;

    if (readText() !== entry.text) {
      return false;
    }
    Services.clipboard.emptyClipboard(Services.clipboard.kGlobalClipboard);
    entry.onCleared?.();
    return true;
  },
};
