/* eslint-disable no-undef */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const { nsZenMultiWindowFeature } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenCommonUtils.mjs",
  { global: "current" }
);

const { nsKeyShortcutModifiers } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenKeyboardShortcuts.mjs",
  {
    global: "current",
  }
);

var gZenMarketplaceManager = {
  async init() {
    const checkForUpdates = document.getElementById("zenThemeMarketplaceCheckForUpdates");
    const header = document.getElementById("zenMarketplaceHeader");

    if (!checkForUpdates || !header) {
      return; // We haven't entered the settings page yet.
    }

    if (this.__hasInitializedEvents) {
      return;
    }

    if (!window.gZenMods) {
      window.gZenMods = nsZenMultiWindowFeature.currentBrowser.gZenMods;
    }

    header.appendChild(this._initDisableAll());

    this._initImportExport();

    this.__hasInitializedEvents = true;

    await this._buildModsList();

    Services.prefs.addObserver(gZenMods.updatePref, this);

    const checkForUpdateClick = (event) => {
      if (event.target === checkForUpdates) {
        event.preventDefault();

        this._checkForThemeUpdates(event);
      }
    };

    checkForUpdates.addEventListener("click", checkForUpdateClick);

    document.addEventListener("ZenModsMarketplace:CheckForUpdatesFinished", (event) => {
      checkForUpdates.disabled = false;

      const updates = event.detail.updates;
      const success = document.getElementById("zenThemeMarketplaceUpdatesSuccess");
      const error = document.getElementById("zenThemeMarketplaceUpdatesFailure");

      if (updates) {
        success.hidden = false;
        error.hidden = true;
      } else {
        success.hidden = true;
        error.hidden = false;
      }
    });

    window.addEventListener("unload", () => {
      Services.prefs.removeObserver(gZenMods.updatePref, this);
      this.__hasInitializedEvents = false;

      document.removeEventListener("ZenModsMarketplace:CheckForUpdatesFinished", this);
      document.removeEventListener("ZenCheckForModUpdates", this);

      checkForUpdates.removeEventListener("click", checkForUpdateClick);

      this.modsList.innerHTML = "";
      this._doNotRebuildModsList = false;
    });
  },

  _initImportExport() {
    const importButton = document.getElementById("zenThemeMarketplaceImport");
    const exportButton = document.getElementById("zenThemeMarketplaceExport");

    if (importButton) {
      importButton.addEventListener("click", this._importThemes.bind(this));
    }

    if (exportButton) {
      exportButton.addEventListener("click", this._exportThemes.bind(this));
    }
  },

  _initDisableAll() {
    const areModsDisabled = Services.prefs.getBoolPref("zen.themes.disable-all", false);
    const browser = nsZenMultiWindowFeature.currentBrowser;
    const mozToggle = document.createElement("moz-toggle");

    mozToggle.className =
      "zenThemeMarketplaceItemPreferenceToggle zenThemeMarketplaceDisableAllToggle";
    mozToggle.pressed = !areModsDisabled;

    browser.document.l10n.setAttributes(
      mozToggle,
      `zen-theme-disable-all-${!areModsDisabled ? "enabled" : "disabled"}`
    );

    mozToggle.addEventListener("toggle", async (event) => {
      const { pressed = false } = event.target || {};

      this.modsList.style.display = pressed ? "" : "none";
      Services.prefs.setBoolPref("zen.themes.disable-all", !pressed);
      browser.document.l10n.setAttributes(
        mozToggle,
        `zen-theme-disable-all-${pressed ? "enabled" : "disabled"}`
      );
    });

    if (areModsDisabled) {
      this.modsList.style.display = "none";
    }

    return mozToggle;
  },

  async observe() {
    await this._buildModsList();
  },

  _checkForThemeUpdates(event) {
    // Send a message to the child to check for theme updates.
    event.target.disabled = true;
    // send an event that will be listened by the child process.
    document.dispatchEvent(new CustomEvent("ZenCheckForModUpdates"));
  },

  get modsList() {
    if (!this._modsList) {
      this._modsList = document.getElementById("zenThemeMarketplaceList");
    }
    return this._modsList;
  },

  _triggerBuildUpdateWithoutRebuild() {
    this._doNotRebuildModsList = true;
    gZenMods.triggerModsUpdate();
  },

  async removeMod(modId) {
    await gZenMods.removeMod(modId);

    gZenMods.triggerModsUpdate();
  },

  async disableMod(modId) {
    await gZenMods.disableMod(modId);

    this._triggerBuildUpdateWithoutRebuild();
  },

  async enableMod(modId) {
    await gZenMods.enableMod(modId);

    this._triggerBuildUpdateWithoutRebuild();
  },

  async _importThemes() {
    const errorBox = document.getElementById("zenThemeMarketplaceImportFailure");
    const successBox = document.getElementById("zenThemeMarketplaceImportSuccess");

    successBox.hidden = true;
    errorBox.hidden = true;

    const input = document.createElement("input");

    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";
    input.setAttribute("moz-accept", ".json");
    input.setAttribute("accept", ".json");

    let timeout;

    const filePromise = new Promise((resolve) => {
      input.addEventListener("change", (event) => {
        if (timeout) {
          clearTimeout(timeout);
        }

        const file = event.target.files[0];
        resolve(file);
      });

      timeout = setTimeout(() => {
        console.warn("[ZenSettings:ZenMods]: Import timeout reached, aborting.");
        resolve(null);
      }, 60000);
    });

    input.addEventListener("cancel", () => {
      console.warn("[ZenSettings:ZenMods]: Import cancelled by user.");
      clearTimeout(timeout);
    });

    input.click();

    try {
      const file = await filePromise;

      if (!file) {
        return;
      }

      const content = await file.text();

      const mods = JSON.parse(content);

      for (const mod of Object.values(mods)) {
        mod.modId = mod.id;
        await window.ZenInstallMod(mod);
      }
    } catch (error) {
      console.error("[ZenSettings:ZenMods]: Error while importing mods:", error);
      errorBox.hidden = false;
    }

    if (input) {
      input.remove();
    }
  },

  async _exportThemes() {
    const errorBox = document.getElementById("zenThemeMarketplaceExportFailure");
    const successBox = document.getElementById("zenThemeMarketplaceExportSuccess");

    successBox.hidden = true;
    errorBox.hidden = true;

    let temporalAnchor, temporalUrl;
    try {
      const mods = await gZenMods.getMods();
      const modsJson = JSON.stringify(mods, null, 2);
      const blob = new Blob([modsJson], { type: "application/json" });

      temporalUrl = URL.createObjectURL(blob);
      // Creating a link to download the JSON file
      temporalAnchor = document.createElement("a");
      temporalAnchor.href = temporalUrl;
      temporalAnchor.download = "zen-mods-export.json";

      document.body.appendChild(temporalAnchor);
      temporalAnchor.click();
      temporalAnchor.remove();

      successBox.hidden = false;
    } catch (error) {
      console.error("[ZenSettings:ZenMods]: Error while exporting mods:", error);
      errorBox.hidden = false;
    }

    if (temporalAnchor) {
      temporalAnchor.remove();
    }

    if (temporalUrl) {
      URL.revokeObjectURL(temporalUrl);
    }
  },

  async _buildModsList() {
    if (!this.modsList) {
      return;
    }

    if (this._doNotRebuildModsList) {
      this._doNotRebuildModsList = false;
      return;
    }

    const mods = await gZenMods.getMods();
    const browser = nsZenMultiWindowFeature.currentBrowser;
    const modList = document.createElement("div");

    for (const mod of Object.values(mods).sort((a, b) => a.name.localeCompare(b.name))) {
      const sanitizedName = gZenMods.sanitizeModName(mod.name);
      const isModEnabled = mod.enabled === undefined || mod.enabled;
      const fragment = window.MozXULElement.parseXULToFragment(`
        <vbox class="zenThemeMarketplaceItem">
          <vbox class="zenThemeMarketplaceItemContent">
            <hbox flex="1" id="zenThemeMarketplaceItemContentHeader">
              <label><h3 class="zenThemeMarketplaceItemTitle"></h3></label>
            </hbox>
            <description class="description-deemphasized zenThemeMarketplaceItemDescription"></description>
          </vbox>
          <hbox class="zenThemeMarketplaceItemActions">
            ${mod.preferences ? `<button id="zenThemeMarketplaceItemConfigureButton-${sanitizedName}" class="zenThemeMarketplaceItemConfigureButton" hidden="true"></button>` : ""}
            ${mod.homepage ? `<button id="zenThemeMarketplaceItemHomePageLink-${sanitizedName}" class="zenThemeMarketplaceItemHomepageButton" zen-mod-id="${mod.id}"></button>` : ""}
            <button class="zenThemeMarketplaceItemUninstallButton" data-l10n-id="zen-theme-marketplace-remove-button" zen-mod-id="${mod.id}"></button>
          </hbox>
        </vbox>
      `);

      const modName = `${mod.name} (v${mod.version ?? "1.0.0"})`;

      const base = fragment.querySelector(".zenThemeMarketplaceItem");
      const baseHeader = fragment.querySelector("#zenThemeMarketplaceItemContentHeader");

      const dialog = document.createElement("dialog");
      const mainDialogDiv = document.createElement("div");
      const headerDiv = document.createElement("div");
      const headerTitle = document.createElement("h3");
      const closeButton = document.createElement("button");
      const contentDiv = document.createElement("div");
      const mozToggle = document.createElement("moz-toggle");

      mainDialogDiv.className = "zenThemeMarketplaceItemPreferenceDialog";
      headerDiv.className = "zenThemeMarketplaceItemPreferenceDialogTopBar";
      headerTitle.textContent = modName;
      browser.document.l10n.setAttributes(headerTitle, "zen-theme-marketplace-theme-header-title", {
        name: sanitizedName,
      });
      headerTitle.className = "zenThemeMarketplaceItemTitle";
      closeButton.id = `${sanitizedName}-modal-close`;
      browser.document.l10n.setAttributes(closeButton, "zen-theme-marketplace-close-modal");
      contentDiv.id = `${sanitizedName}-preferences-content`;
      contentDiv.className = "zenThemeMarketplaceItemPreferenceDialogContent";
      mozToggle.className = "zenThemeMarketplaceItemPreferenceToggle";

      mozToggle.pressed = isModEnabled;
      browser.document.l10n.setAttributes(
        mozToggle,
        `zen-theme-marketplace-toggle-${isModEnabled ? "enabled" : "disabled"}-button`
      );

      baseHeader.appendChild(mozToggle);

      headerDiv.appendChild(headerTitle);
      headerDiv.appendChild(closeButton);

      mainDialogDiv.appendChild(headerDiv);
      mainDialogDiv.appendChild(contentDiv);
      dialog.appendChild(mainDialogDiv);
      base.appendChild(dialog);

      closeButton.addEventListener("click", () => {
        dialog.close();
      });

      mozToggle.addEventListener("toggle", async (event) => {
        const modId = event.target
          .closest(".zenThemeMarketplaceItem")
          .querySelector(".zenThemeMarketplaceItemUninstallButton")
          .getAttribute("zen-mod-id");
        event.target.setAttribute("disabled", true);

        if (!event.target.hasAttribute("pressed")) {
          await this.disableMod(modId);

          browser.document.l10n.setAttributes(
            mozToggle,
            "zen-theme-marketplace-toggle-disabled-button"
          );

          if (mod.preferences) {
            document
              .getElementById(`zenThemeMarketplaceItemConfigureButton-${sanitizedName}`)
              .setAttribute("hidden", true);
          }
        } else {
          await this.enableMod(modId);

          browser.document.l10n.setAttributes(
            mozToggle,
            "zen-theme-marketplace-toggle-enabled-button"
          );

          if (mod.preferences) {
            document
              .getElementById(`zenThemeMarketplaceItemConfigureButton-${sanitizedName}`)
              .removeAttribute("hidden");
          }
        }
        setTimeout(() => {
          // We use a timeout to make sure the theme list has been updated before re-enabling the button.
          event.target.removeAttribute("disabled");
        }, 400);
      });

      fragment.querySelector(".zenThemeMarketplaceItemTitle").textContent = modName;
      fragment.querySelector(".zenThemeMarketplaceItemDescription").textContent = mod.description;
      fragment
        .querySelector(".zenThemeMarketplaceItemUninstallButton")
        .addEventListener("click", async (event) => {
          const [msg] = await document.l10n.formatValues([
            { id: "zen-theme-marketplace-remove-confirmation" },
          ]);

          if (!confirm(msg)) {
            return;
          }

          await this.removeMod(event.target.getAttribute("zen-mod-id"));
        });

      if (mod.homepage) {
        const homepageButton = fragment.querySelector(".zenThemeMarketplaceItemHomepageButton");
        homepageButton.addEventListener("click", () => {
          // open the homepage url in a new tab
          const url = mod.homepage;

          window.open(url, "_blank");
        });
      }

      if (mod.preferences) {
        fragment
          .querySelector(".zenThemeMarketplaceItemConfigureButton")
          .addEventListener("click", () => {
            dialog.showModal();
          });

        if (isModEnabled) {
          fragment
            .querySelector(".zenThemeMarketplaceItemConfigureButton")
            .removeAttribute("hidden");
        }
      }

      const preferences = await gZenMods.getModPreferences(mod);

      if (preferences.length) {
        const preferencesWrapper = document.createXULElement("vbox");

        preferencesWrapper.setAttribute("flex", "1");

        for (const entry of preferences) {
          const { property, label, type, placeholder, defaultValue } = entry;

          switch (type) {
            case "dropdown": {
              const { options } = entry;

              const container = document.createXULElement("hbox");
              container.classList.add("zenThemeMarketplaceItemPreference");
              container.setAttribute("align", "center");
              container.setAttribute("role", "group");

              const menulist = document.createXULElement("menulist");
              const menupopup = document.createXULElement("menupopup");

              menulist.setAttribute("sizetopopup", "none");
              menulist.setAttribute("id", property + "-popup-menulist");

              const savedValue = Services.prefs.getStringPref(property, defaultValue ?? "none");

              menulist.setAttribute("value", savedValue);
              menulist.setAttribute("tooltiptext", property);

              const defaultItem = document.createXULElement("menuitem");

              defaultItem.setAttribute("value", "none");

              if (placeholder) {
                defaultItem.setAttribute("label", placeholder || "-");
              } else {
                browser.document.l10n.setAttributes(
                  defaultItem,
                  "zen-theme-marketplace-dropdown-default-label"
                );
              }

              menupopup.appendChild(defaultItem);

              for (const option of options) {
                let { label: optionLabel, value } = option;
                let valueType = typeof value;

                if (!["string", "number"].includes(valueType)) {
                  console.warn(
                    `[ZenSettings:ZenMods]: Warning, invalid data type received (${valueType}), skipping.`
                  );
                  continue;
                }

                let menuitem = document.createXULElement("menuitem");

                menuitem.setAttribute("value", value.toString());
                menuitem.setAttribute("label", optionLabel);

                menupopup.appendChild(menuitem);
              }

              menulist.appendChild(menupopup);

              menulist.addEventListener("command", () => {
                const value = menulist.selectedItem.value;

                let element = browser.document.getElementById(sanitizedName);

                if (!element) {
                  element = browser.document.createElement("div");

                  element.style.display = "none";
                  element.setAttribute("id", sanitizedName);

                  browser.document.body.appendChild(element);
                }

                element.setAttribute(property?.replaceAll(/\./g, "-"), value);

                Services.prefs.setStringPref(property, value === "none" ? "" : value);
                this._triggerBuildUpdateWithoutRebuild();
              });

              const nameLabel = document.createXULElement("label");
              nameLabel.setAttribute("flex", "1");
              nameLabel.setAttribute("class", "zenThemeMarketplaceItemPreferenceLabel");
              nameLabel.setAttribute("value", label);
              nameLabel.setAttribute("tooltiptext", property);

              container.appendChild(nameLabel);
              container.appendChild(menulist);
              container.setAttribute("aria-labelledby", label);

              preferencesWrapper.appendChild(container);
              break;
            }

            case "checkbox": {
              const checkbox = window.MozXULElement.parseXULToFragment(`
                <hbox class="zenThemeMarketplaceItemPreference">
                  <checkbox class="zenThemeMarketplaceItemPreferenceCheckbox"></checkbox>
                </hbox>
              `);

              const checkboxElement = checkbox.querySelector(
                ".zenThemeMarketplaceItemPreferenceCheckbox"
              );
              checkboxElement.setAttribute("label", label);
              checkboxElement.setAttribute("tooltiptext", property);
              checkboxElement.setAttribute("zen-pref", property);

              // Checkbox only works with "true" and "false" values, it's not like HTML checkboxes.
              if (Services.prefs.getBoolPref(property, defaultValue ?? false)) {
                checkboxElement.setAttribute("checked", "true");
              }

              checkboxElement.addEventListener("click", (event) => {
                const target = event.target.closest(".zenThemeMarketplaceItemPreferenceCheckbox");
                const key = target.getAttribute("zen-pref");
                const checked = target.hasAttribute("checked");

                if (!checked) {
                  target.removeAttribute("checked");
                } else {
                  target.setAttribute("checked", "true");
                }

                Services.prefs.setBoolPref(key, !checked);
              });

              preferencesWrapper.appendChild(checkbox);
              break;
            }

            case "string": {
              const container = document.createXULElement("hbox");
              container.classList.add("zenThemeMarketplaceItemPreference");
              container.setAttribute("align", "center");
              container.setAttribute("role", "group");

              const savedValue = Services.prefs.getStringPref(property, defaultValue ?? "");
              const sanitizedProperty = property?.replaceAll(/\./g, "-");

              const input = document.createElement("input");
              input.setAttribute("flex", "1");
              input.setAttribute("type", "text");
              input.id = `${sanitizedProperty}-input`;
              input.value = savedValue;

              if (placeholder) {
                input.setAttribute("placeholder", placeholder || "-");
              } else {
                browser.document.l10n.setAttributes(
                  input,
                  "zen-theme-marketplace-input-default-placeholder"
                );
              }

              input.addEventListener(
                "change",
                gZenMods.debounce((event) => {
                  const value = event.target.value;

                  Services.prefs.setStringPref(property, value);
                  this._triggerBuildUpdateWithoutRebuild();

                  if (value === "") {
                    browser.document
                      .querySelector(":root")
                      .style.removeProperty(`--${sanitizedProperty}`);
                  } else {
                    browser.document
                      .querySelector(":root")
                      .style.setProperty(`--${sanitizedProperty}`, value);
                  }
                }, 500)
              );

              const nameLabel = document.createXULElement("label");
              nameLabel.setAttribute("flex", "1");
              nameLabel.setAttribute("class", "zenThemeMarketplaceItemPreferenceLabel");
              nameLabel.setAttribute("value", label);
              nameLabel.setAttribute("tooltiptext", property);

              container.appendChild(nameLabel);
              container.appendChild(input);
              container.setAttribute("aria-labelledby", label);

              preferencesWrapper.appendChild(container);
              break;
            }

            default:
              console.warn(
                `[ZenSettings:ZenMods]: Warning, unknown preference type received (${type}), skipping.`
              );
              continue;
          }
        }
        contentDiv.appendChild(preferencesWrapper);
      }
      modList.appendChild(fragment);
    }

    this.modsList.replaceChildren(...modList.children);
    modList.remove();
  },
};

