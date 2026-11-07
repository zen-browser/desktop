/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  CustomizableUI:
    "moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs",
  SessionStore:
    "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
});

class nsZenUIMigration {
  PREF_NAME = "zen.ui.migration.version";
  MIGRATION_VERSION = 9;

  init(isNewProfile) {
    // Issue #16449: "Remember browsing and download history" flipped from
    // disabled to enabled across an update. No Zen code writes
    // places.history.enabled / browser.download.enableDownloadsHistory, so
    // the flip is the user pref being lost and the setting falling back to
    // its `true` default. Snapshot any user-set values before migrations
    // run and restore them afterwards, so a migration step (or a degraded
    // profile load) cannot silently change the user's choice. Prefs with
    // no user value (fresh profile, never toggled) are never forced.
    const historyPrefs = this.#snapshotHistoryPrefs();
    if (!isNewProfile) {
      try {
        this._migrate();
      } catch (e) {
        console.error("ZenUIMigration: Error during migration", e);
      }
    }
    this.#restoreHistoryPrefs(historyPrefs);
    this.#migrateLibraryButton();
    this.clearVariables();
    if (this.shouldRestart) {
      Services.startup.quit(
        Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
      );
    }
  }

  get _migrationVersion() {
    return Services.prefs.getIntPref(this.PREF_NAME, 0);
  }

  set _migrationVersion(value) {
    Services.prefs.setIntPref(this.PREF_NAME, value);
  }

  _migrate() {
    for (let i = 0; i <= this.MIGRATION_VERSION; i++) {
      if (this._migrationVersion < i) {
        this[`_migrateV${i}`]?.();
      }
    }
  }

  clearVariables() {
    this._migrationVersion = this.MIGRATION_VERSION;
  }

