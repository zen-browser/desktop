/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { setTimeout } from "resource://gre/modules/Timer.sys.mjs";

import { parseNoteURL } from "resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs";
import {
  lockNotes,
  pendingSaveCount,
  waitForPendingSaves,
} from "resource:///modules/zen/notepad/ZenNotepadStore.sys.mjs";

const PREF = "zen.notepad.auto-lock-minutes";
const SAVE_CAP_MS = 2000;
const SAVE_QUIET_MS = 400;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isNoteTab(tab) {
  let spec = "";
  try {
    spec = tab.linkedBrowser?.currentURI?.spec || "";
  } catch {
    return false;
  }
  return !!parseNoteURL(spec);
}

function leaveNote(browser) {
  const uri = Services.io.newURI("about:blank");
  browser.loadURI(uri, {
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
}

async function closeNoteTab(win, tab) {
  if (tab.closing || !isNoteTab(tab)) {
    return;
  }
  const browser = tab.linkedBrowser;
  const selected = tab === win.gBrowser.selectedTab;
  if (!selected && tab.linkedPanel && !tab.hasAttribute("pending")) {
    try {
      await win.gBrowser.prepareDiscardBrowser(tab);
      if (
        !tab.closing &&
        tab.linkedPanel &&
        win.gBrowser.discardBrowser(tab, true)
      ) {
        return;
      }
    } catch (error) {
      console.error("ZenNotepadLock could not unload note", error);
    }
  }
  if (!tab.closing && isNoteTab(tab)) {
    leaveNote(browser);
  }
}

/**
 * Lets a pagehide flush land in saveNote before the key is dropped.
 */
async function waitForSaves() {
  const deadline = Date.now() + SAVE_CAP_MS;
  let quietAt = Date.now();
  while (Date.now() < deadline) {
    if (pendingSaveCount()) {
      quietAt = Date.now();
      await Promise.race([waitForPendingSaves(), wait(deadline - Date.now())]);
      continue;
    }
    if (Date.now() - quietAt >= SAVE_QUIET_MS) {
      return;
    }
    await wait(Math.min(20, deadline - Date.now()));
  }
}

class ZenNotepadLockImpl {
  #started = false;
  #idleSeconds = 0;
  #watchingSleep = false;
  #locking = null;

  /**
   * Begin watching idle and sleep. Called the first time a key is unwrapped,
   * so a session that never opens a note pays nothing.
   */
  start() {
    if (this.#started) {
      return;
    }
    this.#started = true;
    Services.prefs.addObserver(PREF, this);
    this.#arm();
  }

  observe(subject, topic) {
    if (topic === "nsPref:changed") {
      this.#arm();
      return;
    }
    if (Services.prefs.getIntPref(PREF, 10) <= 0) {
      return;
    }
    if (topic === "idle" || topic === "sleep_notification") {
      this.lockOpenNotes();
    }
  }

  #arm() {
    this.#disarm();
    const minutes = Services.prefs.getIntPref(PREF, 10);
    if (minutes <= 0) {
      return;
    }
    Services.obs.addObserver(this, "sleep_notification");
    this.#watchingSleep = true;
    this.#idleSeconds = minutes * 60;
    Services.idle.addIdleObserver(this, this.#idleSeconds);
  }

  #disarm() {
    if (this.#idleSeconds) {
      try {
        Services.idle.removeIdleObserver(this, this.#idleSeconds);
      } catch (error) {
        console.error("ZenNotepadLock could not remove idle observer", error);
      }
      this.#idleSeconds = 0;
    }
    if (this.#watchingSleep) {
      Services.obs.removeObserver(this, "sleep_notification");
      this.#watchingSleep = false;
    }
  }

  /**
   * Close every open note, wait for its last save, then drop the key.
   *
   * @returns {Promise<void>}
   */
  lockOpenNotes() {
    if (this.#locking) {
      return this.#locking;
    }
    this.#locking = this.#lockOpenNotes().finally(() => {
      this.#locking = null;
    });
    return this.#locking;
  }

  async #lockOpenNotes() {
    const open = [];
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win.closed || !win.gBrowser) {
        continue;
      }
      for (const tab of win.gBrowser.tabs) {
        if (isNoteTab(tab)) {
          open.push({ win, tab });
        }
      }
    }
    await Promise.allSettled(open.map(({ win, tab }) => closeNoteTab(win, tab)));
    if (open.length) {
      await waitForSaves();
    }
    lockNotes();
  }
}

export const ZenNotepadLock = new ZenNotepadLockImpl();
