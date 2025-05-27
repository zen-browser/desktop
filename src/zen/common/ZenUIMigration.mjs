// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
});

class ZenUIMigration {
  PREF_NAME = 'zen.migration.version';
  MIGRATION_VERSION = 4;

  init(isNewProfile, win) {
    if (!isNewProfile) {
      this._migrate(win);
    }
    this.clearVariables();
  }

  get _migrationVersion() {
    return Services.prefs.getIntPref(this.PREF_NAME, 0);
  }

  set _migrationVersion(value) {
    Services.prefs.setIntPref(this.PREF_NAME, value);
  }

  _migrate(win) {
    if (this._migrationVersion < 1) {
      this._migrateV1(win);
    }
    if (this._migrationVersion < 2) {
      this._migrateV2(win);
    }
    if (this._migrationVersion < 3) {
      this._migrateV3(win);
    }
    if (this._migrationVersion < 4) {
      this._migrateV4(win);
    }
  }

  clearVariables() {
    this._migrationVersion = this.MIGRATION_VERSION;
  }

  _migrateV1(win) {
    // Introduction of the new URL bar, show a message to the user
    const notification = win.gNotificationBox.appendNotification(
      'zen-new-urlbar-notification',
      {
        label: { 'l10n-id': 'zen-new-urlbar-notification' },
        image: 'chrome://browser/skin/notification-icons/persistent-storage-blocked.svg',
        priority: win.gNotificationBox.PRIORITY_WARNING_HIGH,
      },
      [
        {
          'l10n-id': 'zen-disable',
          accessKey: 'D',
          callback: () => {
            Services.prefs.setBoolPref('zen.urlbar.replace-newtab', false);
          },
        },
        {
          link: 'https://docs.zen-browser.app/user-manual/urlbar/',
          'l10n-id': 'zen-learn-more-text',
        },
      ]
    );
  }

  _migrateV2(win) {
    if (Services.prefs.getBoolPref('zen.widget.windows.acrylic', false)) {
      Services.prefs.setIntPref('widget.windows.mica.toplevel-backdrop', 2);
      Services.prefs.clearUserPref('zen.widget.windows.acrylic');
    }
  }

  _migrateV3(win) {
    const kArea = win.CustomizableUI.AREA_TABSTRIP;
    const widgets = win.CustomizableUI.getWidgetsInArea(kArea);
    for (const widget of widgets) {
      const widgetId = widget.id;
      if (widgetId === 'tabbrowser-tabs') {
        continue;
      }
      win.CustomizableUI.removeWidgetFromArea(widgetId);
    }
  }

  _migrateV4(win) {
    Services.prefs.setBoolPref(
      'browser.tabs.unloadOnLowMemory',
      Services.prefs.getBoolPref('zen.tab-unloader.enabled', true)
    );
  }
}

export var gZenUIMigration = new ZenUIMigration();
