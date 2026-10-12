/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function test_clients_escape() {
  _("Set up test fixtures.");

  await configureIdentity();
  let keyBundle = Service.identity.syncKeyBundle;

  let engine = Service.clientsEngine;

  try {
    _("Test that serializing client records results in uploadable ascii");
    engine.localID = "ascii";
    engine.localName = "wéävê";

    _("Make sure we have the expected record");
    let record = await engine._createRecord("ascii");
    Assert.equal(record.id, "ascii");
    Assert.equal(record.name, "wéävê");

    _("Encrypting record...");
    await record.encrypt(keyBundle);
    _("Encrypted.");

    let serialized = JSON.stringify(record);
    let checkCount = 0;
    _("Checking for all ASCII:", serialized);
    for (let ch of serialized) {
      let code = ch.charCodeAt(0);
      _("Checking asciiness of '", ch, "'=", code);
      Assert.less(code, 128);
      checkCount++;
    }

    _("Processed", checkCount, "characters out of", serialized.length);
    Assert.equal(checkCount, serialized.length);

    _("Making sure the record still looks like it did before");
    await record.decrypt(keyBundle);
    Assert.equal(record.id, "ascii");
    Assert.equal(record.name, "wéävê");

    _("Sanity check that creating the record also gives the same");
    record = await engine._createRecord("ascii");
    Assert.equal(record.id, "ascii");
    Assert.equal(record.name, "wéävê");
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});
