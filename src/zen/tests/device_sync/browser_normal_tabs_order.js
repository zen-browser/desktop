/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_RapidTabsGetUniqueSyncIds() {
  await gZenWorkspaces.promiseInitialized;
  const tabs = [];
  for (let i = 0; i < 60; i++) {
    tabs.push(
      gBrowser.addTrustedTab(`https://example.com/?rapid-${i}`, {
        inBackground: true,
        skipAnimation: true,
      })
    );
  }
  await TestUtils.waitForCondition(
    () => tabs.every(tab => tab.id),
    "every rapidly-opened tab is assigned a sync id"
  );
  const ids = tabs.map(tab => tab.id);
  Assert.equal(
    new Set(ids).size,
    ids.length,
    "every rapidly-opened tab has a unique sync id"
  );
  for (const tab of tabs) {
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_IncomingOrderKeepsUnlistedTabInPlace() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({ set: [[NORMAL_TABS_PREF, true]] });

  const uuid = gZenWorkspaces.activeWorkspace;
  const opened = [
    await openSyncableTab("https://example.com/?order-a"),
    await openSyncableTab("https://example.com/?order-b"),
    await openSyncableTab("https://example.com/?order-c"),
  ];
  const container = opened[0].parentNode;
  Assert.ok(
    opened.every(tab => tab.parentNode === container),
    "the three tabs share a container"
  );

  const domOrder = () =>
    [...container.children].filter(node => opened.includes(node));
  const [first, middle, last] = domOrder();

  const spaceData = (await collectProjections()).get(uuid)?.data;
  Assert.ok(spaceData, "the active space projects");
  const record = {
    id: uuid,
    deleted: false,
    cleartext: {
      kind: "space",
      data: { ...spaceData, children: [first.id, last.id] },
    },
  };
  const failed = await ZenSpacesSyncApplier.applyBatch([record]);
  Assert.deepEqual(failed, [], "the space order applies cleanly");

  Assert.deepEqual(
    domOrder(),
    [first, middle, last],
    "the unlisted tab stays between its neighbours, not pushed to the bottom"
  );

  ZenSpacesSyncModel.noteApplied(uuid, null);
  for (const tab of opened) {
    BrowserTestUtils.removeTab(tab);
  }
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_AppliedNormalTabReprojectsFaithfully() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({ set: [[NORMAL_TABS_PREF, true]] });

  const id = "test-sync-normal-faithful";
  const failed = await ZenSpacesSyncApplier.applyBatch([
    tabRecord(id, { pinned: false, url: "https://example.com/?faithful" }),
  ]);
  Assert.deepEqual(failed, [], "the normal-tab record applies cleanly");
  const tab = document.getElementById(id);
  Assert.ok(gBrowser.isTab(tab), "the tab materializes");

  const projections = await collectProjections();
  const changes = ZenSpacesSyncModel.computeChangedIDs();
  Assert.ok(
    projections.get(id),
    "the applied normal tab re-projects (is not dropped from the sidebar)"
  );
  Assert.ok(!(id in changes) || projections.get(id), "and is not tombstoned");

  ZenSpacesSyncModel.noteApplied(id, null);
  BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});
