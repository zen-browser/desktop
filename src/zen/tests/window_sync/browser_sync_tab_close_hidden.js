/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

requestLongerTimeout(3);

const URL = "https://example.com/";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const findTab = (win, id) => gZenWindowSync.getItemFromWindow(win, id);

async function openSyncedTab(win, other) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const tab = BrowserTestUtils.addTab(win.gBrowser, URL, {
      skipAnimation: true,
    });
    await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, URL);
    try {
      await TestUtils.waitForCondition(
        () => tab.id && findTab(other, tab.id),
        "Tab should be synced",
        100,
        20
      );
      return tab;
    } catch (e) {
      // A dropped TabOpen is a separate problem, retry.
      win.gBrowser.removeTab(tab, { animate: false });
      await sleep(300);
    }
  }
  throw new Error("Could not open a synced tab");
}

// Tabs in a hidden window never get a refresh driver tick, so the close
// animation never finishes there and the copy used to stay stuck as closing.
async function closeInHiddenWindow(name, { sameSpace, minimize }, state) {
  const { winA, winB, spaceA, spaceB } = state;
  await winA.gZenWorkspaces.changeWorkspaceWithID(spaceA);
  await winB.gZenWorkspaces.changeWorkspaceWithID(sameSpace ? spaceA : spaceB);
  winA.browsingContext.isActive = true;
  if (minimize) {
    winB.minimize();
    await sleep(500);
  } else {
    winB.browsingContext.isActive = false;
  }
  winA.browsingContext.isActive = true;
  await TestUtils.waitForCondition(
    () => winB.document.hidden,
    `${name}: window B should be hidden`
  );

  for (const burst of [1, 3]) {
    const ids = [];
    for (let i = 0; i < burst; i++) {
      winA.browsingContext.isActive = true;
      ids.push((await openSyncedTab(winA, winB)).id);
    }
    for (const id of ids) {
      winA.gBrowser.removeTab(findTab(winA, id), { animate: true });
    }
    await TestUtils.waitForCondition(
      () =>
        ids.every(id => !findTab(winB, id)) &&
        !winB.gBrowser._removingTabs.size,
      `${name}: copies should leave the hidden window (burst of ${burst})`,
      100,
      50
    ).catch(() => {});
    Assert.deepEqual(
      ids.filter(id => findTab(winB, id)),
      [],
      `${name}: no copy should be left in the hidden window (burst of ${burst})`
    );
    Assert.equal(
      winB.gBrowser._removingTabs.size,
      0,
      `${name}: nothing should be stuck closing in the hidden window`
    );
    // Drain what the assertions above may have found, so later steps are clean.
    for (const id of ids) {
      for (const w of [winA, winB]) {
        const t = findTab(w, id);
        if (t) {
          w.gBrowser.removeTab(t, { animate: false, skipPermitUnload: true });
        }
      }
    }
  }
  if (minimize) {
    winB.restore();
  }
  winB.browsingContext.isActive = true;
}

add_task(async function test_CloseWithCopiesInHiddenWindow() {
  await gZenWorkspaces.promiseInitialized;
  const spaceA = gZenWorkspaces.activeWorkspace;
  const space = await gZenWorkspaces.createAndSaveWorkspace(
    "Hidden test",
    undefined,
    true
  );
  const spaceB = space.uuid;
  const winB = await BrowserTestUtils.openNewBrowserWindow();
  await winB.gZenWorkspaces.promiseInitialized;
  const initialTabs = new Set(gBrowser.tabs);
  // Keep testingEnabled on, but let removeTab take the real animated path.
  window.gZenUIManager.profilingEnabled = true;
  winB.gZenUIManager.profilingEnabled = true;
  const state = { winA: window, winB, spaceA, spaceB };
  try {
    await closeInHiddenWindow(
      "hidden, same space",
      { sameSpace: true, minimize: false },
      state
    );
    await closeInHiddenWindow(
      "hidden, other space",
      { sameSpace: false, minimize: false },
      state
    );
    await closeInHiddenWindow(
      "minimized, other space",
      { sameSpace: false, minimize: true },
      state
    );
  } finally {
    window.gZenUIManager.profilingEnabled = false;
    await window.gZenWorkspaces.changeWorkspaceWithID(spaceA);
    await BrowserTestUtils.closeWindow(winB);
    for (const tab of gBrowser.tabs.filter(t => !initialTabs.has(t))) {
      BrowserTestUtils.removeTab(tab);
    }
  }
});
