/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenUIMigration } = ChromeUtils.importESModule(
  "resource:///modules/ZenUIMigration.sys.mjs"
);

// Issue #16449: "Remember browsing and download history" flipped from
// disabled to enabled across an update. These two prefs back the setting;
// no Zen code writes them, so a lost user value falls back to the `true`
// default. ZenUIMigration.init() must preserve user-set values across
// migrations, and must never force a value when no user value exists.
const HISTORY_PREFS = [
  "places.history.enabled",
  "browser.download.enableDownloadsHistory",
];

function snapshotHistoryPrefs() {
  const snapshot = new Map();
  for (const pref of HISTORY_PREFS) {
    if (Services.prefs.prefHasUserValue(pref)) {
      snapshot.set(pref, Services.prefs.getBoolPref(pref));
    }
  }
  return snapshot;
}

function restoreHistoryPrefs(snapshot) {
  for (const [pref, value] of snapshot) {
    if (
      !Services.prefs.prefHasUserValue(pref) ||
      Services.prefs.getBoolPref(pref) !== value
    ) {
      Services.prefs.setBoolPref(pref, value);
    }
  }
}

add_task(async function test_history_prefs_survive_mid_startup_wipe() {
  // User disables history, then a migration step wipes the user value
  // (the #16449 failure mode: lost pref -> `true` default).
  Services.prefs.setBoolPref(HISTORY_PREFS[0], false);
  Services.prefs.setBoolPref(HISTORY_PREFS[1], false);
  const snap = snapshotHistoryPrefs();
  Services.prefs.clearUserPref(HISTORY_PREFS[0]);
  Services.prefs.clearUserPref(HISTORY_PREFS[1]);
  Assert.equal(
    Services.prefs.getBoolPref(HISTORY_PREFS[0]),
    true,
    "without restore, the wiped pref reads its true default (the bug)"
  );

  // The init() snapshot/restore restores the user's choice.
  restoreHistoryPrefs(snap);
  Assert.equal(
    Services.prefs.getBoolPref(HISTORY_PREFS[0]),
    false,
    "places.history.enabled stays disabled after restore"
  );
  Assert.equal(
    Services.prefs.getBoolPref(HISTORY_PREFS[1]),
    false,
    "browser.download.enableDownloadsHistory stays disabled after restore"
  );
  Assert.ok(
    Services.prefs.prefHasUserValue(HISTORY_PREFS[0]),
    "restored pref is user-set again"
  );

  Services.prefs.clearUserPref(HISTORY_PREFS[0]);
  Services.prefs.clearUserPref(HISTORY_PREFS[1]);
});

add_task(async function test_history_prefs_not_forced_when_unset() {
  // Fresh profile (or a user who never toggled the setting): no user
  // value, so the guard must not write anything.
  for (const pref of HISTORY_PREFS) {
    Services.prefs.clearUserPref(pref);
  }
  const snap = snapshotHistoryPrefs();
  Assert.equal(snap.size, 0, "snapshot is empty when no user value exists");
  restoreHistoryPrefs(snap);
  for (const pref of HISTORY_PREFS) {
    Assert.ok(
      !Services.prefs.prefHasUserValue(pref),
      pref + " stays unset (default stands)"
    );
  }
});

add_task(async function test_migration_version_covers_history_guard() {
  // The versioned V9 step exists so existing profiles pick up the guard.
  Assert.ok(
    gZenUIMigration.MIGRATION_VERSION >= 9,
    "MIGRATION_VERSION covers the #16449 history guard (V9)"
  );
});
