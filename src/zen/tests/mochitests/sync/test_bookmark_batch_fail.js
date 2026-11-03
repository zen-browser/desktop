/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

_("Making sure a failing sync reports a useful error");
// `Service` is used as a global in head_helpers.js.
// eslint-disable-next-line no-unused-vars
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_bookmark_test(async function run_test(engine) {
  await engine.initialize();
  engine._syncStartup = async function () {
    throw new Error("FAIL!");
  };

  try {
    _("Try calling the sync that should throw right away");
    await engine._sync();
    do_throw("Should have failed sync!");
  } catch (ex) {
    _("Making sure what we threw ended up as the exception:", ex);
    Assert.equal(ex.message, "FAIL!");
  }
});
