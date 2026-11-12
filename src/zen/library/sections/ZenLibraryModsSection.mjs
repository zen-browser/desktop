/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  html,
  live,
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

const PREFERENCE_TYPES = new Set([
  "checkbox",
  "dropdown",
  "string",
  "color",
  "number",
  "text",
  "separator",
]);
const MAX_CONDITION_DEPTH = 8;
const FORMATTING_RE = /\\([*~\\])|\*+|~/g;

const MAX_TAG_FILTERS = 12;

const STORE_FILTERS = [
  { id: "available", l10nId: "library-mods-filter-available" },
  { id: "installed", l10nId: "library-mods-filter-installed" },
];

const STATE_FILTERS = [
  { id: "enabled", l10nId: "library-mods-filter-enabled" },
  { id: "disabled", l10nId: "library-mods-filter-disabled" },
  { id: "error", l10nId: "library-mods-filter-error" },
];

const ERROR_L10N_IDS = {
  "missing-files": "library-mods-error-missing-files",
  "update-failed": "library-mods-error-update-failed",
  "script-failed": "library-mods-error-script-failed",
  "page-styles-blocked": "library-mods-error-page-styles-blocked",
};

const SCRIPTS_L10N_IDS = {
  running: "library-mods-scripts-running",
  off: "library-mods-scripts-off",
  "needs-approval": "library-mods-scripts-needs-approval",
  "needs-restart": "library-mods-scripts-needs-restart",
};

/**
 * @param {object} mod - An installed mod
 * @returns {boolean}
 */
function isEnabled(mod) {
  return mod.enabled !== false;
}

/**
 * @param {object} mod - A store entry
 * @returns {string[]} Its tags that are text
 */
function stringTags(mod) {
  return Array.isArray(mod?.tags)
    ? mod.tags.filter(tag => typeof tag === "string" && tag)
    : [];
}

/**
 * Labels written for Sine's formatting (`*`, `**`, `~`) read as plain text:
 * the markers go, and an escaped `\*` stays as `*`.
 *
 * @param {*} label
 * @returns {string}
 */
function plainLabel(label) {
  return String(label ?? "").replace(
    FORMATTING_RE,
    (marker, escaped) => escaped ?? ""
  );
}

/**
 * Whether a preference shows. Each of its `conditions` is
 * `{if: {property, value}}`, `{not: {property, value}}` or a nested group
 * with `conditions` of its own; one of them must hold, or all of them with
 * `operator: "AND"`.
 *
 * @param {object} group - A preference, or a nested group of conditions
 * @param {(property: string, value: *) => boolean} holds - Whether a
 * preference has a value
 * @param {number} [depth]
 * @returns {boolean}
 */
function meetsConditions(group, holds, depth = 0) {
  const { conditions, operator } = group;

  if (!Array.isArray(conditions) || !conditions.length) {
    return true;
  }

  if (depth >= MAX_CONDITION_DEPTH) {
    console.warn(
      "[ZenLibraryMods]: Conditions nested too deep, hiding the preference."
    );

    return false;
  }

  const meets = condition => {
    if (Array.isArray(condition?.conditions)) {
      return meetsConditions(condition, holds, depth + 1);
    }

    const test = condition?.if ?? condition?.not;

    if (typeof test?.property !== "string") {
      console.warn("[ZenLibraryMods]: Invalid condition, it never holds.");

      return false;
    }

    return holds(test.property, test.value) === Boolean(condition.if);
  };

  return String(operator).toUpperCase() === "AND"
    ? conditions.every(meets)
    : conditions.some(meets);
}

/**
 * Restarts the browser, unless something asks to stay open.
 */
function restartBrowser() {
  const cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
    Ci.nsISupportsPRBool
  );

  Services.obs.notifyObservers(
    cancelQuit,
    "quit-application-requested",
    "restart"
  );

  if (!cancelQuit.data) {
    Services.startup.quit(
      Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
    );
  }
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

  const result = await prompts.asyncConfirmEx(
    window.browsingContext,
    prompts.MODAL_TYPE_INTERNAL_WINDOW,
    title,
    message,
    flags,
    accept,
    null,
    null,
    null,
    false
  );

  return result.getProperty("buttonNumClicked") === 0;
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

