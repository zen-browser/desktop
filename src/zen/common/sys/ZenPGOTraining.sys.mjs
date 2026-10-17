// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenLibrary: "moz-src:///zen/library/ZenLibrary.mjs",
});

// Set by build/pgo/profileserver.py for the run that exists only to collect
// this tour's data.
const TRAINING_ENV_VAR = "ZEN_PGO_UI_TRAINING";
const TRAINING_URLS_ENV_VAR = "ZEN_PGO_UI_TRAINING_URLS";

const LOAD_TIMEOUT_MS = 15000;

function trainingPages() {
  return Services.env
    .get(TRAINING_URLS_ENV_VAR)
    .split(",")
    .map(url => url.trim())
    .filter(url => url);
}

/**
 * How many times each action runs.
 *
 * PGO weighs a branch by how often it is taken, so the number that matters is
 * how many times an action *completes*.
 */
const REPEATS = {
  tabSwitch: 200,
  compactMode: 50,
  sidebarHover: 50,
  glance: 50,
  library: 50,
  spaceSwitch: 50,
  urlbar: 50,
  splitView: 20,
  folder: 30,
};

const WAIT_TIMEOUT_MS = 5000;
const STEP_BUDGET_MS = 60000;

const TAB_COUNT = 100;
const FOLDER_TAB_COUNT = 25;
const SPACE_TAB_COUNT = 25;

/**
 * Exercises Zen's own UI while the instrumented browser collects PGO data.
 */
export const ZenPGOTraining = {
  _started: false,

  onWindowReady(window) {
    if (this._started || !Services.env.exists(TRAINING_ENV_VAR)) {
      return;
    }
    this._started = true;
    this.run(window).catch(e => console.error("[ZenPGOTraining]", e));
  },

  async run(window) {
    try {
      const pages = trainingPages();
      await window.gZenStartup.promiseInitialized;
      const tour = new TrainingTour(window, pages);
      await tour.run();
    } finally {
      Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
    }
  },
};

class TrainingTour {
  #window;
  #pages;
  #tabs = [];
  #createdSpaces = [];
  #folder = null;

  constructor(window, pages) {
    this.#window = window;
    this.#pages = pages;
  }

