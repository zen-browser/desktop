/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  html,
  nothing,
  repeat,
} from "chrome://global/content/vendor/lit.all.mjs";
import { ZenLibrarySearchSection } from "moz-src:///zen/library/sections/ZenLibrarySearchSection.mjs";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenModsManager: "resource:///modules/zen/mods/ZenModsManager.sys.mjs",
});

const MODS_TOPIC = "zen-mods-update";
const DISABLE_ALL_PREF = "zen.themes.disable-all";
const STORE_PAGE = "https://zen-browser.app/mods/";
const PANEL_FADE_MS = 300;
const PREFERENCE_DEBOUNCE_MS = 300;
const PANEL_BOTTOM_GAP = 12;
const IMPORT_NAMES_SHOWN = 10;

const PREFERENCE_TYPES = new Set(["checkbox", "dropdown", "string"]);

const STATE_FILTERS = [
  { id: "enabled", l10nId: "library-mods-filter-enabled" },
  { id: "disabled", l10nId: "library-mods-filter-disabled" },
  { id: "error", l10nId: "library-mods-filter-error" },
];

const ERROR_L10N_IDS = {
  "missing-files": "library-mods-error-missing-files",
  "update-failed": "library-mods-error-update-failed",
};

/**
 * @param {object} mod - An installed mod
 * @returns {boolean}
 */
function isEnabled(mod) {
  return mod.enabled !== false;
}

/**
 * Asks before something the user can't take back.
 *
 * @param {string[]} l10nIds - Title, message and accept label
 * @param {object} [args] - Fluent args for the message
 * @returns {Promise<boolean>} Whether the user agreed
 */
async function confirmAction([titleId, messageId, acceptId], args = {}) {
  const prompts = Services.prompt;
  const [title, message, accept] = await document.l10n.formatValues([
    { id: titleId },
    { id: messageId, args },
    { id: acceptId },
  ]);
  const flags =
    prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING +
    prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_CANCEL;

  return (
    prompts.confirmEx(
      window,
      title,
      message,
      flags,
      accept,
      null,
      null,
      null,
      {}
    ) === 0
  );
}

/**
 * @param {number} mode - An nsIFilePicker mode
 * @param {string} titleId - Fluent id of the picker's title
 * @returns {Promise<nsIFile|null>} The file the user picked
 */
async function pickJSONFile(mode, titleId) {
  const picker = Cc["@mozilla.org/filepicker;1"].createInstance(
    Ci.nsIFilePicker
  );
  const [title] = await document.l10n.formatValues([{ id: titleId }]);

  picker.init(window.browsingContext, title, mode);
  picker.appendFilter("JSON", "*.json");
  picker.defaultString = "zen-mods.json";
  picker.defaultExtension = "json";

  const result = await new Promise(resolve => picker.open(resolve));
  const picked = [Ci.nsIFilePicker.returnOK, Ci.nsIFilePicker.returnReplace];

  return picked.includes(result) ? picker.file : null;
}

async function checkForUpdates() {
  const updates = await lazy.gZenModsManager.checkForUpdates();

  if (updates === null) {
    window.gZenUIManager.showToast("library-mods-updates-failed");
  } else if (!updates.length) {
    window.gZenUIManager.showToast("library-mods-updates-none");
  } else {
    window.gZenUIManager.showToast("library-mods-updates-installed", {
      l10nArgs: { count: updates.length },
    });
  }
}

function toggleAllMods() {
  Services.prefs.setBoolPref(
    DISABLE_ALL_PREF,
    !Services.prefs.getBoolPref(DISABLE_ALL_PREF, false)
  );
}

function browseStore() {
  window.openTrustedLinkIn(STORE_PAGE, "tab");
}

