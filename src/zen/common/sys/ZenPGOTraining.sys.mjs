// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const TRAINING_URLS_ENV_VAR = "ZEN_PGO_UI_TRAINING_URLS";

const LOAD_TIMEOUT_MS = 15000;
const STARTUP_TIMEOUT_MS = 60000;

function log(message) {
  dump(`[ZenPGOTraining] ${message}\n`);
}

function withTimeout(window, promise, timeout, what) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${what} timed out after ${timeout}ms`)),
      timeout
    );
    promise.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

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
  boost: 10,
};

const WAIT_TIMEOUT_MS = 5000;
const STEP_BUDGET_MS = 60000;

const FOLDER_BUDGET_MS = 120000;

// Has to stay below UI_TRAINING_TIMEOUT in build/pgo/profileserver.py
const TOUR_BUDGET_MS = 720000;

const TAB_COUNT = 100;
const FOLDER_TAB_COUNT = 25;
const SPACE_TAB_COUNT = 25;

function accent(r, g, b, contrast) {
  return (((contrast >>> 0) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

const BOOST_ACCENTS = [
  accent(80, 120, 200, 200),
  accent(200, 90, 60, 180),
  accent(60, 180, 120, 220),
];

/**
 * Exercises Zen's own UI while the instrumented browser collects PGO data.
 */
export const ZenPGOTraining = {
  _window: null,
  _pages: null,
  _started: false,

  onWindowReady(window) {
    const pages = trainingPages();
    log(`window ready, ${pages.length} training pages`);
    if (!pages.length || this._window) {
      return;
    }
    this._window = window;
    this._pages = pages;
    this._takeOverOnQuit(window);
    log("waiting for the corpus to finish");
  },

  _takeOverOnQuit(window) {
    const canCloseWindow = window.CanCloseWindow;
    window.CanCloseWindow = () => {
      if (this._started) {
        // The tour is done and quitting for real.
        return canCloseWindow.call(window);
      }
      this._started = true;
      log("corpus asked to quit, taking over the browser");
      // Asked from inside the quit itself, so the tour starts once that has
      // been turned away rather than during it.
      window.setTimeout(() => this.run(window, this._pages), 0);
      return false;
    };
  },

  async run(window, pages) {
    try {
      await withTimeout(
        window,
        window.gZenStartup.promiseInitialized,
        STARTUP_TIMEOUT_MS,
        "startup"
      );
      const tour = new TrainingTour(window, pages);
      await tour.run();
    } catch (e) {
      log(`gave up: ${e}`);
    } finally {
      Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
    }
  },
};

class TrainingTour {
  #window;
  #pages;
  #results = [];
  #tabs = [];
  #createdSpaces = [];
  #folder = null;
  #deadline = Infinity;

  constructor(window, pages) {
    this.#window = window;
    this.#pages = pages;
  }

  get #document() {
    return this.#window.document;
  }

  async run() {
    log(`start: ${TAB_COUNT} tabs over ${this.#pages.length} pages`);
    this.#deadline = this.#now() + TOUR_BUDGET_MS;
    await this.#addTabs(TAB_COUNT);
    for (const step of this.#steps()) {
      await this.#runStep(step);
    }
    await this.#cleanup();
    log(`done: ${this.#results.join(", ")}`);
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
        budget: FOLDER_BUDGET_MS,
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
      {
        name: "boost",
        count: REPEATS.boost,
        before: () => this.#selectFirstTab(),
        after: () => this.#clearBoost(),
        step: i => this.#boost(i),
      },
    ];
  }

  async #runStep({ name, count, enabled, before, step, after, budget }) {
    if (enabled && !enabled()) {
      log(`${name}: skipped, feature is off`);
      this.#results.push(`${name} skipped`);
      return;
    }
    if (this.#now() > this.#deadline) {
      this.#results.push(`${name} out of time`);
      return;
    }
    const deadline = Math.min(
      this.#now() + (budget ?? STEP_BUDGET_MS),
      this.#deadline
    );
    let done = 0;
    try {
      await before?.();
      for (let i = 0; i < count; i++) {
        const remaining = deadline - this.#now();
        if (remaining <= 0) {
          break;
        }
        await withTimeout(
          this.#window,
          Promise.resolve(step(i)),
          remaining,
          name
        );
        done++;
      }
    } catch (e) {
      log(`${name}: stopped at ${done}: ${e}`);
    }
    try {
      await after?.();
    } catch (e) {
      log(`${name}: could not be restored: ${e}`);
    }
    if (done < count) {
      log(`${name}: only ran ${done}/${count}`);
    }
    this.#results.push(`${name} ${done}/${count}`);
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
    const library = this.#document.querySelector("zen-library");
    if (!library) {
      return;
    }
    const settled = open =>
      library.hasAttribute("open") === open &&
      !library.hasAttribute("transitioning");

    this.#command("cmd_zenToggleLibrary");
    await this.#until(() => settled(true));
    this.#command("cmd_zenToggleLibrary");
    await this.#until(() => settled(false));
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

  #topBrowsingContext() {
    return this.#window.gBrowser.selectedBrowser?.browsingContext?.top ?? null;
  }

  async #selectFirstTab() {
    const tab = this.#tabs.find(t => t.isConnected);
    if (tab) {
      this.#window.gBrowser.selectedTab = tab;
      await this.#settle(4);
    }
  }

  async #boost(i) {
    const bc = this.#topBrowsingContext();
    if (!bc) {
      return;
    }
    bc.zenBoostsData = BOOST_ACCENTS[i % BOOST_ACCENTS.length];
    bc.zenBoostsComplementaryRotation = (i * 37) % 360;
    bc.isZenBoostsInverted = i % 2 === 1;
    await this.#settle(6);
    this.#clearBoost();
    await this.#settle(6);
  }

  #clearBoost() {
    const bc = this.#topBrowsingContext();
    if (!bc) {
      return;
    }
    bc.zenBoostsData = 0;
    bc.zenBoostsComplementaryRotation = 0;
    bc.isZenBoostsInverted = false;
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
