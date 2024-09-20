// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var gZenMarketplaceManager = {
  init() {
    const checkForUpdates = document.getElementById('zenThemeMarketplaceCheckForUpdates');
    if (!checkForUpdates) return; // We havent entered the settings page yet.
    if (this.__hasInitializedEvents) return;
    this._buildThemesList();
    this.__hasInitializedEvents = true;
    Services.prefs.addObserver(this.updatePref, this);
    checkForUpdates.addEventListener('click', (event) => {
      if (event.target === checkForUpdates) {
        event.preventDefault();
        this._checkForThemeUpdates(event);
      }
    });
    document.addEventListener('ZenThemeMarketplace:CheckForUpdatesFinished', (event) => {
      checkForUpdates.disabled = false;
      const updates = event.detail.updates;
      const success = document.getElementById('zenThemeMarketplaceUpdatesSuccess');
      const error = document.getElementById('zenThemeMarketplaceUpdatesFailure');
      if (updates) {
        success.hidden = false;
        error.hidden = true;
      } else {
        success.hidden = true;
        error.hidden = false;
      }
    });
    window.addEventListener('unload', this.uninit.bind(this));
  },

  uninit() {
    Services.prefs.removeObserver(this.updatePref, this);
  },

  async observe() {
    this._themes = null;
    await this._buildThemesList();
  },

  _checkForThemeUpdates(event) {
    // Send a message to the child to check for theme updates.
    event.target.disabled = true;
    // send an event that will be listened by the child process.
    document.dispatchEvent(new CustomEvent('ZenCheckForThemeUpdates'));
  },

  get updatePref() {
    return 'zen.themes.updated-value-observer';
  },

  triggerThemeUpdate() {
    Services.prefs.setBoolPref(this.updatePref, !Services.prefs.getBoolPref(this.updatePref));
  },

  get themesList() {
    return document.getElementById('zenThemeMarketplaceList');
  },

  async removeTheme(themeId) {
    const themePath = ZenThemesCommon.getThemeFolder(themeId);

    console.info(`[ZenThemeMarketplaceParent:settings]: Removing theme ${themePath}`);

    await IOUtils.remove(themePath, { recursive: true, ignoreAbsent: true });

    const themes = await ZenThemesCommon.getThemes();
    delete themes[themeId];
    await IOUtils.writeJSON(ZenThemesCommon.themesDataFile, themes);

    this.triggerThemeUpdate();
  },

  async disableTheme(themeId) {
    const themes = await ZenThemesCommon.getThemes();
    const theme = themes[themeId];

    theme.enabled = false;

    await IOUtils.writeJSON(ZenThemesCommon.themesDataFile, themes);
    this._doNotRebuildThemesList = true;
    this.triggerThemeUpdate();
  },

  async enableTheme(themeId) {
    const themes = await ZenThemesCommon.getThemes();
    const theme = themes[themeId];

    theme.enabled = true;

    await IOUtils.writeJSON(ZenThemesCommon.themesDataFile, themes);
    this._doNotRebuildThemesList = true;
    this.triggerThemeUpdate();
  },

  async _buildThemesList() {
    if (!this.themesList) return;
    if (this._doNotRebuildThemesList) {
      this._doNotRebuildThemesList = false;
      return;
    }

    console.log('[ZenThemeMarketplaceParent:settings]: Building themes list');

    let themes = await ZenThemesCommon.getThemes();

    const browser = ZenThemesCommon.getBrowser();

    const themeList = document.createElement('div');

    for (const theme of Object.values(themes)) {
      const sanitizedName = `theme-${theme.name?.replaceAll(/\s/g, '-')?.replaceAll(/[^A-z_-]+/g, '')}`;
      const isThemeEnabled = theme.enabled === undefined || theme.enabled;

      const fragment = window.MozXULElement.parseXULToFragment(`
        <vbox class="zenThemeMarketplaceItem">
          <vbox class="zenThemeMarketplaceItemContent">
            <hbox flex="1" id="zenThemeMarketplaceItemContentHeader">
              <label><h3 class="zenThemeMarketplaceItemTitle"></h3></label>
            </hbox>
            <description class="description-deemphasized zenThemeMarketplaceItemDescription"></description>
          </vbox>
          <hbox class="zenThemeMarketplaceItemActions">
            ${theme.preferences ? `<button id="zenThemeMarketplaceItemConfigureButton-${sanitizedName}" class="zenThemeMarketplaceItemConfigureButton" hidden="true"></button>` : ''}
            <button class="zenThemeMarketplaceItemUninstallButton" data-l10n-id="zen-theme-marketplace-remove-button" zen-theme-id="${theme.id}"></button>
          </hbox>
        </vbox>
      `);

      const themeName = `${theme.name} (v${theme.version || '1.0.0'})`;

      const base = fragment.querySelector('.zenThemeMarketplaceItem');
      const baseHeader = fragment.querySelector('#zenThemeMarketplaceItemContentHeader');

      const dialog = document.createElement('dialog');
      const mainDialogDiv = document.createElement('div');
      const headerDiv = document.createElement('div');
      const headerTitle = document.createElement('h3');
      const closeButton = document.createElement('button');
      const contentDiv = document.createElement('div');
      const mozToggle = document.createElement('moz-toggle');

      mainDialogDiv.className = 'zenThemeMarketplaceItemPreferenceDialog';
      headerDiv.className = 'zenThemeMarketplaceItemPreferenceDialogTopBar';
      headerTitle.textContent = themeName;
      browser.document.l10n.setAttributes(headerTitle, 'zen-theme-marketplace-theme-header-title', {
        name: sanitizedName,
      });
      headerTitle.className = 'zenThemeMarketplaceItemTitle';
      closeButton.id = `${sanitizedName}-modal-close`;
      browser.document.l10n.setAttributes(closeButton, 'zen-theme-marketplace-close-modal');
      contentDiv.id = `${sanitizedName}-preferences-content`;
      contentDiv.className = 'zenThemeMarketplaceItemPreferenceDialogContent';
      mozToggle.className = 'zenThemeMarketplaceItemPreferenceToggle';

      mozToggle.pressed = isThemeEnabled;
      browser.document.l10n.setAttributes(
        mozToggle,
        `zen-theme-marketplace-toggle-${isThemeEnabled ? 'enabled' : 'disabled'}-button`
      );

      baseHeader.appendChild(mozToggle);

      headerDiv.appendChild(headerTitle);
      headerDiv.appendChild(closeButton);

      mainDialogDiv.appendChild(headerDiv);
      mainDialogDiv.appendChild(contentDiv);
      dialog.appendChild(mainDialogDiv);
      base.appendChild(dialog);

      closeButton.addEventListener('click', () => {
        dialog.close();
      });

      mozToggle.addEventListener('toggle', async (event) => {
        const themeId = event.target
          .closest('.zenThemeMarketplaceItem')
          .querySelector('.zenThemeMarketplaceItemUninstallButton')
          .getAttribute('zen-theme-id');

        if (!event.target.hasAttribute('pressed')) {
          await this.disableTheme(themeId);

          browser.document.l10n.setAttributes(mozToggle, 'zen-theme-marketplace-toggle-disabled-button');

          if (theme.preferences) {
            document.getElementById(`zenThemeMarketplaceItemConfigureButton-${sanitizedName}`).setAttribute('hidden', true);
          }
        } else {
          await this.enableTheme(themeId);

          browser.document.l10n.setAttributes(mozToggle, 'zen-theme-marketplace-toggle-enabled-button');

          if (theme.preferences) {
            document.getElementById(`zenThemeMarketplaceItemConfigureButton-${sanitizedName}`).removeAttribute('hidden');
          }
        }
      });

      fragment.querySelector('.zenThemeMarketplaceItemTitle').textContent = themeName;
      fragment.querySelector('.zenThemeMarketplaceItemDescription').textContent = theme.description;
      fragment.querySelector('.zenThemeMarketplaceItemUninstallButton').addEventListener('click', async (event) => {
        const [msg] = await document.l10n.formatValues([{ id: 'zen-theme-marketplace-remove-confirmation' }]);

        if (!confirm(msg)) {
          return;
        }

        await this.removeTheme(event.target.getAttribute('zen-theme-id'));
      });

      if (theme.preferences) {
        fragment.querySelector('.zenThemeMarketplaceItemConfigureButton').addEventListener('click', () => {
          dialog.showModal();
        });

        if (isThemeEnabled) {
          fragment.querySelector('.zenThemeMarketplaceItemConfigureButton').removeAttribute('hidden');
        }
      }

      const preferences = await ZenThemesCommon.getThemePreferences(theme);

      if (preferences.length > 0) {
        const preferencesWrapper = document.createXULElement('vbox');

        preferencesWrapper.setAttribute('flex', '1');

        for (const entry of preferences) {
          const { property, label, type, placeholder } = entry;

          switch (type) {
            case 'dropdown': {
              const { options } = entry;

              const container = document.createXULElement('hbox');
              container.classList.add('zenThemeMarketplaceItemPreference');
              container.setAttribute('align', 'center');
              container.setAttribute('role', 'group');

              const menulist = document.createXULElement('menulist');
              const menupopup = document.createXULElement('menupopup');

              menulist.setAttribute('sizetopopup', 'none');
              menulist.setAttribute('id', property + '-popup-menulist');

              const savedValue = Services.prefs.getStringPref(property, 'none');

              menulist.setAttribute('value', savedValue);
              menulist.setAttribute('tooltiptext', property);

              const defaultItem = document.createXULElement('menuitem');

              defaultItem.setAttribute('value', 'none');

              if (placeholder) {
                defaultItem.setAttribute('label', placeholder || '-');
              } else {
                browser.document.l10n.setAttributes(defaultItem, 'zen-theme-marketplace-dropdown-default-label');
              }

              menupopup.appendChild(defaultItem);

              for (const option of options) {
                const { label, value } = option;

                const valueType = typeof value;

                if (!['string', 'number'].includes(valueType)) {
                  console.log(
                    `[ZenThemeMarketplaceParent:settings]: Warning, invalid data type received (${valueType}), skipping.`
                  );
                  continue;
                }

                const menuitem = document.createXULElement('menuitem');

                menuitem.setAttribute('value', value.toString());
                menuitem.setAttribute('label', label);

                menupopup.appendChild(menuitem);
              }

              menulist.appendChild(menupopup);

              menulist.addEventListener('command', () => {
                const value = menulist.selectedItem.value;

                let element = browser.document.getElementById(sanitizedName);

                if (!element) {
                  element = browser.document.createElement('div');

                  element.style.display = 'none';
                  element.setAttribute('id', sanitizedName);

                  browser.document.body.appendChild(element);
                }

                element.setAttribute(property?.replaceAll(/\./g, '-'), value);

                Services.prefs.setStringPref(property, value === 'none' ? '' : value);
              });

              const nameLabel = document.createXULElement('label');
              nameLabel.setAttribute('flex', '1');
              nameLabel.setAttribute('class', 'zenThemeMarketplaceItemPreferenceLabel');
              nameLabel.setAttribute('value', label);
              nameLabel.setAttribute('tooltiptext', property);

              container.appendChild(nameLabel);
              container.appendChild(menulist);
              container.setAttribute('aria-labelledby', label);

              preferencesWrapper.appendChild(container);
              break;
            }

            case 'checkbox': {
              const checkbox = window.MozXULElement.parseXULToFragment(`
                <hbox class="zenThemeMarketplaceItemPreference">
                  <checkbox class="zenThemeMarketplaceItemPreferenceCheckbox" label="${label}" tooltiptext="${property}" zen-pref="${property}"></checkbox>
                </hbox>
              `);

              // Checkbox only works with "true" and "false" values, it's not like HTML checkboxes.
              if (Services.prefs.getBoolPref(property, false)) {
                checkbox.querySelector('.zenThemeMarketplaceItemPreferenceCheckbox').setAttribute('checked', 'true');
              }

              checkbox.querySelector('.zenThemeMarketplaceItemPreferenceCheckbox').addEventListener('click', (event) => {
                const target = event.target.closest('.zenThemeMarketplaceItemPreferenceCheckbox');
                const key = target.getAttribute('zen-pref');
                const checked = target.hasAttribute('checked');

                if (!checked) {
                  target.removeAttribute('checked');
                } else {
                  target.setAttribute('checked', 'true');
                }

                Services.prefs.setBoolPref(key, !checked);
              });

              preferencesWrapper.appendChild(checkbox);
              break;
            }

            case 'string': {
              const container = document.createXULElement('hbox');
              container.classList.add('zenThemeMarketplaceItemPreference');
              container.setAttribute('align', 'center');
              container.setAttribute('role', 'group');

              const savedValue = Services.prefs.getStringPref(property, '');
              const sanitizedProperty = property?.replaceAll(/\./g, '-');

              const input = document.createElement('input');
              input.setAttribute('flex', '1');
              input.setAttribute('type', 'text');
              input.id = `${sanitizedProperty}-input`;
              input.value = savedValue;

              if (placeholder) {
                input.setAttribute('placeholder', placeholder || '-');
              } else {
                browser.document.l10n.setAttributes(input, 'zen-theme-marketplace-input-default-placeholder');
              }

              input.addEventListener(
                'input',
                ZenThemesCommon.throttle((event) => {
                  const value = event.target.value;

                  Services.prefs.setStringPref(property, value);

                  if (value === '') {
                    browser.document.querySelector(':root').style.removeProperty(`--${sanitizedProperty}`);
                  } else {
                    browser.document.querySelector(':root').style.setProperty(`--${sanitizedProperty}`, value);
                  }
                }, 500)
              );

              const nameLabel = document.createXULElement('label');
              nameLabel.setAttribute('flex', '1');
              nameLabel.setAttribute('class', 'zenThemeMarketplaceItemPreferenceLabel');
              nameLabel.setAttribute('value', label);
              nameLabel.setAttribute('tooltiptext', property);

              container.appendChild(nameLabel);
              container.appendChild(input);
              container.setAttribute('aria-labelledby', label);

              preferencesWrapper.appendChild(container);
              break;
            }

            default:
              console.log(
                `[ZenThemeMarketplaceParent:settings]: Warning, unknown preference type received (${type}), skipping.`
              );
              continue;
          }
        }
        contentDiv.appendChild(preferencesWrapper);
      }
      themeList.appendChild(fragment);
    }

    this.themesList.replaceChildren(...themeList.children);
    themeList.remove();
  },
};