async function exportMods() {
  const file = await pickJSONFile(
    Ci.nsIFilePicker.modeSave,
    "library-mods-export-title"
  );

  if (!file) {
    return;
  }

  const mods = await lazy.gZenModsManager.getMods();

  await IOUtils.writeUTF8(file.path, JSON.stringify(mods, null, 2));
  window.gZenUIManager.showToast("library-mods-exported", {
    l10nArgs: { count: Object.keys(mods).length },
  });
}

/**
 * Installs from the store the mods an exported file lists, once the user
 * has seen which ones they are. Only ids come from the file: everything
 * else is what the store publishes.
 */
async function importMods() {
  const file = await pickJSONFile(
    Ci.nsIFilePicker.modeOpen,
    "library-mods-import-title"
  );

  if (!file) {
    return;
  }

  let listed;

  try {
    listed = await IOUtils.readJSON(file.path);
  } catch (error) {
    console.warn("[ZenLibraryMods]: Could not read the imported file:", error);
    window.gZenUIManager.showToast("library-mods-import-invalid");
    return;
  }

  if (!listed || typeof listed !== "object" || Array.isArray(listed)) {
    window.gZenUIManager.showToast("library-mods-import-invalid");
    return;
  }

  const manager = lazy.gZenModsManager;
  const mods = [];

  for (const [modId, entry] of Object.entries(listed)) {
    if (await manager.isModInstalled(modId)) {
      continue;
    }

    try {
      mods.push({
        mod: await manager.fetchStoreMod(modId),
        enabled: entry?.enabled !== false,
      });
    } catch (error) {
      console.warn(
        `[ZenLibraryMods]: Mod ${modId} is not in the store, skipping.`,
        error
      );
    }
  }

  if (!mods.length) {
    window.gZenUIManager.showToast("library-mods-import-nothing");
    return;
  }

  const names = mods
    .slice(0, IMPORT_NAMES_SHOWN)
    .map(({ mod }) => `• ${mod.name}`)
    .join("\n");
  const agreed = await confirmAction(
    [
      "library-mods-import-prompt-title",
      "library-mods-import-prompt-message",
      "library-mods-import-prompt-accept",
    ],
    {
      count: mods.length,
      names,
      more: Math.max(mods.length - IMPORT_NAMES_SHOWN, 0),
    }
  );

  if (!agreed) {
    return;
  }

  let installed = 0;

  for (const { mod, enabled } of mods) {
    try {
      await manager.installMod(mod);

      if (!enabled) {
        await manager.setModEnabled(mod.id, false);
      }

      installed++;
    } catch (error) {
      console.error(`[ZenLibraryMods]: Could not install ${mod.id}:`, error);
    }
  }

  window.gZenUIManager.showToast("library-mods-imported", {
    l10nArgs: { count: installed },
  });
}

export class ZenLibraryModsSection extends ZenLibrarySearchSection {
  static id = "mods";
  static label = "library-mods-section-title";

  static render(library) {
    return html`
      <zen-library-mods-section
        class="zen-library-section"
        data-section="mods"
        .library=${library}
      ></zen-library-mods-section>
    `;
  }

  /** @returns {object[]} What a right click on the mods tab offers */
  static get tabMenu() {
    const allDisabled = Services.prefs.getBoolPref(DISABLE_ALL_PREF, false);

    return [
      { l10nId: "library-mods-check-for-updates", command: checkForUpdates },
      {
        l10nId: allDisabled
          ? "library-mods-enable-all"
          : "library-mods-disable-all",
        command: toggleAllMods,
      },
      {
        l10nId: "library-mods-import",
        command: importMods,
        separatorBefore: true,
      },
      { l10nId: "library-mods-export", command: exportMods },
      {
        l10nId: "library-mods-browse-store",
        command: browseStore,
        separatorBefore: true,
      },
    ];
  }

  static properties = {
    mods: { state: true },
    configuring: { state: true },
  };

  constructor() {
    super();
    this.mods = [];
    this.configuring = null;
  }

