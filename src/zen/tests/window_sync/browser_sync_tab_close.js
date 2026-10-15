/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_URLS = ["https://example.com/", "https://example.org/"];

requestLongerTimeout(5);

// Small deterministic PRNG so failures can be reproduced from the logged seed.
function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function findTab(win, id) {
  return gZenWindowSync.getItemFromWindow(win, id);
}

const gPreexistingIds = new Set();

function snapshotPreexistingTabs(wins) {
  gPreexistingIds.clear();
  for (const w of wins) {
    for (const t of w.gBrowser.tabs) {
      gPreexistingIds.add(t.id);
    }
  }
}

function syncableTabIds(win) {
  return win.gBrowser.tabs
    .filter(t => !t.hasAttribute("zen-empty-tab"))
    .map(t => t.id)
    .filter(id => !gPreexistingIds.has(id))
    .sort();
}

async function waitForTabGoneEverywhere(id, wins, message) {
  try {
    await TestUtils.waitForCondition(
      () => wins.every(w => !findTab(w, id)),
      message,
      100,
      100
    );
  } catch (e) {}
}

async function waitForNoClosingTabs(wins) {
  try {
    await TestUtils.waitForCondition(
      () =>
        wins.every(
          w =>
            !w.gBrowser.tabs.some(t => t.closing) &&
            !w.gBrowser._removingTabs.size
        ),
      "No tabs should be closing",
      100,
      100
    );
  } catch (e) {}
}

function assertNoOrphans(wins, label) {
  for (const [i, w] of wins.entries()) {
    const closing = w.gBrowser.tabs.filter(t => t.closing);
    Assert.deepEqual(
      closing.map(t => t.id),
      [],
      `${label}: window ${i} should have no tabs stuck in closing state`
    );
    Assert.equal(
      w.gBrowser._removingTabs.size,
      0,
      `${label}: window ${i} should have no tabs in _removingTabs`
    );
  }
}

async function openSyncedTab(win, url = TEST_URLS[0]) {
  const tab = BrowserTestUtils.addTab(win.gBrowser, url, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, url);
  const other = BrowserWindowTracker.orderedWindows.find(
    w => w !== win.window && w.gZenWorkspaces
  );
  if (other) {
    await TestUtils.waitForCondition(
      () => tab.id && findTab(other, tab.id),
      `Tab should be synced to the other window (${tab.id})`,
      100,
      20
    ).catch(() => {});
  }
  return tab;
}

async function selectAndFocus(win, tab) {
  await SimpleTest.promiseFocus(win);
  win.gBrowser.selectedTab = tab;
}

async function withTwoWindows(action) {
  await gZenWorkspaces.promiseInitialized;
  const initialMainTabs = new Set(gBrowser.tabs);
  const win = await BrowserTestUtils.openNewBrowserWindow();
  await win.gZenWorkspaces.promiseInitialized;
  snapshotPreexistingTabs([window, win]);
  try {
    await action(window, win);
  } finally {
    await BrowserTestUtils.closeWindow(win);
    // Closing the second window syncs its initial blank tab into this window,
    // leave the main window the way we found it for the harness.
    for (const tab of gBrowser.tabs.filter(t => !initialMainTabs.has(t))) {
      BrowserTestUtils.removeTab(tab);
    }
  }
}

add_task(async function test_CloseTabInOtherWindowRemovesCopy() {
  await withTwoWindows(async (winA, winB) => {
    const tab = await openSyncedTab(winA);
    const id = tab.id;
    Assert.ok(findTab(winB, id), "The tab should be synced to window B");

    BrowserTestUtils.removeTab(tab);
    await waitForTabGoneEverywhere(id, [winA, winB], "Tab removed everywhere");
    await waitForNoClosingTabs([winA, winB]);

    Assert.ok(!findTab(winA, id), "Tab should be gone from window A");
    Assert.ok(!findTab(winB, id), "Copy should be gone from window B");
    assertNoOrphans([winA, winB], "simple close");
    Assert.deepEqual(
      syncableTabIds(winA),
      syncableTabIds(winB),
      "Both windows should have the same tabs"
    );
  });
});

