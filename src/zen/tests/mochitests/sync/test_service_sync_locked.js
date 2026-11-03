/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function run_test() {
  validate_all_future_pings();
  let debug = [];
  let info = [];

  function augmentLogger(old) {
    let d = old.debug;
    let i = old.info;
    // For the purposes of this test we don't need to do full formatting
    // of the 2nd param, as the ones we care about are always strings.
    old.debug = function (m, p) {
      debug.push(p ? m + ": " + (p.message || p) : m);
      d.call(old, m, p);
    };
    old.info = function (m, p) {
      info.push(p ? m + ": " + (p.message || p) : m);
      i.call(old, m, p);
    };
    return old;
  }

  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  augmentLogger(Service._log);

  // Avoid daily ping
  Svc.PrefBranch.setIntPref("lastPing", Math.floor(Date.now() / 1000));

  _("Check that sync will log appropriately if already in 'progress'.");
  Service._locked = true;
  await Service.sync();
  Service._locked = false;

  Assert.ok(
    debug[debug.length - 2].startsWith(
      'Exception calling WrappedLock: Could not acquire lock. Label: "service.js: login".'
    )
  );
  Assert.equal(info[info.length - 1], "Cannot start sync: already syncing?");
});