/**
 * Mod scripts have every power the browser has: the user agrees to each
 * mod's scripts before they can run.
 *
 * @param {string} modName
 * @returns {Promise<boolean>} Whether the user allowed them
 */
function confirmScripts(modName) {
  return confirmAction(
    [
      "library-mods-scripts-prompt-title",
      "library-mods-scripts-prompt-message",
      "library-mods-scripts-prompt-accept",
    ],
    {
      name: modName,
      state: lazy.gZenModsManager.scriptsEnabled ? "on" : "off",
    }
  );
}

/**
 * Adds a mod from a folder of the user's, the way mods are made: the folder
 * stays where it is and reloading the mod reads it again.
 */
async function installFromFolder() {
  const picker = Cc["@mozilla.org/filepicker;1"].createInstance(
    Ci.nsIFilePicker
  );
  const [title] = await document.l10n.formatValues([
    { id: "library-mods-install-folder-title" },
  ]);

  picker.init(window.browsingContext, title, Ci.nsIFilePicker.modeGetFolder);

  const result = await new Promise(resolve => picker.open(resolve));

  if (result !== Ci.nsIFilePicker.returnOK || !picker.file) {
    return;
  }

  const path = picker.file.path;
  let manifest;

  try {
    manifest = await lazy.gZenModsManager.readLocalMod(path);
  } catch (error) {
    console.warn(`[ZenLibraryMods]: ${path} is not a mod:`, error);
    window.gZenUIManager.showToast("library-mods-install-folder-invalid", {
      descriptionId: "library-mods-install-folder-invalid-description",
    });
    return;
  }

  const hasScripts = Boolean(manifest.scripts.length);

  if (hasScripts && !(await confirmScripts(manifest.name))) {
    return;
  }

  await lazy.gZenModsManager.installLocalMod(path, {
    scriptsApproved: hasScripts,
  });
  window.gZenUIManager.showToast("library-mods-installed", {
    l10nArgs: { name: manifest.name },
  });
}

/**
 * Installs a mod from a GitHub repository the user names. Zen doesn't
 * review those, so the user agrees to the mod, and to its scripts if it has
 * any, before anything is installed.
 */