add_task(async function test_CloseTabWhileCopyHoldsLiveContent() {
  await withTwoWindows(async (winA, winB) => {
    const tab = await openSyncedTab(winA);
    const id = tab.id;
    const copy = findTab(winB, id);
    Assert.ok(copy, "The tab should be synced to window B");

    // Select the copy in B so the live docshell is swapped over there.
    await selectAndFocus(winB, copy);
    await TestUtils.waitForCondition(
      () => copy._zenContentsVisible && !tab._zenContentsVisible,
      "Content should live in window B"
    );

    BrowserTestUtils.removeTab(tab);
    await waitForTabGoneEverywhere(id, [winA, winB], "Tab removed everywhere");
    await waitForNoClosingTabs([winA, winB]);

    Assert.ok(!findTab(winA, id), "Tab should be gone from window A");
    Assert.ok(!findTab(winB, id), "Live copy should be gone from window B");
    assertNoOrphans([winA, winB], "close with live copy");

    const tab2 = await openSyncedTab(winA);
    const id2 = tab2.id;
    const copy2 = findTab(winB, id2);
    await selectAndFocus(winB, copy2);
    await TestUtils.waitForCondition(
      () => copy2._zenContentsVisible,
      "Content should live in window B"
    );
    BrowserTestUtils.removeTab(copy2);
    await waitForTabGoneEverywhere(id2, [winA, winB], "Tab removed everywhere");
    await waitForNoClosingTabs([winA, winB]);
    Assert.ok(!findTab(winA, id2), "Copy should be gone from window A");
    Assert.ok(!findTab(winB, id2), "Tab should be gone from window B");
    assertNoOrphans([winA, winB], "close live copy");
  });
});

// The sync re-entrancy guard can drop TabOpen too (a separate issue), so retry.
async function openSyncedTabWithRetry(aWin, aOther, aUrl) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const tab = await openSyncedTab(aWin, aUrl);
    if (tab.id && findTab(aOther, tab.id)) {
      return tab;
    }
    info(`Tab "${tab.id}" was not synced (attempt ${attempt}), retrying`);
    aWin.gBrowser.removeTab(tab, { animate: false });
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

add_task(async function test_StressCloseAcrossWindows() {
  const seed = Date.now() & 0xffffff;
  info(`Stress test seed: ${seed}`);
  const random = makeRandom(seed);
  const ITERATIONS = 40;
  const POOL_SIZE = 3;

  await withTwoWindows(async (winA, winB) => {
    const wins = [winA, winB];
    const pool = [];
    let closed = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      // Keep a few tabs around so closes overlap with swaps of other tabs.
      while (pool.length < POOL_SIZE) {
        const origin = wins[Math.floor(random() * 2)];
        const other = origin === winA ? winB : winA;
        const tab = await openSyncedTabWithRetry(
          origin,
          other,
          TEST_URLS[Math.floor(random() * TEST_URLS.length)]
        );
        if (!tab) {
          ok(false, "Could not open a synced tab");
          break;
        }
        pool.push(tab.id);
      }
      if (!pool.length) {
        break;
      }

      const id = pool.splice(Math.floor(random() * pool.length), 1)[0];

      const steps = 1 + Math.floor(random() * 3);
      for (let s = 0; s < steps; s++) {
        const win = wins[Math.floor(random() * 2)];
        const target = findTab(win, id);
        if (!target) {
          break;
        }
        if (random() < 0.5) {
          await SimpleTest.promiseFocus(win);
        } else {
          win.focus();
        }
        win.gBrowser.selectedTab = target;
        if (random() < 0.5) {
          await new Promise(r => requestAnimationFrame(r));
        }
      }

      // The swaps triggered above are deliberately not awaited.
      const closeWin = wins[Math.floor(random() * 2)];
      const closer = findTab(closeWin, id);
      if (!closer) {
        ok(false, `Iteration ${i}: tab ${id} missing from a window`);
        continue;
      }
      if (random() < 0.5) {
        await new Promise(r => setTimeout(r, Math.floor(random() * 50)));
      }
      closeWin.gBrowser.removeTab(closer, { animate: true });
      closed++;

      if (i % 4 === 0) {
        await waitForTabGoneEverywhere(id, wins, `Iteration ${i} closed`);
        Assert.ok(
          wins.every(w => !findTab(w, id)),
          `Iteration ${i}: tab ${id} should be gone from both windows (seed ${seed})`
        );
      }
    }

    for (const id of pool.splice(0)) {
      const t = findTab(winA, id) || findTab(winB, id);
      t?.documentGlobal.gBrowser.removeTab(t, { animate: true });
    }

    await waitForNoClosingTabs(wins);
    info(`Stress run done, closed ${closed} tabs`);
    assertNoOrphans(wins, `stress (seed ${seed})`);
    for (const w of wins) {
      Assert.deepEqual(
        syncableTabIds(w),
        [],
        `Window should have no leftover tabs from the test (seed ${seed})`
      );
    }
    // The windows' initial blank tabs aren't necessarily synced, so compare
    // the tabs that existed before the test as well.
    Assert.equal(
      winA.gBrowser.tabs.filter(t => !gPreexistingIds.has(t.id)).length,
      winB.gBrowser.tabs.filter(t => !gPreexistingIds.has(t.id)).length,
      "Tab counts should match across windows"
    );
  });
});

