/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ContextualIdentityService: ContainerService } =
  ChromeUtils.importESModule(
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs"
  );

async function freshContainerService(createDefaults, path = null) {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.containers.create-default-identities", createDefaults]],
  });
  if (!path) {
    const dir = await IOUtils.createUniqueDirectory(
      PathUtils.tempDir,
      "zen-containers"
    );
    registerCleanupFunction(() => IOUtils.remove(dir, { recursive: true }));
    path = PathUtils.join(dir, "containers.json");
  }
  return ContainerService.createNewInstanceForTesting(path);
}

add_task(async function test_new_profiles_start_without_containers() {
  const service = await freshContainerService(false);
  Assert.deepEqual(
    service.getPublicIdentities(),
    [],
    "A new profile has no default containers"
  );
  const created = service.create("Arc Work", "fingerprint", "blue");
  Assert.greater(created.userContextId, 0, "Containers can still be created");
  Assert.equal(
    service.getPublicIdentities().length,
    1,
    "and show up as the only public container"
  );
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_default_containers_can_be_kept() {
  const service = await freshContainerService(true);
  Assert.equal(
    service.getPublicIdentities().length,
    4,
    "With the pref on, Firefox's default containers are created"
  );
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_existing_profiles_keep_their_containers() {
  const existing = await freshContainerService(true);
  Assert.equal(existing.getPublicIdentities().length, 4, "Defaults seeded");
  existing.saveSoon();
  await existing._saver.finalize();
  await SpecialPowers.popPrefEnv();

  const service = await freshContainerService(false, existing._path);
  Assert.equal(
    service.getPublicIdentities().length,
    4,
    "A profile that already has the default containers keeps them"
  );
  const personal = service.getPublicIdentities()[0];
  Assert.equal(
    service.getUserContextLabel(personal.userContextId),
    existing.getUserContextLabel(personal.userContextId),
    "and they still show their localized names"
  );
  Assert.notEqual(
    service.getUserContextLabel(personal.userContextId),
    "",
    "which are not empty"
  );
  await SpecialPowers.popPrefEnv();
});
