export class ZenThemeMarketplaceParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenThemeMarketplace:InstallTheme': {
        console.info('ZenThemeMarketplaceParent: Updating themes');
        const theme = message.data.theme;
        theme.enabled = true;
        const themes = await this.getThemes();
        themes[theme.id] = theme;
        this.updateThemes(themes);
        this.updateChildProcesses(theme.id);
        break;
      }
      case 'ZenThemeMarketplace:UninstallTheme': {
        console.info('ZenThemeMarketplaceParent: Uninstalling theme');
        const themeId = message.data.themeId;
        const themes = await this.getThemes();
        delete themes[themeId];
        this.removeTheme(themeId);
        this.updateThemes(themes);
        this.updateChildProcesses(themeId);
        break;
      }
      case 'ZenThemeMarketplace:IsThemeInstalled': {
        const themeId = message.data.themeId;
        const themes = await this.getThemes();

        return Boolean(themes?.[themeId]);
      }
      case 'ZenThemeMarketplace:CheckForUpdates': {
        this.checkForThemeUpdates();
        break;
      }
      case 'ZenThemeMarketplace:RicePage': {
        this.openRicePage(this.browsingContext.topChromeWindow, message.data);
        break;
      }
    }
  }

  openRicePage(window, data) {
    window.gZenThemePicker.riceManager.openRicePage(data);
  }

  compareVersions(version1, version2) {
    let result = false;

    if (typeof version1 !== 'object') {
      version1 = version1.toString().split('.');
    }

    if (typeof version2 !== 'object') {
      version2 = version2.toString().split('.');
    }

    for (let i = 0; i < Math.max(version1.length, version2.length); i++) {
      if (version1[i] == undefined) {
        version1[i] = 0;
      }
      if (version2[i] == undefined) {
        version2[i] = 0;
      }
      if (Number(version1[i]) < Number(version2[i])) {
        result = true;
        break;
      }
      if (version1[i] != version2[i]) {
        break;
      }
    }
    return result;
  }

  async checkForThemeUpdates() {
    console.info('ZenThemeMarketplaceParent: Checking for theme updates');

    let updates = [];
    const themes = await this.getThemes();
    for (const theme of Object.values(themes)) {
      try {
        const themeInfo = await this.sendQuery('ZenThemeMarketplace:GetThemeInfo', {
          themeId: theme.id,
        });

        if (!themeInfo) {
          continue;
        }

        if (
          !this.compareVersions(themeInfo.version, theme.version || '0.0.0') &&
          themeInfo.version != theme.version
        ) {
          console.info(
            'ZenThemeMarketplaceParent: Theme update found',
            theme.id,
            theme.version,
            themeInfo.version
          );

          themeInfo.enabled = theme.enabled;
          updates.push(themeInfo);

          await this.removeTheme(theme.id, false);
          themes[themeInfo.id] = themeInfo;
        }
      } catch (e) {
        console.error('ZenThemeMarketplaceParent: Error checking for theme updates', e);
      }
    }

    await this.updateThemes(themes);

    this.sendAsyncMessage('ZenThemeMarketplace:CheckForUpdatesFinished', { updates });
  }

  async updateChildProcesses(themeId) {
    this.sendAsyncMessage('ZenThemeMarketplace:ThemeChanged', { themeId });
  }

  async getThemes() {
    return await IOUtils.readJSON(this.themesDataFile);
  }

  async updateThemes(themes = undefined) {
    if (!themes) {
      themes = await this.getThemes();
    }
    await IOUtils.writeJSON(this.themesDataFile, themes);
    await this.checkForThemeChanges();
  }

  getStyleSheetFullContent(style = '') {
    let stylesheet = '@-moz-document url-prefix("chrome:") {\n';

    for (const line of style.split('\n')) {
      stylesheet += `  ${line}\n`;
    }

    stylesheet += '}';

    return stylesheet;
  }

  async downloadUrlToFile(url, path, isStyleSheet = false, maxRetries = 3, retryDelayMs = 500) {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `ZenThemeMarketplaceParent: HTTP error! status: ${response.status} for url: ${url}`
          );
        }

        const data = await response.text();
        const content = isStyleSheet ? this.getStyleSheetFullContent(data) : data;
        // convert the data into a Uint8Array
        const buffer = new TextEncoder().encode(content);
        await IOUtils.write(path, buffer);

        return;
      } catch (e) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error('ZenThemeMarketplaceParent: Error downloading file after retries', url, e);
        } else {
          console.warn(
            `ZenThemeMarketplaceParent: Download failed (attempt ${attempt} of ${maxRetries}), retrying in ${retryDelayMs}ms...`,
            url,
            e
          );
          await new Promise((res) => setTimeout(res, retryDelayMs));
        }
      }
    }
  }

  async downloadThemeFileContents(theme) {
    try {
      const themePath = PathUtils.join(this.themesRootPath, theme.id);
      await IOUtils.makeDirectory(themePath, { ignoreExisting: true });

      await this.downloadUrlToFile(theme.style, PathUtils.join(themePath, 'chrome.css'), true);
      await this.downloadUrlToFile(theme.readme, PathUtils.join(themePath, 'readme.md'));

      if (theme.preferences) {
        await this.downloadUrlToFile(
          theme.preferences,
          PathUtils.join(themePath, 'preferences.json')
        );
      }
    } catch (e) {
      console.log('ZenThemeMarketplaceParent: Error downloading theme file contents', theme.id, e);
    }
  }

  get themesRootPath() {
    return PathUtils.join(PathUtils.profileDir, 'chrome', 'zen-themes');
  }

  get themesDataFile() {
    return PathUtils.join(PathUtils.profileDir, 'zen-themes.json');
  }

  triggerThemeUpdate() {
    const pref = 'zen.themes.updated-value-observer';
    Services.prefs.setBoolPref(pref, !Services.prefs.getBoolPref(pref));
  }

  async installTheme(theme) {
    try {
      await this.downloadThemeFileContents(theme);
    } catch (e) {
      console.error('ZenThemeMarketplaceParent: Error installing theme', theme.id, e);
    }
  }

  async checkForThemeChanges() {
    const themes = await this.getThemes();

    const themeIds = Object.keys(themes);

    for (const themeId of themeIds) {
      try {
        const theme = themes[themeId];
        if (!theme) {
          continue;
        }

        const themePath = PathUtils.join(this.themesRootPath, themeId);
        if (!(await IOUtils.exists(themePath))) {
          await this.installTheme(theme);
        }
      } catch (e) {
        console.error('ZenThemeMarketplaceParent: Error checking for theme changes', e);
      }
    }

    this.triggerThemeUpdate();
  }

  async removeTheme(themeId, triggerUpdate = true) {
    const themePath = PathUtils.join(this.themesRootPath, themeId);
    await IOUtils.remove(themePath, { recursive: true, ignoreAbsent: true });

    if (triggerUpdate) {
      this.triggerThemeUpdate();
    }
  }
}
