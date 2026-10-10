/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { MockRegistrar } = ChromeUtils.importESModule(
  "resource://testing-common/MockRegistrar.sys.mjs"
);
const { sinon } = ChromeUtils.importESModule(
  "resource://testing-common/Sinon.sys.mjs"
);
// This is an xpcshell test, but a sibling browser.toml makes eslint apply the
// browser-test env, where TestUtils is a predefined global. It isn't one in
// xpcshell (there's no head.js here to import it either), so the import is
// required.
// eslint-disable-next-line mozilla/no-redeclare-with-import-autofix
const { TestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TestUtils.sys.mjs"
);
const {
  CustomIconManager,
  ICON_CATALOG,
  resolvePreview,
  resolveResourceId,
  OS_LIGHT,
  OS_DARK,
} = ChromeUtils.importESModule(
  "moz-src:///browser/components/shell/CustomIconManager.sys.mjs"
);
// Importing this module constructs the toolkit profile service as a side effect,
// which requires setupProfileService() to have run, so it must stay lazy and
// only be touched from add_setup() onwards.
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  SelectableProfileService:
    "resource:///modules/profiles/SelectableProfileService.sys.mjs",
});

const PREF_ICON_ID = "browser.shell.customIcon.id";
const PREF_ENABLED = "browser.shell.customIcon.enabled";
const PREF_PER_USER_START_MENU_SHORTCUT_CREATED =
  "browser.shell.customIcon.perUserStartMenuShortcutCreated";
const TEST_AUMID = "Test.Firefox.AUMID";
const TEST_SHORTCUTS = ["C:\\fake\\Desktop\\Nightly.lnk"];
const RETRO_RESOURCE_ID = ICON_CATALOG.retro2004.iconResourceId;

// CustomIconManager.apply() refuses to run on MSIX (packaged) builds, so on the
// MSIX CI job every task except the MSIX-specific one (which fakes the
// condition itself and runs everywhere) is skipped.
const ON_MSIX = Services.sysinfo.getProperty("hasWinPackageId");

// add_task() mutates the options object it is handed (tagging it isTask), so
// each call needs its own fresh object rather than a shared one.
function skipOnMsix() {
  return { skip_if: () => ON_MSIX };
}

function exePath() {
  return Services.dirsvc.get("XREExeF", Ci.nsIFile).path;
}

// A shortcut path in the folder holding the user's pinned taskbar shortcuts.
function pinnedShortcut() {
  return PathUtils.join(
    Services.dirsvc.get("AppData", Ci.nsIFile).path,
    "Microsoft",
    "Internet Explorer",
    "Quick Launch",
    "User Pinned",
    "TaskBar",
    "Nightly.lnk"
  );
}

let shellServiceMock = {
  QueryInterface: ChromeUtils.generateQI([Ci.nsIWindowsShellService]),
  enumerateInstallShortcuts: sinon.stub(),
  setShortcutsIcon: sinon.stub(),
  createShortcut: sinon.stub(),
};

let winTaskbarMock = {
  QueryInterface: ChromeUtils.generateQI([Ci.nsIWinTaskbar]),
  setAllWindowIcons: sinon.stub(),
  refreshTaskbarButtons: sinon.stub(),
  get defaultGroupId() {
    return TEST_AUMID;
  },
};

// ensureAppliedOrRevert() awaits SelectableProfileService.init() on the startup
// path so the shared custom-icon pref can finish loading from the profiles
// database before it reconciles. We stub it here so these unit tests don't spin up
// the real profiles machinery.
let spsInitStub;

// hasSystemWideStartMenuShortcut() does real filesystem/environment-variable
// work so here we stub it to isolate maybeCreatePerUserStartMenuShortcut()'s
// own branching logic from that.
let hasSystemWideStartMenuShortcutStub;

// Reset stub history + default behaviour, clear the prefs, and drop any
// recorded Glean values before each task.
function resetMocks() {
  shellServiceMock.enumerateInstallShortcuts.reset();
  shellServiceMock.enumerateInstallShortcuts.resolves(TEST_SHORTCUTS.slice());
  shellServiceMock.setShortcutsIcon.reset();
  shellServiceMock.setShortcutsIcon.resolves();
  shellServiceMock.createShortcut.reset();
  shellServiceMock.createShortcut.resolves();
  winTaskbarMock.setAllWindowIcons.reset();
  winTaskbarMock.refreshTaskbarButtons.reset();
  spsInitStub.reset();
  spsInitStub.resolves();
  hasSystemWideStartMenuShortcutStub.reset();
  hasSystemWideStartMenuShortcutStub.resolves(true);
  Services.prefs.clearUserPref(PREF_ICON_ID);
  Services.prefs.setBoolPref(PREF_ENABLED, true);
  Services.prefs.clearUserPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED);
  Services.fog.testResetFOG();
}