// removeTab skips the close animation when testingEnabled && !profilingEnabled.
function enableCloseAnimations(wins) {
  const restores = [];
  const spies = { calls: 0 };
  for (const w of wins) {
    const ui = w.gZenUIManager;
    const mgr = w.gZenVerticalTabsManager;
    const oldProfiling = ui.profilingEnabled;
    ui.profilingEnabled = true;
    const origAnimate = mgr.animateItemClose;
    mgr.animateItemClose = function (...args) {
      spies.calls++;
      return origAnimate.apply(this, args);
    };
    restores.push(() => {
      ui.profilingEnabled = oldProfiling;
      mgr.animateItemClose = origAnimate;
    });
  }
  return { spies, restore: () => restores.forEach(r => r()) };
}

add_task(async function test_AnimatedCloseInUnfocusedWindow() {
  await withTwoWindows(async (winA, winB) => {
    const { spies, restore } = enableCloseAnimations([winA, winB]);
    try {
      await SimpleTest.promiseFocus(winA);
      const ids = [];
      for (let i = 0; i < 5; i++) {
        ids.push((await openSyncedTab(winA)).id);
      }

      for (const id of ids) {
        winA.gBrowser.removeTab(findTab(winA, id), { animate: true });
      }
      for (const id of ids) {
        await waitForTabGoneEverywhere(id, [winA, winB], "Tab removed");
      }
      await waitForNoClosingTabs([winA, winB]);
      Assert.greater(spies.calls, 0, "The close animation path should be used");
      for (const id of ids) {
        Assert.ok(!findTab(winA, id), "Tab should be gone from window A");
        Assert.ok(!findTab(winB, id), "Copy should be gone from window B");
      }
      assertNoOrphans([winA, winB], "animated close, unfocused window");

      await SimpleTest.promiseFocus(winB);
      const ids2 = [];
      for (let i = 0; i < 5; i++) {
        ids2.push((await openSyncedTab(winB)).id);
      }
      await SimpleTest.promiseFocus(winA);
      for (const id of ids2) {
        winB.gBrowser.removeTab(findTab(winB, id), { animate: true });
      }
      for (const id of ids2) {
        await waitForTabGoneEverywhere(id, [winA, winB], "Tab removed");
      }
      await waitForNoClosingTabs([winA, winB]);
      assertNoOrphans([winA, winB], "animated close, reverse");
    } finally {
      restore();
    }
  });
});

add_task(async function test_AnimatedCloseWithMinimizedWindow() {
  await withTwoWindows(async (winA, winB) => {
    const { spies, restore } = enableCloseAnimations([winA, winB]);
    try {
      await SimpleTest.promiseFocus(winA);
      const ids = [];
      for (let i = 0; i < 3; i++) {
        ids.push((await openSyncedTab(winA)).id);
      }
      // A minimized window has a hidden document, so animations never tick.
      winB.minimize();
      await TestUtils.waitForCondition(
        () => winB.document.hidden || winB.windowState === winB.STATE_MINIMIZED,
        "Window B should be minimized"
      );
      info(`B hidden=${winB.document.hidden} state=${winB.windowState}`);

      for (const id of ids) {
        winA.gBrowser.removeTab(findTab(winA, id), { animate: true });
      }
      for (const id of ids) {
        await waitForTabGoneEverywhere(id, [winA, winB], "Tab removed");
      }
      await waitForNoClosingTabs([winA, winB]);
      Assert.greater(spies.calls, 0, "The close animation path should be used");
      for (const id of ids) {
        Assert.ok(!findTab(winB, id), "Copy should be gone from minimized B");
      }
      assertNoOrphans([winA, winB], "animated close, minimized window");
    } finally {
      winB.restore();
      restore();
    }
  });
});
