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
// Each seed first makes a plain object describing the case, and only
// builds it after confirming it is unique.
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

const DEFAULT_NUM_CASES = 25;
const MAX_FOLDER_DEPTH = Services.prefs.getIntPref(
  "zen.folders.max-subfolders"
);
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
    parseInt(Services.env.get("ZEN_COPY_FUZZ_CASES"), 10) || DEFAULT_NUM_CASES;
  return { baseSeed, numCases };
}

requestLongerTimeout(5);

add_task(async function test_copy_selected_urls_fuzz() {
  // cleanup must leave the window as it found it
  const startTab = gBrowser.selectedTab;

  // get seed
  const { baseSeed, numCases } = readSettings();
  info(`Fuzzing ${numCases} cases from seed ${baseSeed}`);

  const seen = new Set();
  let seed = baseSeed;
  while (seen.size < numCases) {
    const root = createFuzzCase(seed);
    const key = JSON.stringify(root);
    if (seen.has(key)) {
      seed++;
      continue;
    }
    seen.add(key);

    const testCase = await FuzzCase.build(seed, root);
    await assertExpectedResult(testCase);
    await testCase.cleanup(startTab);

    seed++;
  }

  info(
    `Ran ${seen.size} unique cases, skipped ${seed - baseSeed - seen.size} ` +
      `seeds that repeated an earlier case`
  );
});

function createFuzzCase(seed) {
  const random = makeRandom(seed);
  const coinFlip = () => random.chance(0.5);
  const unshareableChance = random.float(0.0, 0.3);
  const tabs = [];
  const folders = [];

  const addTab = pinned => {
    const tab = {
      isFolder: false,
      items: [],
      url: null,
      shareable: !random.chance(unshareableChance),
      ...(pinned === undefined ? {} : { pinned }),
      selected: false,
      current: false,
    };
    tabs.push(tab);
    return tab;
  };

  const addFolder = depth => {
    const folder = { isFolder: true, items: [], url: null, collapsed: false };
    folders.push(folder);

    // randomly place tabs in folder
    while (coinFlip()) {
      folder.items.push(addTab());
    }

    // randomly place subfolders in folder up to MAX_FOLDER_DEPTH
    if (depth < MAX_FOLDER_DEPTH) {
      while (coinFlip()) {
        const index = random.int(0, folder.items.length);
        folder.items.splice(index, 0, addFolder(depth + 1));
      }
    }

    return folder;
  };

  // randomly generate loose tabs
  const loose = [];
  while (coinFlip()) {
    loose.push(addTab(random.chance(0.3)));
  }

  // randomly generate folders
  const topLevelFolders = [];
  while (coinFlip()) {
    topLevelFolders.push(addFolder(1));
  }

  // randomly collapse folders
  for (const folder of folders) {
    folder.collapsed = coinFlip();
  }

  // randomly select tabs
  if (tabs.length) {
    const current = random.pick(tabs);
    current.current = true;
    current.selected = true;
    for (const tab of tabs) {
      if (tab !== current) {
        tab.selected = coinFlip();
      }
    }
  }

  // the root holds the window's tabs and folders in sidebar order: pinned
  // tabs, then folders, then unpinned tabs.
  return {
    isFolder: true,
    items: [
      ...loose.filter(tab => tab.pinned),
      ...topLevelFolders,
      ...loose.filter(tab => !tab.pinned),
    ],
    url: null,
  };
}

async function assertExpectedResult(testCase) {
  info(`Testing seed ${testCase.seed}`);

  const expectations = COPY_METHODS.map(method => ({
    method,
    ...testCase.expectedResult(method),
  }));

  for (const { method, text, toast } of expectations) {
    const { commandId } = method;
    Assert.equal(await copiedText(commandId), text, `${commandId}`);
    Assert.ok(
      hasToast(toast),
      `${commandId} toast ${JSON.stringify(toast)}, ` +
        `shown ${JSON.stringify(shownToasts())}`
    );
  }
}

class FuzzCase {
  static async build(seed, root) {
    const testCase = new FuzzCase(seed, root);
    await testCase.buildTabsAndFolders();
    await testCase.selectTabs();
    await testCase.collapseFolders();
    return testCase;
  }

  constructor(seed, root) {
    this.seed = seed;
    this.root = root;
    this.builtTabCount = 0;
    this.current = null;
    this.selected = new Set();
  }

  /* Helpers */

  // every tab and folder under `node`, in sidebar order.
  *items(node = this.root) {
    for (const item of node.items) {
      yield item;
      yield* this.items(item);
    }
  }