// The single "changed" event recorded since the last reset, or undefined if
// none. Fails if more than one was recorded (each task exercises one change).
function singleChangedEvent() {
  let events = Glean.customIcon.changed.testGetValue() ?? [];
  Assert.lessOrEqual(events.length, 1, "at most one changed event recorded");
  return events[0];
}

// Since we're importing SelectableProfileService for this test, we lift some of
// the setup from toolkit/profile/test/xpcshell/head.js which lets the service
// be imported and executed in debug xpcshell tests.
function setupProfileService() {
  let profD = do_get_profile();

  let dataHome = profD.clone();
  dataHome.append("data");
  dataHome.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0o755);

  let dataHomeLocal = profD.clone();
  dataHomeLocal.append("local");
  dataHomeLocal.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0o755);

  let xreDirProvider = Cc["@mozilla.org/xre/directory-provider;1"].getService(
    Ci.nsIXREDirProvider
  );
  xreDirProvider.setUserDataDirectory(dataHome, false);
  xreDirProvider.setUserDataDirectory(dataHomeLocal, true);
}

add_setup(function () {
  setupProfileService();
  Services.fog.initializeFOG();

  let shellCid = MockRegistrar.register(
    "@mozilla.org/browser/shell-service;1",
    shellServiceMock
  );
  let taskbarCid = MockRegistrar.register(
    "@mozilla.org/windows-taskbar;1",
    winTaskbarMock
  );

  spsInitStub = sinon.stub(lazy.SelectableProfileService, "init").resolves();
  hasSystemWideStartMenuShortcutStub = sinon.stub(
    CustomIconManager,
    "hasSystemWideStartMenuShortcut"
  );

  registerCleanupFunction(() => {
    spsInitStub.restore();
    hasSystemWideStartMenuShortcutStub.restore();
    MockRegistrar.unregister(taskbarCid);
    MockRegistrar.unregister(shellCid);
    Services.prefs.clearUserPref(PREF_ICON_ID);
    Services.prefs.clearUserPref(PREF_ENABLED);
    Services.prefs.clearUserPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED);
  });
});

/**
 * This test verifies that apply() enumerates shortcuts by the default AUMID,
 * writes the catalog resource ID (positive, un-negated) and the executable
 * path to the matching shortcuts, sets the runtime window icon, and records
 * the pref.
 */
add_task(
  skipOnMsix(),
  async function test_apply_updates_shortcuts_pref_and_runtime() {
    resetMocks();

    await CustomIconManager.apply("retro2004");

    Assert.ok(
      shellServiceMock.enumerateInstallShortcuts.calledOnceWithExactly(
        TEST_AUMID
      ),
      "enumerateInstallShortcuts called once with the default AUMID"
    );

    Assert.ok(
      shellServiceMock.setShortcutsIcon.calledOnce,
      "setShortcutsIcon called once"
    );
    let [shortcuts, iconPath, resourceId] =
      shellServiceMock.setShortcutsIcon.getCall(0).args;
    Assert.deepEqual(
      shortcuts,
      TEST_SHORTCUTS,
      "passed the enumerated shortcuts through"
    );
    Assert.equal(iconPath, exePath(), "icon source is the running executable");
    Assert.equal(
      resourceId,
      RETRO_RESOURCE_ID,
      "passed the catalog resource ID as-is (negation happens in C++, not JS)"
    );

    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(RETRO_RESOURCE_ID),
      "runtime window icon set to the retro resource ID"
    );
    Assert.equal(
      Services.prefs.getStringPref(PREF_ICON_ID, ""),
      "retro2004",
      "pref records the applied id"
    );

    let event = singleChangedEvent();
    Assert.ok(event, "a changed event was recorded");
    Assert.equal(event.category, "custom_icon", "event category");
    Assert.equal(event.name, "changed", "event name");
    Assert.equal(
      event.extra.icon_id,
      "retro2004",
      "changed event carries the applied id"
    );
  }
);

/**
 * This test verifies that apply() rejects when given an id absent from the
 * catalog, without touching any shortcut or runtime state or the pref.
 */