async function installFromGitHub() {
  const [title, text] = await document.l10n.formatValues([
    { id: "library-mods-github-title" },
    { id: "library-mods-github-text" },
  ]);
  const result = await Services.prompt.asyncPrompt(
    window.browsingContext,
    Services.prompt.MODAL_TYPE_INTERNAL_WINDOW,
    title,
    text,
    "",
    null,
    false
  );
  const input = result.getProperty("value")?.trim();

  if (!result.getProperty("ok") || !input) {
    return;
  }

  let found;

  try {
    found = await lazy.gZenModsManager.fetchGitHubMod(input);
  } catch (error) {
    console.warn(`[ZenLibraryMods]: No mod found at ${input}:`, error);
    window.gZenUIManager.showToast("library-mods-github-not-found", {
      descriptionId: "library-mods-github-not-found-description",
    });
    return;
  }

  const hasScripts = Boolean(found.scripts.length);
  const agreed = await confirmAction(
    [
      "library-mods-github-prompt-title",
      "library-mods-github-prompt-message",
      "library-mods-github-prompt-accept",
    ],
    {
      name: found.name,
      repo: found.repo,
      scripts: hasScripts ? "yes" : "no",
      pages: found.contentStylePath ? "yes" : "no",
    }
  );

  if (!agreed) {
    return;
  }

  try {
    await lazy.gZenModsManager.installGitHubMod(found, {
      scriptsApproved: hasScripts,
    });
  } catch (error) {
    console.error(`[ZenLibraryMods]: Could not install ${found.repo}:`, error);
    window.gZenUIManager.showToast("library-mods-install-failed", {
      l10nArgs: { name: found.name },
    });
    return;
  }

  window.gZenUIManager.showToast("library-mods-installed", {
    l10nArgs: { name: found.name },
  });
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
        l10nId: "library-mods-install-folder",
        command: installFromFolder,
        separatorBefore: true,
      },
      { l10nId: "library-mods-install-github", command: installFromGitHub },
      { l10nId: "library-mods-import", command: importMods },
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
    view: { state: true },
    storeMods: { state: true },
    storeDetail: { state: true },
  };

  constructor() {
    super();
    this.mods = [];
    this.configuring = null;
    this.view = "installed";

    /** @type {object[]|"loading"|"error"|null} What the store publishes */
    this.storeMods = null;

    /** @type {string|null} The store mod whose details are open */
    this.storeDetail = null;
  }

  /** @type {Set<string>} Store mods being installed */
  #installing = new Set();

  #observer = { observe: () => this.#load() };
  #loads = 0;
  #menu = null;
  #menuMod = null;
  #menuRow = null;
  #picker = null;
  #addMenu = null;
  #pickerOnPick = null;
  #pickerAnchor = null;
  #panelTimer = null;
  #pendingPreferences = new Map();

  /** @type {Set<string>} Mods with a changed preference that needs a restart */
  #restartNeeded = new Set();

  /** @type {(() => void)|null} */
  #stopWatching = null;

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
    this.#watchLocalMods(false);
    Services.obs.removeObserver(this.#observer, MODS_TOPIC);
    Services.prefs.removeObserver(DISABLE_ALL_PREF, this.#observer);
    this.#resizeObserver.disconnect();
    this.#flushPreferences();
    this.#cancelPanelTimer();

    for (const popup of [this.#menu, this.#picker, this.#addMenu]) {
      popup?.hidePopup();
      popup?.remove();
    }

    this.#menu = null;
    this.#picker = null;
    this.#addMenu = null;
  }

  get searchPlaceholderL10nId() {
    return this.view === "store"
      ? "library-mods-store-search-placeholder"
      : "library-mods-search-placeholder";
  }

  get filterTitleL10nId() {
    return "library-mods-filter-title";
  }

  get filterGroups() {
    if (this.view === "installed") {
      return [
        {
          id: "state",
          titleL10nId: "library-mods-filter-state",
          exclusive: true,
          options: STATE_FILTERS,
        },
      ];
    }

    const tags = Array.isArray(this.storeMods)
      ? [...new Set(this.storeMods.flatMap(mod => stringTags(mod)))]
          .sort()
          .slice(0, MAX_TAG_FILTERS)
      : [];
    const groups = [
      {
        id: "store",
        titleL10nId: "library-mods-filter-state",
        exclusive: true,
        options: STORE_FILTERS,
      },
    ];

    if (tags.length) {
      groups.push({
        id: "tag",
        titleL10nId: "library-mods-filter-tags",
        exclusive: true,
        options: tags.map(tag => ({ id: tag, label: tag })),
      });
    }

    return groups;
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
        scriptsState: manager.getScriptsState(mod.id),
        preferences: (await manager.getModPreferences(mod))
          .filter(({ type, property }) => {
            if (PREFERENCE_TYPES.has(type)) {
              return true;
            }

            console.warn(
              `[ZenLibraryMods]: Unknown preference type "${type}" for ${property} of ${mod.name}, skipping.`
            );

            return false;
          })
          .map(preference => ({
            ...preference,
            label: plainLabel(preference.label),
          })),
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

  get #storeDetailMod() {
    return Array.isArray(this.storeMods)
      ? (this.storeMods.find(mod => mod.id === this.storeDetail) ?? null)
      : null;
  }

  /** @returns {object[]} The store mods the search box and filters leave */
  get #shownStoreMods() {
    const query = this.searchQuery.toLowerCase();
    const installed = new Set(this.mods.map(mod => mod.id));
    const tag = [...this.activeFilters]
      .find(filter => filter.startsWith("tag:"))
      ?.slice("tag:".length);

    return this.storeMods.filter(mod => {
      if (this.isFilterActive("store", "available") && installed.has(mod.id)) {
        return false;
      }

      if (this.isFilterActive("store", "installed") && !installed.has(mod.id)) {
        return false;
      }

      if (tag && !stringTags(mod).includes(tag)) {
        return false;
      }

      return (
        !query ||
        [mod.name, mod.author, mod.description, ...stringTags(mod)].some(text =>
          String(text ?? "")
            .toLowerCase()
            .includes(query)
        )
      );
    });
  }

  /**
   * @param {"installed"|"store"} view
   */
  async #showView(view) {
    this.view = view;

    if (view !== "store" || Array.isArray(this.storeMods)) {
      return;
    }

    this.storeMods = "loading";

    try {
      this.storeMods = await lazy.gZenModsManager.fetchStoreIndex();
    } catch (error) {
      console.error("[ZenLibraryMods]: Could not load the store:", error);
      this.storeMods = "error";
    }
  }

  async #installFromStore(entry) {
    this.#installing.add(entry.id);
    this.requestUpdate();

    try {
      await lazy.gZenModsManager.installMod(entry);
      window.gZenUIManager.showToast("library-mods-installed", {
        l10nArgs: { name: entry.name },
      });
    } catch (error) {
      console.error(`[ZenLibraryMods]: Could not install ${entry.id}:`, error);
      window.gZenUIManager.showToast("library-mods-install-failed", {
        l10nArgs: { name: entry.name },
      });
    } finally {
      this.#installing.delete(entry.id);
      this.requestUpdate();
    }
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
        mod.source === "local"
          ? "library-mods-remove-local-prompt-message"
          : "library-mods-remove-prompt-message",
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

  async #reloadLocal(mod) {
    try {
      await lazy.gZenModsManager.reloadLocalMod(mod.id);
      window.gZenUIManager.showToast("library-mods-reloaded", {
        l10nArgs: { name: mod.name },
      });
    } catch (error) {
      console.error(`[ZenLibraryMods]: Could not reload ${mod.id}:`, error);
      window.gZenUIManager.showToast("library-mods-reload-failed", {
        l10nArgs: { name: mod.name },
      });
    }
  }

  #showFolder(mod) {
    const folder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);

    try {
      folder.initWithPath(mod.path);
      folder.reveal();
    } catch (error) {
      console.warn(
        `[ZenLibraryMods]: Could not show the folder of ${mod.id}:`,
        error
      );
    }
  }

  /**
   * An update that changes a GitHub mod's scripts waits for the user.
   *
   * @param {object} mod
   */
  async #reviewUpdate(mod) {
    const agreed = await confirmAction(
      [
        "library-mods-update-prompt-title",
        "library-mods-update-prompt-message",
        "library-mods-update-prompt-accept",
      ],
      { name: mod.name, version: mod.pendingUpdate.version }
    );

    if (!agreed) {
      return;
    }

    try {
      await lazy.gZenModsManager.approveUpdate(mod.id);
      window.gZenUIManager.showToast("library-mods-updated", {
        l10nArgs: { name: mod.name },
      });
    } catch (error) {
      console.error(`[ZenLibraryMods]: Could not update ${mod.id}:`, error);
      window.gZenUIManager.showToast("library-mods-update-failed", {
        l10nArgs: { name: mod.name },
      });
    }
  }

  async #approveScripts(mod) {
    if (await confirmScripts(mod.name)) {
      await lazy.gZenModsManager.approveScripts(mod.id);
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
        <menuitem data-action="review-update" data-l10n-id="library-mods-menu-review-update"/>
        <menuitem data-action="approve-scripts" data-l10n-id="library-mods-menu-approve-scripts"/>
        <menuitem data-action="reload" data-l10n-id="library-mods-menu-reload"/>
        <menuitem data-action="folder" data-l10n-id="library-mods-menu-folder"/>
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

        case "review-update": {
          this.#reviewUpdate(mod);
          break;
        }

        case "approve-scripts": {
          this.#approveScripts(mod);
          break;
        }

        case "reload": {
          this.#reloadLocal(mod);
          break;
        }

        case "folder": {
          this.#showFolder(mod);
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

    const isLocal = mod.source === "local";
    const hidden = {
      configure: !mod.preferences.length,
      homepage: !mod.homepage,
      "review-update": !mod.pendingUpdate,
      "approve-scripts": mod.scriptsState !== "needs-approval",
      reload: !isLocal,
      folder: !isLocal,
      // A local mod has no copy elsewhere to download again.
      reinstall: isLocal,
    };

    for (const [action, isHidden] of Object.entries(hidden)) {
      menu.querySelector(`[data-action='${action}']`).hidden = isHidden;
    }

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
    this.storeDetail = null;
    this.configuring = mod.id;
    this.filtersOpen = true;
  }

  #openStoreDetail(entry) {
    this.#cancelPanelTimer();
    this.configuring = null;
    this.storeDetail = entry.id;
    this.filtersOpen = true;
  }

  #closePanel() {
    this.#flushPreferences();
    this.filtersOpen = false;
    this.#panelTimer = setTimeout(() => {
      this.#panelTimer = null;

      if (!this.filtersOpen) {
        this.configuring = null;
        this.storeDetail = null;
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
    if ((this.configuring || this.storeDetail) && this.filtersOpen) {
      this.#closePanel();
      return true;
    }

    return super.onEscape();
  }

  onShown() {
    super.onShown?.();

    if (customElements.get("zen-library").isLibraryOpen) {
      this.#watchLocalMods(true);
    }
  }

  onHidden() {
    super.onHidden?.();
    this.#watchLocalMods(false);
  }

  onLibraryOpened() {
    this.#watchLocalMods(true);

    return super.onLibraryOpened();
  }

  /**
   * Local mods reload when their files change while the user looks at them.
   *
   * @param {boolean} watch
   */
  #watchLocalMods(watch) {
    if (watch) {
      this.#stopWatching ??= lazy.gZenModsManager.watchLocalMods();
    } else {
      this.#stopWatching?.();
      this.#stopWatching = null;
    }
  }

  onLibraryClosing() {
    super.onLibraryClosing?.();
    this.#watchLocalMods(false);
    this.#flushPreferences();
    this.#cancelPanelTimer();
    this.filtersOpen = false;
    this.configuring = null;
    this.storeDetail = null;
  }

  /**
   * Text preferences are written once the user stops typing; closing the
   * panel writes what is still waiting.
   *
   * @param {object} preference
   * @param {string} value
   */
  #setStringPreference(preference, value) {
    const { property } = preference;

    clearTimeout(this.#pendingPreferences.get(property)?.timer);

    const timer = setTimeout(() => {
      this.#pendingPreferences.delete(property);
      Services.prefs.setStringPref(property, value);
    }, PREFERENCE_DEBOUNCE_MS);

    this.#pendingPreferences.set(property, { timer, value });
    this.#preferenceChanged(preference);
  }

  /**
   * @param {string} property
   * @returns {string} The text preference's value, with what the user is
   * still typing
   */
  #stringValue(property) {
    return (
      this.#pendingPreferences.get(property)?.value ??
      Services.prefs.getStringPref(property, "")
    );
  }

  /**
   * Shows what a changed preference brings: the preferences its conditions
   * reveal and, if it only applies after a restart, the way to restart.
   *
   * @param {object} preference
   */
  #preferenceChanged(preference) {
    if (preference.restart === true) {
      this.#restartNeeded.add(this.configuring);
    }

    this.requestUpdate();
  }

  /**
   * @param {string} property
   * @param {*} expected - A value from a mod's `conditions`
   * @returns {boolean} Whether the preference has that value, counting what
   * the user is still typing
   */
  #holds(property, expected) {
    const { prefs } = Services;
    let value = this.#pendingPreferences.get(property)?.value;

    if (value === undefined) {
      switch (prefs.getPrefType(property)) {
        case prefs.PREF_BOOL: {
          value = prefs.getBoolPref(property);
          break;
        }

        case prefs.PREF_INT: {
          value = prefs.getIntPref(property);
          break;
        }

        case prefs.PREF_STRING: {
          value = prefs.getStringPref(property);
          break;
        }

        default: {
          // Never set: off and empty, the way its control shows it.
          return expected === false || expected === "";
        }
      }
    }

    return String(value) === String(expected);
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
    this.toggleAttribute(
      "configuring",
      Boolean(this.configuring || this.storeDetail)
    );

    if (
      changedProperties.has("configuring") ||
      changedProperties.has("storeDetail")
    ) {
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
      this.#preferenceChanged(preference);
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
    const entry = this.#storeDetailMod;

    if (entry) {
      return this.#renderStoreDetail(entry);
    }

    const mod = this.#configuringMod;

    if (!mod) {
      return super.renderPanel();
    }

    return html`
      ${this.#renderPanelHeader(mod.name)}
      <div class="zen-library-filter-panel">
        <div
          class="zen-library-filter-panel-inner zen-library-mod-preferences"
          ?inert=${!this.filtersOpen}
        >
          ${repeat(
            mod.preferences,
            (preference, index) => preference.property ?? index,
            preference =>
              this.#renderSlot(
                meetsConditions(preference, (property, value) =>
                  this.#holds(property, value)
                ),
                this.#renderPreference(preference)
              )
          )}
          ${this.#renderSlot(
            this.#restartNeeded.has(mod.id),
            html`<moz-message-bar
              type="warning"
              data-l10n-id="library-mods-restart-needed"
            >
              <moz-button
                slot="actions"
                data-l10n-id="library-mods-restart-button"
                @click=${restartBrowser}
              ></moz-button>
            </moz-message-bar>`,
            "zen-library-mod-restart"
          )}
        </div>
      </div>
    `;
  }

  /**
   * Wraps what may come and go in the panel, so it grows and shrinks into
   * place instead of pushing the rest at once.
   *
   * @param {boolean} shown
   * @param {*} content
   * @param {string} [className]
   */
  #renderSlot(shown, content, className = "") {
    return html`
      <div
        class="zen-library-mod-preference-slot ${className}"
        ?collapsed=${!shown}
        ?inert=${!shown}
      >
        <div>${content}</div>
      </div>
    `;
  }

  #renderPreference(preference) {
    const { property, label, type } = preference;

    switch (type) {
      case "checkbox":
      case "separator": {
        // A separator is a heading, and a toggle too if it has a property.
        return html`
          <div
            class="zen-library-mod-preference"
            ?separator=${type === "separator"}
          >
            <span class="zen-library-mod-preference-label">${label}</span>
            ${
              property
                ? html`<moz-toggle
                    .pressed=${Services.prefs.getBoolPref(property, false)}
                    aria-label=${label}
                    @toggle=${event => {
                      Services.prefs.setBoolPref(
                        property,
                        event.target.pressed
                      );
                      this.#preferenceChanged(preference);
                    }}
                  ></moz-toggle>`
                : nothing
            }
          </div>
        `;
      }

      case "text": {
        return html`<p class="zen-library-mod-preference-text">${label}</p>`;
      }

      case "color": {
        return html`
          <div class="zen-library-mod-preference">
            <span class="zen-library-mod-preference-label">${label}</span>
            <input
              class="zen-library-mod-color"
              type="color"
              aria-label=${label}
              .value=${live(this.#stringValue(property))}
              @input=${event =>
                this.#setStringPreference(preference, event.target.value)}
            />
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

      case "string":
      case "number": {
        return html`
          <div class="zen-library-mod-preference" stacked>
            <span class="zen-library-mod-preference-label">${label}</span>
            <input
              class="zen-library-routing-reference"
              type=${type === "number" ? "number" : "text"}
              aria-label=${label}
              .value=${live(this.#stringValue(property))}
              placeholder=${preference.placeholder ?? ""}
              @input=${event =>
                this.#setStringPreference(preference, event.target.value)}
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
          <span class="zen-library-mod-title">
            <span class="zen-library-row-title">${mod.name}</span>
            ${
              mod.source === "local"
                ? html`<span
                    class="zen-library-mod-badge"
                    data-l10n-id="library-mods-badge-local"
                  ></span>`
                : nothing
            }
            ${
              mod.source === "github"
                ? html`<span
                    class="zen-library-mod-badge"
                    data-l10n-id="library-mods-badge-github"
                    data-l10n-args=${JSON.stringify({ repo: mod.repo })}
                  ></span>`
                : nothing
            }
            ${
              mod.pendingUpdate
                ? html`<span
                    class="zen-library-mod-badge"
                    update
                    data-l10n-id="library-mods-badge-update"
                  ></span>`
                : nothing
            }
            ${
              mod.scriptsState === "none"
                ? nothing
                : html`<span
                    class="zen-library-mod-badge"
                    scripts=${mod.scriptsState}
                    data-l10n-id=${SCRIPTS_L10N_IDS[mod.scriptsState]}
                  ></span>`
            }
          </span>
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

  #renderViews() {
    return html`
      <div class="zen-library-mods-views">
        <div class="zen-library-mods-view-tabs" role="tablist">
          ${["installed", "store"].map(
            view => html`
              <button
                class="zen-library-filter-chip"
                role="tab"
                aria-selected=${this.view === view}
                ?active=${this.view === view}
                data-view=${view}
                data-l10n-id=${`library-mods-view-${view}`}
                @click=${() => this.#showView(view)}
              ></button>
            `
          )}
        </div>
        <button
          class="zen-library-filter-chip zen-library-mods-add"
          aria-haspopup="menu"
          data-l10n-id="library-mods-add-button"
          @click=${event => this.#openAddMenu(event.currentTarget)}
        >
          <img src="chrome://browser/skin/zen-icons/plus.svg" alt="" />
        </button>
      </div>
    `;
  }

  /**
   * Where mods come from besides the store, which has a view of its own.
   *
   * @param {Element} anchor - The add button
   */
  #openAddMenu(anchor) {
    if (!this.#addMenu) {
      const menu = window.MozXULElement.parseXULToFragment(`
        <menupopup class="zen-library-mods-add-menu">
          <menuitem data-l10n-id="library-mods-install-github"/>
          <menuitem data-l10n-id="library-mods-install-folder"/>
        </menupopup>
      `).firstElementChild;
      const [github, folder] = menu.children;

      github.addEventListener("command", installFromGitHub);
      folder.addEventListener("command", installFromFolder);
      menu.addEventListener("popuphidden", () => {
        menu.anchorNode?.removeAttribute("menu-open");
      });
      document.getElementById("mainPopupSet").appendChild(menu);
      this.#addMenu = menu;
    }

    anchor.setAttribute("menu-open", "true");
    this.#addMenu.openPopup(anchor, "after_end", 0, 0, false, false);
  }

  /**
   * The mod's picture from the store, or its initial: chrome only loads
   * pictures from the store's own addresses.
   *
   * @param {object} mod
   */
  #renderModImage(mod) {
    if (lazy.gZenModsManager.isStoreUrl(mod.image)) {
      return html`<img
        class="zen-library-mod-icon zen-library-store-thumbnail"
        src=${mod.image}
        alt=""
        loading="lazy"
      />`;
    }

    const initial = [...String(mod.name ?? "").trim()][0] ?? "?";

    return html`<div class="zen-library-mod-icon">
      ${initial.toLocaleUpperCase()}
    </div>`;
  }

  /**
   * @param {object} mod - A store entry
   * @param {boolean} isInstalled
   */
  #renderStoreAction(mod, isInstalled) {
    if (isInstalled) {
      return html`<span
        class="zen-library-mod-badge"
        data-l10n-id="library-mods-store-installed"
      ></span>`;
    }

    return html`<button
      class="zen-library-filter-chip"
      data-l10n-id="library-mods-store-install"
      ?disabled=${this.#installing.has(mod.id)}
      @click=${event => {
        event.stopPropagation();
        this.#installFromStore(mod);
      }}
    ></button>`;
  }

  #renderStoreItems() {
    if (this.storeMods === "loading" || this.storeMods === null) {
      return html`<div
        class="zen-library-empty"
        data-l10n-id="library-mods-store-loading"
      ></div>`;
    }

    if (this.storeMods === "error") {
      return html`
        <div class="zen-library-empty zen-library-mods-empty">
          <span data-l10n-id="library-mods-store-error"></span>
          <button
            class="zen-library-filter-chip"
            data-l10n-id="library-mods-store-retry"
            @click=${() => {
              this.storeMods = null;
              this.#showView("store");
            }}
          ></button>
        </div>
      `;
    }

    const shown = this.#shownStoreMods;
    const installed = new Set(this.mods.map(mod => mod.id));

    if (!shown.length) {
      return html`<div
        class="zen-library-empty"
        data-l10n-id="library-mods-no-results"
      ></div>`;
    }

    return html`
      <p
        class="zen-library-mods-disclaimer"
        data-l10n-id="library-mods-disclaimer"
      ></p>
      <div class="zen-library-group">
        ${repeat(
          shown,
          mod => mod.id,
          mod => html`
            <div
              class="zen-library-row zen-library-mod-row"
              data-store-id=${mod.id}
              tabindex="0"
              @click=${() => this.#openStoreDetail(mod)}
              @keydown=${event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  this.#openStoreDetail(mod);
                }
              }}
            >
              ${this.#renderModImage(mod)}
              <div class="zen-library-row-text">
                <span class="zen-library-row-title">${mod.name}</span>
                <span class="zen-library-row-subtitle">${mod.description}</span>
              </div>
              <div class="zen-library-row-actions">
                ${this.#renderStoreAction(mod, installed.has(mod.id))}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  /**
   * The panels a row opens go back to the list, the way a page does.
   *
   * @param {string} title
   */
  #renderPanelHeader(title) {
    return html`
      <div
        class="zen-library-filter-header zen-library-mods-panel-header"
        ?inert=${!this.filtersOpen}
      >
        <button
          class="zen-library-mods-panel-back"
          data-l10n-id="library-mods-panel-back"
          @click=${() => this.#closePanel()}
        >
          <img src="chrome://browser/skin/zen-icons/back.svg" alt="" />
        </button>
        <h2>${title}</h2>
      </div>
    `;
  }

  /**
   * @param {object} entry - A store entry
   */
  #renderStoreDetail(entry) {
    const installedMod = this.mods.find(mod => mod.id === entry.id);
    const hasImage = lazy.gZenModsManager.isStoreUrl(entry.image);

    return html`
      ${this.#renderPanelHeader(entry.name)}
      <div class="zen-library-filter-panel">
        <div
          class="zen-library-filter-panel-inner zen-library-mod-preferences zen-library-store-detail"
          ?inert=${!this.filtersOpen}
        >
          ${
            hasImage
              ? html`<img
                  class="zen-library-store-image"
                  src=${entry.image}
                  alt=""
                />`
              : nothing
          }
          <p class="zen-library-store-description">${entry.description}</p>
          <span
            class="zen-library-row-subtitle"
            data-l10n-id="library-mods-byline"
            data-l10n-args=${JSON.stringify({
              author: String(entry.author ?? ""),
              version: String(entry.version ?? ""),
            })}
          ></span>
          ${
            typeof entry.updatedAt === "string" && entry.updatedAt
              ? html`<span
                  class="zen-library-row-subtitle"
                  data-l10n-id="library-mods-store-updated"
                  data-l10n-args=${JSON.stringify({ date: entry.updatedAt })}
                ></span>`
              : nothing
          }
          ${
            stringTags(entry).length
              ? html`<div class="zen-library-store-tags">
                  ${stringTags(entry).map(
                    tag =>
                      html`<span class="zen-library-mod-badge">${tag}</span>`
                  )}
                </div>`
              : nothing
          }
          <div class="zen-library-store-actions">
            ${
              installedMod
                ? html`<button
                    class="zen-library-filter-chip"
                    data-l10n-id="library-mods-store-remove"
                    @click=${() => this.#remove(installedMod)}
                  ></button>`
                : html`<button
                    class="zen-library-filter-chip"
                    active
                    data-l10n-id="library-mods-store-install"
                    ?disabled=${this.#installing.has(entry.id)}
                    @click=${() => this.#installFromStore(entry)}
                  ></button>`
            }
            ${
              entry.homepage
                ? html`<button
                    class="zen-library-filter-chip"
                    data-l10n-id="library-mods-store-homepage"
                    @click=${() => this.#openHomepage(entry)}
                  ></button>`
                : nothing
            }
          </div>
        </div>
      </div>
    `;
  }

  renderItems() {
    if (this.view === "store") {
      return html`${this.#renderViews()}${this.#renderStoreItems()}`;
    }

    if (!this.mods.length) {
      return html`
        ${this.#renderViews()}
        <div class="zen-library-empty zen-library-mods-empty">
          <span data-l10n-id="library-mods-empty"></span>
          <button
            class="zen-library-filter-chip"
            data-l10n-id="library-mods-browse-store-button"
            @click=${() => this.#showView("store")}
          ></button>
        </div>
      `;
    }

    const shown = this.#shown;

    if (!shown.length) {
      return html`
        ${this.#renderViews()} ${this.#renderAllDisabledNotice()}
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
        ${this.#renderViews()} ${this.#renderAllDisabledNotice()}
        <div class="zen-library-group">${rows}</div>
      `;
    }

    return html`
      ${this.#renderViews()} ${this.#renderAllDisabledNotice()}
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