const kZenExtendedSidebar = "zen.view.sidebar-expanded";
const kZenSingleToolbar = "zen.view.use-single-toolbar";

var gZenLooksAndFeel = {
  init() {
    if (this.__hasInitialized) {
      return;
    }
    this.__hasInitialized = true;
    gZenMarketplaceManager.init();
    for (const pref of [kZenExtendedSidebar, kZenSingleToolbar]) {
      Services.prefs.addObserver(pref, this);
    }
    window.addEventListener("unload", () => {
      for (const pref of [kZenExtendedSidebar, kZenSingleToolbar]) {
        Services.prefs.removeObserver(pref, this);
      }
    });
    this.applySidebarLayout();
  },

  observe() {
    this.applySidebarLayout();
  },

  applySidebarLayout() {
    const isSingleToolbar = Services.prefs.getBoolPref(kZenSingleToolbar);
    const isExtendedSidebar = Services.prefs.getBoolPref(kZenExtendedSidebar);
    for (const layout of document.getElementById("zenLayoutList").children) {
      layout.classList.remove("selected");
      if (layout.getAttribute("layout") == "single" && isSingleToolbar) {
        layout.classList.add("selected");
      } else if (
        layout.getAttribute("layout") == "multiple" &&
        !isSingleToolbar &&
        isExtendedSidebar
      ) {
        layout.classList.add("selected");
      } else if (layout.getAttribute("layout") == "collapsed" && !isExtendedSidebar) {
        layout.classList.add("selected");
      }
    }
    if (this.__hasInitializedLayout) {
      return;
    }
    this.__hasInitializedLayout = true;
    for (const layout of document.getElementById("zenLayoutList").children) {
      layout.addEventListener("click", () => {
        if (layout.hasAttribute("disabled")) {
          return;
        }

        for (const el of document.getElementById("zenLayoutList").children) {
          el.classList.remove("selected");
        }

        layout.classList.add("selected");

        Services.prefs.setBoolPref(
          kZenExtendedSidebar,
          layout.getAttribute("layout") != "collapsed"
        );
        Services.prefs.setBoolPref(kZenSingleToolbar, layout.getAttribute("layout") == "single");
      });
    }
  },
};