  get #document() {
    return this.#window.document;
  }

  async run() {
    await this.#addTabs(TAB_COUNT);
    for (const step of this.#steps()) {
      await this.#runStep(step);
    }
    await this.#cleanup();
  }

  #steps() {
    const win = this.#window;
    return [
      {
        name: "tabSwitch",
        count: REPEATS.tabSwitch,
        step: async i => {
          win.gBrowser.selectedTab = this.#tabs[i % this.#tabs.length];
          await this.#settle();
        },
      },
      {
        name: "compactMode",
        count: REPEATS.compactMode,
        step: () => this.#toggleCompactMode(),
      },
      {
        name: "sidebarHover",
        count: REPEATS.sidebarHover,
        before: () => this.#enterCompactMode(),
        after: () => this.#leaveCompactMode(),
        step: async () => {
          const compact = win.gZenCompactModeManager;
          compact._setElementExpandAttribute(compact.sidebar, true);
          await this.#settle(3);
          compact._setElementExpandAttribute(compact.sidebar, false);
          await this.#settle(3);
        },
      },
      {
        name: "glance",
        count: REPEATS.glance,
        enabled: () => Services.prefs.getBoolPref("zen.glance.enabled", false),
        step: () => this.#glance(),
      },
      {
        name: "library",
        count: REPEATS.library,
        enabled: () => Services.prefs.getBoolPref("zen.library.enabled", false),
        step: () => this.#library(),
      },
      {
        name: "spaceSwitch",
        count: REPEATS.spaceSwitch,
        enabled: () => win.gZenWorkspaces.workspaceEnabled,
        before: () => this.#ensureTwoSpaces(),
        after: () => this.#removeCreatedSpaces(),
        step: i => this.#switchSpace(i % 2 ? -1 : 1),
      },
      {
        name: "urlbar",
        count: REPEATS.urlbar,
        step: async () => {
          win.gZenUIManager.handleNewTab(false, false, "tab", true);
          await this.#settle(6);
          win.gURLBar._zenHandleUrlbarClose?.(false, false);
          await this.#settle(6);
        },
      },
      {
        name: "splitView",
        count: REPEATS.splitView,
        step: () => this.#splitView(),
      },
      {
        name: "folder",
        count: REPEATS.folder,
        before: () => this.#createFolder(),
        after: () => this.#removeFolder(),
        step: async () => {
          if (!this.#folder?.isConnected) {
            return;
          }
          this.#folder.collapsed = true;
          await this.#settle(4);
          this.#folder.collapsed = false;
          await this.#settle(4);
        },
      },
    ];
  }

  async #runStep({ name, count, enabled, before, step, after }) {
    if (enabled && !enabled()) {
      console.warn(`[ZenPGOTraining] ${name}: skipped, feature is off`);
      return;
    }
    const deadline = this.#now() + STEP_BUDGET_MS;
    let done = 0;
    try {
      await before?.();
      for (let i = 0; i < count; i++) {
        if (this.#now() > deadline) {
          break;
        }
        await step(i);
        done++;
      }
    } catch (e) {
      console.warn(`[ZenPGOTraining] ${name}: stopped at ${done}`, e);
    }
    try {
      await after?.();
    } catch (e) {
      console.warn(`[ZenPGOTraining] ${name}: could not be restored`, e);
    }
    if (done < count) {
      console.warn(`[ZenPGOTraining] ${name}: only ran ${done}/${count}`);
    }
  }

  // Section: waiting

  #now() {
    return this.#window.performance.now();
  }

  /**
   * Waits for one paint. Races a timer so an occluded window, where
   * requestAnimationFrame can stop firing, cannot stall the tour.
   *
   * @returns {Promise<void>}
   */
  #frame() {
    const win = this.#window;
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      win.requestAnimationFrame(finish);
      win.setTimeout(finish, 100);
    });
  }

  async #settle(frames = 2) {
    for (let i = 0; i < frames; i++) {
      await this.#frame();
    }
  }

  async #until(predicate, timeout = WAIT_TIMEOUT_MS) {
    const deadline = this.#now() + timeout;
    while (!predicate()) {
      if (this.#now() > deadline) {
        return false;
      }
      await this.#frame();
    }
    return true;
  }

  #event(type, timeout = WAIT_TIMEOUT_MS) {
    const win = this.#window;
    return new Promise(resolve => {
      let timer = 0;
      const finish = arrived => {
        win.removeEventListener(type, onEvent);
        win.clearTimeout(timer);
        resolve(arrived);
      };
      const onEvent = () => finish(true);
      win.addEventListener(type, onEvent);
      timer = win.setTimeout(() => finish(false), timeout);
    });
  }

  #command(id) {
    this.#document.getElementById(id)?.doCommand();
  }

  // Section: actions

  async #addTabs(count) {
    const gBrowser = this.#window.gBrowser;
    const added = [];
    for (let i = 0; i < count; i++) {
      const tab = gBrowser.addTrustedTab(this.#page(i));
      added.push(tab);
      this.#tabs.push(tab);
    }
    await this.#until(
      () => added.every(tab => !tab.hasAttribute("busy")),
      LOAD_TIMEOUT_MS
    );
    await this.#settle(2);
  }

  #page(i) {
    return this.#pages[i % this.#pages.length];
  }

  async #toggleCompactMode() {
    const toggled = this.#event("ZenCompactMode:Toggled");
    this.#window.gZenCompactModeManager.toggle();
    await toggled;
  }

  async #enterCompactMode() {
    if (!this.#window.gZenCompactModeManager.preference) {
      await this.#toggleCompactMode();
    }
  }

  async #leaveCompactMode() {
    if (this.#window.gZenCompactModeManager.preference) {
      await this.#toggleCompactMode();
    }
  }

  async #glance() {
    const win = this.#window;
    const manager = win.gZenGlanceManager;
    const tab = await manager.openGlance({
      url: this.#page(1),
      clientX: win.innerWidth / 2,
      clientY: win.innerHeight / 2,
      width: 0,
      height: 0,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    if (!tab) {
      return;
    }
    await this.#settle(3);
    manager.closeGlance({ onTabClose: true });
    await this.#until(() => !manager._animating && !manager.closingGlance);
  }

  async #library() {
    this.#command("cmd_zenToggleLibrary");
    await this.#until(() => lazy.ZenLibrary.isLibraryOpen);
    this.#command("cmd_zenToggleLibrary");
    await this.#until(() => !lazy.ZenLibrary.isLibrarySlightlyOpen);
  }

  async #ensureTwoSpaces() {
    const ws = this.#window.gZenWorkspaces;
    while (ws.getWorkspaces().length < 2) {
      const created = await ws.createAndSaveWorkspace("PGO training");
      if (!created?.uuid) {
        break;
      }
      this.#createdSpaces.push(created.uuid);
      await this.#until(() => !ws.isChangingWorkspace);
      await this.#addTabs(SPACE_TAB_COUNT);
    }
  }

  async #removeCreatedSpaces() {
    const ws = this.#window.gZenWorkspaces;
    for (const uuid of this.#createdSpaces) {
      await ws.removeWorkspace(uuid);
      await this.#until(() => !ws.isChangingWorkspace);
    }
    this.#createdSpaces = [];
  }

  async #switchSpace(offset) {
    const ws = this.#window.gZenWorkspaces;
    await ws.changeWorkspaceShortcut(offset);
    await this.#until(() => !ws.isChangingWorkspace);
  }

  async #splitView() {
    const win = this.#window;
    const [a, b] = this.#tabs;
    if (!a || !b) {
      return;
    }
    win.gZenViewSplitter.splitTabs([a, b], "vsep");
    await this.#settle(6);
    for (const type of ["hsep", "grid"]) {
      win.gZenViewSplitter.toggleShortcut(type);
      await this.#settle(4);
    }
    win.gZenViewSplitter.unsplitCurrentView();
    await this.#settle(6);
  }

  async #createFolder() {
    const tabs = this.#tabs.slice(0, FOLDER_TAB_COUNT);
    if (tabs.length < 2) {
      return;
    }
    this.#folder = this.#window.gZenFolders.createFolder(tabs, {});
    await this.#settle(6);
  }

  async #removeFolder() {
    const win = this.#window;
    if (this.#folder?.isConnected) {
      this.#folder.delete();
      await this.#settle(4);
    }
    this.#folder = null;
    for (const tab of this.#tabs) {
      if (tab.isConnected && tab.pinned) {
        win.gBrowser.unpinTab(tab);
      }
    }
    await this.#settle(2);
  }

  async #cleanup() {
    const win = this.#window;
    await this.#leaveCompactMode();
    for (const tab of this.#tabs) {
      if (tab.isConnected) {
        if (tab.pinned) {
          win.gBrowser.unpinTab(tab);
        }
        win.gBrowser.removeTab(tab);
      }
    }
    this.#tabs = [];
    await this.#settle(2);
  }
}
