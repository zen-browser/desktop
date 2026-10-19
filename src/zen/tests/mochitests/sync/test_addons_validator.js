/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { AddonValidator } = ChromeUtils.importESModule(
  "resource://services-sync/engines/addons.sys.mjs"
);

function getDummyServerAndClient() {
  return {
    server: [
      {
        id: "1111",
        applicationID: Services.appinfo.ID,
        addonID: "synced-addon@example.com",
        enabled: true,
        source: "amo",
        understood: true,
      },
    ],
    client: [
      {
        syncGUID: "1111",
        id: "synced-addon@example.com",
        type: "extension",
        isSystem: false,
        isSyncable: true,
      },
      {
        syncGUID: "2222",
        id: "system-addon@example.com",
        type: "extension",
        isSystem: true,
        isSyncable: false,
      },
      {
        // Plugins don't have a `syncedGUID`, but we don't sync them, so we
        // shouldn't report them as client duplicates.
        id: "some-plugin",
        type: "plugin",
      },
      {
        id: "another-plugin",
        type: "plugin",
      },
    ],
  };
}

add_task(async function test_valid() {
  let { server, client } = getDummyServerAndClient();
  let validator = new AddonValidator({
    _findDupe() {
      return null;
    },
    isAddonSyncable(item) {
      return item.type != "plugin";
    },
  });
  let { problemData, clientRecords, records, deletedRecords } =
    await validator.compareClientWithServer(client, server);
  equal(clientRecords.length, 4);
  equal(records.length, 1);
  equal(deletedRecords.length, 0);
  deepEqual(problemData, validator.emptyProblemData());
});
