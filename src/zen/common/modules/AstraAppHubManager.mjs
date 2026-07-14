/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Per-window Astra App Hub controller (Phase 2).
 * Catalog: chrome-packaged JSON. State: profile-local singleton.
 * Icons: local/packaged only — never remote http(s) list-style-image.
 */

const {
  gAstraAppHubState,
  STATE_CHANGED_TOPIC,
  validateAppUrl,
  MAX_NAME_LENGTH,
  MAX_URL_LENGTH,
  isPlainObject,
} = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/AstraAppHubState.mjs"
);
const { resolveAppIcon, pickAndStoreCustomIcon, deleteCustomIcons } =
  ChromeUtils.importESModule(
    "chrome://browser/content/zen-components/AstraAppHubIcons.mjs"
  );

gAstraAppHubState.setIconCleanupHandler(deleteCustomIcons);

const CATALOG_URL =
  "chrome://browser/content/zen-components/astra-app-hub-catalog.json";
const CATALOG_SCHEMA_VERSION = 1;

const SECTION_FAVORITES = "__favorites__";
const SECTION_RECENT = "__recent__";

/** @type {(url: string) => { ok: true, href: string, hostname?: string } | { ok: false, reason: string }} */
export const validateBuiltinAppUrl = validateAppUrl;

function normalizeSearchQuery(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function systemPrincipal() {
  return Services.scriptSecurityManager.getSystemPrincipal();
}

function confirmPrompt(title, message) {
  try {
    return Services.prompt.confirm(window, title, message);
  } catch {
    return false;
  }
}

function setL10nOrText(el, l10nId, fallback) {
  if (!el) {
    return;
  }
  if (document.l10n && l10nId) {
    try {
      document.l10n.setAttributes(el, l10nId);
      return;
    } catch {
      // fall through
    }
  }
  if (el.localName === "label" || el.tagName === "label") {
    el.setAttribute("value", fallback);
  } else if ("label" in el || el.hasAttribute("label")) {
    el.setAttribute("label", fallback);
  } else {
    el.textContent = fallback;
  }
}

function clearChildren(node) {
  if (!node) {
    return;
  }
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function validateCatalog(raw) {
  if (!isPlainObject(raw)) {
    throw new Error("catalog root must be an object");
  }
  if (raw.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    throw new Error(`unsupported catalog schemaVersion: ${raw.schemaVersion}`);
  }
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.apps)) {
    throw new Error("catalog requires categories[] and apps[]");
  }

  const categories = [];
  const categoryIds = new Set();
  for (const cat of raw.categories) {
    if (!isPlainObject(cat) || typeof cat.id !== "string" || !cat.id) {
      continue;
    }
    if (categoryIds.has(cat.id)) {
      console.warn(`[AstraAppHub] duplicate category id skipped: ${cat.id}`);
      continue;
    }
    categoryIds.add(cat.id);
    categories.push({
      id: cat.id,
      label: typeof cat.label === "string" ? cat.label : cat.id,
      order: Number.isFinite(cat.order) ? cat.order : 0,
    });
  }
  categories.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const apps = [];
  const appIds = new Set();
  for (const app of raw.apps) {
    if (!isPlainObject(app) || typeof app.id !== "string" || !app.id) {
      console.warn("[AstraAppHub] skipping invalid app record");
      continue;
    }
    if (appIds.has(app.id)) {
      console.warn(`[AstraAppHub] duplicate app id skipped: ${app.id}`);
      continue;
    }
    if (typeof app.category !== "string" || !categoryIds.has(app.category)) {
      console.warn(
        `[AstraAppHub] app ${app.id} has invalid category; skipped`
      );
      continue;
    }
    const urlCheck = validateAppUrl(app.url);
    if (!urlCheck.ok) {
      console.warn(
        `[AstraAppHub] app ${app.id} invalid url (${urlCheck.reason}); skipped`
      );
      continue;
    }
    const keywords = Array.isArray(app.keywords)
      ? app.keywords
          .filter(k => typeof k === "string" && k.trim())
          .map(k => k.trim().slice(0, 40))
          .slice(0, 16)
      : [];
    // Strip remote http(s) icons from catalog — never use as list-style-image.
    let icon = typeof app.icon === "string" ? app.icon : "";
    if (
      icon &&
      (icon.startsWith("http:") ||
        icon.startsWith("https:") ||
        icon.startsWith("//"))
    ) {
      icon = "";
    }
    appIds.add(app.id);
    apps.push({
      id: app.id,
      name: typeof app.name === "string" ? app.name : app.id,
      url: urlCheck.href,
      category: app.category,
      icon,
      order: Number.isFinite(app.order) ? app.order : 0,
      builtin: app.builtin !== false,
      keywords,
      hostname: urlCheck.hostname || hostnameFromUrl(urlCheck.href),
    });
  }
  apps.sort(
    (a, b) =>
      a.order - b.order ||
      a.category.localeCompare(b.category) ||
      a.id.localeCompare(b.id)
  );

  if (!categories.length) {
    throw new Error("catalog has no valid categories");
  }
  if (!apps.length) {
    throw new Error("catalog has no valid apps");
  }

  return { schemaVersion: CATALOG_SCHEMA_VERSION, categories, apps };
}

class AstraAppHubManager {
  #initPromise = null;
  #initialized = false;
  #destroyed = false;
  #boundCtxPopupHidden = null;
  #boundCtxPopupShowing = null;
  #boundOverflowPopupShowing = null;
  #catalog = null;
  #catalogError = null;
  #rendered = false;
  #priorFocus = null;
  #openSource = "unknown";
  #popupTransition = false;
  #customizeMode = false;
  #editorMode = null; // null | "add" | "edit"
  #editingAppId = null;
  #pendingIconFile = null;
  #searchQuery = "";
  #lastAppliedRevision = -1;
  #contextAppId = null;
  #dragState = null;
  #suppressLaunch = false;
  #focusedItemIndex = -1;

  #boundCommand = null;
  #boundPopupShown = null;
  #boundPopupHidden = null;
  #boundKeydown = null;
  #boundClick = null;
  #boundInput = null;
  #boundContextMenu = null;
  #boundDragStart = null;
  #boundDragOver = null;
  #boundDrop = null;
  #boundDragEnd = null;
  #boundStateChanged = null;
  #shellBuilt = false;

  constructor() {
    window.gAstraAppHubManager = this;
    window.gZenAppLauncher = {
      open: (eventOrOptions, win = window) => {
        const options = this.#normalizeCompatArgs(eventOrOptions);
        if (win && win !== window && win.gAstraAppHubManager) {
          return win.gAstraAppHubManager.open(options);
        }
        return this.open(options);
      },
      close: options => this.close(options),
      toggle: (eventOrOptions, win = window) => {
        const options = this.#normalizeCompatArgs(eventOrOptions);
        if (win && win !== window && win.gAstraAppHubManager) {
          return win.gAstraAppHubManager.toggle(options);
        }
        return this.toggle(options);
      },
      openApp: (appOrUrl, options) => this.openApp(appOrUrl, options),
    };

    window.addEventListener(
      "unload",
      () => {
        this.destroy();
      },
      { once: true }
    );

    void this.init().catch(error => {
      console.error("[AstraAppHub] background init failed:", error);
    });
  }

