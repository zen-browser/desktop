/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_backup_probe_uses_selected_directory() {
  const { BackupUIParent } = ChromeUtils.importESModule(
    "moz-src:///browser/components/backup/actors/BackupUIParent.sys.mjs"
  );
  const { BackupService } = ChromeUtils.importESModule(
    "moz-src:///browser/components/backup/BackupService.sys.mjs"
  );
  const service = BackupService.init();
  const originalEmbeddedData = service.state.embeddedComponentPersistentData;
  const defaultPathDescriptor = Object.getOwnPropertyDescriptor(
    BackupService,
    "DEFAULT_PARENT_DIR_PATH"
  );
  const root = PathUtils.join(
    PathUtils.tempDir,
    Services.uuid.generateUUID().toString()
  );
  await IOUtils.makeDirectory(root);
  await SpecialPowers.pushPrefEnv({ set: [["browser.backup.location", ""]] });
  let defaultPath = PathUtils.join(root, "unavailable-documents");
  Object.defineProperty(BackupService, "DEFAULT_PARENT_DIR_PATH", {
    configurable: true,
    get: () => defaultPath,
  });
  const actor = new BackupUIParent();
  Object.defineProperty(actor, "manager", { value: { isInProcess: true } });
  const probe = async () => {
    const result = await actor.receiveMessage({ name: "ProbeDefaultBackupDir" });
    return result.readAccessGranted;
  };

  try {
    service.setEmbeddedComponentPersistentData({});
    await service.setParentDirPath(root);
    Assert.ok(
      await probe(),
      "The selected parent is probed before the first backup"
    );

    const backupPath = service.state.backupDirPath;
    await IOUtils.makeDirectory(backupPath);
    Assert.ok(await probe(), "An existing selected backup directory is probed");

    await IOUtils.remove(backupPath);
    await IOUtils.writeUTF8(backupPath, "not a directory");
    Assert.ok(!(await probe()), "An unreadable selected target is rejected");
    await IOUtils.remove(backupPath);

    const actorIOUtils = Cu.getGlobalForObject(BackupUIParent).IOUtils;
    const originalExists = actorIOUtils.exists;
    actorIOUtils.exists = async () => {
      throw new DOMException("Directory access denied", "NotAllowedError");
    };
    try {
      Assert.ok(
        !(await probe()),
        "A directory access error returns a failed probe"
      );
    } finally {
      actorIOUtils.exists = originalExists;
    }

    service.setEmbeddedComponentPersistentData({ path: root });
    Assert.ok(await probe(), "The embedded backup path retains priority");
    service.setEmbeddedComponentPersistentData({ path: defaultPath });
    Assert.ok(!(await probe()), "An unavailable embedded path is rejected");
    service.setEmbeddedComponentPersistentData({});

    Services.prefs.clearUserPref("browser.backup.location");
    Assert.ok(
      !(await probe()),
      "An unavailable default is rejected without a custom path"
    );
    defaultPath = root;
    Assert.ok(
      await probe(),
      "The default is used when no custom path was chosen"
    );
  } finally {
    Object.defineProperty(
      BackupService,
      "DEFAULT_PARENT_DIR_PATH",
      defaultPathDescriptor
    );
    service.setEmbeddedComponentPersistentData(originalEmbeddedData || {});
    await SpecialPowers.popPrefEnv();
    await IOUtils.remove(root, { recursive: true });
  }
});
