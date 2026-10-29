/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Fuzz testing for copying the URLs of multiselected tabs. Each case builds a
// random tree of tabs, multiselects a random set, collapses random folders,
// and makes random tabs unshareable.
//
// Both copy methods (plain and markdown) must copy the shown, shareable
// selected tabs in sidebar order, and show the matching toast and count.
//
// Each run starts from a random seed so runs cover different cases. Every
// assertion names its case seed.
//
// To set the number of test cases:
// ZEN_COPY_FUZZ_CASES=<num_test_cases>
//
// To run with a specific seed:
// ZEN_COPY_FUZZ_SEED=<seed>
// ZEN_COPY_FUZZ_CASES=1

const DEFAULT_CASES = 25;
const MAX_FOLDER_DEPTH = Services.prefs.getIntPref("zen.folders.max-subfolders");
const UNSHAREABLE_URL = "about:blank";

const COPY_METHODS = [
  {
    commandId: "cmd_zenCopyCurrentURL",
    format: (_, url) => url,
    singleToastId: "zen-copy-current-url-confirmation",
    multiToastId: "zen-copy-multi-urls-confirmation",
  },
  {
    commandId: "cmd_zenCopyCurrentURLMarkdown",
    format: (label, url) => `[${label}](${url})`,
    singleToastId: "zen-copy-current-url-as-markdown-confirmation",
    multiToastId: "zen-copy-multi-urls-as-markdown-confirmation",
  },
];

function readSettings() {
  const envSeed = parseInt(Services.env.get("ZEN_COPY_FUZZ_SEED"), 10);
  const baseSeed = Number.isNaN(envSeed)
    ? Math.floor(Math.random() * 2 ** 31)
    : envSeed;
  const numCases =
    parseInt(Services.env.get("ZEN_COPY_FUZZ_CASES"), 10) || DEFAULT_CASES;
  return { baseSeed, numCases };
}

requestLongerTimeout(5);

add_task(async function test_copy_selected_urls_fuzz() {
  const { baseSeed, numCases } = readSettings();
  info(`Fuzzing ${numCases} cases from seed ${baseSeed}`);
  // Cleanup must leave the window as it found it, or later cases and later
  // tests run in a different window. Later tests expect the tab that was
  // selected before this one, and browser_drag_drop_vertical.js closes it.
  const tabCount = gBrowser.tabs.length;
  const startTab = gBrowser.selectedTab;

  for (let seed = baseSeed; seed < baseSeed + numCases; seed++) {
    info(`Building case with seed ${seed}`);
    const testCase = await FuzzCase.build(seed);
    await checkCopies(testCase);
    await testCase.cleanup(startTab);
    checkWindowRestored(startTab, tabCount, seed);
  }
});

function checkWindowRestored(startTab, tabCount, seed) {
  Assert.ok(
    startTab.isConnected,
    `The starting tab is still open after seed ${seed}`
  );
  Assert.equal(
    gBrowser.selectedTab,
    startTab,
    `The starting tab is selected again after seed ${seed}`
  );
  Assert.equal(
    gBrowser.tabs.length,
    tabCount,
    `Cleanup closes every tab of seed ${seed}`
  );
}

async function checkCopies(testCase) {
  const expectations = COPY_METHODS.map(method => ({
    method,
    ...testCase.expectedCopy(method),
  }));
  const context = `seed ${testCase.seed}:\n${testCase.describe()}`;
  info(context);

  for (const attempt of [1, 2]) {
    for (const { method, text, toast } of expectations) {
      const { commandId } = method;
      Assert.equal(
        await copiedText(commandId),
        text,
        `${commandId}, attempt ${attempt}, ${context}`
      );
      Assert.ok(
        await hasToast(toast),
        `${commandId} toast ${JSON.stringify(toast)}, attempt ${attempt}, ` +
        `shown ${JSON.stringify(shownToasts())}, ${context}`
      );
    }
  }
}

// One random arrangement of tabs and folders. Each entry is a tab and its
// URL, or a null URL when the tab can't be shared.
class FuzzCase {
  static async build(seed) {
    const testCase = new FuzzCase(seed);
    await testCase.addTabsAndFolders();
    await testCase.selectRandomTabs();
    await testCase.collapseRandomFolders();
    await testCase.waitForStableLayout();
    return testCase;
  }

  constructor(seed) {
    this.seed = seed;
    this.random = makeRandom(seed);
    this.unshareableChance = this.random.float(0.0, 0.3);
    this.entries = [];
    this.folders = [];
    this.current = null;
    this.selected = new Set();
  }

  /* Helpers */

  describe() {
    return this.entries
      .map(entry => {
        const rect = entry.tab.getBoundingClientRect();
        const depth = [];
        for (let group = entry.tab.group; group; group = group.group) {
          depth.push(group.collapsed ? "C" : "F");
        }
        const flags = [
          entry === this.current ? "current" : "",
          this.selected.has(entry) ? "selected" : "",
          entry.tab.pinned ? "pinned" : "",
        ].filter(Boolean);
        return [
          `  top=${Math.round(rect.top)}`,
          `h=${Math.round(rect.height)}`,
          `folders=${depth.join("") || "-"}`,
          flags.join(","),
          entry.url ?? UNSHAREABLE_URL,
        ].join(" ");
      })
      .join("\n");
  }

