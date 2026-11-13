/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Moving tabs to another space must reparent them into that space in every
// synced window, not just in the window where the move happened.

function spaceOf(aItem) {
  return aItem?.closest("zen-workspace")?.id ?? null;
}

function mirrorsIn(aWindow, aTabs) {
  return aTabs.map(tab => gZenWindowSync.getItemFromWindow(aWindow, tab.id));
}

function allInSpace(aWindow, aTabs, aSpaceId) {
  return mirrorsIn(aWindow, aTabs).every(
    mirror =>
      mirror &&
      spaceOf(mirror) === aSpaceId &&
      mirror.getAttribute("zen-workspace-id") === aSpaceId
  );
}

function assertAllInSpace(aWindow, aTabs, aSpaceId, aWindowName) {
  for (const [i, mirror] of mirrorsIn(aWindow, aTabs).entries()) {
    Assert.ok(mirror, `${aWindowName}: tab ${i} exists`);
    Assert.equal(
      mirror.getAttribute("zen-workspace-id"),
      aSpaceId,
      `${aWindowName}: tab ${i} is labelled with the destination space`
    );
    Assert.equal(
      spaceOf(mirror),
      aSpaceId,
      `${aWindowName}: tab ${i} lives in the destination space's strip`
    );
  }
}

async function waitForTabsInSpace(aWin, aTabs, aSpaceId) {
  try {
    await TestUtils.waitForCondition(
      () =>
        allInSpace(window, aTabs, aSpaceId) &&
        allInSpace(aWin, aTabs, aSpaceId),
      "Moved tabs end up in the destination space in every window",
      100,
      50
    );
  } catch (e) {
    // Fall through to the explicit assertions below for a clear failure.
    info(`Timed out waiting for synced move: ${e}`);
  }
  assertAllInSpace(window, aTabs, aSpaceId, "Source window");
  assertAllInSpace(aWin, aTabs, aSpaceId, "Synced window");
}

function addTabs(aCount, aLabel) {
  const tabs = [];
  for (let i = 0; i < aCount; i++) {
    tabs.push(
      BrowserTestUtils.addTab(gBrowser, `data:text/html,${aLabel}-${i}`)
    );
  }
  return tabs;
}

async function waitForMirrors(aWin, aTabs) {
  await TestUtils.waitForCondition(
    () => mirrorsIn(aWin, aTabs).every(Boolean),
    "The tabs are mirrored into the synced window"
  );
}

function removeTabs(aTabs) {
  for (const tab of aTabs) {
    if (tab.isConnected && !tab.closing) {
      BrowserTestUtils.removeTab(tab);
    }
  }
}

/**
 * Creates a source space (made active) and a destination space placed so that
 * it is the first non-active space, then runs aCallback.
 *
 * @param {Function} aCallback - Receives `{ source, destination }`.
 */
async function withSpaces(aCallback) {
  await gZenWorkspaces.promiseInitialized;
  const originalSpace = gZenWorkspaces.getActiveWorkspace();
  const firstSpaceId = gZenWorkspaces.getWorkspaces()[0].uuid;
  const destination = await gZenWorkspaces.createAndSaveWorkspace(
    "15125 destination",
    undefined,
    false,
    0,
    { insertBeforeId: firstSpaceId }
  );
  const source = await gZenWorkspaces.createAndSaveWorkspace("15125 source");
  try {
    await gZenWorkspaces.changeWorkspace(source);
    await aCallback({ source, destination });
  } finally {
    await gZenWorkspaces.changeWorkspace(originalSpace);
    await gZenWorkspaces.removeWorkspace(source.uuid);
    await gZenWorkspaces.removeWorkspace(destination.uuid);
  }
}

async function runMultiTabMove() {
  await withSpaces(async ({ destination }) => {
    await withNewSyncedWindow(async win => {
      const tabs = addTabs(3, "multi");
      try {
        await waitForMirrors(win, tabs);

        gBrowser.selectedTab = tabs[0];
        gBrowser.addRangeToMultiSelectedTabs(tabs[0], tabs[2]);
        Assert.ok(
          tabs.every(tab => tab.multiselected),
          "All three tabs are selected"
        );

        gZenWorkspaces.moveTabsToWorkspace(
          [...gBrowser.selectedTabs],
          destination.uuid
        );
        gBrowser.clearMultiSelectedTabs();

        await waitForTabsInSpace(win, tabs, destination.uuid);

        const sourceOrder = gZenWorkspaces
          .workspaceElement(destination.uuid)
          .tabsContainer.querySelectorAll("tab[id]");
        const peerOrder = win.gZenWorkspaces
          .workspaceElement(destination.uuid)
          .tabsContainer.querySelectorAll("tab[id]");
        const ids = new Set(tabs.map(tab => tab.id));
        Assert.deepEqual(
          [...peerOrder].map(t => t.id).filter(id => ids.has(id)),
          [...sourceOrder].map(t => t.id).filter(id => ids.has(id)),
          "The synced window keeps the same order of moved tabs"
        );
      } finally {
        removeTabs(tabs);
      }
    });
  });
}

add_task(async function test_MoveSeveralTabsToSpace_DefaultPlacement() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.show-newtab-button-top", false]],
  });
  try {
    await runMultiTabMove();
  } finally {
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_MoveSeveralTabsToSpace_NewTabButtonTop() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.show-newtab-button-top", true]],
  });
  try {
    await runMultiTabMove();
  } finally {
    await SpecialPowers.popPrefEnv();
  }
});

// Guards the workspace check in tabbrowser's #notifyOnTabMove: TabMove must be
// synced when moving a tab to another space doesn't change its global index.
add_task(async function test_MoveTabWithUnchangedIndex() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.view.show-newtab-button-top", false]],
  });
  try {
    await withSpaces(async ({ source, destination }) => {
      await withNewSyncedWindow(async win => {
        const [tab] = addTabs(1, "unchanged-index");
        try {
          await waitForMirrors(win, [tab]);
          Assert.equal(
            tab.getAttribute("zen-workspace-id"),
            source.uuid,
            "The tab starts in the source space"
          );
          Assert.ok(
            !gZenWorkspaces
              .workspaceElement(destination.uuid)
              .tabsContainer.querySelector("tab[id]:not([zen-empty-tab])"),
            "The destination space has no normal tabs"
          );

          const indexBefore = tab.index;
          gZenWorkspaces.moveTabToWorkspace(tab, destination.uuid);
          Assert.equal(
            tab.index,
            indexBefore,
            "Precondition: the move keeps the global tab index"
          );

          await waitForTabsInSpace(win, [tab], destination.uuid);
        } finally {
          removeTabs([tab]);
        }
      });
    });
  } finally {
    await SpecialPowers.popPrefEnv();
  }
});
