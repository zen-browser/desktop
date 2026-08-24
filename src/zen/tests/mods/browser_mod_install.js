/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_partial_mod_install_does_not_leave_directory() {
  const modId = `test-failed-install-${Services.uuid.generateUUID()}`;
  const modPath = gZenMods.getModFolder(modId);
  const testRoot = getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content/",
    "https://example.com/"
  );

  await IOUtils.makeDirectory(gZenMods.modsRootPath, {
    ignoreExisting: true,
  });
  const childrenBeforeInstall = await IOUtils.getChildren(
    gZenMods.modsRootPath
  );

  registerCleanupFunction(async () => {
    await IOUtils.remove(modPath, { recursive: true, ignoreAbsent: true });
  });

  await Assert.rejects(
    gZenMods.installMod({
      id: modId,
      style: `${testRoot}test_chrome.css`,
      readme: "ftp://example.com/readme.md",
    }),
    /Refusing non-HTTPS mod asset URL/,
    "A failure after downloading the stylesheet should reject the installation"
  );

  Assert.ok(
    !(await IOUtils.exists(modPath)),
    "A partially downloaded mod should not become an installation"
  );
  Assert.deepEqual(
    (await IOUtils.getChildren(gZenMods.modsRootPath)).sort(),
    childrenBeforeInstall.sort(),
    "A failed installation should also remove its staging directory"
  );
});