var gZenWorkspacesSettings = {
  init() {
    var tabsUnloaderPrefListener = {
      async observe() {
        let buttonIndex = await confirmRestartPrompt(true, 1, true, true);
        if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
          Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
        }
      },
    };

    let toggleZenCycleByAttrWarning = {
      observe() {
        const warning = document.getElementById("zenTabsCycleByAttributeWarning");
        warning.hidden = !(
          Services.prefs.getBoolPref("zen.tabs.ctrl-tab.ignore-essential-tabs", false) &&
          Services.prefs.getBoolPref("browser.ctrlTab.sortByRecentlyUsed", false)
        );
      },
    };

    toggleZenCycleByAttrWarning.observe(); // call it once on initial load

    Services.prefs.addObserver("zen.glance.enabled", tabsUnloaderPrefListener); // We can use the same listener for both prefs
    Services.prefs.addObserver("zen.workspaces.separate-essentials", tabsUnloaderPrefListener);
    Services.prefs.addObserver("zen.glance.activation-method", tabsUnloaderPrefListener);
    Services.prefs.addObserver("zen.window-sync.sync-only-pinned-tabs", tabsUnloaderPrefListener);
    Services.prefs.addObserver(
      "zen.tabs.ctrl-tab.ignore-essential-tabs",
      toggleZenCycleByAttrWarning
    );
    Services.prefs.addObserver("browser.ctrlTab.sortByRecentlyUsed", toggleZenCycleByAttrWarning);
    window.addEventListener("unload", () => {
      Services.prefs.removeObserver("zen.glance.enabled", tabsUnloaderPrefListener);
      Services.prefs.removeObserver("zen.glance.activation-method", tabsUnloaderPrefListener);
      Services.prefs.removeObserver("zen.workspaces.separate-essentials", tabsUnloaderPrefListener);
      Services.prefs.removeObserver(
        "zen.window-sync.sync-only-pinned-tabs",
        tabsUnloaderPrefListener
      );
      Services.prefs.removeObserver(
        "zen.tabs.ctrl-tab.ignore-essential-tabs",
        toggleZenCycleByAttrWarning
      );
      Services.prefs.removeObserver(
        "browser.ctrlTab.sortByRecentlyUsed",
        toggleZenCycleByAttrWarning
      );
    });
  },
};

