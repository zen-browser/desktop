// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var ZenThemesCommon = {
  kZenColors: [
    '#aac7ff',
    '#74d7cb',
    '#a0d490',
    '#dec663',
    '#ffb787',
    '#dec1b1',
    '#ffb1c0',
    '#ddbfc3',
    '#f6b0ea',
    '#d4bbff',
  ],

  get browsers() {
    return Services.wm.getEnumerator('navigator:browser');
  },

  get currentBrowser() {
    return Services.wm.getMostRecentWindow('navigator:browser');
  },

  get themesRootPath() {
    return PathUtils.join(PathUtils.profileDir, 'chrome', 'zen-themes');
  },

  get themesDataFile() {
    return PathUtils.join(PathUtils.profileDir, 'zen-themes.json');
  },

  getThemeFolder(themeId) {
    return PathUtils.join(this.themesRootPath, themeId);
  },

  async getThemes() {
    if (!(await IOUtils.exists(this.themesDataFile))) {
      await IOUtils.writeJSON(this.themesDataFile, {});
    }

    let themes = {};
    try {
      themes = await IOUtils.readJSON(this.themesDataFile);
      if (themes === null || typeof themes !== 'object') {
        throw new Error('Themes data file is null');
      }
    } catch (e) {
      // If we have a corrupted file, reset it
      await IOUtils.writeJSON(this.themesDataFile, {});
      Services.wm
        .getMostRecentWindow('navigator:browser')
        .gZenUIManager.showToast('zen-themes-corrupted', {
          timeout: 8000,
        });
    }
    return themes;
  },

  async getThemePreferences(theme) {
    const themePath = PathUtils.join(this.themesRootPath, theme.id, 'preferences.json');
    if (!(await IOUtils.exists(themePath)) || !theme.preferences) {
      return [];
    }

    const preferences = await IOUtils.readJSON(themePath);

    // compat mode for old preferences, all of them can only be checkboxes
    if (typeof preferences === 'object' && !Array.isArray(preferences)) {
      console.warn(
        `[ZenThemes]: Warning, ${theme.name} uses legacy preferences, please migrate them to the new preferences style, as legacy preferences might be removed at a future release. More information at: https://docs.zen-browser.app/themes-store/themes-marketplace-preferences`
      );
      const newThemePreferences = [];

      for (let [entry, label] of Object.entries(preferences)) {
        const [_, negation = '', os = '', property] =
          /(!?)(?:(macos|windows|linux):)?([A-Za-z0-9-_.]+)/g.exec(entry);
        const isNegation = negation === '!';

        if (
          (isNegation && os === gZenOperatingSystemCommonUtils.currentOperatingSystem) ||
          (os !== '' && os !== gZenOperatingSystemCommonUtils.currentOperatingSystem && !isNegation)
        ) {
          continue;
        }

        newThemePreferences.push({
          property,
          label,
          type: 'checkbox',
          disabledOn: os !== '' ? [os] : [],
        });
      }

      return newThemePreferences;
    }

    return preferences.filter(
      ({ disabledOn = [] }) =>
        !disabledOn.includes(gZenOperatingSystemCommonUtils.currentOperatingSystem)
    );
  },

  throttle(mainFunction, delay) {
    let timerFlag = null;

    return (...args) => {
      if (timerFlag === null) {
        mainFunction(...args);
        timerFlag = setTimeout(() => {
          timerFlag = null;
        }, delay);
      }
    };
  },

  debounce(mainFunction, wait) {
    let timerFlag;

    return (...args) => {
      clearTimeout(timerFlag);
      timerFlag = setTimeout(() => {
        mainFunction(...args);
      }, wait);
    };
  },
};
