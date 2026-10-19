/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_ProjectionGatedByPref() {
  await gZenWorkspaces.promiseInitialized;
  const pinnedTab = await openSyncableTab("https://example.com/?pinned", {
    pinned: true,
  });
  const normalTab = await openSyncableTab("https://example.com/?normal");

  let projections = await collectProjections();
  const pinnedRecord = projections.get(pinnedTab.id);
  Assert.ok(pinnedRecord, "Pinned tab should project with the option off");
  Assert.equal(
    pinnedRecord.data.pinned,
    true,
    "Pinned tab record should carry pinned: true"
  );
  Assert.ok(
    !projections.get(normalTab.id),
    "Normal tab should not project with the option off"
  );

  await SpecialPowers.pushPrefEnv({ set: [[NORMAL_TABS_PREF, true]] });
  ZenSpacesSyncModel.invalidate();
  projections = ZenSpacesSyncModel.projections();

  const record = projections.get(normalTab.id);
  Assert.ok(record, "Normal tab should project with the option on");
  Assert.equal(
    record.data.pinned,
    false,
    "Normal tab record should carry pinned: false"
  );
  Assert.equal(
    record.data.workspaceUuid,
    gZenWorkspaces.activeWorkspace,
    "Normal tab record should name its workspace"
  );
  const space = projections.get(gZenWorkspaces.activeWorkspace);
  Assert.ok(
    space?.data?.children?.includes(normalTab.id),
    "The space's child order should include the normal tab"
  );

  await SpecialPowers.popPrefEnv();
  BrowserTestUtils.removeTab(normalTab);
  BrowserTestUtils.removeTab(pinnedTab);
});

add_task(async function test_DisablingOptionHoldsBackInsteadOfTombstoning() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({ set: [[NORMAL_TABS_PREF, true]] });
  const normalTab = await openSyncableTab("https://example.com/?heldback");

  await collectProjections();
  ZenSpacesSyncModel.markUploaded([normalTab.id]);
  let changes = ZenSpacesSyncModel.computeChangedIDs();
  Assert.ok(
    !(normalTab.id in changes),
    "An uploaded normal tab should report no pending change"
  );

  await SpecialPowers.popPrefEnv();
  ZenSpacesSyncModel.invalidate();
  Assert.ok(
    !ZenSpacesSyncModel.projections().get(normalTab.id),
    "Normal tab should stop projecting once the option is off"
  );
  changes = ZenSpacesSyncModel.computeChangedIDs();
  Assert.ok(
    !(normalTab.id in changes),
    "Disabling the option should not tombstone the tab"
  );

  // Drop the snapshot entry so this task leaves no sync state behind.
  ZenSpacesSyncModel.noteApplied(normalTab.id, null);
  BrowserTestUtils.removeTab(normalTab);
});