const ZEN_CKS_CLASS_BASE = "zenCKSOption";
const ZEN_CKS_INPUT_FIELD_CLASS = `${ZEN_CKS_CLASS_BASE}-input`;
const ZEN_CKS_LABEL_CLASS = `${ZEN_CKS_CLASS_BASE}-label`;
const ZEN_CKS_WRAPPER_ID = `${ZEN_CKS_CLASS_BASE}-wrapper`;
const ZEN_CKS_GROUP_PREFIX = `${ZEN_CKS_CLASS_BASE}-group`;
const KEYBIND_ATTRIBUTE_KEY = "key";

const zenMissingKeyboardShortcutL10n = {
  key_quickRestart: "zen-key-quick-restart",
  key_delete: "zen-key-delete",
  goBackKb: "zen-key-go-back",
  goForwardKb: "zen-key-go-forward",
  key_enterFullScreen: "zen-key-enter-full-screen",
  key_exitFullScreen: "zen-key-exit-full-screen",
  key_aboutProcesses: "zen-key-about-processes",
  key_sanitize: "zen-key-sanitize",
  key_wrCaptureCmd: "zen-key-wr-capture-cmd",
  key_wrToggleCaptureSequenceCmd: "zen-key-wr-toggle-capture-sequence-cmd",
  key_undoCloseWindow: "zen-key-undo-close-window",

  "zen-glance-expand": "zen-glance-expand",

  key_selectTab1: "zen-key-select-tab-1",
  key_selectTab2: "zen-key-select-tab-2",
  key_selectTab3: "zen-key-select-tab-3",
  key_selectTab4: "zen-key-select-tab-4",
  key_selectTab5: "zen-key-select-tab-5",
  key_selectTab6: "zen-key-select-tab-6",
  key_selectTab7: "zen-key-select-tab-7",
  key_selectTab8: "zen-key-select-tab-8",
  key_selectLastTab: "zen-key-select-tab-last",

  key_showAllTabs: "zen-key-show-all-tabs",
  key_gotoHistory: "zen-key-goto-history",

  goHome: "zen-key-go-home",
  key_redo: "zen-key-redo",

  key_inspectorMac: "zen-key-inspector-mac",

  // Devtools
  key_toggleToolbox: "zen-devtools-toggle-shortcut",
  key_browserToolbox: "zen-devtools-toggle-browser-toolbox-shortcut",
  key_browserConsole: "zen-devtools-toggle-browser-console-shortcut",
  key_responsiveDesignMode: "zen-devtools-toggle-responsive-design-mode-shortcut",
  key_inspector: "zen-devtools-toggle-inspector-shortcut",
  key_webconsole: "zen-devtools-toggle-web-console-shortcut",
  key_jsdebugger: "zen-devtools-toggle-js-debugger-shortcut",
  key_netmonitor: "zen-devtools-toggle-net-monitor-shortcut",
  key_styleeditor: "zen-devtools-toggle-style-editor-shortcut",
  key_performance: "zen-devtools-toggle-performance-shortcut",
  key_storage: "zen-devtools-toggle-storage-shortcut",
  key_dom: "zen-devtools-toggle-dom-shortcut",
  key_accessibility: "zen-devtools-toggle-accessibility-shortcut",
};