  #observer = { observe: () => this.#load() };
  #loads = 0;
  #menu = null;
  #menuMod = null;
  #menuRow = null;
  #picker = null;
  #pickerOnPick = null;
  #pickerAnchor = null;
  #panelTimer = null;
  #pendingPreferences = new Map();
  #resizeObserver = new ResizeObserver(() => this.#fitPanel());

  connectedCallback() {
    super.connectedCallback();
    Services.obs.addObserver(this.#observer, MODS_TOPIC);
    Services.prefs.addObserver(DISABLE_ALL_PREF, this.#observer);
    this.#resizeObserver.observe(this);
    this.#load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    Services.obs.removeObserver(this.#observer, MODS_TOPIC);
    Services.prefs.removeObserver(DISABLE_ALL_PREF, this.#observer);
    this.#resizeObserver.disconnect();
    this.#flushPreferences();
    this.#cancelPanelTimer();

    for (const popup of [this.#menu, this.#picker]) {
      popup?.hidePopup();
      popup?.remove();
    }

    this.#menu = null;
    this.#picker = null;
  }

  get searchPlaceholderL10nId() {
    return "library-mods-search-placeholder";
  }

  get filterTitleL10nId() {
    return "library-mods-filter-title";
  }

  get filterGroups() {
    return [
      {
        id: "state",
        titleL10nId: "library-mods-filter-state",
        exclusive: true,
        options: STATE_FILTERS,
      },
    ];
  }

  onSearchChanged() {
    this.requestUpdate();
  }

  onFiltersChanged() {
    this.requestUpdate();
  }

  /**
   * Reads the installed mods and what each one lets the user change. Only the
   * latest of overlapping loads lands.
   */
  async #load() {
    const load = ++this.#loads;
    const manager = lazy.gZenModsManager;
    const mods = await manager.getOrderedMods();
    const withDetails = await Promise.all(
      mods.map(async mod => ({
        ...mod,
        error: manager.getModError(mod.id),
        preferences: (await manager.getModPreferences(mod)).filter(
          ({ type, property }) => {
            if (PREFERENCE_TYPES.has(type)) {
              return true;
            }

            console.warn(
              `[ZenLibraryMods]: Unknown preference type "${type}" for ${property} of ${mod.name}, skipping.`
            );

            return false;
          }
        ),
      }))
    );

    if (load !== this.#loads) {
      return;
    }

    this.mods = withDetails;

    if (this.configuring && !this.#configuringMod) {
      this.#closePanel();
    }
  }

  /** @returns {object[]} The mods the search box and filters leave standing */
  get #shown() {
    const query = this.searchQuery.toLowerCase();

    return this.mods.filter(mod => {
      if (this.isFilterActive("state", "enabled") && !isEnabled(mod)) {
        return false;
      }

      if (this.isFilterActive("state", "disabled") && isEnabled(mod)) {
        return false;
      }

      if (this.isFilterActive("state", "error") && !mod.error) {
        return false;
      }

      if (!query) {
        return true;
      }

      const texts = [
        mod.name,
        mod.author,
        ...mod.preferences.map(({ label }) => label),
      ];

      return texts.some(text =>
        String(text ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }

  get #configuringMod() {
    return this.mods.find(mod => mod.id === this.configuring) ?? null;
  }

  // Actions

  async #toggle(mod) {
    await lazy.gZenModsManager.setModEnabled(mod.id, !isEnabled(mod));
  }

  #onRowClick(mod) {
    if (mod.preferences.length) {
      this.#configure(mod);
    } else {
      this.#toggle(mod);
    }
  }

  /**
   * Ctrl+Shift+Up/Down moves the focused mod; Enter or Space acts like a
   * click.
   *
   * @param {KeyboardEvent} event
   * @param {object} mod
   */
  #onRowKeyDown(event, mod) {
    const list = event.currentTarget.closest("moz-reorderable-list");
    const move = list?.evaluateKeyDownEvent(event);

    if (move) {
      event.preventDefault();
      this.#reorder(move);
      return;
    }

    if (
      event.target === event.currentTarget &&
      [" ", "Enter"].includes(event.key)
    ) {
      event.preventDefault();
      this.#onRowClick(mod);
    }
  }

  /**
   * Moves a mod in the list right away and then saves the new load order.
   *
   * @param {{draggedIndex: number, insertAt: number}} move - From the
   * reorderable list
   */
  async #reorder({ draggedIndex, insertAt }) {
    const mods = [...this.mods];
    const [moved] = mods.splice(draggedIndex, 1);

    mods.splice(insertAt, 0, moved);
    this.mods = mods;

    await lazy.gZenModsManager.setModsOrder(mods.map(mod => mod.id));
  }

  async #remove(mod) {
    const agreed = await confirmAction(
      [
        "library-mods-remove-prompt-title",
        "library-mods-remove-prompt-message",
        "library-mods-remove-prompt-accept",
      ],
      { name: mod.name }
    );

    if (agreed) {
      await lazy.gZenModsManager.uninstallMod(mod.id);
    }
  }

