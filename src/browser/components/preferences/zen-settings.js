/* eslint-disable no-undef */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const { nsZenMultiWindowFeature } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenCommonUtils.mjs",
  { global: "current" }
);

var gZenMarketplaceManager = {
  async init() {
    const checkForUpdates = document.getElementById(
      "zenThemeMarketplaceCheckForUpdates"
    );
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

    Services.prefs.addObserver(gZenMods.updatePref, this);
    window.addEventListener(
      "unload",
      () => {
        Services.prefs.removeObserver(gZenMods.updatePref, this);
      },
      { once: true }
    );

    await this._buildModsList();

    const checkForUpdateClick = event => {
      if (event.target === checkForUpdates) {
        event.preventDefault();

        this._checkForThemeUpdates(event);
      }
    };

    checkForUpdates.addEventListener("click", checkForUpdateClick);

    document.addEventListener(
      "ZenModsMarketplace:CheckForUpdatesFinished",
      event => {
        checkForUpdates.disabled = false;

        const updates = event.detail.updates;
        const success = document.getElementById(
          "zenThemeMarketplaceUpdatesSuccess"
        );
        const error = document.getElementById(
          "zenThemeMarketplaceUpdatesFailure"
        );

        if (updates) {
          success.hidden = false;
          error.hidden = true;
        } else {
          success.hidden = true;
          error.hidden = false;
        }
      }
    );

    window.addEventListener("unload", () => {
      this.__hasInitializedEvents = false;

      document.removeEventListener(
        "ZenModsMarketplace:CheckForUpdatesFinished",
        this
      );
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
    const areModsDisabled = Services.prefs.getBoolPref(
      "zen.themes.disable-all",
      false
    );
    const browser = nsZenMultiWindowFeature.currentBrowser;
    const mozToggle = document.createElement("moz-toggle");

    mozToggle.className =
      "zenThemeMarketplaceItemPreferenceToggle zenThemeMarketplaceDisableAllToggle";
    mozToggle.pressed = !areModsDisabled;

    browser.document.l10n.setAttributes(
      mozToggle,
      `zen-theme-disable-all-${!areModsDisabled ? "enabled" : "disabled"}`
    );

    mozToggle.addEventListener("toggle", async event => {
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
    const errorBox = document.getElementById(
      "zenThemeMarketplaceImportFailure"
    );
    const successBox = document.getElementById(
      "zenThemeMarketplaceImportSuccess"
    );

    successBox.hidden = true;
    errorBox.hidden = true;

    const input = document.createElement("input");

    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";
    input.setAttribute("moz-accept", ".json");
    input.setAttribute("accept", ".json");

    let timeout;

    const filePromise = new Promise(resolve => {
      input.addEventListener("change", event => {
        if (timeout) {
          clearTimeout(timeout);
        }

        const file = event.target.files[0];
        resolve(file);
      });

      timeout = setTimeout(() => {
        console.warn(
          "[ZenSettings:ZenMods]: Import timeout reached, aborting."
        );
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
      console.error(
        "[ZenSettings:ZenMods]: Error while importing mods:",
        error
      );
      errorBox.hidden = false;
    }

    if (input) {
      input.remove();
    }
  },

  async _exportThemes() {
    const errorBox = document.getElementById(
      "zenThemeMarketplaceExportFailure"
    );
    const successBox = document.getElementById(
      "zenThemeMarketplaceExportSuccess"
    );

    successBox.hidden = true;
    errorBox.hidden = true;

    try {
      const mods = await gZenMods.getMods();
      const modsJson = JSON.stringify(mods, null, 2);

      const nsIFilePicker = Ci.nsIFilePicker;
      const fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

      fp.init(
        window.browsingContext,
        "Export Zen Mods",
        nsIFilePicker.modeSave
      );
      fp.defaultString = "zen-mods-export";
      fp.defaultExtension = "json";
      fp.appendFilter("JSON Files", "*.json");
      fp.appendFilters(nsIFilePicker.filterAll);

      const result = await new Promise(resolve => {
        fp.open(resolve);
      });

      if (
        (result === nsIFilePicker.returnOK ||
          result === nsIFilePicker.returnReplace) &&
        fp.file
      ) {
        await IOUtils.writeUTF8(fp.file.path, modsJson);
        successBox.hidden = false;
      }
    } catch (error) {
      console.error(
        "[ZenSettings:ZenMods]: Error while exporting mods:",
        error
      );
      errorBox.hidden = false;
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

    for (const mod of Object.values(mods).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
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
      const baseHeader = fragment.querySelector(
        "#zenThemeMarketplaceItemContentHeader"
      );

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
      browser.document.l10n.setAttributes(
        headerTitle,
        "zen-theme-marketplace-theme-header-title",
        {
          name: sanitizedName,
        }
      );
      headerTitle.className = "zenThemeMarketplaceItemTitle";
      closeButton.id = `${sanitizedName}-modal-close`;
      browser.document.l10n.setAttributes(
        closeButton,
        "zen-theme-marketplace-close-modal"
      );
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

      mozToggle.addEventListener("toggle", async event => {
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
              .getElementById(
                `zenThemeMarketplaceItemConfigureButton-${sanitizedName}`
              )
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
              .getElementById(
                `zenThemeMarketplaceItemConfigureButton-${sanitizedName}`
              )
              .removeAttribute("hidden");
          }
        }
        setTimeout(() => {
          // We use a timeout to make sure the theme list has been updated before re-enabling the button.
          event.target.removeAttribute("disabled");
        }, 400);
      });

      fragment.querySelector(".zenThemeMarketplaceItemTitle").textContent =
        modName;
      fragment.querySelector(
        ".zenThemeMarketplaceItemDescription"
      ).textContent = mod.description;
      fragment
        .querySelector(".zenThemeMarketplaceItemUninstallButton")
        .addEventListener("click", async event => {
          const [msg] = await document.l10n.formatValues([
            { id: "zen-theme-marketplace-remove-confirmation" },
          ]);

          if (!confirm(msg)) {
            return;
          }

          await this.removeMod(event.target.getAttribute("zen-mod-id"));
        });

      if (mod.homepage) {
        const homepageButton = fragment.querySelector(
          ".zenThemeMarketplaceItemHomepageButton"
        );
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

              const savedValue = Services.prefs.getStringPref(
                property,
                defaultValue ?? "none"
              );

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

                Services.prefs.setStringPref(
                  property,
                  value === "none" ? "" : value
                );
                this._triggerBuildUpdateWithoutRebuild();
              });

              const nameLabel = document.createXULElement("label");
              nameLabel.setAttribute("flex", "1");
              nameLabel.setAttribute(
                "class",
                "zenThemeMarketplaceItemPreferenceLabel"
              );
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

              checkboxElement.addEventListener("click", event => {
                const target = event.target.closest(
                  ".zenThemeMarketplaceItemPreferenceCheckbox"
                );
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

              const savedValue = Services.prefs.getStringPref(
                property,
                defaultValue ?? ""
              );
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
                gZenMods.debounce(event => {
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
              nameLabel.setAttribute(
                "class",
                "zenThemeMarketplaceItemPreferenceLabel"
              );
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

{
  const zenSettingsButton = document.getElementById("category-zen-settings");
  zenSettingsButton.addEventListener(
    "click",
    event => {
      event.stopPropagation();
      ChromeUtils.importESModule(
        "resource:///modules/zen/settings/ZenSettings.sys.mjs"
      ).ZenSettings.open();
    },
    true
  );
}