var gZenLooksAndFeel = {
  init() {
    if (this.__hasInitialized) return;
    this.__hasInitialized = true;
    this._initializeColorPicker(this._getInitialAccentColor());
    window.zenPageAccentColorChanged = this._handleAccentColorChange.bind(this);
    this._initializeTabbarExpandForm();
    gZenThemeBuilder.init();
    gZenMarketplaceManager.init();
    var onPreferColorSchemeChange = this.onPreferColorSchemeChange.bind(this);
    window.matchMedia('(prefers-color-scheme: dark)').addListener(onPreferColorSchemeChange);
    this.onPreferColorSchemeChange();
    window.addEventListener('unload', () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeListener(onPreferColorSchemeChange);
    });
    setTimeout(() => {
      const group = document.getElementById('zenLooksAndFeelGroup');
      const webGroup = document.getElementById('webAppearanceGroup');
      webGroup.style.display = 'none';
      // Iterate reverse to prepend the elements in the correct order.
      for (let child of [...webGroup.children].reverse()) {
        group.prepend(child);
      }
    }, 500);
    this.setDarkThemeListener();
  },

  onPreferColorSchemeChange(event) {
    const darkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let elem = document.getElementById('ZenDarkThemeStyles');
    if (darkTheme) {
      elem.removeAttribute('hidden');
    } else {
      elem.setAttribute('hidden', 'true');
    }
  },

  setDarkThemeListener() {
    this.chooser = document.getElementById('zen-dark-theme-styles-form');
    this.radios = [...this.chooser.querySelectorAll('input')];
    for (let radio of this.radios) {
      if (radio.value === 'amoled' && Services.prefs.getBoolPref('zen.theme.color-prefs.amoled')) {
        radio.checked = true;
      } else if (radio.value === 'colorful' && Services.prefs.getBoolPref('zen.theme.color-prefs.colorful')) {
        radio.checked = true;
      } else if (
        radio.value === 'default' &&
        !Services.prefs.getBoolPref('zen.theme.color-prefs.amoled') &&
        !Services.prefs.getBoolPref('zen.theme.color-prefs.colorful')
      ) {
        radio.checked = true;
      }
      radio.addEventListener('change', (e) => {
        let value = e.target.value;
        switch (value) {
          case 'amoled':
            Services.prefs.setBoolPref('zen.theme.color-prefs.amoled', true);
            Services.prefs.setBoolPref('zen.theme.color-prefs.colorful', false);
            break;
          case 'colorful':
            Services.prefs.setBoolPref('zen.theme.color-prefs.amoled', false);
            Services.prefs.setBoolPref('zen.theme.color-prefs.colorful', true);
            break;
          default:
            Services.prefs.setBoolPref('zen.theme.color-prefs.amoled', false);
            Services.prefs.setBoolPref('zen.theme.color-prefs.colorful', false);
            break;
        }
      });
    }
  },

  _initializeTabbarExpandForm() {
    const form = document.getElementById('zen-expand-tabbar-strat');
    const radios = form.querySelectorAll('input[type=radio]');
    const onHoverPref = 'zen.view.sidebar-expanded.on-hover';
    const defaultExpandPref = 'zen.view.sidebar-expanded';
    if (Services.prefs.getBoolPref(onHoverPref)) {
      form.querySelector('input[value="hover"]').checked = true;
    } else if (Services.prefs.getBoolPref(defaultExpandPref)) {
      form.querySelector('input[value="expand"]').checked = true;
    } else {
      form.querySelector('input[value="none"]').checked = true;
    }
    for (let radio of radios) {
      radio.addEventListener('change', (e) => {
        switch (e.target.value) {
          case 'expand':
            Services.prefs.setBoolPref(onHoverPref, false);
            Services.prefs.setBoolPref(defaultExpandPref, true);
            break;
          case 'none':
            Services.prefs.setBoolPref(onHoverPref, false);
            Services.prefs.setBoolPref(defaultExpandPref, false);
            break;
          case 'hover':
            Services.prefs.setBoolPref(onHoverPref, true);
            Services.prefs.setBoolPref(defaultExpandPref, true);
            break;
        }
      });
    }
  },

  _initializeColorPicker(accentColor) {
    let elem = document.getElementById('zenLooksAndFeelColorOptions');
    elem.innerHTML = '';
    for (let color of ZenThemesCommon.kZenColors) {
      let colorElemParen = document.createElement('div');
      let colorElem = document.createElement('div');
      colorElemParen.classList.add('zenLooksAndFeelColorOptionParen');
      colorElem.classList.add('zenLooksAndFeelColorOption');
      colorElem.style.setProperty('--zen-primary-color', color, 'important');
      if (accentColor === color) {
        colorElemParen.setAttribute('selected', 'true');
      }
      colorElemParen.addEventListener('click', () => {
        Services.prefs.setStringPref('zen.theme.accent-color', color);
      });
      colorElemParen.appendChild(colorElem);
      elem.appendChild(colorElemParen);
    }
    // TODO: add custom color selection!
  },

  _handleAccentColorChange(accentColor) {
    this._initializeColorPicker(accentColor);
  },

  _getInitialAccentColor() {
    return Services.prefs.getStringPref('zen.theme.accent-color', ZenThemesCommon.kZenColors[0]);
  },
};

