/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  clearInterval: "resource://gre/modules/Timer.sys.mjs",
  setInterval: "resource://gre/modules/Timer.sys.mjs",
});

const TIMEOUT_PREF = "zen.tabs.auto-archive.timeout-minutes";

// Tabs are archived after hours or days, so looking every few minutes is
// precise enough without waking the browser up all the time.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const MS_PER_MINUTE = 60 * 1000;

// A tab with any of these is in use even though nobody is looking at it, or
// is one Zen keeps around on its own.
const KEEP_ATTRIBUTES = [
  "selected",
  "multiselected",
  "soundplaying",
  "pictureinpicture",
  "attention",
  "glance-id",
  "zen-empty-tab",
  "zen-essential",
];

/**
 * Archives the unpinned tabs nobody has opened for a while, the way Arc does.
 * Archiving a tab closes it, which keeps it among the closed tabs that the
 * Library shows as its Archive, where it can be reopened.
 *
 * Every window is looked at in one go, as window sync keeps a copy of each tab
 * in every window and closing one copy closes them all: a tab is only archived
 * once none of its copies is in use or has been opened lately.
 */
class nsZenTabArchiver {
  #initialized = false;
  #timer = null;

  /**
   * When each tab, by id, was last seen opened or kept from the archive in any
   * window. Remembering it keeps a tab from passing for idle when it was used
   * in a window that has since closed, or has only just been unpinned.
   *
   * @type {Map<string, number>}
   */
  #lastAccessedById = new Map();

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    Services.prefs.addObserver(TIMEOUT_PREF, this);
    this.#updateTimer();
  }

  uninit() {
    if (!this.#initialized) {
      return;
    }
    this.#initialized = false;
    Services.prefs.removeObserver(TIMEOUT_PREF, this);
    this.#stopTimer();
    this.#lastAccessedById.clear();
  }

  observe(_subject, topic, data) {
    if (topic == "nsPref:changed" && data == TIMEOUT_PREF) {
      this.#updateTimer();
    }
  }

  /**
   * @returns {number} How many minutes a tab can go unopened before it is
   *   archived, or 0 when tabs are never archived.
   */
  get timeoutMinutes() {
    return Math.max(0, Services.prefs.getIntPref(TIMEOUT_PREF, 0));
  }

  #updateTimer() {
    this.#stopTimer();
    if (!this.timeoutMinutes) {
      this.#lastAccessedById.clear();
      return;
    }
    this.#timer = lazy.setInterval(() => {
      try {
        this.sweep();
      } catch (e) {
        console.error("ZenTabArchiver: Failed to archive idle tabs", e);
      }
    }, CHECK_INTERVAL_MS);
  }

  #stopTimer() {
    if (this.#timer) {
      lazy.clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /**
   * The windows whose tabs can be archived. Private windows are left out, as
   * the tabs they close are forgotten along with them, and so are popups and
   * unsynced windows, whose tabs live outside Zen's synced spaces.
   *
   * @returns {Window[]|null} Those windows, or null while one of them is still
   *   starting up, closing or switching spaces. Its tabs are in flux then, and
   *   leaving it out could let window sync carry an archived tab's closing into
   *   a copy that is in use there.
   */
  #windowsToSweep() {
    const windows = [];
    for (const win of lazy.BrowserWindowTracker.orderedWindows) {
      if (win.closed || win.gZenWorkspaces?.privateWindowOrDisabled !== false) {
        continue;
      }
      if (
        !win.gZenStartup?.isReady ||
        win._zenClosingWindow ||
        win.gZenWorkspaces.isChangingWorkspace
      ) {
        return null;
      }
      windows.push(win);
    }
    return windows;
  }

  /**
   * Whether a tab may be archived, leaving aside how long it has been idle:
   * only unpinned tabs that are not in use are.
   *
   * @param {MozTabbrowserTab} tab - The tab to look at
   * @returns {boolean} Whether it may go to the archive
   */
  #canArchive(tab) {
    if (
      tab.closing ||
      tab.pinned ||
      // Folders, split views and tab groups are all groups.
      tab.group ||
      tab.splitView ||
      KEEP_ATTRIBUTES.some(attribute => tab.hasAttribute(attribute))
    ) {
      return false;
    }
    const browser = tab.linkedBrowser;
    const browsingContext = browser?.browsingContext;
    if (!browsingContext) {
      // The tab isn't loaded, so nothing can be going on in it.
      return true;
    }
    // A page that would ask whether to leave it can't be closed with nobody
    // there to answer, and one sharing the camera, microphone or screen is in
    // use.
    return !(
      browser.hasBeforeUnload ||
      tab.documentGlobal.webrtcUI?.browserHasStreams(browser) ||
      browsingContext.currentWindowGlobal?.hasActivePeerConnections()
    );
  }

  /**
   * Archives the tabs that have gone unopened for longer than the timeout.
   *
   * @returns {MozTabbrowserTab[]} The tabs it archived, one copy of each
   */
  sweep() {
    const timeoutMinutes = this.timeoutMinutes;
    if (!timeoutMinutes || Services.startup.shuttingDown) {
      return [];
    }
    const windows = this.#windowsToSweep();
    if (!windows) {
      return [];
    }
    const now = Date.now();
    const cutoff = now - timeoutMinutes * MS_PER_MINUTE;

    // Window sync gives every copy of a tab the same id.
    const copiesById = new Map();
    for (const win of windows) {
      for (const tab of win.gZenWorkspaces.allStoredTabs) {
        const id = tab.id || tab;
        const copies = copiesById.get(id);
        if (copies) {
          copies.push(tab);
        } else {
          copiesById.set(id, [tab]);
        }
      }
    }
    for (const id of this.#lastAccessedById.keys()) {
      if (!copiesById.has(id)) {
        this.#lastAccessedById.delete(id);
      }
    }

    const archived = [];
    const tabsByWindow = new Map();
    for (const [id, copies] of copiesById) {
      // A tab kept from the archive, by being pinned or in use, counts as just
      // opened. That way one that is unpinned or stops playing after a long
      // time gets the whole timeout again rather than going at once.
      const kept = !copies.every(tab => this.#canArchive(tab));
      let lastAccessed = kept
        ? now
        : Math.max(...copies.map(tab => tab.lastAccessed));
      if (typeof id == "string") {
        lastAccessed = Math.max(
          lastAccessed,
          this.#lastAccessedById.get(id) ?? 0
        );
        this.#lastAccessedById.set(id, lastAccessed);
      }
      if (kept || lastAccessed > cutoff) {
        continue;
      }
      archived.push(copies[0]);
      for (const tab of copies) {
        const win = tab.documentGlobal;
        if (tabsByWindow.has(win)) {
          tabsByWindow.get(win).push(tab);
        } else {
          tabsByWindow.set(win, [tab]);
        }
      }
    }

    // Every copy is closed from here rather than left to window sync, which
    // drops a window's tab events while it is busy with another window's. It
    // can still close some copies while one window's tabs are being closed,
    // so the ones already gone by their window's turn are skipped.
    for (const [win, tabs] of tabsByWindow) {
      const open = tabs.filter(tab => tab.isConnected && !tab.closing);
      if (open.length) {
        win.gBrowser.removeTabs(open, {
          animate: false,
          closeWindowWithLastTab: false,
        });
      }
    }
    return archived;
  }
}

export const ZenTabArchiver = new nsZenTabArchiver();