add_task(skipOnMsix(), async function test_apply_unknown_id_throws() {
  resetMocks();

  await Assert.rejects(
    CustomIconManager.apply("does-not-exist"),
    /Unknown icon id/,
    "apply rejects for an unknown catalog id"
  );

  Assert.ok(
    shellServiceMock.setShortcutsIcon.notCalled,
    "no shortcut work attempted for an unknown id"
  );
  Assert.ok(
    winTaskbarMock.setAllWindowIcons.notCalled,
    "no runtime work attempted for an unknown id"
  );
  Assert.equal(
    Services.prefs.getStringPref(PREF_ICON_ID, ""),
    "",
    "pref left untouched"
  );
});

/**
 * This test verifies that apply() throws on MSIX (packaged) builds, where the
 * feature is unsupported, without touching shortcuts, the runtime icon, or the
 * pref.
 */
add_task(async function test_apply_throws_on_msix() {
  resetMocks();

  // Fake an MSIX build by flipping the sysinfo property the manager checks.
  // nsSystemInfo is a writable property bag, so set it directly and restore it.
  let bag = Services.sysinfo.QueryInterface(Ci.nsIWritablePropertyBag2);
  let original = bag.getProperty("hasWinPackageId");
  bag.setPropertyAsBool("hasWinPackageId", true);

  try {
    await Assert.rejects(
      CustomIconManager.apply("retro2004"),
      /MSIX/,
      "apply rejects on an MSIX build"
    );

    Assert.ok(
      shellServiceMock.setShortcutsIcon.notCalled,
      "no shortcut work attempted on MSIX"
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.notCalled,
      "no runtime work attempted on MSIX"
    );
    Assert.equal(
      Services.prefs.getStringPref(PREF_ICON_ID, ""),
      "",
      "pref left untouched on MSIX"
    );
  } finally {
    bag.setPropertyAsBool("hasWinPackageId", original);
  }
});

/**
 * This test verifies that revert() resets matching shortcuts to the
 * executable's default icon (resource ID 0), clears the runtime override, and
 * clears the pref.
 */
add_task(
  skipOnMsix(),
  async function test_revert_resets_shortcuts_pref_and_runtime() {
    resetMocks();
    Services.prefs.setStringPref(PREF_ICON_ID, "retro2004");

    await CustomIconManager.revert();

    Assert.ok(
      shellServiceMock.setShortcutsIcon.calledOnce,
      "setShortcutsIcon called once"
    );
    let [, iconPath, resourceId] =
      shellServiceMock.setShortcutsIcon.getCall(0).args;
    Assert.equal(iconPath, exePath(), "reverts using the executable path");
    Assert.equal(
      resourceId,
      0,
      "resource ID 0 selects the executable's default icon"
    );

    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(0),
      "runtime window icon cleared (0)"
    );
    Assert.ok(!Services.prefs.prefHasUserValue(PREF_ICON_ID), "pref cleared");

    let event = singleChangedEvent();
    Assert.ok(event, "reverting from a custom icon records a changed event");
    Assert.equal(
      event.extra.icon_id,
      "default",
      "revert records the default id as the new selection"
    );
  }
);

/**
 * This test verifies that when enumeration matches no shortcuts, apply() skips
 * setShortcutsIcon but still applies the runtime icon and records the pref, so
 * the running window updates even though no shortcut could be changed.
 */
add_task(skipOnMsix(), async function test_apply_no_matching_shortcuts() {
  resetMocks();
  shellServiceMock.enumerateInstallShortcuts.resolves([]);

  // Must not throw even though nothing matched.
  await CustomIconManager.apply("retro2004");

  Assert.ok(
    shellServiceMock.setShortcutsIcon.notCalled,
    "setShortcutsIcon not called when enumeration matched nothing"
  );
  Assert.ok(
    winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(RETRO_RESOURCE_ID),
    "runtime icon still applied even though no shortcut changed"
  );
  Assert.equal(
    Services.prefs.getStringPref(PREF_ICON_ID, ""),
    "retro2004",
    "pref still recorded"
  );
  Assert.equal(
    singleChangedEvent()?.extra.icon_id,
    "retro2004",
    "changed event still recorded even though no shortcut matched"
  );
});

/**
 * This test verifies that when setShortcutsIcon rejects, apply() logs and
 * swallows the failure rather than throwing, and still applies the runtime
 * icon and pref.
 */
