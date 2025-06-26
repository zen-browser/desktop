// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

class nsZenUIMigration {
  PREF_NAME = 'zen.ui.migration.version';
  MIGRATION_VERSION = 1;

  init(isNewProfile) {
    if (!isNewProfile) {
      try {
        this._migrate();
      } catch (e) {
        console.error('ZenUIMigration: Error during migration', e);
      }
    }
    this.clearVariables();
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
    if (userChromeFile.exists() || userContentFile.exists()) {
      Services.prefs.setBoolPref('toolkit.legacyUserProfileCustomizations.stylesheets', true);
    }
    Services.prefs.setBoolPref(
      'zen.workspaces.separate-essentials',
      Services.prefs.getBoolPref('zen.workspaces.container-specific-essentials-enabled', false)
    );
  }
}

export var gZenUIMigration = new nsZenUIMigration();
