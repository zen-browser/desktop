/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from 'resource://gre/modules/AppConstants.sys.mjs';

class nsZenUIMigration {
  PREF_NAME = 'zen.ui.migration.version';
  MIGRATION_VERSION = 5;

  init(isNewProfile) {
    if (!isNewProfile) {
      try {
        this._migrate();
      } catch (e) {
        console.error('ZenUIMigration: Error during migration', e);
      }
    }
    this.clearVariables();
    if (this.shouldRestart) {
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
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

  _migrateV1() {
    // If there's an userChrome.css or userContent.css existing, we set
    // 'toolkit.legacyUserProfileCustomizations.stylesheets' back to true
    // We do this to avoid existing user stylesheets to be ignored
    const profileDir = Services.dirsvc.get('ProfD', Ci.nsIFile);
    const userChromeFile = profileDir.clone();
    userChromeFile.append('chrome');
    userChromeFile.append('userChrome.css');
    const userContentFile = profileDir.clone();
    userContentFile.append('chrome');
    userContentFile.append('userContent.css');
    Services.prefs.setBoolPref(
      'zen.workspaces.separate-essentials',
      Services.prefs.getBoolPref('zen.workspaces.container-specific-essentials-enabled', false)
    );
    const theme = Services.prefs.getIntPref('layout.css.prefers-color-scheme.content-override', 0);
    Services.prefs.setIntPref('zen.view.window.scheme', theme);
    if (userChromeFile.exists() || userContentFile.exists()) {
      Services.prefs.setBoolPref('toolkit.legacyUserProfileCustomizations.stylesheets', true);
      console.log('ZenUIMigration: User stylesheets detected, enabling legacy stylesheets.');
      this.shouldRestart = true;
    }
  }

  _migrateV2() {
    if (AppConstants.platform !== 'linux') {
      Services.prefs.setIntPref('zen.theme.gradient-legacy-version', 0);
    }
  }

  _migrateV3() {
    if (Services.prefs.getStringPref('zen.theme.accent-color', '').startsWith('system')) {
      Services.prefs.setStringPref('zen.theme.accent-color', 'AccentColor');
    }
  }

  _migrateV4() {
    // Fix spelling mistake in preference name
    Services.prefs.setBoolPref(
      'zen.theme.use-system-colors',
      Services.prefs.getBoolPref('zen.theme.use-sysyem-colors', false)
    );
  }

  _migrateV5() {
    Services.prefs.setBoolPref('zen.site-data-panel.show-callout', true);
  }
}

export var gZenUIMigration = new nsZenUIMigration();