var gZenWorkspacesSettings = {
  init() {
    Services.prefs.addObserver('zen.workspaces.enabled', this);
    window.addEventListener('unload', () => {
      Services.prefs.removeObserver('zen.workspaces.enabled', this);
    });
  },

  async observe(subject, topic, data) {
    await this.onWorkspaceChange(Services.prefs.getBoolPref('zen.workspaces.enabled'));
  },

  async onWorkspaceChange(checked) {
    if (checked) {
      let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
      if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
        Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
        return;
      }
    }
  },
};

var gZenCKSSettings = {
  init() {
    this._currentAction = null;
    this._initializeEvents();
    this._initializeCKS();
    this._addPrefObservers();
    window.addEventListener('unload', () => {
      Services.prefs.removeObserver('zen.keyboard.shortcuts.disable-firefox', this);
    });
  },

  _addPrefObservers() {
    Services.prefs.addObserver('zen.keyboard.shortcuts.disable-firefox', this);
  },

  observe(subject, topic, data) {
    this.onDisableFirefoxShortcutsChange();
  },

  async onDisableFirefoxShortcutsChange(event) {
    let checked = Services.prefs.getBoolPref('zen.keyboard.shortcuts.disable-firefox');
    if (checked) return;
    let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
      return;
    }
  },

  _initializeCKS() {
    let wrapepr = document.getElementById('zenCKSOptions-wrapper');

    // Create the groups first.
    for (let key in kZKSActions) {
      const data = kZKSActions[key];
      const group = data[2];
      if (!wrapepr.querySelector(`[data-group="${group}"]`)) {
        let groupElem = document.createElement('h2');
        groupElem.setAttribute('data-group', group);
        document.l10n.setAttributes(groupElem, `zen-cks-group-${group}`);
        wrapepr.appendChild(groupElem);
      }
    }

    const keys = Object.keys(kZKSActions);
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      const data = kZKSActions[key];
      const l10nId = data[1];
      const group = data[2];
      let fragment = window.MozXULElement.parseXULToFragment(`
        <hbox class="zenCKSOption">
          <label class="zenCKSOption-label" for="zenCKSOption-${key}"></label>
          <html:input readonly="1" class="zenCKSOption-input" id="zenCKSOption-${key}" />
        </hbox>
      `);
      document.l10n.setAttributes(fragment.querySelector('.zenCKSOption-label'), l10nId);

      let input = fragment.querySelector('.zenCKSOption-input');
      let shortcut = gZenKeyboardShortcuts.getShortcut(key);
      if (shortcut) {
        input.value = gZenKeyboardShortcuts.shortCutToString(shortcut);
      } else {
        this._resetCKS(input, key);
      }

      input.setAttribute('data-key', key);
      input.addEventListener('focus', (event) => {
        const key = event.target.getAttribute('data-key');
        this._currentAction = key;
        event.target.classList.add('zenCKSOption-input-editing');
      });

      input.addEventListener('blur', (event) => {
        this._currentAction = null;
        event.target.classList.remove('zenCKSOption-input-editing');
      });

      const groupElem = wrapepr.querySelector(`[data-group="${group}"]`);
      groupElem.after(fragment);
    }
  },

  _resetCKS(input, key) {
    input.value = 'Not set';
    input.classList.add('zenCKSOption-input-not-set');
    input.classList.remove('zenCKSOption-input-invalid');
    gZenKeyboardShortcuts.setShortcut(key, null);
  },

  _initializeEvents() {
    window.addEventListener('keydown', this._handleKeyDown.bind(this));
  },

  _handleKeyDown(event) {
    if (!this._currentAction) {
      return;
    }

    let input = document.querySelector(`.zenCKSOption-input[data-key="${this._currentAction}"]`);
    let shortcut = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    };

    const shortcutWithoutModifiers = !shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta;

    if (event.key === 'Tab' && shortcutWithoutModifiers) {
      return;
    } else if (event.key === 'Escape' && shortcutWithoutModifiers) {
      this._currentAction = null;
      input.blur();
      return;
    } else if (event.key === 'Backspace' && shortcutWithoutModifiers) {
      this._resetCKS(input, this._currentAction);
      return;
    }

    if (!shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta) {
      this._resetCKS(input, this._currentAction);
      return; // No modifiers, ignore.
    }

    if (!['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) {
      if (event.keycode) {
        shortcut.keycode = event.keycode;
      } else {
        shortcut.key = event.key;
      }
    }

    event.preventDefault();
    gZenKeyboardShortcuts.setShortcut(this._currentAction, shortcut);

    input.value = gZenKeyboardShortcuts.shortCutToString(shortcut);
    input.classList.remove('zenCKSOption-input-not-set');

    if (gZenKeyboardShortcuts.isValidShortcut(shortcut)) {
      input.classList.remove('zenCKSOption-input-invalid');
    } else {
      input.classList.add('zenCKSOption-input-invalid');
    }
  },
};

Preferences.addAll([
  {
    id: 'zen.theme.toolbar-themed',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.sidebar.enabled',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.sidebar.close-on-blur',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.view.compact',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.view.compact.hide-toolbar',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.view.compact.toolbar-flash-popup',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.workspaces.enabled',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.view.sidebar-expanded.show-button',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.view.sidebar-expanded',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.theme.pill-button',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.keyboard.shortcuts.disable-firefox',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.workspaces.hide-default-container-indicator',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.workspaces.individual-pinned-tabs',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.workspaces.show-icon-strip',
    type: 'bool',
    default: true,
  }
]);