  async waitForStableLayout() {
    let previous = null;
    let stableFrames = 0;
    for (let i = 0; i < 300 && stableFrames < 5; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const layout = this.entries
        .map(({ tab }) => {
          const rect = tab.getBoundingClientRect();
          return `${rect.top},${rect.height}`;
        })
        .join(";");
      stableFrames = layout === previous ? stableFrames + 1 : 0;
      previous = layout;
    }
    Assert.equal(stableFrames, 5, `The tab layout settles, seed ${this.seed}`);
  }

  /* Test Case Building */

  coinFlip() {
    return this.random.chance(0.5);
  }

  async addTabsAndFolders() {
    // add loose tabs
    while (this.coinFlip()) {
      const entry = await this.addTab();
      if (this.random.chance(0.3)) {
        gBrowser.pinTab(entry.tab);
      }
    }

    // add folders
    while (this.coinFlip()) {
      await this.addFolder(1);
    }
  }

  async addTab() {
    const shareable = !this.random.chance(this.unshareableChance);
    const url = shareable
      ? `https://example.com/?fuzz=${this.seed}-${this.random.int(0, 1e9)}`
      : UNSHAREABLE_URL;
    const tab = BrowserTestUtils.addTab(gBrowser, url, { skipAnimation: true });
    if (shareable) {
      await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, url);
    }
    const entry = { tab, url: shareable ? url : null };
    this.entries.push(entry);
    return entry;
  }

  async addFolder(depth, parent = null) {
    const folderEntries = [];
    while (this.coinFlip()) {
      folderEntries.push(await this.addTab());
    }

    const folder = await gZenFolders.createFolder(
      folderEntries.map(entry => entry.tab),
      { renameFolder: false, label: `fuzz-${depth}`, ...(parent ? { insertAfter: this.random.pick(parent.allItems) } : {}) }
    );
    this.folders.push(folder);

    if (depth < MAX_FOLDER_DEPTH) {
      while (this.coinFlip()) {
        await this.addFolder(depth + 1, folder);
      }
    }
  }

  async selectRandomTabs() {
    // With no tabs of its own, the case runs in Zen's empty-tab state, where
    // the hidden empty tab is the active tab. It belongs to the window, so it
    // stays out of this.entries and cleanup leaves it alone.
    this.current = this.entries.length
      ? this.random.pick(this.entries)
      : { tab: gZenWorkspaces._emptyTab, url: null };
    await selectTab(this.current.tab);
    this.selected.add(this.current);
    for (const entry of this.entries) {
      if (entry !== this.current && this.coinFlip()) {
        gBrowser.addToMultiSelectedTabs(entry.tab);
        this.selected.add(entry);
      }
    }
  }

  async collapseRandomFolders() {
    for (const folder of this.folders.toReversed()) {
      if (this.coinFlip()) {
        const collapseEvent = BrowserTestUtils.waitForEvent(
          window,
          "TabGroupCollapse"
        );
        folder.collapsed = true;
        await collapseEvent;
      }
    }
  }

  /* Validation */

  expectedCopy(method) {
    const shown = [...this.selected]
      .filter(entry => isShown(entry.tab))
      .sort(
        (a, b) =>
          a.tab.getBoundingClientRect().top - b.tab.getBoundingClientRect().top
      );
    const shareable = shown.filter(entry => entry.url);

    if (shown.length < 2 || !shareable.length) {
      const url = this.current.url ?? UNSHAREABLE_URL;
      return {
        text: method.format(this.current.tab.label, url),
        toast: { id: method.singleToastId },
      };
    }
    return {
      text: shareable
        .map(entry => method.format(entry.tab.label, entry.url))
        .join("\n"),
      toast: { id: method.multiToastId, count: shareable.length },
    };
  }

  // Cleanup

  async cleanup(startTab) {
    // A toast that is still visible is reused with its old count, so start the
    // next case without one.
    document.getElementById("zen-toast-container").replaceChildren();
    gBrowser.clearMultiSelectedTabs();
    // Closing the selected tab can make Zen close the window, so close the
    // case tabs from the starting tab, which no case closes.
    await selectTab(startTab);
    for (const folder of this.folders.toReversed()) {
      if (folder.isConnected) {
        const removeEvent = BrowserTestUtils.waitForEvent(
          folder,
          "TabGroupRemoved"
        );
        folder.delete();
        await removeEvent;
      }
    }
    for (const { tab } of this.entries) {
      if (tab.isConnected) {
        BrowserTestUtils.removeTab(tab);
      }
    }
  }
}

// Helpers

function isShown(tab) {
  return tab.getBoundingClientRect().height > 0;
}

async function selectTab(tab) {
  if (gBrowser.selectedTab !== tab) {
    await BrowserTestUtils.switchTab(gBrowser, tab);
  }
}

function copiedText(commandId) {
  return SimpleTest.promiseClipboardChange(
    data => !data.startsWith("waitForClipboard-known-value-"),
    () => document.getElementById(commandId).doCommand()
  );
}

function shownToasts() {
  return [
    ...document.querySelectorAll("#zen-toast-container .zen-toast label"),
  ].map(label => document.l10n.getAttributes(label));
}

async function hasToast({ id, count }) {
  try {
    await TestUtils.waitForCondition(
      () =>
        shownToasts().some(
          toast =>
            toast.id === id &&
            (count === undefined || toast.args?.count === count)
        ),
      "",
      50,
      20
    );
    return true;
  } catch (e) {
    return false;
  }
}

// Random seeds

function makeRandom(seed) {
  const next = mulberry32(seed);
  const random = {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    chance: probability => next() < probability,
    pick: items => items[random.int(0, items.length - 1)],
  };
  return random;
}

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
