/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenSyncStore } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenSyncManager.sys.mjs"
);
const { ContextualIdentityService } = ChromeUtils.importESModule(
  "resource://gre/modules/ContextualIdentityService.sys.mjs"
);

function emptySyncItems() {
  return { spaces: [], containers: [] };
}

add_task(async function test_opaque_container_aliases_are_non_destructive() {
  const name = `Zen Sync test ${Services.uuid.generateUUID()}`;
  const first = ContextualIdentityService.create(name, "circle", "blue");
  const second = ContextualIdentityService.create(name, "circle", "blue");

  registerCleanupFunction(() => {
    ContextualIdentityService.remove(first.userContextId);
    ContextualIdentityService.remove(second.userContextId);
  });

  const localSyncId = ZenSyncStore.getContainerSyncId(first.userContextId);
  Assert.ok(
    /^[0-9a-f-]{36}$/i.test(localSyncId),
    "The wire identity is opaque"
  );
  Assert.notEqual(
    localSyncId,
    String(first.userContextId),
    "The profile-local numeric ID is not used on the wire"
  );
  Assert.equal(
    ZenSyncStore.getContainerSemanticOrdinal(first.userContextId),
    0,
    "The first otherwise-identical container has ordinal zero"
  );
  Assert.equal(
    ZenSyncStore.getContainerSemanticOrdinal(second.userContextId),
    1,
    "Intentional duplicate containers remain distinct"
  );

  const firstRemoteId = Services.uuid.generateUUID().toString().slice(1, -1);
  const secondRemoteId = Services.uuid.generateUUID().toString().slice(1, -1);
  const pulled = emptySyncItems();
  pulled.containers = [
    {
      syncId: firstRemoteId,
      name,
      icon: "circle",
      color: "blue",
      semanticOrdinal: 0,
    },
    {
      syncId: secondRemoteId,
      name,
      icon: "circle",
      color: "blue",
      semanticOrdinal: 1,
    },
  ];
  await ZenSyncStore.applyIncomingBatch(pulled, emptySyncItems());

  Assert.equal(
    ZenSyncStore.resolveLocalContainerId(firstRemoteId),
    first.userContextId,
    "The first remote identity aliases the first local container"
  );
  Assert.equal(
    ZenSyncStore.resolveLocalContainerId(secondRemoteId),
    second.userContextId,
    "The second remote identity aliases the second local container"
  );

  const removals = emptySyncItems();
  removals.containers = [{ syncId: firstRemoteId }, { syncId: secondRemoteId }];
  await ZenSyncStore.applyIncomingBatch(emptySyncItems(), removals);

  Assert.ok(
    ContextualIdentityService.getPublicIdentityFromId(first.userContextId),
    "A remote tombstone does not delete local container data"
  );
  Assert.ok(
    ContextualIdentityService.getPublicIdentityFromId(second.userContextId),
    "Every intentional local container remains available"
  );
});