  get tabs() {
    return [...this.items()].filter(item => !item.isFolder);
  }

  get folders() {
    return [...this.items()].filter(item => item.isFolder);
  }

  /* Test Case Building */

  async buildTabsAndFolders() {
    const unpinned = [];
    for (const item of this.root.items) {
      if (item.isFolder) {
        await this.buildFolder(item, 1);
      } else if (item.pinned) {
        await this.buildTab(item, true);
      } else {
        unpinned.push(item);
      }
    }

    // build unpinned tabs in reverse order
    for (const tab of unpinned.toReversed()) {
      await this.buildTab(tab);
    }
  }

  async buildTab(tab, pinned = false) {
    const url = tab.shareable
      ? `https://example.com/?fuzz=${this.seed}-${this.builtTabCount++}`
      : UNSHAREABLE_URL;
    tab.element = BrowserTestUtils.addTab(gBrowser, url, {
      skipAnimation: true,
      pinned,
    });
    if (tab.shareable) {
      await BrowserTestUtils.browserLoaded(
        tab.element.linkedBrowser,
        false,
        url
      );
    }
    tab.url = tab.shareable ? url : null;
  }

  async buildFolder(folder, depth, insertAfter = null) {
    const tabs = folder.items.filter(item => !item.isFolder);
    for (const tab of tabs) {
      await this.buildTab(tab, true);
    }
    folder.element = await gZenFolders.createFolder(
      tabs.map(tab => tab.element),
      { renameFolder: false, label: `fuzz-${depth}`, insertAfter }
    );

    let previous = folder.element.allItems.find(item =>
      item.hasAttribute("zen-empty-tab")
    );
    for (const item of folder.items) {
      if (item.isFolder) {
        await this.buildFolder(item, depth + 1, previous);
      }
      previous = item.element;
    }
  }

  async selectTabs() {
    this.current = this.tabs.find(tab => tab.current) ?? {
      element: gZenWorkspaces._emptyTab,
      url: null,
    };
    await selectTab(this.current.element);
    this.selected.add(this.current);

    for (const tab of this.tabs) {
      if (tab !== this.current && tab.selected) {
        gBrowser.addToMultiSelectedTabs(tab.element);
        this.selected.add(tab);
      }
    }
  }

  async collapseFolders() {
    const animationEnds = [];
    for (const folder of this.folders.toReversed()) {
      if (folder.collapsed) {
        animationEnds.push(
          BrowserTestUtils.waitForEvent(
            folder.element,
            "TabGroupAnimationComplete",
            false,
            event => event.target === folder.element
          )
        );
        folder.element.collapsed = true;
      }
    }

    await Promise.all(animationEnds);
  }

  /* Validation */

  expectedResult(method) {
    const shown = [...this.selected]
      .filter(tab => isShown(tab.element))
      .sort(
        (a, b) =>
          a.element.getBoundingClientRect().top -
          b.element.getBoundingClientRect().top
      );
    const shareable = shown.filter(tab => tab.url);

    if (shown.length < 2 || !shareable.length) {
      const url = this.current.url ?? UNSHAREABLE_URL;
      return {
        text: method.format(this.current.element.label, url),
        toast: { id: method.singleToastId },
      };
    }
    return {
      text: shareable
        .map(tab => method.format(tab.element.label, tab.url))
        .join("\n"),
      toast: { id: method.multiToastId, count: shareable.length },
    };
  }

  /* Cleanup */

  async cleanup(startTab) {
    // clear toasts
    document.getElementById("zen-toast-container").replaceChildren();

    // unselect tabs
    gBrowser.clearMultiSelectedTabs();

    // remove folders
    await selectTab(startTab);
    for (const { element: folder } of this.folders.toReversed()) {
      if (folder.isConnected) {
        const removeEvent = BrowserTestUtils.waitForEvent(
          folder,
          "TabGroupRemoved"
        );
        folder.delete();
        await removeEvent;
      }
    }

    // remove remaining loose tabs
    for (const item of this.root.items) {
      if (!item.isFolder) {
        BrowserTestUtils.removeTab(item.element);
      }
    }
  }
}

/*  Helpers */

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

function hasToast({ id, count }) {
  return shownToasts().some(
    toast =>
      toast.id === id && (count === undefined || toast.args?.count === count)
  );
}

function shownToasts() {
  return [
    ...document.querySelectorAll("#zen-toast-container .zen-toast label"),
  ].map(label => document.l10n.getAttributes(label));
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
