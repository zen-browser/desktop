/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Unit tests for RustPasswordTracker.observe().
 *
 * observe() is pure scoring logic with no dependency on the Rust store, so it is
 * exercised on a minimal fake object rather than a fully initialized engine.
 */

"use strict";

const { RustPasswordEngine } = ChromeUtils.importESModule(
  "resource://services-sync/engines/passwords.sys.mjs"
);

// RustPasswordTracker is not exported directly; reach it through the engine.
const RustPasswordTracker = RustPasswordEngine.prototype._trackerObj;

function makeTracker({ ignoreAll = false } = {}) {
  return {
    score: 0,
    ignoreAll,
    observe: RustPasswordTracker.prototype.observe,
  };
}

// Stands in for the nsIArray subject passed for "removeAllLogins".
function fakeLoginArray(count) {
  const array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  for (let i = 0; i < count; i++) {
    array.appendElement(
      Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString)
    );
  }
  return array;
}

add_task(async function test_single_change_topics_bump_score() {
  for (let data of ["modifyLogin", "addLogin", "removeLogin", "importLogins"]) {
    let tracker = makeTracker();
    await tracker.observe(null, "passwordmgr-storage-changed", data);
    Assert.equal(
      tracker.score,
      SCORE_INCREMENT_XLARGE,
      `${data} bumps the score by SCORE_INCREMENT_XLARGE`
    );
  }
});

add_task(async function test_modifyLogin_ignores_syncCounter() {
  // The legacy PasswordTracker only scores "modifyLogin" when the subject's
  // syncCounter is > 0. The Rust tracker must not look at the subject at all,
  // so passing a null subject still bumps the score.
  let tracker = makeTracker();
  await tracker.observe(null, "passwordmgr-storage-changed", "modifyLogin");
  Assert.equal(
    tracker.score,
    SCORE_INCREMENT_XLARGE,
    "modifyLogin scores without inspecting the subject's syncCounter"
  );
});

add_task(async function test_removeAllLogins_scales_with_count() {
  let tracker = makeTracker();
  await tracker.observe(
    fakeLoginArray(3),
    "passwordmgr-storage-changed",
    "removeAllLogins"
  );
  Assert.equal(
    tracker.score,
    SCORE_INCREMENT_XLARGE * 4,
    "removeAllLogins bumps the score by SCORE_INCREMENT_XLARGE * (count + 1)"
  );
});

add_task(async function test_unknown_topic_does_nothing() {
  let tracker = makeTracker();
  await tracker.observe(null, "passwordmgr-storage-changed", "somethingElse");
  Assert.equal(tracker.score, 0, "an unrelated notification leaves the score");
});

add_task(async function test_ignoreAll_suppresses_scoring() {
  let tracker = makeTracker({ ignoreAll: true });
  await tracker.observe(null, "passwordmgr-storage-changed", "addLogin");
  await tracker.observe(
    fakeLoginArray(5),
    "passwordmgr-storage-changed",
    "removeAllLogins"
  );
  Assert.equal(tracker.score, 0, "ignoreAll suppresses all scoring");
});