  async #reinstall(mod) {
    try {
      await lazy.gZenModsManager.reinstallMod(mod.id);
      window.gZenUIManager.showToast("library-mods-reinstalled", {
        l10nArgs: { name: mod.name },
      });
    } catch (error) {
      console.error(`[ZenLibraryMods]: Could not reinstall ${mod.id}:`, error);
      window.gZenUIManager.showToast("library-mods-reinstall-failed", {
        l10nArgs: { name: mod.name },
      });
    }
  }

  /**
   * Opens the mod's page. Only web pages: the address comes from the store.
   *
   * @param {object} mod
   */
  #openHomepage(mod) {
    const url = URL.parse(mod.homepage ?? "");

    if (url?.protocol !== "https:" && url?.protocol !== "http:") {
      console.warn(
        `[ZenLibraryMods]: ${mod.name} has no web page to open, skipping.`
      );
      return;
    }

    window.openTrustedLinkIn(url.href, "tab");
  }

  // Context menu

  #buildMenu() {
    const menu = window.MozXULElement.parseXULToFragment(`
      <menupopup class="zen-library-mods-menu">
        <menuitem data-action="configure" data-l10n-id="library-mods-menu-configure"/>
        <menuitem data-action="homepage" data-l10n-id="library-mods-menu-homepage"/>
        <menuitem data-action="reinstall" data-l10n-id="library-mods-menu-reinstall"/>
        <menuseparator/>
        <menuitem data-action="remove" data-l10n-id="library-mods-menu-remove"/>
      </menupopup>
    `).firstElementChild;

    menu.addEventListener("command", event => {
      const mod = this.#menuMod;

      if (!mod) {
        return;
      }

      switch (event.target.dataset.action) {
        case "configure": {
          this.#configure(mod);
          break;
        }

        case "homepage": {
          this.#openHomepage(mod);
          break;
        }

        case "reinstall": {
          this.#reinstall(mod);
          break;
        }

        case "remove": {
          this.#remove(mod);
          break;
        }
      }
    });
    menu.addEventListener("popuphidden", () => {
      menu.hidden = true;
      this.#menuRow?.removeAttribute("menu-open");
      this.#menuRow = null;
      this.#menuMod = null;
    });
    menu.hidden = true;
    document.getElementById("mainPopupSet").appendChild(menu);

    return menu;
  }

  #openMenu(mod, row, event) {
    this.#menu ??= this.#buildMenu();

    const menu = this.#menu;

    menu.querySelector("[data-action='configure']").hidden =
      !mod.preferences.length;
    menu.querySelector("[data-action='homepage']").hidden = !mod.homepage;
    menu.hidden = false;
    this.#menuRow?.removeAttribute("menu-open");
    this.#menuMod = mod;
    this.#menuRow = row;
    row.setAttribute("menu-open", "true");
    menu.openPopupAtScreen(event.screenX, event.screenY, true, event);
  }

  // Preferences panel

  /**
   * Shows what a mod lets the user change where the filters show, the way
   * routes are edited.
   *
   * @param {object} mod
   */
  #configure(mod) {
    this.#cancelPanelTimer();
    this.configuring = mod.id;
    this.filtersOpen = true;
  }

  #closePanel() {
    this.#flushPreferences();
    this.filtersOpen = false;
    this.#panelTimer = setTimeout(() => {
      this.#panelTimer = null;

      if (!this.filtersOpen) {
        this.configuring = null;
      }
    }, PANEL_FADE_MS);
  }

  #cancelPanelTimer() {
    if (this.#panelTimer) {
      clearTimeout(this.#panelTimer);
      this.#panelTimer = null;
    }
  }

  onEscape() {
    if (this.configuring && this.filtersOpen) {
      this.#closePanel();
      return true;
    }

    return super.onEscape();
  }

  onLibraryClosing() {
    super.onLibraryClosing?.();
    this.#flushPreferences();
    this.#cancelPanelTimer();
    this.filtersOpen = false;
    this.configuring = null;
  }

  /**
   * Text preferences are written once the user stops typing; closing the
   * panel writes what is still waiting.
   *
   * @param {string} property
   * @param {string} value
   */
  #setStringPreference(property, value) {
    clearTimeout(this.#pendingPreferences.get(property)?.timer);

    const timer = setTimeout(() => {
      this.#pendingPreferences.delete(property);
      Services.prefs.setStringPref(property, value);
    }, PREFERENCE_DEBOUNCE_MS);

    this.#pendingPreferences.set(property, { timer, value });
  }

  #flushPreferences() {
    for (const [property, { timer, value }] of this.#pendingPreferences) {
      clearTimeout(timer);
      Services.prefs.setStringPref(property, value);
    }

    this.#pendingPreferences.clear();
  }

  /**
   * The panel is as tall as what's left of the section below it, and
   * scrolls inside for mods with many preferences.
   */
  #fitPanel() {
    if (!this.configuring) {
      return;
    }

    const inner = this.querySelector(".zen-library-mod-preferences");

    if (!inner) {
      return;
    }

    const available =
      this.getBoundingClientRect().bottom -
      inner.getBoundingClientRect().top -
      PANEL_BOTTOM_GAP;

    this.style.setProperty(
      "--zen-library-mods-panel-height",
      `${Math.max(available, 0)}px`
    );
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    this.toggleAttribute("configuring", Boolean(this.configuring));

    if (changedProperties.has("configuring")) {
      this.#fitPanel();
    }
  }

  #buildPicker() {
    const menu = window.MozXULElement.parseXULToFragment(`
      <menupopup class="zen-library-mods-picker"/>
    `).firstElementChild;

    menu.addEventListener("command", event => {
      this.#pickerOnPick?.(event.target.dataset.value);
    });
    menu.addEventListener("popuphidden", () => {
      menu.hidden = true;
      this.#pickerAnchor?.removeAttribute("menu-open");
      this.#pickerAnchor = null;
      this.#pickerOnPick = null;
    });
    menu.hidden = true;
    document.getElementById("mainPopupSet").appendChild(menu);

    return menu;
  }

  /**
   * @param {MouseEvent} event - The click on the dropdown
   * @param {object} preference - A `dropdown` preference
   */
  #openPicker(event, preference) {
    const anchor = event.currentTarget;
    const menu = (this.#picker ??= this.#buildPicker());
    const current = Services.prefs.getStringPref(preference.property, "");
    const items = this.#dropdownOptions(preference).map(({ label, value }) => {
      const item = document.createXULElement("menuitem");

      item.dataset.value = value;
      item.setAttribute("type", "radio");
      item.setAttribute("name", "zen-library-mods-option");
      item.toggleAttribute("checked", value === current);

      if (label === null) {
        item.setAttribute("data-l10n-id", "library-mods-preference-none-item");
      } else {
        item.setAttribute("label", label);
      }

      return item;
    });

    menu.replaceChildren(...items);
    this.#pickerOnPick = value => {
      Services.prefs.setStringPref(preference.property, value);
      this.requestUpdate();
    };
    this.#pickerAnchor = anchor;
    anchor.setAttribute("menu-open", "true");
    menu.hidden = false;
    menu.style.minWidth = `${anchor.getBoundingClientRect().width}px`;
    menu.openPopup(anchor, "after_start", 0, 0, false, false);
  }

  /**
   * The options of a `dropdown` preference, after the empty one that leaves
   * the mod's default. A null label stands for the localized "None".
   *
   * @param {object} preference
   * @returns {{label: string|null, value: string}[]}
   */
  #dropdownOptions(preference) {
    const options = [{ label: preference.placeholder || null, value: "" }];

    for (const option of preference.options ?? []) {
      const valueType = typeof option?.value;

      if (!["string", "number"].includes(valueType)) {
        console.warn(
          `[ZenLibraryMods]: Invalid option value type (${valueType}) for ${preference.property}, skipping.`
        );
        continue;
      }

      options.push({
        label: String(option.label ?? option.value),
        value: String(option.value),
      });
    }

    return options;
  }

  // Rendering

  renderPanel() {
    const mod = this.#configuringMod;

    if (!mod) {
      return super.renderPanel();
    }

    return html`
      <div class="zen-library-filter-header" ?inert=${!this.filtersOpen}>
        <h2>${mod.name}</h2>
        <button
          class="zen-library-filter-done"
          data-l10n-id="library-filter-done"
          @click=${() => this.#closePanel()}
        ></button>
      </div>
      <div class="zen-library-filter-panel">
        <div
          class="zen-library-filter-panel-inner zen-library-mod-preferences"
          ?inert=${!this.filtersOpen}
        >
          ${repeat(
            mod.preferences,
            preference => preference.property,
            preference => this.#renderPreference(preference)
          )}
        </div>
      </div>
    `;
  }

  #renderPreference(preference) {
    const { property, label, type } = preference;

    switch (type) {
      case "checkbox": {
        return html`
          <div class="zen-library-mod-preference">
            <span class="zen-library-mod-preference-label">${label}</span>
            <moz-toggle
              .pressed=${Services.prefs.getBoolPref(property, false)}
              aria-label=${label}
              @toggle=${event =>
                Services.prefs.setBoolPref(property, event.target.pressed)}
            ></moz-toggle>
          </div>
        `;
      }

      case "dropdown": {
        const current = Services.prefs.getStringPref(property, "");
        const option = this.#dropdownOptions(preference).find(
          candidate => candidate.value === current
        );

        return html`
          <div class="zen-library-mod-preference" stacked>
            <span class="zen-library-mod-preference-label">${label}</span>
            <button
              class="zen-library-routing-select"
              aria-label=${label}
              @click=${event => this.#openPicker(event, preference)}
            >
              ${
                option?.label
                  ? html`<span class="zen-library-routing-select-name"
                      >${option.label}</span
                    >`
                  : html`<span
                      class="zen-library-routing-select-name"
                      data-l10n-id="library-mods-preference-none"
                    ></span>`
              }
              <img
                class="zen-library-routing-chevron"
                src="chrome://browser/skin/zen-icons/arrow-down.svg"
                alt=""
              />
            </button>
          </div>
        `;
      }

      case "string": {
        return html`
          <div class="zen-library-mod-preference" stacked>
            <span class="zen-library-mod-preference-label">${label}</span>
            <input
              class="zen-library-routing-reference"
              type="text"
              aria-label=${label}
              .value=${
                this.#pendingPreferences.get(property)?.value ??
                Services.prefs.getStringPref(property, "")
              }
              placeholder=${preference.placeholder ?? ""}
              @input=${event =>
                this.#setStringPreference(property, event.target.value)}
            />
          </div>
        `;
      }
    }

    return nothing;
  }

  #renderMod(mod) {
    const enabled = isEnabled(mod);
    const initial = [...String(mod.name ?? "").trim()][0] ?? "?";

    return html`
      <div
        class="zen-library-row zen-library-mod-row"
        ?disabled=${!enabled}
        ?has-error=${Boolean(mod.error)}
        data-mod-id=${mod.id}
        tabindex="0"
        @click=${() => this.#onRowClick(mod)}
        @keydown=${event => this.#onRowKeyDown(event, mod)}
        @contextmenu=${event => {
          event.preventDefault();
          this.#openMenu(mod, event.currentTarget, event);
        }}
      >
        <div class="zen-library-mod-icon">${initial.toLocaleUpperCase()}</div>
        <div class="zen-library-row-text">
          <span class="zen-library-row-title">${mod.name}</span>
          ${
            mod.error
              ? html`<span
                  class="zen-library-row-subtitle zen-library-mod-error"
                  data-l10n-id=${ERROR_L10N_IDS[mod.error.type]}
                  title=${mod.error.message ?? ""}
                ></span>`
              : html`<span
                  class="zen-library-row-subtitle"
                  data-l10n-id="library-mods-byline"
                  data-l10n-args=${JSON.stringify({
                    author: String(mod.author ?? ""),
                    version: String(mod.version ?? ""),
                  })}
                ></span>`
          }
        </div>
        <div class="zen-library-row-actions">
          ${
            mod.preferences.length
              ? html`
                  <toolbarbutton
                    class="toolbarbutton-1"
                    data-l10n-id="library-mods-configure-button"
                    @click=${event => {
                      event.stopPropagation();
                      this.#configure(mod);
                    }}
                  >
                    <img
                      class="toolbarbutton-icon"
                      src="chrome://browser/skin/zen-icons/sliders.svg"
                      alt=""
                    />
                  </toolbarbutton>
                `
              : nothing
          }
          <moz-toggle
            ?pressed=${enabled}
            data-l10n-id="library-mods-toggle"
            @click=${event => event.stopPropagation()}
            @toggle=${() => this.#toggle(mod)}
          ></moz-toggle>
        </div>
      </div>
    `;
  }

  #renderAllDisabledNotice() {
    if (!Services.prefs.getBoolPref(DISABLE_ALL_PREF, false)) {
      return nothing;
    }

    return html`
      <div class="zen-library-mods-notice">
        <span data-l10n-id="library-mods-all-disabled"></span>
        <button
          class="zen-library-filter-chip"
          data-l10n-id="library-mods-enable-all-button"
          @click=${toggleAllMods}
        ></button>
      </div>
    `;
  }

  renderItems() {
    if (!this.mods.length) {
      return html`
        <div class="zen-library-empty zen-library-mods-empty">
          <span data-l10n-id="library-mods-empty"></span>
          <button
            class="zen-library-filter-chip"
            data-l10n-id="library-mods-browse-store-button"
            @click=${browseStore}
          ></button>
        </div>
      `;
    }

    const shown = this.#shown;

    if (!shown.length) {
      return html`
        ${this.#renderAllDisabledNotice()}
        <div
          class="zen-library-empty"
          data-l10n-id="library-mods-no-results"
        ></div>
      `;
    }

    const rows = repeat(
      shown,
      mod => mod.id,
      mod => this.#renderMod(mod)
    );

    // Only the whole list can be reordered: a filtered one would hide where
    // a mod lands.
    if (this.searchQuery || this.activeFilters.size) {
      return html`
        ${this.#renderAllDisabledNotice()}
        <div class="zen-library-group">${rows}</div>
      `;
    }

    return html`
      ${this.#renderAllDisabledNotice()}
      <moz-reorderable-list
        class="zen-library-group"
        itemselector=".zen-library-mod-row"
        @reorder=${event => this.#reorder(event.detail)}
      >
        ${rows}
      </moz-reorderable-list>
    `;
  }
}

customElements.define("zen-library-mods-section", ZenLibraryModsSection);