  #migrateLibraryButton() {
    const donePref = "zen.library.migrated-downloads-button";
    if (
      !Services.prefs.getBoolPref("zen.library.enabled", false) ||
      Services.prefs.getBoolPref(donePref, false)
    ) {
      return;
    }
    // A toolbar's saved placements are only there once a window has it.
    const footButtons = "zen-sidebar-foot-buttons";
    const listener = {
      onAreaNodeRegistered: area => {
        if (area !== footButtons) {
          return;
        }
        lazy.CustomizableUI.removeListener(listener);
        Services.prefs.setBoolPref(donePref, true);
        if (lazy.CustomizableUI.getPlacementOfWidget("zen-library-button")) {
          return;
        }
        const downloads =
          lazy.CustomizableUI.getPlacementOfWidget("downloads-button");
        const standsIn = downloads?.area === footButtons;
        lazy.CustomizableUI.addWidgetToArea(
          "zen-library-button",
          footButtons,
          standsIn ? downloads.position : 0
        );
        if (standsIn) {
          lazy.CustomizableUI.removeWidgetFromArea("downloads-button");
        }
      },
    };
    lazy.CustomizableUI.addListener(listener);
  }

  _migrateV1() {
    // If there's an userChrome.css or userContent.css existing, we set
    // 'toolkit.legacyUserProfileCustomizations.stylesheets' back to true
    // We do this to avoid existing user stylesheets to be ignored
    const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
    const userChromeFile = profileDir.clone();
    userChromeFile.append("chrome");
    userChromeFile.append("userChrome.css");
    const userContentFile = profileDir.clone();
    userContentFile.append("chrome");
    userContentFile.append("userContent.css");
    Services.prefs.setBoolPref(
      "zen.workspaces.separate-essentials",
      Services.prefs.getBoolPref(
        "zen.workspaces.container-specific-essentials-enabled",
        false
      )
    );
    const theme = Services.prefs.getIntPref(
      "layout.css.prefers-color-scheme.content-override",
      0
    );
    Services.prefs.setIntPref("zen.view.window.scheme", theme);
    if (userChromeFile.exists() || userContentFile.exists()) {
      Services.prefs.setBoolPref(
        "toolkit.legacyUserProfileCustomizations.stylesheets",
        true
      );
      console.warn(
        "ZenUIMigration: User stylesheets detected, enabling legacy stylesheets."
      );
      this.shouldRestart = true;
    }
  }

  _migrateV2() {
    if (AppConstants.platform !== "linux") {
      Services.prefs.setIntPref("zen.theme.gradient-legacy-version", 0);
    }
  }

  _migrateV3() {
    if (
      Services.prefs
        .getStringPref("zen.theme.accent-color", "")
        .startsWith("system")
    ) {
      Services.prefs.setStringPref("zen.theme.accent-color", "AccentColor");
    }
  }

  _migrateV4() {
    // Fix spelling mistake in preference name
    Services.prefs.setBoolPref(
      "zen.theme.use-system-colors",
      Services.prefs.getBoolPref("zen.theme.use-sysyem-colors", false)
    );
  }

  _migrateV5() {
    Services.prefs.setBoolPref("zen.site-data-panel.show-callout", true);
  }

  _migrateV6() {
    lazy.SessionStore.promiseAllWindowsRestored.then(() => {
      const win = Services.wm.getMostRecentWindow("navigator:browser");
      win.setTimeout(async () => {
        const [title, message, learnMore, accept] =
          await win.document.l10n.formatMessages([
            "zen-window-sync-migration-dialog-title",
            "zen-window-sync-migration-dialog-message",
            "zen-window-sync-migration-dialog-learn-more",
            "zen-window-sync-migration-dialog-accept",
          ]);

        // buttonPressed will be 0 for cancel, 1 for "more info"
        let buttonPressed = Services.prompt.confirmEx(
          win,
          title.value,
          message.value,
          Services.prompt.BUTTON_POS_0 *
            Services.prompt.BUTTON_TITLE_IS_STRING +
            Services.prompt.BUTTON_POS_1 *
              Services.prompt.BUTTON_TITLE_IS_STRING,
          learnMore.value,
          accept.value,
          null,
          null,
          {}
        );
        // User has clicked on "Learn More"
        if (buttonPressed === 0) {
          win.openTrustedLinkIn(
            "https://docs.zen-browser.app/user-manual/window-sync",
            "tab"
          );
        }
      }, 1000);
    });
  }

  _migrateV7() {
    if (
      AppConstants.platform === "macosx" &&
      Services.prefs.prefHasUserValue(
        "widget.macos.sidebar-blend-mode.behind-window"
      ) &&
      !Services.prefs.getBoolPref(
        "widget.macos.sidebar-blend-mode.behind-window"
      )
    ) {
      Services.prefs.setBoolPref("zen.widget.macos.window-vibrancy", false);
    }
  }

  _migrateV8() {
    // A version mismatch in the downloadable gfx blocklist wrongly blocked
    // video overlays for every Windows user. The status pref persists in the
    // profile and short-circuits the blocklist evaluation, so clear it (and
    // its failure id) and restart, since gfx is already initialized by now.
    if (Services.prefs.prefHasUserValue("gfx.blacklist.video-overlay")) {
      Services.prefs.clearUserPref("gfx.blacklist.video-overlay");
      Services.prefs.clearUserPref("gfx.blacklist.video-overlay.failureid");
      this.shouldRestart = true;
    }
  }

  _migrateV9() {
    // Issue #16449: "Remember browsing and download history" flipped from
    // disabled to enabled across an update. No Zen code writes
    // places.history.enabled or browser.download.enableDownloadsHistory, so
    // the flip is a user pref being *lost* (profile refresh / prefs.js not
    // re-read) and the setting falling back to its `true` default. If a
    // user value still exists, pin it: writing it back is a no-op for a
    // healthy profile and a restore for a degraded one. If no user value
    // exists (fresh profile, user never toggled), write nothing, so the
    // default stands.
    this.#preserveHistoryPrefs();
  }

  // The two prefs behind Settings > Privacy & Security > "Remember browsing
  // and download history" (issue #16449). See init() for why they are
  // snapshotted on every startup.
  static get HISTORY_PREFS() {
    return ["places.history.enabled", "browser.download.enableDownloadsHistory"];
  }

  /**
   * Capture every user-set history pref. Prefs that were never user-set
   * (fresh profiles, or users who simply never toggled the setting) are
   * omitted from the snapshot so the restore step never forces a value the
   * user did not choose.
   *
   * @returns {Map<string, boolean>} pref name -> user value, only for
   *   prefs with a user value at snapshot time.
   */
  #snapshotHistoryPrefs() {
    const snapshot = new Map();
    for (const pref of nsZenUIMigration.HISTORY_PREFS) {
      if (Services.prefs.prefHasUserValue(pref)) {
        snapshot.set(pref, Services.prefs.getBoolPref(pref));
      }
    }
    return snapshot;
  }

  /**
   * Re-assert every snapshotted history pref. Called after the migration
   * steps so that a step (or an external code path) which cleared or
   * overwrote the user value cannot silently flip the setting back to the
   * `true` default. A pref with no user value is left alone.
   */
  #restoreHistoryPrefs(snapshot) {
    for (const [pref, value] of snapshot) {
      if (
        !Services.prefs.prefHasUserValue(pref) ||
        Services.prefs.getBoolPref(pref) !== value
      ) {
        Services.prefs.setBoolPref(pref, value);
      }
    }
  }

  /**
   * Idempotent version of the init() snapshot/restore pair, for use as a
   * migration step. Reads the current user values and writes them back so
   * that a migration step that ran in between (or a profile refresh that
   * wiped them) cannot change the user's choice.
   */
  #preserveHistoryPrefs() {
    const snapshot = this.#snapshotHistoryPrefs();
    this.#restoreHistoryPrefs(snapshot);
  }
}

export var gZenUIMigration = new nsZenUIMigration();