add_task(
  skipOnMsix(),
  async function test_apply_shortcut_write_failure_is_swallowed() {
    resetMocks();
    shellServiceMock.setShortcutsIcon.rejects(
      Components.Exception(
        "mock setShortcutsIcon failure",
        Cr.NS_ERROR_NOT_AVAILABLE
      )
    );

    // A shortcut-write failure is logged, not thrown.
    await CustomIconManager.apply("retro2004");

    Assert.ok(
      shellServiceMock.setShortcutsIcon.calledOnce,
      "setShortcutsIcon was attempted"
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(RETRO_RESOURCE_ID),
      "runtime icon still applied despite the shortcut-write failure"
    );
    Assert.equal(
      Services.prefs.getStringPref(PREF_ICON_ID, ""),
      "retro2004",
      "pref still recorded"
    );
    Assert.equal(
      singleChangedEvent()?.extra.icon_id,
      "retro2004",
      "changed event still recorded despite the shortcut-write failure"
    );
  }
);

/**
 * This test verifies that re-applying the icon that is already active (as the
 * theme observer and startup reconcile do) records no changed event, so the
 * probe only fires on a genuine change of icon.
 */
add_task(skipOnMsix(), async function test_apply_same_id_records_no_change() {
  resetMocks();

  await CustomIconManager.apply("retro2004");
  Assert.ok(singleChangedEvent(), "first apply records a change");

  Services.fog.testResetFOG();
  await CustomIconManager.apply("retro2004");
  Assert.equal(
    Glean.customIcon.changed.testGetValue(),
    undefined,
    "re-applying the same id records no changed event"
  );
});

/**
 * This test verifies that revert() over the already-default state (no custom
 * icon active) records no changed event.
 */
add_task(
  skipOnMsix(),
  async function test_revert_when_default_records_nothing() {
    resetMocks();

    await CustomIconManager.revert();

    Assert.equal(
      Glean.customIcon.changed.testGetValue(),
      undefined,
      "reverting when already default records no changed event"
    );
  }
);

/**
 * This test verifies that a rejected apply() (unknown id) records no changed
 * event.
 */
add_task(skipOnMsix(), async function test_unknown_id_records_no_change() {
  resetMocks();

  await Assert.rejects(
    CustomIconManager.apply("does-not-exist"),
    /Unknown icon id/,
    "apply rejects for an unknown catalog id"
  );

  Assert.equal(
    Glean.customIcon.changed.testGetValue(),
    undefined,
    "no changed event recorded for a rejected apply"
  );
});

/**
 * This test verifies that ensureAppliedOrRevert() records the current-icon
 * string metric once at startup: the active id for a known custom icon, and
 * "default" when no custom icon is set.
 */
add_task(
  skipOnMsix(),
  async function test_ensureAppliedOrRevert_records_current() {
    resetMocks();
    Services.prefs.setStringPref(PREF_ICON_ID, "retro2004");

    await CustomIconManager.ensureAppliedOrRevert();
    Assert.equal(
      Glean.customIcon.current.testGetValue(),
      "retro2004",
      "current records the active custom icon id"
    );

    resetMocks();
    await CustomIconManager.ensureAppliedOrRevert();
    Assert.equal(
      Glean.customIcon.current.testGetValue(),
      "default",
      "current records the default id when no custom icon is set"
    );
  }
);

/**
 * This test verifies that ensureAppliedOrRevert() with a pref naming a known
 * catalog id re-applies the runtime icon only, without rewriting shortcuts,
 * and keeps the pref.
 */
add_task(
  skipOnMsix(),
  async function test_ensureAppliedOrRevert_applies_known_id() {
    resetMocks();
    Services.prefs.setStringPref(PREF_ICON_ID, "retro2004");

    await CustomIconManager.ensureAppliedOrRevert();

    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(RETRO_RESOURCE_ID),
      "runtime icon applied for a known id"
    );
    Assert.ok(
      shellServiceMock.setShortcutsIcon.notCalled,
      "ensureAppliedOrRevert does not rewrite shortcuts for a known id"
    );
    Assert.equal(
      Services.prefs.getStringPref(PREF_ICON_ID, ""),
      "retro2004",
      "pref retained"
    );
  }
);

/**
 * This test verifies that ensureAppliedOrRevert() with a pref naming an id
 * absent from the catalog (e.g. a newer build's icon, or one since retired)
 * reverts the shortcuts and runtime icon to default and clears the pref.
 */