  #normalizeCompatArgs(eventOrOptions) {
    if (
      eventOrOptions &&
      typeof eventOrOptions === "object" &&
      Object.getPrototypeOf(eventOrOptions) === Object.prototype &&
      (Object.prototype.hasOwnProperty.call(eventOrOptions, "event") ||
        Object.prototype.hasOwnProperty.call(eventOrOptions, "source") ||
        Object.prototype.hasOwnProperty.call(eventOrOptions, "restoreFocus"))
    ) {
      return eventOrOptions;
    }
    return { event: eventOrOptions || null, source: "compat" };
  }

  get panel() {
    return document.getElementById("PanelUI-zen-app-launcher");
  }

  get container() {
    return document.getElementById("PanelUI-zen-app-launcher-container");
  }

  get list() {
    return document.getElementById("PanelUI-zen-app-launcher-list");
  }

  get searchInput() {
    return document.getElementById("astra-app-hub-search");
  }

  get editor() {
    return document.getElementById("astra-app-hub-editor");
  }

  get contextMenu() {
    return document.getElementById("astra-app-hub-context-menu");
  }

  get overflowMenu() {
    return document.getElementById("astra-app-hub-overflow-menu");
  }

  get isOpen() {
    const panel = this.panel;
    if (!panel) {
      return false;
    }
    const state = panel.state;
    return state === "open" || state === "showing";
  }

  get #isHiding() {
    return this.panel?.state === "hiding";
  }

  async init() {
    if (this.#destroyed) {
      return null;
    }
    if (this.#initialized) {
      return this.#catalog;
    }
    if (this.#initPromise) {
      return this.#initPromise;
    }
    this.#initPromise = this.#initInternal();
    try {
      return await this.#initPromise;
    } finally {
      this.#initPromise = null;
    }
  }

  async #initInternal() {
    try {
      await gAstraAppHubState.load();
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      const response = await fetch(CATALOG_URL);
      if (!response.ok) {
        throw new Error(`catalog fetch failed: ${response.status}`);
      }
      const raw = await response.json();
      this.#catalog = validateCatalog(raw);
      this.#catalogError = null;
      await this.#pruneUnknown();
      this.#ensureShell();
      this.#bindPanelListeners();
      this.#initialized = true;
      return this.#catalog;
    } catch (error) {
      this.#catalog = null;
      this.#catalogError = error;
      this.#initialized = true;
      console.error("[AstraAppHub] catalog load failed:", error);
      this.#ensureShell();
      this.#bindPanelListeners();
      return null;
    }
  }

  async #pruneUnknown() {
    if (!this.#catalog) {
      return;
    }
    const knownApps = new Set([
      ...this.#catalog.apps.map(a => a.id),
      ...(gAstraAppHubState.data.customApps || []).map(a => a.id),
    ]);
    const knownCats = new Set(this.#catalog.categories.map(c => c.id));
    try {
      await gAstraAppHubState.pruneUnknownIds(knownApps, knownCats);
      this.#lastAppliedRevision = gAstraAppHubState.revision;
    } catch (error) {
      console.warn("[AstraAppHub] prune failed:", error);
    }
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#unbindPanelListeners();
    this.#removeMenus();
    this.#priorFocus = null;
    this.#dragState = null;
    this.#contextAppId = null;
  }

  #ensureShell() {
    const panel = this.panel;
    const container = this.container;
    if (!panel || !container || this.#shellBuilt) {
      if (panel && container && !this.#shellBuilt) {
        // Fall through only when not yet built.
      } else {
        return;
      }
    }
    this.#shellBuilt = true;

    // Header
    let header = document.getElementById("astra-app-hub-header");
    if (!header) {
      header = document.createXULElement("hbox");
      header.id = "astra-app-hub-header";
      header.classList.add("astra-app-hub-header");
      header.setAttribute("align", "center");

      const title = document.createXULElement("label");
      title.id = "astra-app-hub-title";
      title.classList.add("astra-app-hub-title");
      setL10nOrText(title, "astra-app-hub-title", "App Hub");
      header.appendChild(title);

      const hint = document.createXULElement("label");
      hint.id = "astra-app-hub-shortcut-hint";
      hint.classList.add("astra-app-hub-shortcut-hint");
      header.appendChild(hint);
      this.#updateShortcutHint(hint);

      const spacer = document.createXULElement("spacer");
      spacer.setAttribute("flex", "1");
      header.appendChild(spacer);

      const customizeBtn = document.createXULElement("toolbarbutton");
      customizeBtn.id = "astra-app-hub-customize-btn";
      customizeBtn.classList.add("astra-app-hub-header-btn");
      customizeBtn.setAttribute("data-action", "customize");
      setL10nOrText(customizeBtn, "astra-app-hub-customize", "Customize");
      header.appendChild(customizeBtn);

      const doneBtn = document.createXULElement("toolbarbutton");
      doneBtn.id = "astra-app-hub-done-btn";
      doneBtn.classList.add("astra-app-hub-header-btn");
      doneBtn.setAttribute("data-action", "done-customize");
      doneBtn.hidden = true;
      setL10nOrText(doneBtn, "astra-app-hub-done", "Done");
      header.appendChild(doneBtn);

      const oldTitle = document.getElementById("PanelUI-zen-app-launcher-title");
      if (oldTitle) {
        oldTitle.remove();
      }
      container.insertBefore(header, container.firstChild);
    }

    // Search row
    let searchRow = document.getElementById("astra-app-hub-search-row");
    if (!searchRow) {
      searchRow = document.createXULElement("hbox");
      searchRow.id = "astra-app-hub-search-row";
      searchRow.classList.add("astra-app-hub-search-row");
      searchRow.setAttribute("align", "center");

      const search = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      search.id = "astra-app-hub-search";
      search.classList.add("astra-app-hub-search");
      search.setAttribute("type", "search");
      search.setAttribute("autocomplete", "off");
      search.setAttribute("placeholder", "Search apps");
      if (document.l10n) {
        try {
          document.l10n.setAttributes(search, "astra-app-hub-search-placeholder");
        } catch {
          // keep placeholder
        }
      }
      searchRow.appendChild(search);

      const clearBtn = document.createXULElement("toolbarbutton");
      clearBtn.id = "astra-app-hub-search-clear";
      clearBtn.classList.add("astra-app-hub-search-clear");
      clearBtn.setAttribute("data-action", "clear-search");
      clearBtn.hidden = true;
      setL10nOrText(clearBtn, "astra-app-hub-search-clear", "Clear");
      searchRow.appendChild(clearBtn);

      const listEl = this.list;
      if (listEl) {
        container.insertBefore(searchRow, listEl);
      } else {
        container.appendChild(searchRow);
      }
    }

    let status = document.getElementById("astra-app-hub-search-status");
    if (!status) {
      status = document.createXULElement("label");
      status.id = "astra-app-hub-search-status";
      status.classList.add("astra-app-hub-search-status");
      status.setAttribute("role", "status");
      status.hidden = true;
      const listEl = this.list;
      if (listEl) {
        container.insertBefore(status, listEl);
      } else {
        container.appendChild(status);
      }
    }

    // Ensure list exists
    let list = this.list;
    if (!list) {
      list = document.createXULElement("vbox");
      list.id = "PanelUI-zen-app-launcher-list";
      list.classList.add("astra-app-hub-list");
      container.appendChild(list);
    } else {
      list.classList.add("astra-app-hub-list");
    }

    // Footer
    let footer = document.getElementById("astra-app-hub-footer");
    if (!footer) {
      footer = document.createXULElement("hbox");
      footer.id = "astra-app-hub-footer";
      footer.classList.add("astra-app-hub-footer");
      footer.setAttribute("align", "center");

      const addBtn = document.createXULElement("toolbarbutton");
      addBtn.id = "astra-app-hub-add-btn";
      addBtn.setAttribute("data-action", "add-app");
      setL10nOrText(addBtn, "astra-app-hub-add", "Add app");
      footer.appendChild(addBtn);

      const spacer = document.createXULElement("spacer");
      spacer.setAttribute("flex", "1");
      footer.appendChild(spacer);

      const overflowBtn = document.createXULElement("toolbarbutton");
      overflowBtn.id = "astra-app-hub-overflow-btn";
      overflowBtn.setAttribute("data-action", "overflow");
      setL10nOrText(overflowBtn, "astra-app-hub-overflow", "More");
      footer.appendChild(overflowBtn);

      container.appendChild(footer);
    }

    // Editor subview
    let editor = this.editor;
    if (!editor) {
      editor = document.createXULElement("vbox");
      editor.id = "astra-app-hub-editor";
      editor.classList.add("astra-app-hub-editor");
      editor.hidden = true;

      const nameLabel = document.createXULElement("label");
      setL10nOrText(nameLabel, "astra-app-hub-editor-name-label", "Name");
      editor.appendChild(nameLabel);
      const nameInput = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      nameInput.id = "astra-app-hub-editor-name";
      nameInput.setAttribute("type", "text");
      nameInput.setAttribute("maxlength", String(MAX_NAME_LENGTH));
      editor.appendChild(nameInput);

      const urlLabel = document.createXULElement("label");
      setL10nOrText(urlLabel, "astra-app-hub-editor-url-label", "URL (https)");
      editor.appendChild(urlLabel);
      const urlInput = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      urlInput.id = "astra-app-hub-editor-url";
      urlInput.setAttribute("type", "url");
      urlInput.setAttribute("maxlength", String(MAX_URL_LENGTH));
      editor.appendChild(urlInput);

      const catLabel = document.createXULElement("label");
      setL10nOrText(catLabel, "astra-app-hub-editor-category-label", "Category");
      editor.appendChild(catLabel);
      const catSelect = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "select"
      );
      catSelect.id = "astra-app-hub-editor-category";
      editor.appendChild(catSelect);

      const kwLabel = document.createXULElement("label");
      setL10nOrText(
        kwLabel,
        "astra-app-hub-editor-keywords-label",
        "Keywords (comma-separated)"
      );
      editor.appendChild(kwLabel);
      const kwInput = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      kwInput.id = "astra-app-hub-editor-keywords";
      kwInput.setAttribute("type", "text");
      editor.appendChild(kwInput);

      const iconBtn = document.createXULElement("toolbarbutton");
      iconBtn.id = "astra-app-hub-editor-icon-btn";
      iconBtn.setAttribute("data-action", "pick-icon");
      setL10nOrText(iconBtn, "astra-app-hub-editor-icon", "Choose icon");
      editor.appendChild(iconBtn);

      const err = document.createXULElement("label");
      err.id = "astra-app-hub-editor-error";
      err.classList.add("astra-app-hub-editor-error");
      err.hidden = true;
      editor.appendChild(err);

      const actions = document.createXULElement("hbox");
      const saveBtn = document.createXULElement("toolbarbutton");
      saveBtn.id = "astra-app-hub-editor-save";
      saveBtn.setAttribute("data-action", "editor-save");
      setL10nOrText(saveBtn, "astra-app-hub-editor-save", "Save");
      actions.appendChild(saveBtn);
      const cancelBtn = document.createXULElement("toolbarbutton");
      cancelBtn.id = "astra-app-hub-editor-cancel";
      cancelBtn.setAttribute("data-action", "editor-cancel");
      setL10nOrText(cancelBtn, "astra-app-hub-editor-cancel", "Cancel");
      actions.appendChild(cancelBtn);
      editor.appendChild(actions);

      container.appendChild(editor);
    }

    this.#ensureMenus();
  }

  #updateShortcutHint(hintEl = null) {
    const hint =
      hintEl || document.getElementById("astra-app-hub-shortcut-hint");
    if (!hint) {
      return;
    }
    let display = null;
    try {
      display =
        window.gZenKeyboardShortcutsManager?.getShortcutDisplayFromCommand?.(
          "cmd_zenOpenAppLauncher"
        ) || null;
    } catch {
      display = null;
    }
    if (display) {
      hint.removeAttribute("data-l10n-id");
      hint.setAttribute("value", display);
      return;
    }
    const isMac =
      typeof AppConstants !== "undefined"
        ? AppConstants.platform === "macosx"
        : Services.appinfo.OS === "Darwin";
    setL10nOrText(
      hint,
      isMac
        ? "astra-app-hub-shortcut-hint-mac"
        : "astra-app-hub-shortcut-hint",
      isMac ? "⌘⇧U" : "Ctrl+Shift+U"
    );
  }

  #menuParent() {
    return (
      document.getElementById("mainPopupSet") ||
      this.panel?.parentElement ||
      document.documentElement
    );
  }

  #removeMenus() {
    for (const id of [
      "astra-app-hub-context-menu",
      "astra-app-hub-overflow-menu",
    ]) {
      const el = document.getElementById(id);
      if (el?.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
    this.#boundCtxPopupHidden = null;
    this.#boundCtxPopupShowing = null;
    this.#boundOverflowPopupShowing = null;
  }

  #ensureMenus() {
    if (this.contextMenu && this.overflowMenu) {
      return;
    }

    const parent = this.#menuParent();

    if (!this.contextMenu) {
      const menu = document.createXULElement("menupopup");
      menu.id = "astra-app-hub-context-menu";

      const items = [
        ["astra-app-hub-ctx-open", "Open", "open"],
        ["astra-app-hub-ctx-new-tab", "Open in New Tab", "tab"],
        ["astra-app-hub-ctx-current", "Open in Current Tab", "current"],
        ["astra-app-hub-ctx-new-window", "Open in New Window", "window"],
        ["astra-app-hub-ctx-private", "Open in Private Window", "private"],
        null,
        ["astra-app-hub-ctx-favorite", "Favorite", "favorite"],
        ["astra-app-hub-ctx-hide", "Hide", "hide"],
        ["astra-app-hub-ctx-edit", "Edit", "edit"],
        ["astra-app-hub-ctx-delete", "Delete", "delete"],
        null,
        ["astra-app-hub-ctx-split", "Open in Split View", "split"],
        ["astra-app-hub-ctx-essentials", "Pin to Essentials", "essentials"],
      ];

      for (const entry of items) {
        if (!entry) {
          menu.appendChild(document.createXULElement("menuseparator"));
          continue;
        }
        const [id, label, action] = entry;
        const item = document.createXULElement("menuitem");
        item.id = id;
        item.setAttribute("data-action", action);
        setL10nOrText(item, id, label);
        menu.appendChild(item);
      }

      const wsMenu = document.createXULElement("menu");
      wsMenu.id = "astra-app-hub-ctx-workspace";
      setL10nOrText(wsMenu, "astra-app-hub-ctx-workspace", "Open in Workspace");
      const wsPopup = document.createXULElement("menupopup");
      wsPopup.id = "astra-app-hub-ctx-workspace-popup";
      wsMenu.appendChild(wsPopup);
      menu.appendChild(wsMenu);

      parent.appendChild(menu);
    }

    if (!this.overflowMenu) {
      const menu = document.createXULElement("menupopup");
      menu.id = "astra-app-hub-overflow-menu";
      const items = [
        ["astra-app-hub-overflow-export", "Export…", "export"],
        ["astra-app-hub-overflow-import", "Import…", "import"],
        null,
        [
          "astra-app-hub-overflow-clear-recent",
          "Clear Recently Used",
          "clear-recent",
        ],
        [
          "astra-app-hub-overflow-clear-favorites",
          "Clear Favorites",
          "clear-favorites",
        ],
        [
          "astra-app-hub-overflow-restore-hidden",
          "Restore Hidden Apps",
          "restore-hidden",
        ],
        null,
        ["astra-app-hub-overflow-reset-layout", "Reset Layout", "reset-layout"],
        [
          "astra-app-hub-overflow-reset-all",
          "Reset App Hub Completely…",
          "reset-all",
        ],
        null,
        [
          "astra-app-hub-overflow-toggle-recent",
          "Show Recently Used",
          "toggle-recent",
        ],
        [
          "astra-app-hub-overflow-toggle-favorites",
          "Show Favorites",
          "toggle-favorites",
        ],
      ];
      for (const entry of items) {
        if (!entry) {
          menu.appendChild(document.createXULElement("menuseparator"));
          continue;
        }
        const [id, label, action] = entry;
        const item = document.createXULElement("menuitem");
        item.id = id;
        item.setAttribute("data-action", action);
        if (action === "toggle-recent" || action === "toggle-favorites") {
          item.setAttribute("type", "checkbox");
        }
        setL10nOrText(item, id, label);
        menu.appendChild(item);
      }
      parent.appendChild(menu);
    }
  }

  #bindPanelListeners() {
    const panel = this.panel;
    if (!panel || this.#boundCommand) {
      return;
    }
    this.#boundCommand = event => this.#onCommand(event);
    this.#boundPopupShown = event => this.#onPopupShown(event);
    this.#boundPopupHidden = event => this.#onPopupHidden(event);
    this.#boundKeydown = event => this.#onPanelKeydown(event);
    this.#boundClick = event => this.#onClick(event);
    this.#boundInput = event => this.#onInput(event);
    this.#boundContextMenu = event => this.#onContextMenu(event);
    this.#boundDragStart = event => this.#onDragStart(event);
    this.#boundDragOver = event => this.#onDragOver(event);
    this.#boundDrop = event => this.#onDrop(event);
    this.#boundDragEnd = event => this.#onDragEnd(event);
    this.#boundStateChanged = (_subject, _topic, data) => {
      this.#onStateChanged(data);
    };

    panel.addEventListener("command", this.#boundCommand);
    panel.addEventListener("popupshown", this.#boundPopupShown);
    panel.addEventListener("popuphidden", this.#boundPopupHidden);
    panel.addEventListener("keydown", this.#boundKeydown);
    panel.addEventListener("click", this.#boundClick);
    panel.addEventListener("input", this.#boundInput);
    panel.addEventListener("contextmenu", this.#boundContextMenu);
    panel.addEventListener("dragstart", this.#boundDragStart);
    panel.addEventListener("dragover", this.#boundDragOver);
    panel.addEventListener("drop", this.#boundDrop);
    panel.addEventListener("dragend", this.#boundDragEnd);

    try {
      Services.obs.addObserver(this.#boundStateChanged, STATE_CHANGED_TOPIC);
    } catch (error) {
      console.warn("[AstraAppHub] obs subscribe failed:", error);
    }

    const ctx = this.contextMenu;
    if (ctx) {
      ctx.addEventListener("command", this.#boundCommand);
      this.#boundCtxPopupShowing = () => this.#populateWorkspaceSubmenu();
      this.#boundCtxPopupHidden = () => {
        this.#contextAppId = null;
      };
      ctx.addEventListener("popupshowing", this.#boundCtxPopupShowing);
      ctx.addEventListener("popuphidden", this.#boundCtxPopupHidden);
    }
    const overflow = this.overflowMenu;
    if (overflow) {
      overflow.addEventListener("command", this.#boundCommand);
      this.#boundOverflowPopupShowing = () => this.#syncOverflowChecks();
      overflow.addEventListener(
        "popupshowing",
        this.#boundOverflowPopupShowing
      );
    }
  }

  #unbindPanelListeners() {
    const panel = this.panel;
    if (this.#boundStateChanged) {
      try {
        Services.obs.removeObserver(
          this.#boundStateChanged,
          STATE_CHANGED_TOPIC
        );
      } catch {
        // ignore
      }
    }
    if (!panel || !this.#boundCommand) {
      this.#boundCommand = null;
      this.#boundStateChanged = null;
      return;
    }
    panel.removeEventListener("command", this.#boundCommand);
    panel.removeEventListener("popupshown", this.#boundPopupShown);
    panel.removeEventListener("popuphidden", this.#boundPopupHidden);
    panel.removeEventListener("keydown", this.#boundKeydown);
    panel.removeEventListener("click", this.#boundClick);
    panel.removeEventListener("input", this.#boundInput);
    panel.removeEventListener("contextmenu", this.#boundContextMenu);
    panel.removeEventListener("dragstart", this.#boundDragStart);
    panel.removeEventListener("dragover", this.#boundDragOver);
    panel.removeEventListener("drop", this.#boundDrop);
    panel.removeEventListener("dragend", this.#boundDragEnd);

    const ctx = this.contextMenu;
    if (ctx && this.#boundCommand) {
      ctx.removeEventListener("command", this.#boundCommand);
      if (this.#boundCtxPopupShowing) {
        ctx.removeEventListener("popupshowing", this.#boundCtxPopupShowing);
      }
      if (this.#boundCtxPopupHidden) {
        ctx.removeEventListener("popuphidden", this.#boundCtxPopupHidden);
      }
    }
    const overflow = this.overflowMenu;
    if (overflow && this.#boundCommand) {
      overflow.removeEventListener("command", this.#boundCommand);
      if (this.#boundOverflowPopupShowing) {
        overflow.removeEventListener(
          "popupshowing",
          this.#boundOverflowPopupShowing
        );
      }
    }

    this.#boundCommand = null;
    this.#boundPopupShown = null;
    this.#boundPopupHidden = null;
    this.#boundKeydown = null;
    this.#boundClick = null;
    this.#boundInput = null;
    this.#boundContextMenu = null;
    this.#boundDragStart = null;
    this.#boundDragOver = null;
    this.#boundDrop = null;
    this.#boundDragEnd = null;
    this.#boundStateChanged = null;
    this.#boundCtxPopupShowing = null;
    this.#boundCtxPopupHidden = null;
    this.#boundOverflowPopupShowing = null;
  }

  #onStateChanged(data) {
    if (this.#destroyed) {
      return;
    }
    const rev = Number(data);
    if (!Number.isFinite(rev) || rev === this.#lastAppliedRevision) {
      return;
    }
    this.#lastAppliedRevision = rev;
    // Re-render only; never write back on notify (avoid loops).
    this.#rendered = false;
    if (this.isOpen) {
      this.#rebuildList();
      if (this.#searchQuery) {
        this.#applySearchFilter(this.#searchQuery);
      }
    }
  }

  async reloadCatalog() {
    this.#initialized = false;
    this.#rendered = false;
    this.#catalog = null;
    this.#catalogError = null;
    clearChildren(this.list);
    return this.init();
  }

  getCatalog() {
    return this.#catalog ? JSON.parse(JSON.stringify(this.#catalog)) : null;
  }

  getState() {
    return JSON.parse(JSON.stringify(gAstraAppHubState.data));
  }

  async toggle(options = {}) {
    if (this.#destroyed || window.closed) {
      return;
    }
    await this.init();
    if (this.#destroyed || window.closed) {
      return;
    }
    if (this.#popupTransition || this.#isHiding) {
      return;
    }
    if (this.isOpen) {
      this.close({ ...options, restoreFocus: true });
      return;
    }
    await this.open(options);
  }

  #resolveOpenSource(options = {}) {
    if (options.source) {
      return options.source;
    }
    const src = options.event?.sourceEvent || options.event;
    const type = src?.type;
    if (type === "keydown" || type === "keypress" || type === "keyup") {
      return "keyboard";
    }
    if (type && String(type).startsWith("mouse")) {
      return "mouse";
    }
    return "unknown";
  }

  async open(options = {}) {
    if (this.#destroyed || window.closed) {
      return;
    }
    await this.init();
    if (this.#destroyed || window.closed) {
      return;
    }
    const panel = this.panel;
    if (!panel) {
      console.error("[AstraAppHub] panel missing");
      return;
    }

    this.#openSource = this.#resolveOpenSource(options);
    this.#capturePriorFocus();
    this.#ensureShell();
    this.#ensureRendered();

    if (this.isOpen || this.#popupTransition || this.#isHiding) {
      return;
    }

    const anchor = this.#resolveAnchor(options.event);
    this.#popupTransition = true;
    try {
      panel.openPopup(anchor, "after_start", 0, 0, false, false);
    } catch (error) {
      this.#popupTransition = false;
      console.error("[AstraAppHub] openPopup failed:", error);
    }
  }

  close(options = {}) {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    if (options.restoreFocus === false) {
      this.#priorFocus = null;
    }
    if (this.isOpen) {
      this.#popupTransition = true;
      try {
        panel.hidePopup();
      } catch (error) {
        this.#popupTransition = false;
        console.error("[AstraAppHub] hidePopup failed:", error);
      }
    }
    if (options.restoreFocus !== false && !this.isOpen && !this.#isHiding) {
      this.#restorePriorFocus();
    }
  }

  // —— App resolution ——

  #allAppsMap() {
    const map = new Map();
    if (this.#catalog) {
      for (const app of this.#catalog.apps) {
        map.set(app.id, { ...app, builtin: true });
      }
    }
    const knownCats = new Set(
      (this.#catalog?.categories || []).map(c => c.id)
    );
    for (const app of gAstraAppHubState.data.customApps || []) {
      const category =
        typeof app.category === "string" && knownCats.has(app.category)
          ? app.category
          : "productivity";
      map.set(app.id, {
        ...app,
        category,
        builtin: false,
        keywords: app.keywords || [],
        hostname: hostnameFromUrl(app.url),
      });
    }
    return map;
  }

  #resolveApp(appOrUrl) {
    const map = this.#allAppsMap();
    if (typeof appOrUrl === "string") {
      if (map.has(appOrUrl)) {
        return map.get(appOrUrl);
      }
      const byUrl = [...map.values()].find(a => a.url === appOrUrl);
      if (byUrl) {
        return byUrl;
      }
      return { id: null, name: appOrUrl, url: appOrUrl, builtin: false };
    }
    if (isPlainObject(appOrUrl)) {
      if (appOrUrl.id && map.has(appOrUrl.id)) {
        return map.get(appOrUrl.id);
      }
      return appOrUrl;
    }
    return null;
  }

  async openApp(appOrUrl, options = {}) {
    await this.init();
    if (this.#destroyed || window.closed) {
      return;
    }
    const mode = options.mode || "tab";
    const app = this.#resolveApp(appOrUrl);
    if (!app?.url) {
      return;
    }
    const check = validateAppUrl(app.url);
    if (!check.ok) {
      console.error(`[AstraAppHub] blocked launch (${check.reason}):`, app.url);
      try {
        window.gZenUIManager?.showToast?.("zen-general-error");
      } catch {
        // ignore
      }
      return;
    }

    this.close({ restoreFocus: false });

    let ok = false;
    try {
      ok = await this.#launch(check.href, mode, options);
    } catch (error) {
      console.error("[AstraAppHub] openApp failed:", error);
      ok = false;
    }

    if (ok && app.id) {
      const isPrivate =
        mode === "private" ||
        (typeof PrivateBrowsingUtils !== "undefined" &&
          PrivateBrowsingUtils.isWindowPrivate(window));
      try {
        await gAstraAppHubState.recordRecent(app.id, {
          privateWindow: isPrivate,
        });
        this.#lastAppliedRevision = gAstraAppHubState.revision;
      } catch (error) {
        console.warn("[AstraAppHub] recordRecent failed:", error);
      }
    }
  }

  async #launch(url, mode, options = {}) {
    const win = window;
    switch (mode) {
      case "current": {
        const tab = win.gBrowser?.selectedTab;
        // Never overwrite pinned / Essential tabs in place.
        if (tab?.pinned || tab?.hasAttribute?.("zen-essential")) {
          return this.#openTrusted(url, "tab");
        }
        return this.#openTrusted(url, "current");
      }
      case "window":
        return this.#openTrusted(url, "window");
      case "private":
        return this.#openPrivate(url);
      case "workspace":
        return this.#openInWorkspace(url, options.workspaceId);
      case "split":
        return this.#openSplit(url);
      case "essentials":
        return this.#openEssentials(url);
      case "tab":
      case "open":
      default:
        return this.#openTrusted(url, "tab");
    }
  }

  #openTrusted(url, where) {
    try {
      if (typeof window.openTrustedLinkIn === "function") {
        window.openTrustedLinkIn(url, where, {
          triggeringPrincipal: systemPrincipal(),
          inBackground: false,
        });
        return true;
      }
      if (where === "tab" && window.gBrowser) {
        window.gBrowser.selectedTab = window.gBrowser.addTrustedTab(url, {
          triggeringPrincipal: systemPrincipal(),
          inBackground: false,
        });
        return true;
      }
      if (where === "current" && window.gBrowser?.selectedBrowser) {
        window.gBrowser.loadURI(Services.io.newURI(url), {
          triggeringPrincipal: systemPrincipal(),
        });
        return true;
      }
    } catch (error) {
      console.error("[AstraAppHub] openTrusted failed:", error);
    }
    return false;
  }

  async #openPrivate(url) {
    try {
      let newWin = null;
      if (typeof OpenBrowserWindow === "function") {
        newWin = OpenBrowserWindow({ private: true });
      }
      if (newWin) {
        await new Promise(resolve => {
          const onLoad = () => {
            newWin.removeEventListener("load", onLoad);
            resolve();
          };
          if (newWin.document?.readyState === "complete") {
            resolve();
          } else {
            newWin.addEventListener("load", onLoad);
            setTimeout(resolve, 3000);
          }
        });
        // Wait for delayed browser startup before using gBrowser / openTrustedLinkIn.
        try {
          if (newWin.delayedStartupPromise) {
            await newWin.delayedStartupPromise;
          } else {
            await new Promise(resolve => {
              const topic = "browser-delayed-startup-finished";
              const obs = (subject, _topic) => {
                if (subject === newWin) {
                  Services.obs.removeObserver(obs, topic);
                  resolve();
                }
              };
              Services.obs.addObserver(obs, topic);
              setTimeout(() => {
                try {
                  Services.obs.removeObserver(obs, topic);
                } catch {
                  // ignore
                }
                resolve();
              }, 5000);
            });
          }
        } catch {
          // continue with best effort
        }
        if (this.#destroyed || window.closed) {
          return false;
        }
        try {
          if (typeof newWin.openTrustedLinkIn === "function") {
            newWin.openTrustedLinkIn(url, "tab", {
              triggeringPrincipal: systemPrincipal(),
              inBackground: false,
            });
            return true;
          }
          if (newWin.gBrowser) {
            newWin.gBrowser.selectedTab = newWin.gBrowser.addTrustedTab(url, {
              triggeringPrincipal: systemPrincipal(),
            });
            return true;
          }
        } catch (error) {
          console.warn("[AstraAppHub] private follow-up open failed:", error);
        }
      }
      if (typeof window.openTrustedLinkIn === "function") {
        window.openTrustedLinkIn(url, "window", {
          triggeringPrincipal: systemPrincipal(),
          private: true,
          inBackground: false,
        });
        return true;
      }
    } catch (error) {
      console.error("[AstraAppHub] openPrivate failed:", error);
    }
    return false;
  }

  async #openInWorkspace(url, workspaceId) {
    const tabOk = this.#openTrusted(url, "tab");
    if (!tabOk) {
      return false;
    }
    const ws = window.gZenWorkspaces;
    if (!ws || typeof ws.moveTabToWorkspace !== "function") {
      return true;
    }
    const targetId = workspaceId || ws.activeWorkspace;
    if (!targetId) {
      return true;
    }
    try {
      const tab = window.gBrowser?.selectedTab;
      if (tab) {
        ws.moveTabToWorkspace(tab, targetId);
      }
      return true;
    } catch (error) {
      console.warn("[AstraAppHub] moveTabToWorkspace failed:", error);
      return true;
    }
  }

  #openSplit(url) {
    const splitter = window.gZenViewSplitter;
    if (
      !splitter ||
      typeof splitter.openAndSwitchToTab !== "function" ||
      typeof splitter.splitTabs !== "function"
    ) {
      return this.#openTrusted(url, "tab");
    }
    let newTab = null;
    try {
      const cur = window.gBrowser.selectedTab;
      newTab = splitter.openAndSwitchToTab(url, {
        triggeringPrincipal: systemPrincipal(),
      });
      if (cur && newTab) {
        splitter.splitTabs([cur, newTab], "vsep", 1);
      }
      return true;
    } catch (error) {
      console.error("[AstraAppHub] split launch failed:", error);
      // Roll back orphan tab created before a failed split.
      try {
        if (newTab && window.gBrowser?.tabs && [...window.gBrowser.tabs].includes(newTab)) {
          window.gBrowser.removeTab(newTab);
        }
      } catch {
        // ignore
      }
      return false;
    }
  }

  #openEssentials(url) {
    const tabOk = this.#openTrusted(url, "tab");
    if (!tabOk) {
      return false;
    }
    const mgr = window.gZenPinnedTabManager;
    if (!mgr || typeof mgr.addToEssentials !== "function") {
      return true;
    }
    try {
      const tab = window.gBrowser?.selectedTab;
      if (tab) {
        mgr.addToEssentials(tab);
      }
      return true;
    } catch (error) {
      console.warn("[AstraAppHub] addToEssentials failed:", error);
      return true;
    }
  }

  // —— Rendering ——

  #ensureRendered() {
    if (this.#destroyed) {
      return;
    }
    if (
      this.#rendered &&
      this.list?.childElementCount &&
      this.#lastAppliedRevision === gAstraAppHubState.revision
    ) {
      return;
    }
    this.#rebuildList();
  }

  #rebuildList() {
    const list = this.list;
    if (!list) {
      return;
    }
    clearChildren(list);
    this.#focusedItemIndex = -1;

    if (this.#catalogError || !this.#catalog) {
      const msg = document.createXULElement("label");
      msg.classList.add("zen-app-launcher-section-title", "astra-app-hub-error");
      setL10nOrText(
        msg,
        "astra-app-hub-load-error",
        "App Hub could not load. Try again after restarting."
      );
      list.appendChild(msg);
      this.#rendered = true;
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      return;
    }

    const state = gAstraAppHubState.data;
    const appMap = this.#allAppsMap();
    const hidden = new Set(state.hidden || []);
    const favorites = (state.favorites || []).filter(
      id => appMap.has(id) && !hidden.has(id)
    );
    const recent = (state.recent || [])
      .map(e => e.id)
      .filter(id => appMap.has(id) && !hidden.has(id));

    if (state.settings?.showFavorites && favorites.length) {
      this.#appendSection(
        list,
        SECTION_FAVORITES,
        "Favorites",
        "astra-app-hub-favorites",
        favorites.map(id => appMap.get(id)),
        { collapsible: false, special: true }
      );
    }

    if (state.settings?.showRecent && recent.length) {
      this.#appendSection(
        list,
        SECTION_RECENT,
        "Recently Used",
        "astra-app-hub-recent",
        recent.map(id => appMap.get(id)),
        { collapsible: false, special: true }
      );
    }

    const categoryOrder = this.#orderedCategories(state);
    for (const category of categoryOrder) {
      const apps = this.#orderedAppsForCategory(category.id, appMap, state, hidden);
      if (!apps.length && !this.#customizeMode) {
        continue;
      }
      const collapsed = (state.collapsedCategories || []).includes(category.id);
      this.#appendSection(
        list,
        category.id,
        category.label,
        null,
        apps,
        { collapsible: true, collapsed, special: false }
      );
    }

    // Hidden apps section (customize mode only)
    if (this.#customizeMode) {
      const hiddenApps = (state.hidden || [])
        .map(id => appMap.get(id))
        .filter(Boolean);
      if (hiddenApps.length) {
        this.#appendSection(
          list,
          "__hidden__",
          "Hidden",
          "astra-app-hub-hidden",
          hiddenApps,
          { collapsible: false, special: true, hiddenSection: true }
        );
      }
    }

    this.#rendered = true;
    this.#lastAppliedRevision = gAstraAppHubState.revision;
    this.#updateCustomizeChrome();
  }

  #orderedCategories(state) {
    const cats = [...(this.#catalog?.categories || [])];
    const order = state.categoryOrder || [];
    if (!order.length) {
      return cats;
    }
    const byId = new Map(cats.map(c => [c.id, c]));
    const ordered = [];
    for (const id of order) {
      if (byId.has(id)) {
        ordered.push(byId.get(id));
        byId.delete(id);
      }
    }
    for (const c of cats) {
      if (byId.has(c.id)) {
        ordered.push(c);
      }
    }
    return ordered;
  }

  #orderedAppsForCategory(categoryId, appMap, state, hidden) {
    const all = [...appMap.values()].filter(
      a => a.category === categoryId && (!hidden.has(a.id) || this.#customizeMode)
    );
    const order = (state.appOrder && state.appOrder[categoryId]) || [];
    if (!order.length) {
      return all.sort(
        (a, b) =>
          (a.order || 0) - (b.order || 0) ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id)
      );
    }
    const byId = new Map(all.map(a => [a.id, a]));
    const ordered = [];
    for (const id of order) {
      if (byId.has(id)) {
        ordered.push(byId.get(id));
        byId.delete(id);
      }
    }
    for (const a of all) {
      if (byId.has(a.id)) {
        ordered.push(a);
      }
    }
    return ordered;
  }

  #appendSection(list, categoryId, label, l10nId, apps, options = {}) {
    const section = document.createXULElement("vbox");
    section.classList.add("astra-app-hub-section");
    section.setAttribute("data-category-id", categoryId);
    if (options.special) {
      section.setAttribute("data-special", "true");
    }
    if (options.collapsed) {
      section.setAttribute("collapsed-section", "true");
    }

    const header = document.createXULElement("hbox");
    header.classList.add(
      "astra-app-hub-section-header",
      "zen-app-launcher-section-title"
    );
    header.setAttribute("data-category-id", categoryId);
    header.setAttribute("align", "center");

    if (options.collapsible) {
      const toggle = document.createXULElement("toolbarbutton");
      toggle.classList.add("astra-app-hub-collapse-btn");
      toggle.setAttribute("data-action", "toggle-collapse");
      toggle.setAttribute("data-category-id", categoryId);
      toggle.setAttribute(
        "aria-expanded",
        options.collapsed ? "false" : "true"
      );
      toggle.textContent = options.collapsed ? "▸" : "▾";
      header.appendChild(toggle);
    }

    const title = document.createXULElement("label");
    title.classList.add("astra-app-hub-section-label");
    if (l10nId) {
      setL10nOrText(title, l10nId, label);
    } else {
      title.setAttribute("value", label);
    }
    header.appendChild(title);

    if (this.#customizeMode && !options.special) {
      header.setAttribute("draggable", "true");
      header.classList.add("astra-app-hub-draggable");

      const moveUp = document.createXULElement("toolbarbutton");
      moveUp.classList.add("astra-app-hub-move-btn");
      moveUp.setAttribute("data-action", "move-category-up");
      moveUp.setAttribute("data-category-id", categoryId);
      moveUp.setAttribute("tooltiptext", "Move up");
      moveUp.textContent = "↑";
      header.appendChild(moveUp);

      const moveDown = document.createXULElement("toolbarbutton");
      moveDown.classList.add("astra-app-hub-move-btn");
      moveDown.setAttribute("data-action", "move-category-down");
      moveDown.setAttribute("data-category-id", categoryId);
      moveDown.setAttribute("tooltiptext", "Move down");
      moveDown.textContent = "↓";
      header.appendChild(moveDown);
    }

    section.appendChild(header);

    const grid = document.createXULElement("hbox");
    grid.classList.add("zen-app-launcher-grid", "astra-app-hub-grid");
    grid.setAttribute("data-category-id", categoryId);
    if (options.collapsed) {
      grid.hidden = true;
    }

    for (const app of apps) {
      if (!app) {
        continue;
      }
      grid.appendChild(this.#createAppButton(app, options));
    }
    section.appendChild(grid);
    list.appendChild(section);
  }

  #createAppButton(app, sectionOptions = {}) {
    const button = document.createXULElement("toolbarbutton");
    button.classList.add(
      "zen-app-launcher-item",
      "astra-app-hub-item"
    );
    button.setAttribute("data-app-id", app.id);
    button.setAttribute("data-url", app.url);
    button.setAttribute("tooltiptext", app.name);
    if (app.builtin === false || String(app.id).startsWith("custom-")) {
      button.setAttribute("data-custom", "true");
    }
    if (sectionOptions.hiddenSection) {
      button.setAttribute("data-hidden-app", "true");
    }

    const favSet = new Set(gAstraAppHubState.data.favorites || []);
    if (favSet.has(app.id)) {
      button.setAttribute("data-favorite", "true");
    }

    // Icon via resolveAppIcon — never http(s)
    const iconInfo = resolveAppIcon(app);
    const iconBox = document.createXULElement("vbox");
    iconBox.classList.add("astra-app-hub-item-icon-box");
    if (iconInfo.type === "image" && iconInfo.src) {
      const safe = String(iconInfo.src);
      if (
        !safe.startsWith("http:") &&
        !safe.startsWith("https:") &&
        !safe.startsWith("//")
      ) {
        const image = document.createXULElement("image");
        image.classList.add(
          "zen-app-launcher-item-icon",
          "astra-app-hub-item-icon"
        );
        // Match ZenSpaceManager profile-local image pattern (list-style-image /
        // CSS url), which is proven for chrome loading of PathUtils.toFileURI.
        const escaped = safe.replace(/\\/g, "/").replace(/"/g, "%22");
        image.style.listStyleImage = `url("${escaped}")`;
        iconBox.appendChild(image);
      } else {
        this.#appendMonogram(iconBox, app, iconInfo);
      }
    } else {
      this.#appendMonogram(iconBox, app, iconInfo);
    }
    button.appendChild(iconBox);

    const label = document.createXULElement("label");
    label.classList.add(
      "zen-app-launcher-item-label",
      "astra-app-hub-item-label"
    );
    label.setAttribute("value", app.name);
    button.appendChild(label);

    if (!this.#customizeMode) {
      const star = document.createXULElement("toolbarbutton");
      star.classList.add("astra-app-hub-fav-btn");
      star.setAttribute("data-action", "toggle-favorite");
      star.setAttribute("data-app-id", app.id);
      star.setAttribute(
        "tooltiptext",
        favSet.has(app.id) ? "Remove from favorites" : "Add to favorites"
      );
      star.textContent = favSet.has(app.id) ? "★" : "☆";
      button.appendChild(star);
    } else {
      button.setAttribute("draggable", "true");
      button.classList.add("astra-app-hub-draggable");

      const moveUp = document.createXULElement("toolbarbutton");
      moveUp.classList.add("astra-app-hub-move-btn");
      moveUp.setAttribute("data-action", "move-app-up");
      moveUp.setAttribute("data-app-id", app.id);
      moveUp.textContent = "↑";
      button.appendChild(moveUp);

      const moveDown = document.createXULElement("toolbarbutton");
      moveDown.classList.add("astra-app-hub-move-btn");
      moveDown.setAttribute("data-action", "move-app-down");
      moveDown.setAttribute("data-app-id", app.id);
      moveDown.textContent = "↓";
      button.appendChild(moveDown);

      if (sectionOptions.hiddenSection) {
        const restore = document.createXULElement("toolbarbutton");
        restore.classList.add("astra-app-hub-restore-btn");
        restore.setAttribute("data-action", "restore-app");
        restore.setAttribute("data-app-id", app.id);
        restore.textContent = "↩";
        button.appendChild(restore);
      }
    }

    return button;
  }

  #appendMonogram(parent, app, iconInfo) {
    const mono = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    mono.classList.add("astra-app-hub-item-monogram");
    mono.setAttribute(
      "data-accent",
      String(iconInfo?.accent ?? 0)
    );
    mono.textContent = iconInfo?.text || "?";
    parent.appendChild(mono);
  }

  #updateCustomizeChrome() {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    if (this.#customizeMode) {
      panel.setAttribute("customize-mode", "true");
    } else {
      panel.removeAttribute("customize-mode");
    }
    const customizeBtn = document.getElementById("astra-app-hub-customize-btn");
    const doneBtn = document.getElementById("astra-app-hub-done-btn");
    if (customizeBtn) {
      customizeBtn.hidden = this.#customizeMode || !!this.#editorMode;
    }
    if (doneBtn) {
      doneBtn.hidden = !this.#customizeMode;
    }
    const search = this.searchInput;
    if (search) {
      search.disabled = this.#customizeMode || !!this.#editorMode;
    }
    const footer = document.getElementById("astra-app-hub-footer");
    if (footer) {
      footer.hidden = !!this.#editorMode;
    }
    const list = this.list;
    if (list) {
      list.hidden = !!this.#editorMode;
    }
    const editor = this.editor;
    if (editor) {
      editor.hidden = !this.#editorMode;
    }
  }

  // —— Search ——

  #onInput(event) {
    const target = event.target;
    if (!target || target.id !== "astra-app-hub-search") {
      return;
    }
    const q = normalizeSearchQuery(target.value);
    this.#searchQuery = q;
    const clearBtn = document.getElementById("astra-app-hub-search-clear");
    if (clearBtn) {
      clearBtn.hidden = !q;
    }
    this.#applySearchFilter(q);
  }

  #applySearchFilter(query) {
    const list = this.list;
    if (!list) {
      return;
    }
    const status = document.getElementById("astra-app-hub-search-status");
    if (!query) {
      for (const section of list.querySelectorAll(".astra-app-hub-section")) {
        section.hidden = false;
        const catId = section.getAttribute("data-category-id");
        const collapsed =
          catId &&
          (gAstraAppHubState.data.collapsedCategories || []).includes(catId);
        const grid = section.querySelector(".astra-app-hub-grid");
        if (grid && section.getAttribute("data-special") !== "true") {
          if (collapsed) {
            grid.hidden = true;
            section.setAttribute("collapsed-section", "true");
          } else {
            grid.hidden = false;
            section.removeAttribute("collapsed-section");
          }
        }
        for (const item of section.querySelectorAll(".astra-app-hub-item")) {
          item.hidden = false;
        }
      }
      if (status) {
        status.hidden = true;
        status.setAttribute("value", "");
      }
      return;
    }

    const appMap = this.#allAppsMap();
    let matchCount = 0;
    for (const section of list.querySelectorAll(".astra-app-hub-section")) {
      let sectionMatch = false;
      const catId = section.getAttribute("data-category-id");
      const catLabel =
        section
          .querySelector(".astra-app-hub-section-label")
          ?.getAttribute("value") || "";
      for (const item of section.querySelectorAll(".astra-app-hub-item")) {
        const appId = item.getAttribute("data-app-id");
        const app = appMap.get(appId);
        const matches = app ? this.#appMatchesQuery(app, catLabel, query) : false;
        item.hidden = !matches;
        if (matches) {
          sectionMatch = true;
          matchCount += 1;
        }
      }
      section.hidden = !sectionMatch;
      if (sectionMatch) {
        const grid = section.querySelector(".astra-app-hub-grid");
        if (grid) {
          grid.hidden = false;
        }
        // Temporarily reveal collapsed categories with matches
        section.removeAttribute("collapsed-section");
      }
    }
    if (status) {
      status.hidden = false;
      status.setAttribute(
        "value",
        matchCount ? `${matchCount} matches` : "No matches"
      );
    }
  }

  #appMatchesQuery(app, categoryLabel, query) {
    const hay = normalizeSearchQuery(
      [
        app.name,
        categoryLabel,
        ...(app.keywords || []),
        app.hostname || hostnameFromUrl(app.url),
      ].join(" ")
    );
    return hay.includes(query);
  }

  #clearSearch() {
    const search = this.searchInput;
    if (search) {
      search.value = "";
    }
    this.#searchQuery = "";
    const clearBtn = document.getElementById("astra-app-hub-search-clear");
    if (clearBtn) {
      clearBtn.hidden = true;
    }
    this.#applySearchFilter("");
  }

  // —— Events ——

  #onCommand(event) {
    const target = event.target;
    if (!target) {
      return;
    }
    const action =
      target.getAttribute?.("data-action") ||
      target.closest?.("[data-action]")?.getAttribute("data-action");

    if (action) {
      void this.#handleAction(action, target, event);
      return;
    }

    if (this.#suppressLaunch || this.#customizeMode || this.#editorMode) {
      return;
    }
    const item =
      typeof target.closest === "function"
        ? target.closest(".astra-app-hub-item[data-app-id]")
        : null;
    if (!item || item.hidden) {
      return;
    }
    // Ignore favorite star clicks (handled via data-action)
    if (
      typeof target.closest === "function" &&
      target.closest("[data-action]")
    ) {
      return;
    }
    const appId = item.getAttribute("data-app-id");
    if (appId) {
      void this.openApp(appId, { mode: "tab", source: "item" });
    }
  }

  #onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }
    const actionEl = target.closest("[data-action]");
    if (!actionEl) {
      return;
    }
    // XUL toolbarbuttons fire command; html buttons / spans need click.
    if (actionEl.localName === "toolbarbutton" || actionEl.localName === "menuitem") {
      return;
    }
    const action = actionEl.getAttribute("data-action");
    if (action) {
      event.preventDefault();
      void this.#handleAction(action, actionEl, event);
    }
  }

  async #handleAction(action, target, event) {
    const appId =
      target.getAttribute("data-app-id") ||
      this.#contextAppId ||
      target.closest?.("[data-app-id]")?.getAttribute("data-app-id");
    const categoryId =
      target.getAttribute("data-category-id") ||
      target.closest?.("[data-category-id]")?.getAttribute("data-category-id");

    switch (action) {
      case "clear-search":
        this.#clearSearch();
        this.searchInput?.focus();
        break;
      case "customize":
        this.#enterCustomizeMode();
        break;
      case "done-customize":
        this.#exitCustomizeMode();
        break;
      case "add-app":
        this.#openEditor("add");
        break;
      case "overflow":
        this.#openOverflowMenu(event);
        break;
      case "toggle-favorite":
        if (appId) {
          await gAstraAppHubState.toggleFavorite(appId);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
          if (this.#searchQuery) {
            this.#applySearchFilter(this.#searchQuery);
          }
        }
        break;
      case "favorite":
        if (this.#contextAppId) {
          await gAstraAppHubState.toggleFavorite(this.#contextAppId);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "hide":
        if (this.#contextAppId) {
          await gAstraAppHubState.hideApp(this.#contextAppId);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "edit":
        if (this.#contextAppId?.startsWith("custom-")) {
          this.#openEditor("edit", this.#contextAppId);
        }
        break;
      case "delete":
        await this.#deleteCustomApp(this.#contextAppId);
        break;
      case "restore-app":
        if (appId) {
          await gAstraAppHubState.restoreHidden([appId]);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "toggle-collapse":
        if (categoryId) {
          const collapsed = (
            gAstraAppHubState.data.collapsedCategories || []
          ).includes(categoryId);
          await gAstraAppHubState.setCollapsed(categoryId, !collapsed);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "move-category-up":
        await this.#moveCategory(categoryId, -1);
        break;
      case "move-category-down":
        await this.#moveCategory(categoryId, 1);
        break;
      case "move-app-up":
        await this.#moveApp(appId, -1);
        break;
      case "move-app-down":
        await this.#moveApp(appId, 1);
        break;
      case "open":
      case "tab":
      case "current":
      case "window":
      case "private":
      case "split":
      case "essentials":
        if (this.#contextAppId || appId) {
          void this.openApp(this.#contextAppId || appId, { mode: action });
        }
        break;
      case "workspace": {
        const wsId = target.getAttribute("data-workspace-id");
        if ((this.#contextAppId || appId) && wsId) {
          void this.openApp(this.#contextAppId || appId, {
            mode: "workspace",
            workspaceId: wsId,
          });
        }
        break;
      }
      case "editor-save":
        await this.#saveEditor();
        break;
      case "editor-cancel":
        this.#closeEditor();
        break;
      case "pick-icon":
        await this.#pickEditorIcon();
        break;
      case "export":
        await this.#exportState();
        break;
      case "import":
        await this.#importState();
        break;
      case "clear-recent":
        if (
          confirmPrompt(
            "App Hub",
            "Clear the Recently Used list?"
          )
        ) {
          await gAstraAppHubState.clearRecent();
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "clear-favorites":
        if (confirmPrompt("App Hub", "Clear all favorites?")) {
          await gAstraAppHubState.clearFavorites();
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "restore-hidden":
        if (confirmPrompt("App Hub", "Restore all hidden apps?")) {
          await gAstraAppHubState.restoreHidden(null);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "reset-layout":
        if (
          confirmPrompt(
            "App Hub",
            "Reset category and app order to defaults?"
          )
        ) {
          await gAstraAppHubState.resetLayout();
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "reset-all":
        if (
          confirmPrompt(
            "App Hub",
            "Reset App Hub completely? This removes favorites, custom apps, and layout."
          )
        ) {
          await gAstraAppHubState.resetComplete();
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
        break;
      case "toggle-recent":
        await gAstraAppHubState.update(state => {
          state.settings.showRecent = !state.settings.showRecent;
          return state;
        });
        this.#lastAppliedRevision = gAstraAppHubState.revision;
        this.#rendered = false;
        this.#rebuildList();
        break;
      case "toggle-favorites":
        await gAstraAppHubState.update(state => {
          state.settings.showFavorites = !state.settings.showFavorites;
          return state;
        });
        this.#lastAppliedRevision = gAstraAppHubState.revision;
        this.#rendered = false;
        this.#rebuildList();
        break;
      default:
        break;
    }
  }

  #enterCustomizeMode() {
    this.#customizeMode = true;
    this.#clearSearch();
    this.#rendered = false;
    this.#rebuildList();
  }

  #exitCustomizeMode() {
    this.#customizeMode = false;
    this.#dragState = null;
    this.#rendered = false;
    this.#rebuildList();
  }

  #openOverflowMenu(event) {
    const menu = this.overflowMenu;
    const btn = document.getElementById("astra-app-hub-overflow-btn");
    if (!menu || !btn) {
      return;
    }
    this.#syncOverflowChecks();
    try {
      menu.openPopup(
        btn,
        "before_end",
        0,
        0,
        true,
        false,
        event?.sourceEvent || event
      );
    } catch (error) {
      console.warn("[AstraAppHub] overflow menu failed:", error);
    }
  }

  #syncOverflowChecks() {
    const recent = document.getElementById("astra-app-hub-overflow-toggle-recent");
    const favs = document.getElementById(
      "astra-app-hub-overflow-toggle-favorites"
    );
    const settings = gAstraAppHubState.data.settings || {};
    if (recent) {
      if (settings.showRecent) {
        recent.setAttribute("checked", "true");
      } else {
        recent.removeAttribute("checked");
      }
    }
    if (favs) {
      if (settings.showFavorites) {
        favs.setAttribute("checked", "true");
      } else {
        favs.removeAttribute("checked");
      }
    }
  }

  #onContextMenu(event) {
    if (this.#editorMode) {
      return;
    }
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }
    const item = target.closest(".astra-app-hub-item[data-app-id]");
    if (!item) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.#contextAppId = item.getAttribute("data-app-id");
    this.#showContextMenuFor(item, event);
  }

  #showContextMenuFor(item, event) {
    const menu = this.contextMenu;
    if (!menu || !this.#contextAppId) {
      return;
    }
    const app = this.#allAppsMap().get(this.#contextAppId);
    const isCustom = !!app && (!app.builtin || String(app.id).startsWith("custom-"));
    const isFav = (gAstraAppHubState.data.favorites || []).includes(
      this.#contextAppId
    );

    const favItem = document.getElementById("astra-app-hub-ctx-favorite");
    if (favItem) {
      setL10nOrText(
        favItem,
        isFav ? "astra-app-hub-ctx-unfavorite" : "astra-app-hub-ctx-favorite",
        isFav ? "Remove from Favorites" : "Add to Favorites"
      );
    }
    const editItem = document.getElementById("astra-app-hub-ctx-edit");
    const deleteItem = document.getElementById("astra-app-hub-ctx-delete");
    const hideItem = document.getElementById("astra-app-hub-ctx-hide");
    const isHiddenApp = !!(
      app && (gAstraAppHubState.data.hidden || []).includes(app.id)
    );
    if (editItem) {
      editItem.hidden = !isCustom;
    }
    if (deleteItem) {
      deleteItem.hidden = !isCustom;
    }
    if (hideItem) {
      // Built-in apps hide; custom apps delete. Hidden apps use restore via customize.
      hideItem.hidden = isCustom || isHiddenApp;
      if (!hideItem.hidden) {
        setL10nOrText(hideItem, "astra-app-hub-ctx-hide", "Hide from App Hub");
      }
    }

    // Capability detection
    const splitItem = document.getElementById("astra-app-hub-ctx-split");
    if (splitItem) {
      splitItem.hidden = !(
        window.gZenViewSplitter &&
        typeof window.gZenViewSplitter.openAndSwitchToTab === "function" &&
        typeof window.gZenViewSplitter.splitTabs === "function"
      );
    }
    const essItem = document.getElementById("astra-app-hub-ctx-essentials");
    if (essItem) {
      essItem.hidden = !(
        window.gZenPinnedTabManager &&
        typeof window.gZenPinnedTabManager.addToEssentials === "function"
      );
    }
    const wsMenu = document.getElementById("astra-app-hub-ctx-workspace");
    if (wsMenu) {
      const hasWs =
        window.gZenWorkspaces &&
        window.gZenWorkspaces.workspaceEnabled &&
        typeof window.gZenWorkspaces.getWorkspaces === "function" &&
        typeof window.gZenWorkspaces.moveTabToWorkspace === "function";
      wsMenu.hidden = !hasWs;
      if (hasWs) {
        this.#populateWorkspaceSubmenu();
      }
    }
    const privItem = document.getElementById("astra-app-hub-ctx-private");
    if (privItem) {
      privItem.hidden = typeof OpenBrowserWindow !== "function";
    }

    // PWA intentionally omitted / never shown

    try {
      if (event && typeof menu.openPopupAtScreen === "function") {
        menu.openPopupAtScreen(event.screenX, event.screenY, true, event);
      } else {
        menu.openPopup(item, "after_start", 0, 0, true, false, event);
      }
    } catch (error) {
      console.warn("[AstraAppHub] context menu failed:", error);
    }
  }

  #populateWorkspaceSubmenu() {
    const popup = document.getElementById("astra-app-hub-ctx-workspace-popup");
    if (!popup) {
      return;
    }
    clearChildren(popup);
    const ws = window.gZenWorkspaces;
    if (!ws || typeof ws.getWorkspaces !== "function") {
      // Fallback: open in active workspace only
      const item = document.createXULElement("menuitem");
      item.setAttribute("data-action", "workspace");
      item.setAttribute(
        "data-workspace-id",
        ws?.activeWorkspace || ""
      );
      setL10nOrText(
        item,
        "astra-app-hub-ctx-workspace-current",
        "Current workspace"
      );
      popup.appendChild(item);
      return;
    }
    let spaces = [];
    try {
      spaces = ws.getWorkspaces() || [];
    } catch {
      spaces = [];
    }
    if (!spaces.length) {
      const item = document.createXULElement("menuitem");
      item.setAttribute("data-action", "workspace");
      item.setAttribute("data-workspace-id", ws.activeWorkspace || "");
      setL10nOrText(
        item,
        "astra-app-hub-ctx-workspace-current",
        "Current workspace"
      );
      popup.appendChild(item);
      return;
    }
    for (const space of spaces) {
      const item = document.createXULElement("menuitem");
      item.setAttribute("data-action", "workspace");
      item.setAttribute("data-workspace-id", space.uuid);
      item.setAttribute("label", space.name || space.uuid);
      if (space.uuid === ws.activeWorkspace) {
        item.setAttribute("default", "true");
      }
      popup.appendChild(item);
    }
  }

  async #deleteCustomApp(appId) {
    if (!appId || !appId.startsWith("custom-")) {
      return;
    }
    const app = this.#allAppsMap().get(appId);
    const name = app?.name || appId;
    if (
      !confirmPrompt(
        "Delete App",
        `Delete custom app “${name}”? This cannot be undone.`
      )
    ) {
      return;
    }
    await gAstraAppHubState.deleteCustomApp(appId);
    this.#lastAppliedRevision = gAstraAppHubState.revision;
    this.#rendered = false;
    this.#rebuildList();
  }

  // —— Editor ——

  #openEditor(mode, appId = null) {
    this.#editorMode = mode;
    this.#editingAppId = appId;
    this.#pendingIconFile = null;
    this.#updateCustomizeChrome();

    const nameEl = document.getElementById("astra-app-hub-editor-name");
    const urlEl = document.getElementById("astra-app-hub-editor-url");
    const catEl = document.getElementById("astra-app-hub-editor-category");
    const kwEl = document.getElementById("astra-app-hub-editor-keywords");
    const errEl = document.getElementById("astra-app-hub-editor-error");
    if (errEl) {
      errEl.hidden = true;
      errEl.setAttribute("value", "");
    }

    // Populate categories
    if (catEl) {
      clearChildren(catEl);
      for (const cat of this.#catalog?.categories || []) {
        const opt = document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "option"
        );
        opt.value = cat.id;
        opt.textContent = cat.label;
        catEl.appendChild(opt);
      }
    }

    if (mode === "edit" && appId) {
      const app = this.#allAppsMap().get(appId);
      if (nameEl) {
        nameEl.value = app?.name || "";
      }
      if (urlEl) {
        urlEl.value = app?.url || "";
      }
      if (catEl && app?.category) {
        catEl.value = app.category;
      }
      if (kwEl) {
        kwEl.value = (app?.keywords || []).join(", ");
      }
    } else {
      if (nameEl) {
        nameEl.value = "";
      }
      if (urlEl) {
        urlEl.value = "https://";
      }
      if (catEl && catEl.options.length) {
        catEl.value = "productivity";
      }
      if (kwEl) {
        kwEl.value = "";
      }
    }
    nameEl?.focus();
  }

  #closeEditor() {
    this.#editorMode = null;
    this.#editingAppId = null;
    this.#pendingIconFile = null;
    this.#updateCustomizeChrome();
    this.#rendered = false;
    this.#rebuildList();
  }

  async #pickEditorIcon() {
    try {
      const fileName = await pickAndStoreCustomIcon(window);
      if (fileName) {
        this.#pendingIconFile = fileName;
      }
    } catch (error) {
      console.warn("[AstraAppHub] icon pick failed:", error);
      this.#setEditorError("Could not store icon. Use PNG, WebP, or ICO.");
    }
  }

  #setEditorError(message) {
    const errEl = document.getElementById("astra-app-hub-editor-error");
    if (!errEl) {
      return;
    }
    errEl.hidden = !message;
    errEl.setAttribute("value", message || "");
  }

  async #saveEditor() {
    const nameEl = document.getElementById("astra-app-hub-editor-name");
    const urlEl = document.getElementById("astra-app-hub-editor-url");
    const catEl = document.getElementById("astra-app-hub-editor-category");
    const kwEl = document.getElementById("astra-app-hub-editor-keywords");
    const name = (nameEl?.value || "").trim();
    const url = (urlEl?.value || "").trim();
    const category = catEl?.value || "productivity";
    const keywords = (kwEl?.value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (!name) {
      this.#setEditorError("Name is required.");
      return;
    }
    const urlCheck = validateAppUrl(url);
    if (!urlCheck.ok) {
      this.#setEditorError(`Invalid URL (${urlCheck.reason}). HTTPS only.`);
      return;
    }

    const payload = {
      name,
      url: urlCheck.href,
      category,
      keywords,
    };
    if (this.#pendingIconFile) {
      payload.icon = this.#pendingIconFile;
    }

    try {
      if (this.#editorMode === "edit" && this.#editingAppId) {
        await gAstraAppHubState.updateCustomApp(this.#editingAppId, payload);
      } else {
        await gAstraAppHubState.addCustomApp(payload);
      }
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      this.#closeEditor();
    } catch (error) {
      const reason = error?.message || String(error);
      const messages = {
        "duplicate-url": "An app with this URL already exists.",
        "custom-limit": "Custom app limit reached.",
        "empty-name": "Name is required.",
        "not-found": "App not found.",
      };
      this.#setEditorError(messages[reason] || `Could not save (${reason}).`);
    }
  }

  // —— Reorder ——

  async #moveCategory(categoryId, delta) {
    if (!categoryId || categoryId.startsWith("__")) {
      return;
    }
    const order = this.#orderedCategories(gAstraAppHubState.data).map(c => c.id);
    const idx = order.indexOf(categoryId);
    if (idx < 0) {
      return;
    }
    const next = idx + delta;
    if (next < 0 || next >= order.length) {
      return;
    }
    [order[idx], order[next]] = [order[next], order[idx]];
    await gAstraAppHubState.setCategoryOrder(order);
    this.#lastAppliedRevision = gAstraAppHubState.revision;
    this.#rendered = false;
    this.#rebuildList();
  }

  async #moveApp(appId, delta) {
    const app = this.#allAppsMap().get(appId);
    if (!app) {
      return;
    }
    const state = gAstraAppHubState.data;
    const hidden = new Set(state.hidden || []);
    const apps = this.#orderedAppsForCategory(
      app.category,
      this.#allAppsMap(),
      state,
      hidden
    );
    const ids = apps.map(a => a.id);
    const idx = ids.indexOf(appId);
    if (idx < 0) {
      return;
    }
    const next = idx + delta;
    if (next < 0 || next >= ids.length) {
      return;
    }
    [ids[idx], ids[next]] = [ids[next], ids[idx]];
    await gAstraAppHubState.setAppOrder(app.category, ids);
    this.#lastAppliedRevision = gAstraAppHubState.revision;
    this.#rendered = false;
    this.#rebuildList();
  }

  #onDragStart(event) {
    if (!this.#customizeMode) {
      return;
    }
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }
    const item = target.closest(
      ".astra-app-hub-item[draggable], .astra-app-hub-section-header[draggable]"
    );
    if (!item) {
      return;
    }
    this.#suppressLaunch = true;
    const isApp = item.classList.contains("astra-app-hub-item");
    this.#dragState = {
      type: isApp ? "app" : "category",
      id: isApp
        ? item.getAttribute("data-app-id")
        : item.getAttribute("data-category-id"),
      categoryId: isApp
        ? item.closest("[data-category-id]")?.getAttribute("data-category-id")
        : item.getAttribute("data-category-id"),
    };
    item.setAttribute("data-dragging", "true");
    try {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", this.#dragState.id || "");
    } catch {
      // ignore
    }
  }

  #onDragOver(event) {
    if (!this.#customizeMode || !this.#dragState) {
      return;
    }
    event.preventDefault();
    try {
      event.dataTransfer.dropEffect = "move";
    } catch {
      // ignore
    }
  }

  async #onDrop(event) {
    if (!this.#customizeMode || !this.#dragState) {
      return;
    }
    event.preventDefault();
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    if (this.#dragState.type === "category") {
      const header = target.closest(
        ".astra-app-hub-section-header[data-category-id]"
      );
      const dropId = header?.getAttribute("data-category-id");
      if (dropId && dropId !== this.#dragState.id && !dropId.startsWith("__")) {
        const order = this.#orderedCategories(gAstraAppHubState.data).map(
          c => c.id
        );
        const from = order.indexOf(this.#dragState.id);
        const to = order.indexOf(dropId);
        if (from >= 0 && to >= 0) {
          order.splice(from, 1);
          order.splice(to, 0, this.#dragState.id);
          await gAstraAppHubState.setCategoryOrder(order);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
      }
    } else if (this.#dragState.type === "app") {
      const dropItem = target.closest(".astra-app-hub-item[data-app-id]");
      const dropAppId = dropItem?.getAttribute("data-app-id");
      const dropCat =
        dropItem
          ?.closest("[data-category-id]")
          ?.getAttribute("data-category-id") || this.#dragState.categoryId;
      if (
        dropAppId &&
        dropAppId !== this.#dragState.id &&
        dropCat &&
        !dropCat.startsWith("__")
      ) {
        const state = gAstraAppHubState.data;
        const hidden = new Set(state.hidden || []);
        const apps = this.#orderedAppsForCategory(
          dropCat,
          this.#allAppsMap(),
          state,
          hidden
        );
        let ids = apps.map(a => a.id);
        // If moving across categories, update app.category via custom only —
        // for builtins keep within same category.
        const dragApp = this.#allAppsMap().get(this.#dragState.id);
        if (dragApp && dragApp.category !== dropCat) {
          // Only allow same-category reorder for built-ins; custom can stay put.
          if (dragApp.category === dropCat || !dragApp.builtin) {
            // For Phase 2: restrict reorder to same category
          }
          if (dragApp.category !== dropCat) {
            this.#onDragEnd();
            return;
          }
        }
        const from = ids.indexOf(this.#dragState.id);
        const to = ids.indexOf(dropAppId);
        if (from >= 0 && to >= 0) {
          ids.splice(from, 1);
          ids.splice(to, 0, this.#dragState.id);
          await gAstraAppHubState.setAppOrder(dropCat, ids);
          this.#lastAppliedRevision = gAstraAppHubState.revision;
          this.#rendered = false;
          this.#rebuildList();
        }
      }
    }
    this.#onDragEnd();
  }

  #onDragEnd() {
    const dragging = this.list?.querySelectorAll("[data-dragging]");
    if (dragging) {
      for (const el of dragging) {
        el.removeAttribute("data-dragging");
      }
    }
    this.#dragState = null;
    // Prevent accidental launch after drag
    setTimeout(() => {
      this.#suppressLaunch = false;
    }, 0);
  }

  // —— Import / Export ——

  async #exportState() {
    try {
      const fp = Cc["@mozilla.org/filepicker;1"].createInstance(
        Ci.nsIFilePicker
      );
      fp.init(
        window.browsingContext,
        "Export App Hub",
        Ci.nsIFilePicker.modeSave
      );
      fp.appendFilter("JSON", "*.json");
      fp.defaultString = "astra-app-hub-export.json";
      fp.defaultExtension = "json";
      const result = await new Promise(resolve => fp.open(resolve));
      if (
        result !== Ci.nsIFilePicker.returnOK &&
        result !== Ci.nsIFilePicker.returnReplace
      ) {
        return;
      }
      const payload = gAstraAppHubState.buildExportPayload();
      const json = JSON.stringify(payload, null, 2);
      await IOUtils.writeUTF8(fp.file.path, json, {
        tmpPath: `${fp.file.path}.tmp`,
      });
    } catch (error) {
      console.error("[AstraAppHub] export failed:", error);
      try {
        window.gZenUIManager?.showToast?.("zen-general-error");
      } catch {
        // ignore
      }
    }
  }

  async #importState() {
    try {
      const fp = Cc["@mozilla.org/filepicker;1"].createInstance(
        Ci.nsIFilePicker
      );
      fp.init(
        window.browsingContext,
        "Import App Hub",
        Ci.nsIFilePicker.modeOpen
      );
      fp.appendFilter("JSON", "*.json");
      const result = await new Promise(resolve => fp.open(resolve));
      if (result !== Ci.nsIFilePicker.returnOK || !fp.file) {
        return;
      }
      // Cap import payload size (~2 MiB) before parsing.
      try {
        const stat = await IOUtils.stat(fp.file.path);
        if (stat.size > 2 * 1024 * 1024) {
          throw new Error("file-too-large");
        }
      } catch (error) {
        if (error?.message === "file-too-large") {
          throw error;
        }
      }
      const text = await IOUtils.readUTF8(fp.file.path);
      let raw;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error("invalid-json");
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("malformed");
      }
      const apps = Array.isArray(raw.customApps) ? raw.customApps.length : 0;
      const favorites = Array.isArray(raw.favorites) ? raw.favorites.length : 0;
      const hidden = Array.isArray(raw.hidden) ? raw.hidden.length : 0;
      if (
        !confirmPrompt(
          "Import App Hub",
          `Replace current App Hub configuration?\n\nPreview: ${apps} custom apps, ${favorites} favorites, ${hidden} hidden apps.\nA backup will be created first.`
        )
      ) {
        return;
      }
      await gAstraAppHubState.importReplace(raw);
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      this.#rendered = false;
      this.#rebuildList();
    } catch (error) {
      console.error("[AstraAppHub] import failed:", error);
      confirmPrompt(
        "Import Failed",
        `Could not import App Hub data: ${error?.message || error}`
      );
    }
  }

  // —— Focus / popup ——

  #resolveAnchor(event) {
    const isUsableAnchor = node => {
      if (
        !node ||
        !node.isConnected ||
        typeof node.getBoundingClientRect !== "function"
      ) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };
    const eventAnchor = event?.sourceEvent?.target || event?.target;
    return (
      (isUsableAnchor(eventAnchor) && eventAnchor) ||
      document.getElementById("zen-app-launcher-button") ||
      document.getElementById("zen-sidebar-top-buttons-separator") ||
      document.getElementById("zen-sidebar-top-buttons") ||
      document.getElementById("nav-bar") ||
      document.getElementById("browser")
    );
  }

  #capturePriorFocus() {
    try {
      const focused =
        Services.focus.focusedElement || document.activeElement || null;
      this.#priorFocus =
        focused && focused.isConnected && focused.ownerGlobal === window
          ? focused
          : null;
    } catch {
      this.#priorFocus = null;
    }
  }

  #restorePriorFocus() {
    const prior = this.#priorFocus;
    this.#priorFocus = null;
    if (!prior || !prior.isConnected || prior.ownerGlobal !== window) {
      return;
    }
    try {
      Services.focus.setFocus(prior, Services.focus.FLAG_NOSCROLL);
    } catch {
      try {
        prior.focus();
      } catch {
        // ignore
      }
    }
  }

  #onPopupShown() {
    this.#popupTransition = false;
    if (this.#destroyed) {
      return;
    }
    this.#updateShortcutHint();
    // Keyboard open focuses search; mouse open does not steal focus.
    if (this.#openSource === "keyboard") {
      const search = this.searchInput;
      if (search) {
        try {
          search.focus();
          search.select?.();
        } catch {
          // ignore
        }
      }
    }
  }

  #onPopupHidden() {
    this.#popupTransition = false;
    let needsRebuild = false;
    if (this.#editorMode) {
      this.#editorMode = null;
      this.#editingAppId = null;
      this.#pendingIconFile = null;
      needsRebuild = true;
      this.#updateCustomizeChrome();
    }
    if (this.#customizeMode) {
      this.#customizeMode = false;
      needsRebuild = true;
      this.#updateCustomizeChrome();
    }
    if (needsRebuild) {
      this.#rendered = false;
    }
    this.#clearSearch();
    this.#restorePriorFocus();
    this.#openSource = "unknown";
    this.#contextAppId = null;
    this.#dragState = null;
    this.#suppressLaunch = false;
  }

  #visibleItems() {
    return [
      ...(this.list?.querySelectorAll(
        ".astra-app-hub-item:not([hidden])"
      ) || []),
    ].filter(el => {
      const section = el.closest(".astra-app-hub-section");
      return section && !section.hidden;
    });
  }

  #focusItemAt(index) {
    const items = this.#visibleItems();
    if (!items.length) {
      return;
    }
    const i = Math.max(0, Math.min(items.length - 1, index));
    this.#focusedItemIndex = i;
    try {
      items[i].focus();
    } catch {
      // ignore
    }
  }

  #onPanelKeydown(event) {
    if (this.#destroyed) {
      return;
    }

    if (event.key === "Escape") {
      event.stopPropagation();
      if (this.#dragState) {
        this.#onDragEnd();
        return;
      }
      if (this.#editorMode) {
        this.#closeEditor();
        return;
      }
      if (this.#customizeMode) {
        this.#exitCustomizeMode();
        return;
      }
      if (this.#searchQuery) {
        this.#clearSearch();
        this.searchInput?.focus();
        return;
      }
      if (this.isOpen && !this.#popupTransition) {
        this.close({ restoreFocus: true });
      }
      return;
    }

    // Enter/Space: rely on XUL toolbarbutton "command" — do not double-fire on keydown.
    if (event.key === "Enter" || event.key === " ") {
      return;
    }

    if (event.key === "F10" && event.shiftKey) {
      const active = document.activeElement?.closest?.(
        ".astra-app-hub-item[data-app-id]"
      );
      if (active) {
        event.preventDefault();
        this.#contextAppId = active.getAttribute("data-app-id");
        this.#showContextMenuFor(active, event);
      }
      return;
    }

    if (event.key === "ContextMenu") {
      const active = document.activeElement?.closest?.(
        ".astra-app-hub-item[data-app-id]"
      );
      if (active) {
        event.preventDefault();
        this.#contextAppId = active.getAttribute("data-app-id");
        this.#showContextMenuFor(active, event);
      }
      return;
    }

    const search = this.searchInput;
    const inSearch = search && document.activeElement === search;

    if (inSearch && event.key === "ArrowDown") {
      event.preventDefault();
      this.#focusItemAt(0);
      return;
    }

    if (inSearch) {
      return;
    }

    const items = this.#visibleItems();
    if (!items.length) {
      return;
    }

    let idx = items.indexOf(document.activeElement);
    if (idx < 0) {
      idx = this.#focusedItemIndex;
    }

    const cols = 4;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        this.#focusItemAt(idx < 0 ? 0 : idx + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        this.#focusItemAt(idx < 0 ? 0 : idx - 1);
        break;
      case "ArrowDown":
        event.preventDefault();
        this.#focusItemAt(idx < 0 ? 0 : idx + cols);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (idx <= 0) {
          search?.focus();
        } else {
          this.#focusItemAt(idx - cols);
        }
        break;
      case "Home":
        event.preventDefault();
        this.#focusItemAt(0);
        break;
      case "End":
        event.preventDefault();
        this.#focusItemAt(items.length - 1);
        break;
      default:
        break;
    }
  }
}

// Per-window instance via ChromeUtils.importESModule(..., { global: "current" })
new AstraAppHubManager();
