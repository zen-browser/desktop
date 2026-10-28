/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ContextualIdentityService: ContainerService } =
  ChromeUtils.importESModule(
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs"
  );

async function freshContainerService(createDefaults) {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.containers.create-default-identities", createDefaults]],
  });
  const dir = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-containers"
  );
  const service = ContainerService.createNewInstanceForTesting(
    PathUtils.join(dir, "containers.json")
  );
  registerCleanupFunction(() => IOUtils.remove(dir, { recursive: true }));
  return service;
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