add_task(
  skipOnMsix(),
  async function test_ensureAppliedOrRevert_reverts_unknown_id() {
    resetMocks();
    Services.prefs.setStringPref(PREF_ICON_ID, "icon-from-a-newer-build");

    await CustomIconManager.ensureAppliedOrRevert();

    // Unknown id -> revert: shortcuts reset to default, runtime cleared, pref
    // cleared.
    Assert.ok(
      shellServiceMock.setShortcutsIcon.calledOnce,
      "revert rewrote shortcuts"
    );
    Assert.equal(
      shellServiceMock.setShortcutsIcon.getCall(0).args[2],
      0,
      "shortcuts reset to the default icon"
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(0),
      "runtime icon cleared"
    );
    Assert.ok(!Services.prefs.prefHasUserValue(PREF_ICON_ID), "pref cleared");
    Assert.equal(
      Glean.customIcon.changed.testGetValue(),
      undefined,
      "the startup reconcile of an unknown id is not a user change"
    );
  }
);

/**
 * This test verifies that ensureAppliedOrRevert() does nothing when no custom
 * icon pref is set.
 */
add_task(
  skipOnMsix(),
  async function test_ensureAppliedOrRevert_noop_without_pref() {
    resetMocks();

    await CustomIconManager.ensureAppliedOrRevert();

    Assert.ok(
      shellServiceMock.setShortcutsIcon.notCalled,
      "no shortcut work when no custom icon is recorded"
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.notCalled,
      "no runtime work when no custom icon is recorded"
    );
  }
);

/**
 * This test checks that ensureAppliedOrRevert() will run setShortcutsIcon
 * even if no custom ID is set, but only if it's being called because a remote
 * profile updated.
 */
add_task(
  skipOnMsix(),
  async function test_ensureAppliedOrRevert_when_remoteProfileUpdated() {
    resetMocks();

    await CustomIconManager.ensureAppliedOrRevert(
      true /* remoteProfileUpdated */
    );

    Assert.ok(
      shellServiceMock.setShortcutsIcon.notCalled,
      "Shortcuts were not modified if a remote profile cleared the icon"
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnce,
      "Runtime icon was modified if a remote profile cleared the icon"
    );
  }
);

/**
 * This test verifies that the startup reconcile (remoteProfileUpdated = false)
 * awaits SelectableProfileService.init() before reading the pref, so a custom
 * icon synced late from the selectable-profiles database is still applied
 * rather than missed. init() stands in for that shared-pref load and only sets
 * the pref after yielding, so a reconcile that read the pref without awaiting
 * would see no icon and apply nothing.
 */
add_task(
  skipOnMsix(),
  async function test_ensureAppliedOrRevert_waits_for_shared_pref_load() {
    resetMocks();

    spsInitStub.callsFake(async () => {
      await Promise.resolve();
      Services.prefs.setStringPref(PREF_ICON_ID, "retro2004");
    });

    await CustomIconManager.ensureAppliedOrRevert();

    Assert.ok(
      spsInitStub.calledOnce,
      "The startup reconcile awaited SelectableProfileService.init()."
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(RETRO_RESOURCE_ID),
      "The icon synced during init() was applied to runtime windows."
    );
  }
);

/**
 * This test verifies the theme-aware catalog shape: a theme-aware icon exposes
 * distinct dark/light variants and resolveResourceId()/resolvePreview() pick the
 * scheme-specific asset, while a flat icon ignores the scheme.
 */
add_task(async function test_theme_aware_catalog() {
  let minimal = ICON_CATALOG.minimal;
  Assert.ok(minimal.variants, "minimal is theme-aware");
  Assert.notEqual(
    minimal.variants.dark.iconResourceId,
    minimal.variants.light.iconResourceId,
    "dark and light variants use distinct resource IDs"
  );
  Assert.notEqual(
    resolvePreview(minimal, "dark"),
    resolvePreview(minimal, "light"),
    "resolvePreview returns the scheme-specific preview for a theme-aware icon"
  );
  Assert.equal(
    resolveResourceId(minimal, "dark"),
    minimal.variants.dark.iconResourceId,
    "resolveResourceId picks the dark variant's id under a dark scheme"
  );
  Assert.equal(
    resolveResourceId(minimal, "light"),
    minimal.variants.light.iconResourceId,
    "resolveResourceId picks the light variant's id under a light scheme"
  );

  let retro = ICON_CATALOG.retro2004;
  Assert.ok(!retro.variants, "retro2004 is theme-agnostic");
  Assert.equal(
    resolvePreview(retro, "dark"),
    resolvePreview(retro, "light"),
    "a flat entry returns the same preview regardless of scheme"
  );
  Assert.equal(
    resolveResourceId(retro, "dark"),
    retro.iconResourceId,
    "a flat entry returns its single resource id regardless of scheme"
  );
});

