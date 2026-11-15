/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ContextualIdentityService } = ChromeUtils.importESModule(
  "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs"
);

function spaceRecord(
  uuid,
  { name = "Synced Space", containerGuid = null } = {}
) {
  return {
    id: uuid,
    deleted: false,
    cleartext: {
      kind: "space",
      data: {
        uuid,
        name,
        icon: null,
        theme: null,
        containerGuid,
        children: [],
      },
    },
  };
}

add_task(async function test_ApplyCreatesMissingBuiltinContainers() {
  await gZenWorkspaces.promiseInitialized;

  // Simulate a fresh Zen profile (zen.containers.create-default-identities = false)
  // where Firefox's built-in containers 1 and 2 are not present locally.
  for (const builtinId of [1, 2]) {
    if (ContextualIdentityService.getPublicIdentityFromId(builtinId)) {
      ContextualIdentityService.remove(builtinId);
    }
    ZenSpacesSyncModel.forgetContainerGuid(`builtin-${builtinId}`);
  }
  Assert.equal(
    ZenSpacesSyncModel.contextIdForGuid("builtin-1"),
    null,
    "builtin-1 should not resolve before sync creates it"
  );

  const spaceId = "test-builtin-container-space";
  const tabId = "test-builtin-container-tab";
  const space2Id = "test-builtin-container-space-2";
  const createdContainerIds = [];

  try {
    const tab = tabRecord(tabId, {
      pinned: true,
      workspaceUuid: spaceId,
    });
    tab.cleartext.data.containerGuid = "builtin-1";

    const failed = await ZenSpacesSyncApplier.applyBatch([
      spaceRecord(spaceId, {
        name: "Personal Synced",
        containerGuid: "builtin-1",
      }),
      tab,
      spaceRecord(space2Id, {
        name: "Work Synced",
        containerGuid: "builtin-2",
      }),
    ]);
    Assert.deepEqual(
      failed,
      [],
      "Spaces and tabs referencing missing built-in containers should apply"
    );

    const space1 = gZenWorkspaces.getWorkspaceFromId(spaceId);
    const space2 = gZenWorkspaces.getWorkspaceFromId(space2Id);
    Assert.ok(space1, "First synced space should exist");
    Assert.ok(space2, "Second synced space should exist");
    Assert.greater(
      space1.containerTabId,
      0,
      "Space 1 should receive a created containerTabId"
    );
    Assert.greater(
      space2.containerTabId,
      0,
      "Space 2 should receive a created containerTabId"
    );
    Assert.notEqual(
      space1.containerTabId,
      space2.containerTabId,
      "builtin-1 and builtin-2 should map to distinct local containers"
    );
    createdContainerIds.push(space1.containerTabId, space2.containerTabId);

    const personalIdentity = ContextualIdentityService.getPublicIdentityFromId(
      space1.containerTabId
    );
    Assert.equal(personalIdentity?.name, "Personal");
    Assert.equal(
      ZenSpacesSyncModel.guidForContextId(space1.containerTabId),
      "builtin-1",
      "Created container should round-trip back to builtin-1"
    );
    Assert.equal(
      ZenSpacesSyncModel.guidForContextId(space2.containerTabId),
      "builtin-2",
      "Created container should round-trip back to builtin-2"
    );

    const syncedTab = document.getElementById(tabId);
    Assert.ok(gBrowser.isTab(syncedTab), "Pinned tab should materialize");
    Assert.equal(
      syncedTab.userContextId,
      space1.containerTabId,
      "Pinned tab should use the created built-in container"
    );
  } finally {
    const syncedTab = document.getElementById(tabId);
    if (syncedTab) {
      BrowserTestUtils.removeTab(syncedTab);
    }
    for (const id of [spaceId, space2Id]) {
      if (gZenWorkspaces.getWorkspaceFromId(id)) {
        await gZenWorkspaces.removeWorkspace(id);
      }
      ZenSpacesSyncModel.noteApplied(id, null);
    }
    ZenSpacesSyncModel.noteApplied(tabId, null);
    for (const ctxId of createdContainerIds) {
      if (ContextualIdentityService.getPublicIdentityFromId(ctxId)) {
        ContextualIdentityService.remove(ctxId);
      }
    }
    ZenSpacesSyncModel.forgetContainerGuid("builtin-1");
    ZenSpacesSyncModel.forgetContainerGuid("builtin-2");
    ContextualIdentityService.resetDefault();
  }
});

add_task(async function test_UnknownNonBuiltinContainerStillFails() {
  await gZenWorkspaces.promiseInitialized;

  const customSpaceId = "test-unknown-custom-container-space";
  const outOfRangeSpaceId = "test-unknown-builtin-5-space";

  const failed = await ZenSpacesSyncApplier.applyBatch([
    spaceRecord(customSpaceId, {
      name: "Missing Custom",
      containerGuid: "nonexistent-custom-container-guid",
    }),
    spaceRecord(outOfRangeSpaceId, {
      name: "Invalid Builtin 5",
      containerGuid: "builtin-5",
    }),
  ]);

  Assert.deepEqual(
    failed,
    [customSpaceId, outOfRangeSpaceId],
    "Non-builtin or out-of-range container guids should still fail cleanly"
  );
  Assert.equal(
    gZenWorkspaces.getWorkspaceFromId(customSpaceId),
    null,
    "Space with missing custom container should not be applied early"
  );
  Assert.equal(
    gZenWorkspaces.getWorkspaceFromId(outOfRangeSpaceId),
    null,
    "Space with invalid builtin-5 should not be applied"
  );
});

add_task(async function test_StandInIsNotUploadedUntilRenamed() {
  await gZenWorkspaces.promiseInitialized;

  const projectedNames = async () => {
    const projections = await collectProjections();
    return new Map(
      [...projections.entries()]
        .filter(([, record]) => record.kind === "container")
        .map(([guid, record]) => [guid, record.data.name])
    );
  };

  if (ContextualIdentityService.getPublicIdentityFromId(2)) {
    ContextualIdentityService.remove(2);
  }
  ZenSpacesSyncModel.forgetContainerGuid("builtin-2");

  const contextId = ZenSpacesSyncModel.ensureBuiltinContainer("builtin-2");
  try {
    const identity =
      ContextualIdentityService.getPublicIdentityFromId(contextId);
    Assert.ok(identity, "The stand-in container should exist");
    Assert.ok(
      !(await projectedNames()).has("builtin-2"),
      "A stand-in is not uploaded, so it cannot rename a real built-in elsewhere"
    );

    ContextualIdentityService.update(
      contextId,
      "My Work",
      identity.icon,
      identity.color
    );
    Assert.equal(
      (await projectedNames()).get("builtin-2"),
      "My Work",
      "Once the user renames it, it syncs like any other container"
    );
  } finally {
    if (ContextualIdentityService.getPublicIdentityFromId(contextId)) {
      ContextualIdentityService.remove(contextId);
    }
    ZenSpacesSyncModel.forgetContainerGuid("builtin-2");
    ContextualIdentityService.resetDefault();
  }
});