var zenIgnoreKeyboardShortcutIDs = [
  "key_enterFullScreen_old",
  "key_enterFullScreen_compat",
  "key_exitFullScreen_old",
  "key_exitFullScreen_compat",
];

var zenIgnoreKeyboardShortcutL10n = [
  "zen-full-zoom-reduce-shortcut-alt-b",
  "zen-full-zoom-reduce-shortcut-alt-a",
];

var gZenCKSSettings = {
  async init() {
    await this._initializeCKS();
    if (this.__hasInitialized) {
      return;
    }
    this.__hasInitialized = true;
    this._currentActionID = null;
    this._initializeEvents();
    window.addEventListener("unload", () => {
      this.__hasInitialized = false;
      document.getElementById(ZEN_CKS_WRAPPER_ID).innerHTML = "";
    });
  },

  _initializeEvents() {
    const resetAllListener = this.resetAllShortcuts.bind(this);
    const handleKeyDown = this._handleKeyDown.bind(this);
    window.addEventListener("keydown", handleKeyDown);
    const button = document.getElementById("zenCKSResetButton");
    button.addEventListener("click", resetAllListener);
    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", handleKeyDown);
      button.removeEventListener("click", resetAllListener);
    });
  },

  async resetAllShortcuts() {
    let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      await gZenKeyboardShortcutsManager.resetAllShortcuts();
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    }
  },

  async _initializeCKS() {
    let wrapper = document.getElementById(ZEN_CKS_WRAPPER_ID);
    wrapper.innerHTML = "";

    let shortcuts = await gZenKeyboardShortcutsManager.getModifiableShortcuts();

    if (!shortcuts) {
      throw Error("No shortcuts defined!");
    }

    // Generate section per each group
    for (let group of VALID_SHORTCUT_GROUPS) {
      let groupClass = `${ZEN_CKS_GROUP_PREFIX}-${group}`;
      if (!wrapper.querySelector(`[data-group="${groupClass}"]`)) {
        let groupElem = document.createElement("h2");
        groupElem.setAttribute("data-group", groupClass);
        document.l10n.setAttributes(groupElem, groupClass);
        wrapper.appendChild(groupElem);
      }
    }

    for (let shortcut of shortcuts) {
      const keyID = shortcut.getID();
      const action = shortcut.getAction();
      const l10nID = shortcut.getL10NID();
      const group = shortcut.getGroup();
      const keyInString = shortcut.toDisplayString();

      const labelValue = zenMissingKeyboardShortcutL10n[keyID] ?? l10nID;

      if (
        zenIgnoreKeyboardShortcutIDs.includes(keyID) ||
        zenIgnoreKeyboardShortcutL10n.includes(labelValue) ||
        shortcut.shouldBeEmpty
      ) {
        continue;
      }

      let fragment = window.MozXULElement.parseXULToFragment(`
        <hbox class="${ZEN_CKS_CLASS_BASE}">
          <label class="${ZEN_CKS_LABEL_CLASS}" for="${ZEN_CKS_CLASS_BASE}-${keyID}"></label>
          <vbox flex="1">
            <html:input readonly="1" class="${ZEN_CKS_INPUT_FIELD_CLASS}" id="${ZEN_CKS_INPUT_FIELD_CLASS}-${keyID}" />
          </vbox>
        </hbox>
      `);

      const label = fragment.querySelector(`.${ZEN_CKS_LABEL_CLASS}`);
      if (!labelValue) {
        label.textContent = action; // Just in case
      } else {
        document.l10n.setAttributes(label, labelValue);
      }

      let input = fragment.querySelector(`.${ZEN_CKS_INPUT_FIELD_CLASS}`);
      if (keyInString && !shortcut.isEmpty()) {
        input.value = keyInString;
      } else {
        this._resetShortcut(input);
      }

      input.setAttribute(KEYBIND_ATTRIBUTE_KEY, keyID);
      input.setAttribute("data-group", group);
      input.setAttribute("data-id", keyID);

      input.addEventListener("focus", (event) => {
        this._currentActionID = event.target.getAttribute("data-id");
        event.target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
        this._hasSafed = true;
      });

      input.addEventListener("editDone", (event) => {
        const target = event.target;
        target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
      });

      input.addEventListener("blur", (event) => {
        const target = event.target;
        target.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
        if (!this._hasSafed) {
          target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);
          if (!target.nextElementSibling) {
            target.after(
              window.MozXULElement.parseXULToFragment(`
              <label class="${ZEN_CKS_CLASS_BASE}-unsafed" data-l10n-id="zen-key-unsaved"></label>
            `)
            );
            target.value = "Not set";
          }
        } else {
          target.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);
          const sibling = target.nextElementSibling;
          if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-unsafed`)) {
            sibling.remove();
          }
        }
        if (target.classList.contains(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`)) {
          target.label = "Not set";
        }
      });

      const groupElem = wrapper.querySelector(`[data-group="${ZEN_CKS_GROUP_PREFIX}-${group}"]`);
      groupElem.after(fragment);
    }
  },

  async _resetShortcut(input) {
    input.value = "Not set";
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
    input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);

    if (this._currentActionID) {
      this._editDone();
      await gZenKeyboardShortcutsManager.setShortcut(this._currentActionID, null, null);
    }
  },

  _editDone(shortcut, modifiers) {
    // Check if we have a valid key
    if (!shortcut || !modifiers) {
      return;
    }
    gZenKeyboardShortcutsManager.setShortcut(this._currentActionID, shortcut, modifiers);
    this._currentActionID = null;
  },

  //TODO Check for duplicates
  async _handleKeyDown(event) {
    if (!this._currentActionID || document.hidden) {
      return;
    }

    event.preventDefault();

    let input = document.querySelector(
      `.${ZEN_CKS_INPUT_FIELD_CLASS}[${KEYBIND_ATTRIBUTE_KEY}="${this._currentActionID}"]`
    );
    const modifiers = new nsKeyShortcutModifiers(
      event.ctrlKey,
      event.altKey,
      event.shiftKey,
      event.metaKey,
      false
    );
    const modifiersActive = modifiers.areAnyActive();

    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);

    // First, try to read the *physical* key via event.code.
    // If event.code is like "KeyS", "KeyA", ..., strip off "Key" → "S".
    // Otherwise, fall back to event.key (e.g. "F5", "Enter", etc.).
    let shortcut;
    if (event.code && event.code.startsWith("Key")) {
      shortcut = event.code.slice(3);
    } else {
      shortcut = event.key;
    }

    shortcut = shortcut.replace(/Ctrl|Control|Shift|Alt|Option|Cmd|Meta/, ""); // Remove all modifiers

    if (shortcut == "Tab" && !modifiersActive) {
      input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);
      input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
      this._latestValidKey = null;
      return;
    } else if (shortcut == "Escape" && !modifiersActive) {
      const { hasConflicts, conflictShortcut } = gZenKeyboardShortcutsManager.checkForConflicts(
        this._latestValidKey ? this._latestValidKey : shortcut,
        this._latestModifier ? this._latestModifier : modifiers,
        this._currentActionID
      );

      if (!this._latestValidKey && !this._latestModifier) {
        // todo(lint): This is a bit weird, we need to remove this empty block
      } else if (!this._latestValidKey || hasConflicts) {
        if (!input.classList.contains(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`)) {
          input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
        }
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);

        if (hasConflicts) {
          const shortcutL10nKey =
            zenMissingKeyboardShortcutL10n[conflictShortcut.getID()] ??
            conflictShortcut.getL10NID();

          const [group] = await document.l10n.formatValues([
            { id: `${ZEN_CKS_GROUP_PREFIX}-${conflictShortcut.getGroup()}` },
            { id: shortcutL10nKey },
          ]);

          if (!input.nextElementSibling) {
            input.after(
              window.MozXULElement.parseXULToFragment(`
                <label class="${ZEN_CKS_CLASS_BASE}-conflict" data-l10n-id="zen-key-conflict"></label>
              `)
            );
          }

          document.l10n.setAttributes(input.nextElementSibling, "zen-key-conflict", {
            group: group ?? "",
            shortcut: shortcut ?? "",
          });
        }
      } else {
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);

        this._editDone(this._latestValidKey, this._latestModifier);
        if (this.name == "Not set") {
          input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);
        }
        this._latestValidKey = null;
        this._latestModifier = null;
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
        input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-valid`);
        setTimeout(() => {
          input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-valid`);
        }, 1000);
        const sibling = input.nextElementSibling;
        if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-conflict`)) {
          sibling.remove();
        }
      }
      this._hasSafed = true;
      input.blur();
      this._currentActionID = null;
      return;
    } else if (shortcut == "Backspace" && !modifiersActive) {
      this._resetShortcut(input);
      this._latestValidKey = null;
      this._latestModifier = null;
      this._hasSafed = true;
      const sibling = input.nextElementSibling;
      if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-conflict`)) {
        sibling.remove();
      }
      return;
    }

    this._latestModifier = modifiers;
    this._hasSafed = false;
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);
    input.value = modifiers.toDisplayString() + shortcut;
    this._latestValidKey = shortcut;
  },
};

Preferences.addAll([
  {
    id: "zen.view.compact.toolbar-flash-popup",
    type: "bool",
    default: true,
  },
  {
    id: "zen.workspaces.hide-default-container-indicator",
    type: "bool",
    default: true,
  },
  {
    id: "zen.tab-unloader.timeout-minutes",
    type: "int",
    default: 10,
  },
  {
    id: "zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url",
    type: "bool",
    default: true,
  },
  {
    id: "zen.pinned-tab-manager.close-shortcut-behavior",
    type: "string",
    default: "switch",
  },
  {
    id: "zen.workspaces.force-container-workspace",
    type: "bool",
    default: true,
  },
  {
    id: "zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed",
    type: "bool",
    default: true,
  },
  {
    id: "zen.glance.activation-method",
    type: "string",
    default: "ctrl",
  },
  {
    id: "zen.glance.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.urlbar.behavior",
    type: "string",
    default: "float",
  },
  {
    id: "zen.workspaces.separate-essentials",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.show-newtab-vertical",
    type: "bool",
    default: true,
  },
  {
    id: "zen.view.show-newtab-button-top",
    type: "bool",
    default: true,
  },
  {
    id: "media.videocontrols.picture-in-picture.enabled",
    type: "bool",
    default: true,
  },
  {
    id: "zen.workspaces.continue-where-left-off",
    type: "bool",
    default: false,
  },
  {
    id: "zen.mods.auto-update",
    type: "bool",
    default: true,
  },
  {
    id: "zen.tabs.ctrl-tab.ignore-essential-tabs",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.ctrl-tab.ignore-pending-tabs",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.close-on-back-with-no-history",
    type: "bool",
    default: false,
  },
  {
    id: "zen.tabs.select-recently-used-on-close",
    type: "bool",
    default: true,
  },
  {
    id: "zen.window-sync.sync-only-pinned-tabs",
    type: "bool",
    default: false,
  },
]);

Preferences.addSetting({
  id: "zenWorkspaceContinueWhereLeftOff",
  pref: "zen.workspaces.continue-where-left-off",
});