/**
 * This test verifies the OS-theme runtime behaviour of a theme-aware icon:
 * apply() picks the variant matching the OS taskbar theme, and a
 * look-and-feel-changed notification re-applies the other variant when (and
 * only when) the OS theme actually flips.
 *
 * osColorScheme() reads the Windows registry, so we mock nsIWindowsRegKey for
 * the duration of this task only (to avoid disturbing other registry reads) and
 * drive SystemUsesLightTheme directly.
 */
add_task(skipOnMsix(), async function test_theme_change_reapplies_variant() {
  resetMocks();

  // The test flips this between OS_LIGHT/OS_DARK to simulate the user
  // changing their OS theme.
  let osTheme = OS_LIGHT;
  let regKeyMock = {
    QueryInterface: ChromeUtils.generateQI([Ci.nsIWindowsRegKey]),
    open() {},
    close() {},
    hasValue: name => name === "SystemUsesLightTheme",
    readIntValue: name => (name === "SystemUsesLightTheme" ? osTheme : 0),
  };
  let regCid = MockRegistrar.register(
    "@mozilla.org/windows-registry-key;1",
    regKeyMock
  );

  let { dark, light } = ICON_CATALOG.minimal.variants;

  try {
    // Startup registers the look-and-feel-changed observer.
    CustomIconManager.applyRuntimeOverrideForStartup();

    // Light OS theme -> Minimal applies the light variant.
    osTheme = OS_LIGHT;
    await CustomIconManager.apply("minimal");
    Assert.equal(
      shellServiceMock.setShortcutsIcon.lastCall.args[2],
      light.iconResourceId,
      "Minimal applies the light variant under a light OS theme"
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledWith(light.iconResourceId),
      "runtime window icon set to the light variant"
    );

    // Flip the OS to dark and notify -> the active Minimal re-applies as dark.
    osTheme = OS_DARK;
    shellServiceMock.setShortcutsIcon.resetHistory();
    winTaskbarMock.setAllWindowIcons.resetHistory();
    Services.obs.notifyObservers(null, "look-and-feel-changed");
    await TestUtils.waitForCondition(
      () => shellServiceMock.setShortcutsIcon.called,
      "icon re-applied after the OS theme flipped to dark"
    );
    Assert.equal(
      shellServiceMock.setShortcutsIcon.lastCall.args[2],
      dark.iconResourceId,
      "the dark variant is applied after the theme flips to dark"
    );

    // A notification with no actual theme change is a no-op (the
    // gLastAppliedScheme guard short-circuits before re-applying).
    shellServiceMock.setShortcutsIcon.resetHistory();
    Services.obs.notifyObservers(null, "look-and-feel-changed");
    Assert.ok(
      shellServiceMock.setShortcutsIcon.notCalled,
      "no re-apply when the OS theme is unchanged"
    );
  } finally {
    MockRegistrar.unregister(regCid);
    Services.prefs.clearUserPref(PREF_ICON_ID);
  }
});

