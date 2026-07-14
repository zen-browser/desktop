/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Per-window Astra App Hub controller.
 * Catalog: chrome packaged JSON. State: profile-local foundation only.
 */

const CATALOG_URL =
  "chrome://browser/content/zen-components/astra-app-hub-catalog.json";
const CATALOG_SCHEMA_VERSION = 1;
const FORBIDDEN_SCHEMES = new Set([
  "javascript",
  "data",
  "file",
  "chrome",
  "resource",
  "about",
  "moz-extension",
  "blob",
  "view-source",
]);

const { gAstraAppHubState } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/AstraAppHubState.mjs"
);

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Validate built-in catalog HTTPS URLs.
 * @returns {{ ok: true, href: string } | { ok: false, reason: string }}
 */
export function validateBuiltinAppUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return { ok: false, reason: "empty" };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "unparseable" };
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "https") {
    return { ok: false, reason: `scheme:${scheme}` };
  }
  if (FORBIDDEN_SCHEMES.has(scheme)) {
    return { ok: false, reason: `forbidden:${scheme}` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials" };
  }
  if (!parsed.hostname || parsed.hostname.includes(" ")) {
    return { ok: false, reason: "hostname" };
  }
  return { ok: true, href: parsed.href };
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
    const urlCheck = validateBuiltinAppUrl(app.url);
    if (!urlCheck.ok) {
      console.warn(
        `[AstraAppHub] app ${app.id} invalid url (${urlCheck.reason}); skipped`
      );
      continue;
    }
    appIds.add(app.id);
    apps.push({
      id: app.id,
      name: typeof app.name === "string" ? app.name : app.id,
      url: urlCheck.href,
      category: app.category,
      icon: typeof app.icon === "string" ? app.icon : "",
      order: Number.isFinite(app.order) ? app.order : 0,
      builtin: app.builtin !== false,
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
  #catalog = null;
  #catalogError = null;
  #rendered = false;
  #priorFocus = null;
  #openSource = "unknown";
  #boundCommand = null;
  #boundPopupShown = null;
  #boundPopupHidden = null;
  #boundKeydown = null;
  #popupTransition = false;

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

    // Warm catalog asynchronously; never block startup.
    void this.init().catch(error => {
      console.error("[AstraAppHub] background init failed:", error);
    });
  }

  #normalizeCompatArgs(eventOrOptions) {
    // Options bag: plain object with known keys. Never treat Event/Window as options.
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

  get list() {
    return document.getElementById("PanelUI-zen-app-launcher-list");
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
      const response = await fetch(CATALOG_URL);
      if (!response.ok) {
        throw new Error(`catalog fetch failed: ${response.status}`);
      }
      const raw = await response.json();
      this.#catalog = validateCatalog(raw);
      this.#catalogError = null;
      this.#bindPanelListeners();
      this.#initialized = true;
      return this.#catalog;
    } catch (error) {
      this.#catalog = null;
      this.#catalogError = error;
      this.#initialized = true;
      console.error("[AstraAppHub] catalog load failed:", error);
      this.#bindPanelListeners();
      return null;
    }
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#unbindPanelListeners();
    this.#priorFocus = null;
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
    panel.addEventListener("command", this.#boundCommand);
    panel.addEventListener("popupshown", this.#boundPopupShown);
    panel.addEventListener("popuphidden", this.#boundPopupHidden);
    panel.addEventListener("keydown", this.#boundKeydown);
  }

  #unbindPanelListeners() {
    const panel = this.panel;
    if (!panel || !this.#boundCommand) {
      return;
    }
    panel.removeEventListener("command", this.#boundCommand);
    panel.removeEventListener("popupshown", this.#boundPopupShown);
    panel.removeEventListener("popuphidden", this.#boundPopupHidden);
    panel.removeEventListener("keydown", this.#boundKeydown);
    this.#boundCommand = null;
    this.#boundPopupShown = null;
    this.#boundPopupHidden = null;
    this.#boundKeydown = null;
  }

  async reloadCatalog() {
    this.#initialized = false;
    this.#rendered = false;
    this.#catalog = null;
    this.#catalogError = null;
    const list = this.list;
    if (list) {
      while (list.firstChild) {
        list.removeChild(list.firstChild);
      }
    }
    return this.init();
  }

  getCatalog() {
    // Defensive copy so callers cannot mutate the live catalog object.
    return this.#catalog
      ? JSON.parse(JSON.stringify(this.#catalog))
      : null;
  }

  getState() {
    // Defensive copy; Commit 2 must not mutate shared store state by reference.
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
    // Ignore while a show/hide animation is in flight.
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
    // Focus restore runs from popuphidden for dismissal paths; for explicit
    // close with restoreFocus, restore after hide begins if already closed.
    if (options.restoreFocus !== false && !this.isOpen && !this.#isHiding) {
      this.#restorePriorFocus();
    }
  }

  async openApp(appOrUrl, options = {}) {
    await this.init();
    if (this.#destroyed || window.closed) {
      return;
    }

    let url = null;
    if (typeof appOrUrl === "string") {
      if (this.#catalog) {
        const byId = this.#catalog.apps.find(app => app.id === appOrUrl);
        if (byId) {
          url = byId.url;
        }
      }
      if (!url) {
        url = appOrUrl;
      }
    } else if (isPlainObject(appOrUrl) && typeof appOrUrl.url === "string") {
      url = appOrUrl.url;
    }

    const check = validateBuiltinAppUrl(url);
    if (!check.ok) {
      console.error(`[AstraAppHub] blocked launch (${check.reason}):`, url);
      try {
        window.gZenUIManager?.showToast?.("zen-general-error");
      } catch {
        // ignore
      }
      return;
    }

    this.close({ restoreFocus: false });

    try {
      // Always open in this window — never steal another window's focus.
      const win = window;
      if (typeof win.openTrustedLinkIn === "function") {
        win.openTrustedLinkIn(check.href, "tab", {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
          inBackground: false,
        });
        return;
      }
      if (win.gBrowser) {
        win.gBrowser.selectedTab = win.gBrowser.addTrustedTab(check.href, {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
          inBackground: false,
        });
      }
    } catch (error) {
      console.error("[AstraAppHub] openApp failed:", error);
    }
  }

  #ensureRendered() {
    if (this.#destroyed) {
      return;
    }
    const list = this.list;
    if (!list) {
      return;
    }
    if (this.#rendered && list.childElementCount) {
      return;
    }
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (this.#catalogError || !this.#catalog) {
      const msg = document.createXULElement("label");
      msg.classList.add("zen-app-launcher-section-title");
      msg.setAttribute(
        "value",
        "App Hub could not load. Check console for details."
      );
      list.appendChild(msg);
      this.#rendered = true;
      return;
    }

    for (const category of this.#catalog.categories) {
      const sectionApps = this.#catalog.apps
        .filter(app => app.category === category.id)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      if (!sectionApps.length) {
        continue;
      }

      const title = document.createXULElement("label");
      title.classList.add("zen-app-launcher-section-title");
      title.setAttribute("value", category.label);
      list.appendChild(title);

      const grid = document.createXULElement("hbox");
      grid.classList.add("zen-app-launcher-grid");

      for (const app of sectionApps) {
        const button = document.createXULElement("toolbarbutton");
        button.classList.add("zen-app-launcher-item");
        button.setAttribute("data-app-id", app.id);
        button.setAttribute("data-url", app.url);
        button.setAttribute("tooltiptext", app.name);
        if (app.icon) {
          // Preserve remote icons for this foundation commit.
          const safeIcon = String(app.icon).replace(/['\\]/g, "");
          button.setAttribute(
            "style",
            `list-style-image: url('${safeIcon}')`
          );
        }

        const image = document.createXULElement("image");
        image.classList.add("zen-app-launcher-item-icon");
        button.appendChild(image);

        const label = document.createXULElement("label");
        label.classList.add("zen-app-launcher-item-label");
        label.setAttribute("value", app.name);
        button.appendChild(label);

        grid.appendChild(button);
      }
      list.appendChild(grid);
    }
    this.#rendered = true;
  }

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

  #onCommand(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }
    const item = target.closest(".zen-app-launcher-item[data-url]");
    if (!item) {
      return;
    }
    const url = item.getAttribute("data-url");
    if (url) {
      void this.openApp(url, { source: "item" });
    }
  }

  #onPopupShown() {
    this.#popupTransition = false;
    if (this.#destroyed) {
      return;
    }
    // Focus the first tile only for keyboard-driven opens to avoid mouse focus rings.
    if (this.#openSource !== "keyboard") {
      return;
    }
    const first = this.list?.querySelector(
      ".zen-app-launcher-item:not([disabled])"
    );
    if (first) {
      try {
        first.focus();
      } catch {
        // ignore
      }
    }
  }

  #onPopupHidden() {
    this.#popupTransition = false;
    // Stock dismissal (Escape / click-outside) and hidePopup complete here.
    this.#restorePriorFocus();
    this.#openSource = "unknown";
  }

  #onPanelKeydown(event) {
    if (event.key === "Escape") {
      if (this.isOpen && !this.#popupTransition) {
        // Stop duplicate chrome handlers; close() → hidePopup → popuphidden restores focus.
        event.stopPropagation();
        this.close({ restoreFocus: true });
      }
      // Enter/Space: rely on XUL toolbarbutton "command" (handled once in #onCommand).
    }
  }
}

// Per-window instance via ChromeUtils.importESModule(..., { global: "current" })
new AstraAppHubManager();