/**
 * This test verifies that maybeCreatePerUserStartMenuShortcut() does not create a
 * shortcut when one already exists in the per-user Start Menu Programs folder.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_already_exists() {
    resetMocks();

    let programsPath = Services.dirsvc.get("Progs", Ci.nsIFile).path;
    shellServiceMock.enumerateInstallShortcuts.resolves([
      programsPath + "\\Nightly.lnk",
    ]);

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.notCalled,
      "createShortcut not called when a per-user Start Menu shortcut already exists"
    );
    Assert.ok(
      Services.prefs.getBoolPref(
        PREF_PER_USER_START_MENU_SHORTCUT_CREATED,
        false
      ),
      "the created pref is set once an existing shortcut is found"
    );
  }
);

/**
 * This test verifies that maybeCreatePerUserStartMenuShortcut() creates a shortcut
 * in the Programs folder when none is found among the enumerated shortcuts.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_creates_shortcut() {
    resetMocks();
    // TEST_SHORTCUTS ("C:\\fake\\Desktop\\Nightly.lnk") does not live in
    // the Programs dir, so the method must create the missing shortcut.

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.calledOnce,
      "createShortcut called when no per-user Start Menu shortcut exists"
    );
    let [exeFile, args, , iconFile, iconIndex, aumid, location, name] =
      shellServiceMock.createShortcut.getCall(0).args;
    Assert.equal(
      exeFile.path,
      exePath(),
      "shortcut targets the running executable"
    );
    Assert.deepEqual(args, [], "no extra arguments");
    Assert.equal(iconFile.path, exePath(), "icon source is the executable");
    Assert.equal(
      iconIndex,
      0,
      "icon index 0 selects the executable's default icon"
    );
    Assert.equal(aumid, TEST_AUMID, "shortcut carries the install AUMID");
    Assert.equal(
      location,
      "Programs",
      "shortcut placed in the Programs location"
    );
    Assert.ok(name.endsWith(".lnk"), "shortcut filename ends with .lnk");
    Assert.ok(
      Services.prefs.getBoolPref(
        PREF_PER_USER_START_MENU_SHORTCUT_CREATED,
        false
      ),
      "the created pref is set once the shortcut is successfully created"
    );
  }
);

/**
 * This test verifies that maybeCreatePerUserStartMenuShortcut() does nothing
 * when the custom icon feature is disabled.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_disabled_feature() {
    resetMocks();
    Services.prefs.setBoolPref(PREF_ENABLED, false);

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.notCalled,
      "createShortcut not called when the feature is disabled"
    );
  }
);

/**
 * This test verifies that maybeCreatePerUserStartMenuShortcut() is a no-op once
 * the created pref has already been set by a prior run, even if the user has
 * since deleted the shortcut.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_skips_once_created() {
    resetMocks();
    Services.prefs.setBoolPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED, true);

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.notCalled,
      "createShortcut not called once the created pref is set"
    );
  }
);

/**
 * This test verifies that maybeCreatePerUserStartMenuShortcut() does not create
 * a shortcut when there is no system-wide Start Menu shortcut to mirror.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_no_system_wide_shortcut() {
    resetMocks();
    hasSystemWideStartMenuShortcutStub.resolves(false);

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.notCalled,
      "createShortcut not called when there is no system-wide shortcut to mirror"
    );
  }
);

/**
 * This test verifies that once a per-user shortcut has been successfully
 * created, a later call does not attempt to create another one.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_second_call_is_noop() {
    resetMocks();

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();
    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.calledOnce,
      "the second call does not attempt to recreate a user-deleted shortcut"
    );
  }
);

/**
 * This test verifies that when enumerateInstallShortcuts rejects,
 * maybeCreatePerUserStartMenuShortcut() swallows the error and does not attempt
 * to create a shortcut.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_enumeration_failure() {
    resetMocks();
    shellServiceMock.enumerateInstallShortcuts.rejects(
      Components.Exception("mock enum failure", Cr.NS_ERROR_FAILURE)
    );

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.notCalled,
      "createShortcut not attempted when enumeration fails"
    );
  }
);

/**
 * This test verifies that when createShortcut rejects,
 * maybeCreatePerUserStartMenuShortcut() swallows the error and does not throw.
 */
add_task(
  skipOnMsix(),
  async function test_maybeCreatePerUserStartMenuShortcut_create_failure() {
    resetMocks();
    shellServiceMock.createShortcut.rejects(
      Components.Exception("mock create failure", Cr.NS_ERROR_FAILURE)
    );

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.createShortcut.calledOnce,
      "createShortcut was attempted despite the eventual failure"
    );
    Assert.ok(
      !Services.prefs.getBoolPref(
        PREF_PER_USER_START_MENU_SHORTCUT_CREATED,
        false
      ),
      "the created pref is left unset after a failed attempt"
    );
  }
);

/**
 * This test verifies that maybeCreatePerUserStartMenuShortcut() is a no-op on
 * MSIX (packaged) builds where shortcut creation is unsupported.
 */
add_task(
  { skip_if: () => !ON_MSIX },
  async function test_maybeCreatePerUserStartMenuShortcut_noop_on_msix() {
    resetMocks();

    await CustomIconManager.maybeCreatePerUserStartMenuShortcut();

    Assert.ok(
      shellServiceMock.enumerateInstallShortcuts.notCalled,
      "no enumeration on MSIX"
    );
    Assert.ok(
      shellServiceMock.createShortcut.notCalled,
      "no shortcut creation on MSIX"
    );
  }
);

/**
 * This test verifies that the feature stays enabled while our per-user Start
 * Menu shortcut is still present: it shadows the system-wide one, so we can
 * still write the shortcut the taskbar takes its icon from.
 */
add_task(skipOnMsix(), async function test_shouldDisable_shortcut_present() {
  resetMocks();
  Services.prefs.setBoolPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED, true);
  hasSystemWideStartMenuShortcutStub.resolves(true);
  shellServiceMock.enumerateInstallShortcuts.resolves([
    Services.dirsvc.get("Progs", Ci.nsIFile).path + "\\Nightly.lnk",
  ]);

  Assert.ok(
    !(await CustomIconManager.shouldDisableForMissingShortcut()),
    "does not disable while the per-user Start Menu shortcut is present"
  );
});

/**
 * This test verifies that once our per-user Start Menu shortcut is gone, the
 * feature is disabled when the system-wide shortcut governs the taskbar icon,
 * since that lives in an all-users directory we cannot write.
 */
add_task(skipOnMsix(), async function test_shouldDisable_system_wide_governs() {
  resetMocks();
  Services.prefs.setBoolPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED, true);
  hasSystemWideStartMenuShortcutStub.resolves(true);

  Assert.ok(
    await CustomIconManager.shouldDisableForMissingShortcut(),
    "disables when the unwritable system-wide shortcut governs the taskbar"
  );
});

/**
 * This test verifies that a remaining taskbar pin keeps the feature enabled
 * even alongside a system-wide shortcut, since we can still write the pin.
 */
add_task(skipOnMsix(), async function test_shouldDisable_pin_still_writable() {
  resetMocks();
  Services.prefs.setBoolPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED, true);
  hasSystemWideStartMenuShortcutStub.resolves(true);
  shellServiceMock.enumerateInstallShortcuts.resolves([pinnedShortcut()]);

  Assert.ok(
    !(await CustomIconManager.shouldDisableForMissingShortcut()),
    "does not disable while a writable taskbar pin remains"
  );
});

/**
 * This test verifies that with no system-wide shortcut to take over, the
 * feature stays enabled: the taskbar falls back to the window icon, which we
 * set at runtime.
 */
add_task(
  skipOnMsix(),
  async function test_shouldDisable_window_icon_fallback() {
    resetMocks();
    Services.prefs.setBoolPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED, true);
    hasSystemWideStartMenuShortcutStub.resolves(false);

    Assert.ok(
      !(await CustomIconManager.shouldDisableForMissingShortcut()),
      "does not disable when the taskbar falls back to the window icon"
    );
  }
);

/**
 * This test verifies that ensureAppliedOrRevert() acts on the decision above
 * instead of reconciling as usual. With a custom icon recorded but the taskbar
 * no longer overridable, it turns the feature off.
 */
add_task(
  skipOnMsix(),
  async function test_ensureAppliedOrRevert_disables_feature() {
    resetMocks();
    Services.prefs.setStringPref(PREF_ICON_ID, "retro2004");
    Services.prefs.setBoolPref(PREF_PER_USER_START_MENU_SHORTCUT_CREATED, true);
    hasSystemWideStartMenuShortcutStub.resolves(true);

    await CustomIconManager.ensureAppliedOrRevert();

    Assert.ok(
      !Services.prefs.getBoolPref(PREF_ENABLED, false),
      "the feature is disabled"
    );
    Assert.ok(
      winTaskbarMock.setAllWindowIcons.calledOnceWithExactly(0),
      "the runtime icon is reverted to the default rather than applied"
    );
    Assert.ok(!Services.prefs.prefHasUserValue(PREF_ICON_ID), "pref cleared");
  }
);

/**
 * This test verifies that refreshTaskbarButtons() delegates to
 * WinTaskbar.refreshTaskbarButtons().
 */
add_task(function test_refreshTaskbarButtons_calls_wintaskbar() {
  winTaskbarMock.refreshTaskbarButtons.reset();

  CustomIconManager.refreshTaskbarButtons();

  Assert.ok(
    winTaskbarMock.refreshTaskbarButtons.calledOnce,
    "refreshTaskbarButtons delegates to WinTaskbar"
  );
});

/**
 * This test verifies that refreshTaskbarButtons() swallows errors thrown by
 * WinTaskbar.refreshTaskbarButtons() rather than propagating them.
 */
add_task(function test_refreshTaskbarButtons_swallows_errors() {
  winTaskbarMock.refreshTaskbarButtons.reset();
  winTaskbarMock.refreshTaskbarButtons.throws(
    Components.Exception("mock failure", Cr.NS_ERROR_FAILURE)
  );

  CustomIconManager.refreshTaskbarButtons();

  Assert.ok(
    winTaskbarMock.refreshTaskbarButtons.calledOnce,
    "refreshTaskbarButtons was attempted"
  );
});
