/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Per-window Astra App Hub controller (Phase 2).
 * Catalog: chrome-packaged ESM module (lazy import). State: profile-local singleton.
 * Icons: packaged chrome / cached data:image only in the grid — never raw http(s)
 * list-style-image. Custom-app add may discover a site's own icons and cache them.
 */

const {
  gAstraAppHubState,
  STATE_CHANGED_TOPIC,
  validateAppUrl,
  normalizeAppUrlKey,
  MAX_NAME_LENGTH,
  MAX_URL_LENGTH,
  isPlainObject,
} = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/AstraAppHubState.mjs"
);

let resolveAppIcon;
let getPackagedIconURL;
let pickCustomIconAsDataURI;
let deleteCustomIcons;
let resolvePlacesFaviconURL;
let resolveCustomAppFaviconDataURI;
let sanitizeDataImageURI;
let migrateLegacyIconFileName;
try {
  ({
    resolveAppIcon,
    getPackagedIconURL,
    pickCustomIconAsDataURI,
    deleteCustomIcons,
    resolvePlacesFaviconURL,
    resolveCustomAppFaviconDataURI,
    sanitizeDataImageURI,
    migrateLegacyIconFileName,
  } = ChromeUtils.importESModule(
    "chrome://browser/content/zen-components/AstraAppHubIcons.mjs"
  ));
  gAstraAppHubState.setIconCleanupHandler(deleteCustomIcons);
} catch (iconModuleError) {
  console.error(
    "[AstraAppHub] icon module failed; continuing without custom icons:",
    iconModuleError
  );
  resolveAppIcon = app => ({
    type: "monogram",
    text: String(app?.monogram || app?.name || app?.id || "?")
      .trim()
      .slice(0, 3)
      .toUpperCase() || "?",
    monogram: String(app?.monogram || app?.name || app?.id || "?")
      .trim()
      .slice(0, 3)
      .toUpperCase() || "?",
    accent: 0,
    iconSource: "monogram",
  });
  getPackagedIconURL = () => null;
  pickCustomIconAsDataURI = async () => null;
  deleteCustomIcons = async () => {};
  resolvePlacesFaviconURL = async () => null;
  resolveCustomAppFaviconDataURI = async () => null;
  sanitizeDataImageURI = () => "";
  migrateLegacyIconFileName = async () => "";
}

const CATALOG_MODULE_URL =
  "chrome://browser/content/zen-components/AstraAppHubCatalog.mjs";
const CATALOG_SCHEMA_VERSION = 1;

const SECTION_FAVORITES = "__favorites__";
const SECTION_RECENT = "__recent__";
const SECTION_PINNED = "__pinned__";
const SECTION_SUGGESTED = "__suggested__";
const SECTION_SEARCH = "__search__";
/** Recommended maximum visible pinned apps on the main launchpad. */
const MAIN_PINNED_LIMIT = 12;

/**
 * Fallback suggested apps when the user has no Pinned/Recent history yet.
 * Prefer catalog `id`; soft entries may supply name/url/monogram for apps
 * not yet in the packaged catalog. Used only for fresh profiles.
 */
const DEFAULT_SUGGESTED_APPS = Object.freeze([
  { id: "notion" },
  { id: "slack" },
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    monogram: "AI",
  },
  { id: "canva" },
]);

/** Max chips shown in Suggested for you. */
const SUGGESTED_LIMIT = 4;

const ICON_CHROME = "chrome://browser/skin/zen-icons/";

/** Used when the packaged catalog has not loaded yet. */
const EDITOR_CATEGORY_FALLBACK = [
  { id: "communication", label: "Communication" },
  { id: "study", label: "Study" },
  { id: "work", label: "Work" },
  { id: "government", label: "Government" },
  { id: "finance", label: "Finance" },
  { id: "entertainment", label: "Entertainment" },
];

/** First-run launchpad pins when the user has not customized favorites yet.
 * India-first defaults: mail, chat, gov docs, rail, video, files. */
const DEFAULT_LAUNCHPAD_FAVORITES = Object.freeze([
  "gmail",
  "whatsapp",
  "digilocker",
  "irctc",
  "youtube",
  "google-drive",
]);

const EDITOR_ERROR_FALLBACKS = {
  "astra-app-hub-error-empty-name": "Enter an app name.",
  "astra-app-hub-error-url": "Enter a valid http or https URL.",
  "astra-app-hub-error-duplicate": "An app with this URL already exists.",
  "astra-app-hub-error-generic": "Could not save this app.",
  "astra-app-hub-error-private-edit":
    "Custom apps cannot be edited in a private window.",
  "astra-app-hub-error-icon-unsupported":
    "Use a PNG, JPEG, WebP, or ICO image.",
  "astra-app-hub-error-icon-too-large":
    "That image is too large. Choose a file under 1 MB.",
};

const TAB_DROP_TYPE =
  typeof globalThis.TAB_DROP_TYPE === "string"
    ? globalThis.TAB_DROP_TYPE
    : "application/x-moz-tabbrowser-tab";

const DROP_STATUS_FALLBACKS = {
  "astra-app-hub-drop-error-invalid": "Drop a website link or browser tab.",
  "astra-app-hub-drop-error-private":
    "Custom apps cannot be added in a private window.",
  "astra-app-hub-drop-adding": "Adding…",
  "astra-app-hub-error-duplicate": "An app with this URL already exists.",
  "astra-app-hub-error-url": "Enter a valid http or https URL.",
};

function mozItemTypes(dt, index = 0) {
  try {
    const list = dt?.mozTypesAt?.(index);
    if (!list) {
      return [];
    }
    return typeof list.length === "number" ? [...list] : [];
  } catch {
    return [];
  }
}

function dataTransferHasExternalAppPayload(dt) {
  if (!dt) {
    return false;
  }
  const types = new Set([
    ...(dt.types ? [...dt.types] : []),
    ...mozItemTypes(dt, 0),
  ]);
  return (
    types.has(TAB_DROP_TYPE) ||
    types.has("text/x-moz-url") ||
    types.has("text/uri-list") ||
    types.has("text/plain")
  );
}

function firstUrlLineFromText(text) {
  if (typeof text !== "string") {
    return "";
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    return trimmed.split(/\s+/)[0] || "";
  }
  return text.trim().split(/\s+/)[0] || "";
}

function titleFromMozUrlPayload(text) {
  if (typeof text !== "string") {
    return "";
  }
  const lines = text.split(/\r?\n/);
  return (lines[1] || "").trim();
}

function readDataTransferString(dt, flavor) {
  if (!dt) {
    return "";
  }
  try {
    if (typeof dt.getData === "function") {
      const v = dt.getData(flavor);
      if (v) {
        return v;
      }
    }
  } catch {
    // ignore
  }
  try {
    if (mozItemTypes(dt, 0).includes(flavor)) {
      const v = dt.mozGetDataAt(flavor, 0);
      return typeof v === "string" ? v : "";
    }
  } catch {
    // ignore
  }
  return "";
}

/** @type {(url: string) => { ok: true, href: string, hostname?: string } | { ok: false, reason: string }} */
export const validateBuiltinAppUrl = validateAppUrl;

function normalizeSearchQuery(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function formatRelativeTime(ts) {
  const time = Number(ts);
  if (!Number.isFinite(time) || time <= 0) {
    return "";
  }
  const diffMs = Date.now() - time;
  if (diffMs < 0) {
    return "";
  }
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) {
    return "Just now";
  }
  if (mins < 60) {
    return `${mins} min ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  try {
    return new Date(time).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
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
    // Catalog stores iconKey only — never remote http(s) icon URLs.
    let iconKey =
      typeof app.iconKey === "string" && app.iconKey.trim()
        ? app.iconKey.trim()
        : app.id;
    if (
      iconKey.startsWith("http:") ||
      iconKey.startsWith("https:") ||
      iconKey.startsWith("//")
    ) {
      iconKey = app.id;
    }
    let monogram =
      typeof app.monogram === "string" ? app.monogram.trim().slice(0, 3) : "";
    if (!monogram) {
      monogram = String(app.name || app.id)
        .trim()
        .slice(0, 2)
        .toUpperCase() || "?";
    }
    // Legacy/custom icon field: profile file name only (never remote).
    let icon = typeof app.icon === "string" ? app.icon : "";
    if (
      icon &&
      (icon.startsWith("http:") ||
        icon.startsWith("https:") ||
        icon.startsWith("//") ||
        icon.startsWith("chrome:") ||
        icon.startsWith("resource:"))
    ) {
      icon = "";
    }
    appIds.add(app.id);
    apps.push({
      id: app.id,
      name: typeof app.name === "string" ? app.name : app.id,
      url: urlCheck.href,
      category: app.category,
      iconKey,
      monogram,
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

/**
 * Lazily import the packaged ESM catalog and validate a mutable clone.
 * Diagnostics never include user apps, URLs, profile paths, or search text.
 * Stages: module-import | catalog-validate | shell | render | state
 */
function loadPackagedCatalog() {
  const diag = {
    stage: "module-import",
    chromeResourcePath: CATALOG_MODULE_URL,
    responseStatus: null,
    exceptionName: null,
    schemaReason: null,
  };

  let raw;
  try {
    const { ASTRA_APP_HUB_CATALOG } = ChromeUtils.importESModule(
      CATALOG_MODULE_URL
    );
    raw = JSON.parse(JSON.stringify(ASTRA_APP_HUB_CATALOG));
  } catch (error) {
    diag.exceptionName = error?.name || "Error";
    diag.stage = "module-import";
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      astraCatalogDiag: { ...diag },
    });
  }

  try {
    diag.stage = "catalog-validate";
    const catalog = validateCatalog(raw);
    return { catalog, error: null, diag: null };
  } catch (schemaError) {
    diag.exceptionName = schemaError?.name || "Error";
    diag.schemaReason = String(schemaError?.message || schemaError).slice(
      0,
      160
    );
    throw Object.assign(schemaError, { astraCatalogDiag: { ...diag } });
  }
}

function logCatalogFailure(diag, error) {
  const payload = {
    stage: diag?.stage || "unknown",
    resource: diag?.chromeResourcePath || CATALOG_MODULE_URL,
    chromeResourcePath: diag?.chromeResourcePath || CATALOG_MODULE_URL,
    responseStatus: diag?.responseStatus ?? null,
    exceptionName:
      diag?.exceptionName || error?.name || error?.constructor?.name || "Error",
    schemaReason: diag?.schemaReason || null,
  };
  console.error("[AstraAppHub] catalog load failed:", payload);
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
  #catalogDiag = null;
  #retryInFlight = false;
  /** True after a user Retry still fails at module-import or catalog-validate. */
  #catalogRetryExhausted = false;
  #rendered = false;
  #priorFocus = null;
  #openSource = "unknown";
  #popupTransition = false;
  #customizeMode = false;
  #editorMode = null; // null | "add" | "edit"
  #editingAppId = null;
  #pendingIconData = null;
  #pendingResetIcon = false;
  #searchQuery = "";
  /** @type {"launchpad"|"browse"} */
  #hubView = "launchpad";
  #lastAppliedRevision = -1;
  #contextAppId = null;
  /** @type {string[]} */
  #spacePinIds = [];
  #dragState = null;
  #externalDropActive = false;
  #externalDropDepth = 0;
  #externalDropInFlight = false;
  /** @type {number|null} */
  #dropStatusTimer = null;
  #suppressLaunch = false;
  #focusedItemIndex = -1;
  /** @type {Map<string, object>} Bounded per-app favicon capture sessions. */
  #faviconCaptures = new Map();
  /** @type {number|null} Debounce timer for search rebuild/filter. */
  #searchDebounceTimer = null;

  #boundCommand = null;
  #boundPopupShowing = null;
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
  #boundDragEnter = null;
  #boundDragLeave = null;
  #boundStateChanged = null;
  #shellBuilt = false;

  constructor() {
    window.gAstraAppHubManager = this;
    // Attach to stable bootstrap facade — never replace window.gZenAppLauncher.
    try {
      window.gAstraAppHubBootstrap?.attachManager?.(this);
    } catch (error) {
      console.error("[AstraAppHub] bootstrap attach failed:", error);
    }

    window.addEventListener(
      "unload",
      () => {
        this.destroy();
      },
      { once: true }
    );

    void this.init().catch(error => {
      console.error("[AstraAppHub] background init failed:", error);
      try {
        window.gAstraAppHubBootstrap?.markManagerFailed?.(error, "init");
      } catch {
        // ignore
      }
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
    // Critical: panel wiring must not depend on profile IO / catalog.
    try {
      this.#ensureShell();
      this.#bindPanelListeners();
    } catch (error) {
      console.error("[AstraAppHub] critical shell init failed:", error);
      try {
        window.gAstraAppHubBootstrap?.markManagerFailed?.(error, "shell");
      } catch {
        // ignore
      }
      this.#initialized = true;
      return null;
    }

    // Non-critical: state, catalog, icons, prune.
    try {
      try {
        await gAstraAppHubState.load();
        this.#lastAppliedRevision = gAstraAppHubState.revision;
      } catch (stateError) {
        console.warn("[AstraAppHub] state load failed:", stateError);
      }

      try {
        const loaded = await loadPackagedCatalog();
        if (this.#destroyed || window.closed) {
          return null;
        }
        this.#catalog = loaded.catalog;
        this.#catalogError = null;
        this.#catalogDiag = null;
        await this.#seedDefaultFavorites();
        try {
          await this.#pruneUnknown();
        } catch (pruneError) {
          // Prune must not wipe a successfully loaded catalog.
          console.warn("[AstraAppHub] prune failed:", pruneError);
        }
      } catch (catalogError) {
        if (this.#destroyed || window.closed) {
          return null;
        }
        this.#catalog = null;
        this.#catalogError = catalogError;
        this.#catalogDiag = catalogError?.astraCatalogDiag || {
          stage: "module-import",
          chromeResourcePath: CATALOG_MODULE_URL,
          responseStatus: null,
          exceptionName: catalogError?.name || "Error",
          schemaReason: null,
        };
        logCatalogFailure(this.#catalogDiag, catalogError);
      }

      if (this.#destroyed || window.closed) {
        return null;
      }
      this.#ensureShell();
      this.#bindPanelListeners();
      this.#initialized = true;
      this.#applyCatalogReadyState();
      return this.#catalog;
    } catch (error) {
      if (this.#destroyed || window.closed) {
        return null;
      }
      this.#catalog = null;
      this.#catalogError = error;
      this.#catalogDiag = {
        stage: "shell",
        chromeResourcePath: CATALOG_MODULE_URL,
        responseStatus: null,
        exceptionName: error?.name || "Error",
        schemaReason: null,
      };
      this.#initialized = true;
      logCatalogFailure(this.#catalogDiag, error);
      this.#ensureShell();
      this.#bindPanelListeners();
      this.#applyCatalogReadyState();
      return null;
    }
  }

  /**
   * Launchpad readiness: shell + mandatory controls + successful render.
   * If the packaged catalog failed, keep the static fallback visible — advanced
   * Browse would otherwise open empty while hiding working shortcut tiles.
   */
  #applyCatalogReadyState() {
    if (this.#destroyed || window.closed) {
      return;
    }
    if (this.#catalogError && !this.#catalog) {
      try {
        window.gAstraAppHubBootstrap?.setAdvancedReady?.(false);
      } catch {
        // ignore
      }
      this.#showFallbackFailureBanner(true);
      return;
    }
    let ready = false;
    if (this.#shellBuilt) {
      this.#rendered = false;
      try {
        const controlsOk = !!(
          this.panel &&
          this.container &&
          this.list &&
          this.searchInput
        );
        if (controlsOk) {
          this.#rebuildList();
          ready = !!(
            this.#shellBuilt &&
            this.#rendered &&
            controlsOk &&
            !this.#destroyed &&
            !window.closed
          );
        } else {
          console.warn(
            "[AstraAppHub] launchpad controls missing; not marking ready"
          );
        }
      } catch (error) {
        console.warn("[AstraAppHub] launchpad render failed:", error);
        this.#catalogDiag = {
          stage: "render",
          chromeResourcePath: CATALOG_MODULE_URL,
          responseStatus: null,
          exceptionName: error?.name || "Error",
          schemaReason: String(error?.message || error).slice(0, 160),
        };
        ready = false;
        try {
          logCatalogFailure(this.#catalogDiag, error);
        } catch {
          // ignore
        }
      }
    }
    try {
      window.gAstraAppHubBootstrap?.setAdvancedReady?.(ready);
    } catch {
      // ignore
    }
    if (ready) {
      this.#handoffFocusFromHiddenFallback();
    }
    this.#showFallbackFailureBanner(false);
  }

  /**
   * One-time first-run pins so the launchpad is useful immediately.
   * Skipped once the user has any favorites/custom apps or after seed.
   */
  async #seedDefaultFavorites() {
    if (!this.#catalog?.apps?.length) {
      return;
    }
    const state = gAstraAppHubState.data;
    if (!state) {
      return;
    }
    if (state.settings?.defaultsSeeded) {
      return;
    }
    if ((state.favorites || []).length || (state.customApps || []).length) {
      try {
        await gAstraAppHubState.update(current => {
          const settings = {
            ...(current.settings || {}),
            defaultsSeeded: true,
          };
          return { ...current, settings };
        });
      } catch {
        // ignore
      }
      return;
    }
    const known = new Set(this.#catalog.apps.map(a => a.id));
    const seed = DEFAULT_LAUNCHPAD_FAVORITES.filter(id => known.has(id));
    if (!seed.length) {
      return;
    }
    try {
      await gAstraAppHubState.update(current => {
        const settings = {
          ...(current.settings || {}),
          defaultsSeeded: true,
        };
        return {
          ...current,
          favorites: seed.slice(0, MAIN_PINNED_LIMIT),
          settings,
        };
      });
      this.#lastAppliedRevision = gAstraAppHubState.revision;
    } catch (error) {
      console.warn("[AstraAppHub] default favorite seed failed:", error);
    }
  }

  /**
   * If focus was inside the fallback subtree that is about to hide, move it
   * to advanced search (or the panel) once. No polling.
   */
  #handoffFocusFromHiddenFallback() {
    try {
      const fallback = document.getElementById(
        "PanelUI-zen-app-launcher-fallback"
      );
      const active = document.activeElement;
      if (!fallback || !active || !fallback.contains(active)) {
        return;
      }
      const search = this.searchInput;
      if (search && search.isConnected && !search.hidden) {
        search.focus();
        return;
      }
      this.panel?.focus?.();
    } catch {
      // ignore
    }
  }

  #showFallbackFailureBanner(show) {
    const banner = document.getElementById("astra-app-hub-fallback-banner");
    if (banner) {
      banner.hidden = true;
    }
    if (show) {
      console.warn(
        "[AstraAppHub] launchpad unavailable; static fallback remains usable"
      );
    }
  }

  async #retryCatalog() {
    if (
      this.#retryInFlight ||
      this.#catalogRetryExhausted ||
      this.#destroyed ||
      window.closed
    ) {
      return null;
    }
    this.#retryInFlight = true;
    this.#showFallbackFailureBanner(true);
    try {
      const loaded = await loadPackagedCatalog();
      if (this.#destroyed || window.closed) {
        return null;
      }
      this.#catalog = loaded.catalog;
      this.#catalogError = null;
      this.#catalogDiag = null;
      this.#catalogRetryExhausted = false;
      await this.#pruneUnknown();
      if (this.#destroyed || window.closed) {
        return null;
      }
      this.#applyCatalogReadyState();
      return this.#catalog;
    } catch (catalogError) {
      if (this.#destroyed || window.closed) {
        return null;
      }
      this.#catalog = null;
      this.#catalogError = catalogError;
      this.#catalogDiag = catalogError?.astraCatalogDiag || {
        stage: "module-import",
        chromeResourcePath: CATALOG_MODULE_URL,
        responseStatus: null,
        exceptionName: catalogError?.name || "Error",
        schemaReason: null,
      };
      const stage = this.#catalogDiag.stage;
      if (stage === "module-import" || stage === "catalog-validate") {
        // Failed import/validate is normally permanent for this process/build.
        this.#catalogRetryExhausted = true;
      }
      logCatalogFailure(this.#catalogDiag, catalogError);
      this.#applyCatalogReadyState();
      return null;
    } finally {
      this.#retryInFlight = false;
      if (!this.#destroyed && !window.closed) {
        const advanced =
          this.panel?.getAttribute("app-hub-mode") === "advanced";
        this.#showFallbackFailureBanner(!advanced);
      }
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
    if (this.#searchDebounceTimer) {
      clearTimeout(this.#searchDebounceTimer);
      this.#searchDebounceTimer = null;
    }
    this.#stopAllFaviconCaptures();
    this.#unbindPanelListeners();
    this.#removeMenus();
    this.#priorFocus = null;
    this.#dragState = null;
    this.#contextAppId = null;
    if (this.#dropStatusTimer) {
      clearTimeout(this.#dropStatusTimer);
      this.#dropStatusTimer = null;
    }
    this.#clearExternalDropActive();
    this.#externalDropInFlight = false;
    try {
      window.gZenCompactModeManager?.unlockForPanel?.(
        "PanelUI-zen-app-launcher"
      );
    } catch {
      // ignore
    }
    try {
      window.gAstraAppHubBootstrap?.setAdvancedReady?.(false);
    } catch {
      // ignore
    }
  }

  #ensureShell() {
    const panel = this.panel;
    const container = this.container;
    if (!panel || !container) {
      return;
    }
    if (this.#shellBuilt) {
      this.#polishShellChrome();
      return;
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
      setL10nOrText(title, "astra-app-hub-title", "Astra App Hub");
      header.appendChild(title);

      const hint = document.createXULElement("label");
      hint.id = "astra-app-hub-shortcut-hint";
      hint.classList.add("astra-app-hub-shortcut-hint");
      header.appendChild(hint);
      try {
        this.#updateShortcutHint(hint);
      } catch (hintError) {
        console.warn("[AstraAppHub] shortcut hint failed:", hintError);
      }

      const spacer = document.createXULElement("spacer");
      spacer.setAttribute("flex", "1");
      header.appendChild(spacer);

      const backHeaderBtn = document.createXULElement("toolbarbutton");
      backHeaderBtn.id = "astra-app-hub-back-header-btn";
      backHeaderBtn.classList.add("astra-app-hub-header-btn");
      backHeaderBtn.setAttribute("data-action", "back-launchpad");
      backHeaderBtn.hidden = true;
      setL10nOrText(backHeaderBtn, "astra-app-hub-back", "Back");
      header.appendChild(backHeaderBtn);

      const addHeaderBtn = document.createXULElement("toolbarbutton");
      addHeaderBtn.id = "astra-app-hub-add-header-btn";
      addHeaderBtn.classList.add("astra-app-hub-header-btn", "astra-app-hub-add-header-btn");
      addHeaderBtn.setAttribute("data-action", "add-app");
      addHeaderBtn.setAttribute("tooltiptext", "Add website");
      setL10nOrText(addHeaderBtn, "astra-app-hub-add-website-short", "+");
      header.appendChild(addHeaderBtn);

      const customizeBtn = document.createXULElement("toolbarbutton");
      customizeBtn.id = "astra-app-hub-customize-btn";
      customizeBtn.classList.add("astra-app-hub-header-btn");
      customizeBtn.setAttribute("data-action", "manage-apps");
      setL10nOrText(customizeBtn, "astra-app-hub-manage", "Manage Apps");
      header.appendChild(customizeBtn);

      const overflowHeaderBtn = document.createXULElement("toolbarbutton");
      overflowHeaderBtn.id = "astra-app-hub-overflow-header-btn";
      overflowHeaderBtn.classList.add(
        "astra-app-hub-header-btn",
        "astra-app-hub-overflow-header-btn"
      );
      overflowHeaderBtn.setAttribute("data-action", "overflow");
      overflowHeaderBtn.setAttribute("tooltiptext", "More options");
      setL10nOrText(overflowHeaderBtn, "astra-app-hub-overflow-short", "⋯");
      header.appendChild(overflowHeaderBtn);

      const doneBtn = document.createXULElement("toolbarbutton");
      doneBtn.id = "astra-app-hub-done-btn";
      doneBtn.classList.add("astra-app-hub-header-btn");
      doneBtn.setAttribute("data-action", "done-customize");
      doneBtn.hidden = true;
      setL10nOrText(doneBtn, "astra-app-hub-done", "Done");
      header.appendChild(doneBtn);

      const oldTitle = document.getElementById("PanelUI-zen-app-launcher-title");
      // Never destroy the known-good fallback title node.
      if (
        oldTitle &&
        !oldTitle.closest?.("#PanelUI-zen-app-launcher-fallback")
      ) {
        oldTitle.remove();
      }
      // Insert advanced header before the advanced list (after fallback block).
      const listEl = this.list;
      if (listEl && listEl.parentNode === container) {
        container.insertBefore(header, listEl);
      } else {
        container.insertBefore(header, container.firstChild);
      }
    }

    // Search row
    let searchRow = document.getElementById("astra-app-hub-search-row");
    if (!searchRow) {
      searchRow = document.createXULElement("hbox");
      searchRow.id = "astra-app-hub-search-row";
      searchRow.classList.add("astra-app-hub-search-row");
      searchRow.setAttribute("align", "center");

      const searchWrap = document.createXULElement("hbox");
      searchWrap.id = "astra-app-hub-search-wrap";
      searchWrap.classList.add("astra-app-hub-search-wrap");
      searchWrap.setAttribute("flex", "1");
      searchWrap.setAttribute("align", "center");

      const search = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      search.id = "astra-app-hub-search";
      search.classList.add("astra-app-hub-search");
      search.setAttribute("type", "search");
      search.setAttribute("autocomplete", "off");
      search.setAttribute("placeholder", "Search apps or enter a website...");
      if (document.l10n) {
        try {
          document.l10n.setAttributes(search, "astra-app-hub-search-placeholder");
        } catch {
          // keep placeholder
        }
      }
      searchWrap.appendChild(search);

      const sparkle = document.createXULElement("image");
      sparkle.id = "astra-app-hub-search-sparkle";
      sparkle.classList.add("astra-app-hub-search-sparkle");
      sparkle.setAttribute("src", `${ICON_CHROME}sparkles.svg`);
      sparkle.setAttribute("aria-hidden", "true");
      searchWrap.appendChild(sparkle);

      searchRow.appendChild(searchWrap);

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

    // Footer row removed for a minimal launcher feel. Manage Apps / Add
    // Website / overflow live in the header; Browse remains via Show all /
    // empty-state / Manage. Clear any legacy in-session footer chrome.
    let footer = document.getElementById("astra-app-hub-footer");
    if (footer) {
      clearChildren(footer);
      footer.hidden = true;
      footer.setAttribute("data-retired", "true");
    }

    // Upgrade older in-session headers that predate Back / overflow controls.
    const existingHeader = document.getElementById("astra-app-hub-header");
    if (existingHeader) {
      if (!document.getElementById("astra-app-hub-back-header-btn")) {
        const backHeaderBtn = document.createXULElement("toolbarbutton");
        backHeaderBtn.id = "astra-app-hub-back-header-btn";
        backHeaderBtn.classList.add("astra-app-hub-header-btn");
        backHeaderBtn.setAttribute("data-action", "back-launchpad");
        backHeaderBtn.hidden = true;
        setL10nOrText(backHeaderBtn, "astra-app-hub-back", "Back");
        const addBtn = document.getElementById("astra-app-hub-add-header-btn");
        existingHeader.insertBefore(
          backHeaderBtn,
          addBtn || existingHeader.lastChild
        );
      }
      if (!document.getElementById("astra-app-hub-overflow-header-btn")) {
        const overflowHeaderBtn = document.createXULElement("toolbarbutton");
        overflowHeaderBtn.id = "astra-app-hub-overflow-header-btn";
        overflowHeaderBtn.classList.add(
          "astra-app-hub-header-btn",
          "astra-app-hub-overflow-header-btn"
        );
        overflowHeaderBtn.setAttribute("data-action", "overflow");
        overflowHeaderBtn.setAttribute("tooltiptext", "More options");
        setL10nOrText(overflowHeaderBtn, "astra-app-hub-overflow-short", "⋯");
        const doneBtn = document.getElementById("astra-app-hub-done-btn");
        existingHeader.insertBefore(overflowHeaderBtn, doneBtn || null);
      }
      const manageHdr = document.getElementById("astra-app-hub-customize-btn");
      if (manageHdr) {
        setL10nOrText(manageHdr, "astra-app-hub-manage", "Manage Apps");
      }
    }

    this.#polishShellChrome();

    // Editor subview
    let editor = this.editor;
    if (!editor) {
      editor = document.createXULElement("vbox");
      editor.id = "astra-app-hub-editor";
      editor.classList.add("astra-app-hub-editor");
      editor.hidden = true;

      const nameLabel = document.createXULElement("label");
      nameLabel.classList.add("astra-app-hub-editor-label");
      nameLabel.setAttribute("control", "astra-app-hub-editor-name");
      setL10nOrText(nameLabel, "astra-app-hub-editor-name-label", "Name");
      editor.appendChild(nameLabel);
      const nameInput = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      nameInput.id = "astra-app-hub-editor-name";
      nameInput.classList.add("astra-app-hub-editor-field");
      nameInput.setAttribute("type", "text");
      nameInput.setAttribute("maxlength", String(MAX_NAME_LENGTH));
      editor.appendChild(nameInput);

      const urlLabel = document.createXULElement("label");
      urlLabel.classList.add("astra-app-hub-editor-label");
      urlLabel.setAttribute("control", "astra-app-hub-editor-url");
      setL10nOrText(urlLabel, "astra-app-hub-editor-url-label", "Website URL");
      editor.appendChild(urlLabel);
      const urlInput = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      urlInput.id = "astra-app-hub-editor-url";
      urlInput.classList.add("astra-app-hub-editor-field");
      urlInput.setAttribute("type", "url");
      urlInput.setAttribute("maxlength", String(MAX_URL_LENGTH));
      editor.appendChild(urlInput);

      const catLabel = document.createXULElement("label");
      catLabel.classList.add("astra-app-hub-editor-label");
      catLabel.setAttribute("control", "astra-app-hub-editor-category");
      setL10nOrText(catLabel, "astra-app-hub-editor-category-label", "Category");
      editor.appendChild(catLabel);
      const catSelect = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "select"
      );
      catSelect.id = "astra-app-hub-editor-category";
      catSelect.classList.add("astra-app-hub-editor-field");
      editor.appendChild(catSelect);

      const kwLabel = document.createXULElement("label");
      kwLabel.classList.add("astra-app-hub-editor-label");
      kwLabel.setAttribute("control", "astra-app-hub-editor-keywords");
      setL10nOrText(
        kwLabel,
        "astra-app-hub-editor-keywords-label",
        "Keywords (optional)"
      );
      editor.appendChild(kwLabel);
      const kwInput = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "input"
      );
      kwInput.id = "astra-app-hub-editor-keywords";
      kwInput.classList.add("astra-app-hub-editor-field");
      kwInput.setAttribute("type", "text");
      editor.appendChild(kwInput);

      const iconRow = document.createXULElement("hbox");
      iconRow.classList.add("astra-app-hub-editor-icon-row");
      iconRow.setAttribute("align", "center");

      const iconBtn = document.createXULElement("toolbarbutton");
      iconBtn.id = "astra-app-hub-editor-icon-btn";
      iconBtn.classList.add("astra-app-hub-editor-secondary-btn");
      iconBtn.setAttribute("data-action", "pick-icon");
      setL10nOrText(iconBtn, "astra-app-hub-editor-icon", "Choose icon…");
      iconRow.appendChild(iconBtn);

      const resetIconBtn = document.createXULElement("toolbarbutton");
      resetIconBtn.id = "astra-app-hub-editor-reset-icon-btn";
      resetIconBtn.classList.add("astra-app-hub-editor-secondary-btn");
      resetIconBtn.setAttribute("data-action", "reset-icon");
      setL10nOrText(
        resetIconBtn,
        "astra-app-hub-editor-reset-icon",
        "Reset icon"
      );
      iconRow.appendChild(resetIconBtn);
      editor.appendChild(iconRow);

      const iconHint = document.createXULElement("label");
      iconHint.classList.add("astra-app-hub-editor-hint");
      setL10nOrText(
        iconHint,
        "astra-app-hub-editor-icon-hint",
        "Optional — we'll fetch the site icon automatically if you skip this."
      );
      editor.appendChild(iconHint);

      const err = document.createXULElement("label");
      err.id = "astra-app-hub-editor-error";
      err.classList.add("astra-app-hub-editor-error");
      err.hidden = true;
      editor.appendChild(err);

      const actions = document.createXULElement("hbox");
      actions.classList.add("astra-app-hub-editor-actions");
      actions.setAttribute("align", "center");
      const cancelBtn = document.createXULElement("toolbarbutton");
      cancelBtn.id = "astra-app-hub-editor-cancel";
      cancelBtn.classList.add("astra-app-hub-editor-secondary-btn");
      cancelBtn.setAttribute("data-action", "editor-cancel");
      setL10nOrText(cancelBtn, "astra-app-hub-editor-cancel", "Cancel");
      actions.appendChild(cancelBtn);
      const saveBtn = document.createXULElement("toolbarbutton");
      saveBtn.id = "astra-app-hub-editor-save";
      saveBtn.classList.add("primary");
      saveBtn.setAttribute("data-action", "editor-save");
      setL10nOrText(saveBtn, "astra-app-hub-editor-save", "Add");
      actions.appendChild(saveBtn);
      editor.appendChild(actions);

      const footer = document.getElementById("astra-app-hub-footer");
      if (footer && footer.parentNode === container) {
        container.insertBefore(editor, footer);
      } else {
        container.appendChild(editor);
      }
    } else {
      this.#upgradeEditorShell(editor);
    }

    this.#ensureMenus();
  }

  /**
   * Idempotent chrome polish for search sparkle + footer action icons/labels.
   * Safe to call every open once the shell exists.
   */
  #polishShellChrome() {
    const searchRow = document.getElementById("astra-app-hub-search-row");
    const search = document.getElementById("astra-app-hub-search");
    if (searchRow && search && !document.getElementById("astra-app-hub-search-wrap")) {
      const wrap = document.createXULElement("hbox");
      wrap.id = "astra-app-hub-search-wrap";
      wrap.classList.add("astra-app-hub-search-wrap");
      wrap.setAttribute("flex", "1");
      wrap.setAttribute("align", "center");
      search.parentNode?.insertBefore(wrap, search);
      wrap.appendChild(search);
      const sparkle = document.createXULElement("image");
      sparkle.id = "astra-app-hub-search-sparkle";
      sparkle.classList.add("astra-app-hub-search-sparkle");
      sparkle.setAttribute("src", `${ICON_CHROME}sparkles.svg`);
      sparkle.setAttribute("aria-hidden", "true");
      wrap.appendChild(sparkle);
    } else if (
      searchRow &&
      !document.getElementById("astra-app-hub-search-sparkle")
    ) {
      const wrap =
        document.getElementById("astra-app-hub-search-wrap") || searchRow;
      const sparkle = document.createXULElement("image");
      sparkle.id = "astra-app-hub-search-sparkle";
      sparkle.classList.add("astra-app-hub-search-sparkle");
      sparkle.setAttribute("src", `${ICON_CHROME}sparkles.svg`);
      sparkle.setAttribute("aria-hidden", "true");
      wrap.appendChild(sparkle);
    }

    const footer = document.getElementById("astra-app-hub-footer");
    if (footer) {
      clearChildren(footer);
      footer.hidden = true;
      footer.setAttribute("data-retired", "true");
    }

    // Upgrade older in-session headers that predate Back / overflow controls.
    const existingHeader = document.getElementById("astra-app-hub-header");
    if (existingHeader) {
      if (!document.getElementById("astra-app-hub-back-header-btn")) {
        const backHeaderBtn = document.createXULElement("toolbarbutton");
        backHeaderBtn.id = "astra-app-hub-back-header-btn";
        backHeaderBtn.classList.add("astra-app-hub-header-btn");
        backHeaderBtn.setAttribute("data-action", "back-launchpad");
        backHeaderBtn.hidden = true;
        setL10nOrText(backHeaderBtn, "astra-app-hub-back", "Back");
        const addBtn = document.getElementById("astra-app-hub-add-header-btn");
        existingHeader.insertBefore(
          backHeaderBtn,
          addBtn || existingHeader.lastChild
        );
      }
      if (!document.getElementById("astra-app-hub-overflow-header-btn")) {
        const overflowHeaderBtn = document.createXULElement("toolbarbutton");
        overflowHeaderBtn.id = "astra-app-hub-overflow-header-btn";
        overflowHeaderBtn.classList.add(
          "astra-app-hub-header-btn",
          "astra-app-hub-overflow-header-btn"
        );
        overflowHeaderBtn.setAttribute("data-action", "overflow");
        overflowHeaderBtn.setAttribute("tooltiptext", "More options");
        setL10nOrText(overflowHeaderBtn, "astra-app-hub-overflow-short", "⋯");
        const doneBtn = document.getElementById("astra-app-hub-done-btn");
        existingHeader.insertBefore(overflowHeaderBtn, doneBtn || null);
      }
    }

    const manageHdr = document.getElementById("astra-app-hub-customize-btn");
    if (manageHdr) {
      setL10nOrText(manageHdr, "astra-app-hub-manage", "Manage Apps");
    }
    const overflowHdr = document.getElementById(
      "astra-app-hub-overflow-header-btn"
    );
    if (overflowHdr) {
      setL10nOrText(overflowHdr, "astra-app-hub-overflow-short", "⋯");
    }
  }

  /** Ensure older in-session editor markup picks up Task 3 classes/actions. */
  #upgradeEditorShell(editor) {
    if (!editor) {
      return;
    }
    editor.classList.add("astra-app-hub-editor");
    for (const id of [
      "astra-app-hub-editor-name",
      "astra-app-hub-editor-url",
      "astra-app-hub-editor-category",
      "astra-app-hub-editor-keywords",
    ]) {
      document.getElementById(id)?.classList.add("astra-app-hub-editor-field");
    }
    const saveBtn = document.getElementById("astra-app-hub-editor-save");
    if (saveBtn) {
      saveBtn.classList.add("primary");
      if (!saveBtn.closest(".astra-app-hub-editor-actions")) {
        let actions = editor.querySelector(".astra-app-hub-editor-actions");
        if (!actions) {
          actions = document.createXULElement("hbox");
          actions.classList.add("astra-app-hub-editor-actions");
          actions.setAttribute("align", "center");
          editor.appendChild(actions);
        }
        const cancelBtn = document.getElementById("astra-app-hub-editor-cancel");
        if (cancelBtn && cancelBtn.parentNode !== actions) {
          actions.appendChild(cancelBtn);
        }
        if (saveBtn.parentNode !== actions) {
          actions.appendChild(saveBtn);
        }
      }
    }
    document
      .getElementById("astra-app-hub-editor-icon-btn")
      ?.classList.add("astra-app-hub-editor-secondary-btn");
    document
      .getElementById("astra-app-hub-editor-reset-icon-btn")
      ?.classList.add("astra-app-hub-editor-secondary-btn");
    document
      .getElementById("astra-app-hub-editor-cancel")
      ?.classList.add("astra-app-hub-editor-secondary-btn");
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
        null,
        ["astra-app-hub-pin-current-space", "Pin to current Space", "pin-space"],
        [
          "astra-app-hub-unpin-current-space",
          "Unpin from current Space",
          "unpin-space",
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
        setL10nOrText(item, id, label);
        menu.appendChild(item);
      }

      const wsMenu = document.createXULElement("menu");
      wsMenu.id = "astra-app-hub-ctx-workspace";
      setL10nOrText(
        wsMenu,
        "astra-app-hub-open-another-space",
        "Open in another Space…"
      );
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
    this.#boundPopupShowing = () => this.#onPopupShowing();
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
    this.#boundDragEnter = event => this.#onDragEnter(event);
    this.#boundDragLeave = event => this.#onDragLeave(event);
    this.#boundStateChanged = (_subject, _topic, data) => {
      this.#onStateChanged(data);
    };

    panel.addEventListener("command", this.#boundCommand);
    panel.addEventListener("popupshowing", this.#boundPopupShowing);
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
    panel.addEventListener("dragenter", this.#boundDragEnter);
    panel.addEventListener("dragleave", this.#boundDragLeave);

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
    if (this.#boundPopupShowing) {
      panel.removeEventListener("popupshowing", this.#boundPopupShowing);
    }
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
    if (this.#boundDragEnter) {
      panel.removeEventListener("dragenter", this.#boundDragEnter);
    }
    if (this.#boundDragLeave) {
      panel.removeEventListener("dragleave", this.#boundDragLeave);
    }

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
    this.#boundPopupShowing = null;
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
    this.#boundDragEnter = null;
    this.#boundDragLeave = null;
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
    this.#rendered = false;
    this.#catalog = null;
    this.#catalogError = null;
    this.#catalogDiag = null;
    clearChildren(this.list);
    return this.#retryCatalog();
  }

  getCatalog() {
    return this.#catalog ? JSON.parse(JSON.stringify(this.#catalog)) : null;
  }

  getState() {
    return JSON.parse(JSON.stringify(gAstraAppHubState.data));
  }

  async toggle(options = {}) {
    if (this.#destroyed || window.closed) {
      return false;
    }
    // Do not block toggle on non-critical init; open path is resilient.
    void this.init();
    if (this.#destroyed || window.closed) {
      return false;
    }
    if (this.#popupTransition || this.#isHiding) {
      if (this.#popupTransition && !this.isOpen && !this.#isHiding) {
        this.#popupTransition = false;
      } else {
        return false;
      }
    }
    if (this.isOpen) {
      this.close({ ...options, restoreFocus: true });
      return true;
    }
    return this.open(options);
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
      return false;
    }

    // Kick non-critical init without blocking the first paint of the panel.
    const initPromise = this.init();

    const panel = this.panel;
    if (!panel) {
      console.error("[AstraAppHub] panel missing");
      // Panel may appear after head-script construction; retry after init.
      try {
        await initPromise;
      } catch {
        // ignore
      }
      if (!this.panel) {
        return false;
      }
    }

    this.#openSource = this.#resolveOpenSource(options);
    this.#capturePriorFocus();
    try {
      this.#ensureShell();
      this.#bindPanelListeners();
    } catch (error) {
      this.#popupTransition = false;
      console.error("[AstraAppHub] shell/bind failed:", error);
      return false;
    }

    // Render if catalog already available; otherwise show shell and fill later.
    try {
      await this.#refreshSpacePins();
      if (this.#catalog || this.#catalogError || this.#initialized) {
        this.#ensureRendered();
      }
    } catch (error) {
      console.warn("[AstraAppHub] render failed before open:", error);
    }

    const livePanel = this.panel;
    if (!livePanel) {
      console.error("[AstraAppHub] panel missing");
      return false;
    }

    if (this.isOpen || this.#popupTransition || this.#isHiding) {
      // Recover from a stuck transition after a failed previous open.
      if (this.#popupTransition && !this.isOpen && !this.#isHiding) {
        this.#popupTransition = false;
      } else {
        return true;
      }
    }

    const anchor = this.#resolveAnchor(options.event);
    this.#popupTransition = true;
    try {
      // Acquire compact lock before openPopup so hide timers cannot race during
      // popupshowing while the pointer moves from the sidebar into the panel.
      window.gZenCompactModeManager?.lockForPanel?.(
        "PanelUI-zen-app-launcher"
      );
      livePanel.openPopup(anchor, "after_start", 0, 0, false, false);
    } catch (error) {
      this.#popupTransition = false;
      try {
        window.gZenCompactModeManager?.unlockForPanel?.(
          "PanelUI-zen-app-launcher"
        );
      } catch {
        // ignore
      }
      console.error("[AstraAppHub] openPopup failed:", error);
      return false;
    }

    // Finish init/render in the background; never leave transition stuck.
    void initPromise
      .then(() => {
        if (this.#destroyed || window.closed) {
          return;
        }
        try {
          this.#ensureShell();
          this.#bindPanelListeners();
          this.#ensureRendered();
        } catch (error) {
          console.warn("[AstraAppHub] post-open render failed:", error);
        }
      })
      .catch(error => {
        this.#popupTransition = false;
        console.error("[AstraAppHub] background init failed:", error);
      });

    return true;
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
    /** @type {Map<string, string>} hostname → packaged iconKey */
    const hostToIconKey = new Map();
    if (this.#catalog) {
      for (const app of this.#catalog.apps) {
        map.set(app.id, { ...app, builtin: true });
        const host =
          (typeof app.hostname === "string" && app.hostname) ||
          hostnameFromUrl(app.url);
        if (host && app.iconKey) {
          hostToIconKey.set(host, app.iconKey);
          // Also map bare registrable-ish aliases (www.)
          if (host.startsWith("www.")) {
            hostToIconKey.set(host.slice(4), app.iconKey);
          } else {
            hostToIconKey.set(`www.${host}`, app.iconKey);
          }
        }
      }
    }
    const knownCats = new Set(
      (this.#catalog?.categories || []).map(c => c.id)
    );
    for (const app of gAstraAppHubState.data.customApps || []) {
      const category =
        typeof app.category === "string" && knownCats.has(app.category)
          ? app.category
          : "work";
      const hostname = hostnameFromUrl(app.url);
      // Prefer an explicit iconKey; otherwise reuse a packaged mark when the
      // custom URL matches a known catalog host (instant icon, no wait).
      let iconKey = typeof app.iconKey === "string" ? app.iconKey : "";
      if (
        !iconKey &&
        !sanitizeDataImageURI(app.customIconData) &&
        !sanitizeDataImageURI(app.cachedFaviconData) &&
        hostname
      ) {
        iconKey =
          hostToIconKey.get(hostname) ||
          hostToIconKey.get(hostname.replace(/^www\./, "")) ||
          "";
      }
      map.set(app.id, {
        ...app,
        category,
        builtin: false,
        keywords: app.keywords || [],
        hostname,
        ...(iconKey ? { iconKey } : {}),
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

    const isPrivate =
      mode === "private" ||
      (typeof PrivateBrowsingUtils !== "undefined" &&
        PrivateBrowsingUtils.isWindowPrivate(window));

    let ok = false;
    let launchedTab = null;
    try {
      const launchResult = await this.#launch(check.href, mode, options);
      if (launchResult && typeof launchResult === "object") {
        ok = !!launchResult.ok;
        launchedTab = launchResult.tab || null;
      } else {
        ok = !!launchResult;
      }
    } catch (error) {
      console.error("[AstraAppHub] openApp failed:", error);
      ok = false;
    }

    if (ok && app.id) {
      try {
        await gAstraAppHubState.recordRecent(app.id, {
          privateWindow: isPrivate,
        });
        this.#lastAppliedRevision = gAstraAppHubState.revision;
      } catch (error) {
        console.warn("[AstraAppHub] recordRecent failed:", error);
      }

      // Bounded favicon capture only for custom apps launched in normal windows.
      if (
        app.builtin === false &&
        !isPrivate &&
        mode !== "private" &&
        typeof app.id === "string" &&
        app.id.startsWith("custom-")
      ) {
        this.#beginFaviconCapture(app, launchedTab);
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
        const tab =
          where === "tab" || where === "current"
            ? window.gBrowser?.selectedTab || null
            : null;
        return { ok: true, tab };
      }
      if (where === "tab" && window.gBrowser) {
        const tab = window.gBrowser.addTrustedTab(url, {
          triggeringPrincipal: systemPrincipal(),
          inBackground: false,
        });
        window.gBrowser.selectedTab = tab;
        return { ok: true, tab };
      }
      if (where === "current" && window.gBrowser?.selectedBrowser) {
        window.gBrowser.loadURI(Services.io.newURI(url), {
          triggeringPrincipal: systemPrincipal(),
        });
        return { ok: true, tab: window.gBrowser.selectedTab || null };
      }
    } catch (error) {
      console.error("[AstraAppHub] openTrusted failed:", error);
    }
    return { ok: false, tab: null };
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
    try {
      const { openURLInSpace } = ChromeUtils.importESModule(
        "resource:///modules/zen/AstraSpaceRouting.mjs"
      );
      const result = await openURLInSpace(window, {
        url,
        targetSpaceId: workspaceId || null,
        inBackground: false,
        source: "app-hub",
      });
      if (result?.ok) {
        return { ok: true, tab: result.tab || null };
      }
    } catch (error) {
      console.warn("[AstraAppHub] Space routing failed; falling back");
    }
    // Fallback: current-Space trusted open (never invisible invalid Space).
    return this.#openTrusted(url, "tab");
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
      return { ok: true, tab: newTab };
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
      return { ok: false, tab: null };
    }
  }

  #openEssentials(url) {
    const tabOk = this.#openTrusted(url, "tab");
    if (!tabOk?.ok) {
      return false;
    }
    const mgr = window.gZenPinnedTabManager;
    if (!mgr || typeof mgr.addToEssentials !== "function") {
      return tabOk;
    }
    try {
      const tab = tabOk.tab || window.gBrowser?.selectedTab;
      if (tab) {
        mgr.addToEssentials(tab);
      }
      return tabOk;
    } catch (error) {
      console.warn("[AstraAppHub] addToEssentials failed:", error);
      return tabOk;
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
    this.#updateHubChrome();

    const state = gAstraAppHubState.data;
    const appMap = this.#allAppsMap();
    const hidden = new Set(state.hidden || []);
    const query = this.#searchQuery;

    // Launchpad (and search) never require the packaged catalog.
    if (this.#hubView === "launchpad" && !this.#customizeMode) {
      this.#rebuildLaunchpad(list, state, appMap, hidden, query);
      this.#rendered = true;
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      this.#updateCustomizeChrome();
      return;
    }

    if (this.#catalogError && !this.#catalog && this.#hubView === "browse") {
      // Browse without catalog: show an empty discovery state, not a technical banner.
      console.warn(
        "[AstraAppHub] Browse Apps opened without catalog:",
        this.#catalogDiag?.exceptionName || "unavailable"
      );
    }

    this.#showFallbackFailureBanner(false);

    const favorites = (state.favorites || []).filter(
      id => appMap.has(id) && !hidden.has(id)
    );
    const recent = (state.recent || [])
      .map(e => e.id)
      .filter(id => appMap.has(id) && !hidden.has(id));

    if (this.#customizeMode) {
      if (state.settings?.showFavorites && favorites.length) {
        this.#appendSection(
          list,
          SECTION_FAVORITES,
          "Pinned",
          "astra-app-hub-pinned",
          favorites.map(id => appMap.get(id)),
          { collapsible: false, special: true }
        );
      }
      if (state.settings?.showRecent && recent.length) {
        this.#appendSection(
          list,
          SECTION_RECENT,
          "Recent",
          "astra-app-hub-recent",
          recent.map(id => appMap.get(id)),
          { collapsible: false, special: true }
        );
      }
    }

    // Optional per-Space pins (compact; omitted when empty).
    if (
      this.#spacePinIds.length &&
      !PrivateBrowsingUtils.isWindowPrivate(window) &&
      (this.#customizeMode || this.#hubView === "browse")
    ) {
      const pinnedApps = this.#spacePinIds
        .map(id => appMap.get(id))
        .filter(app => app && !hidden.has(app.id));
      if (pinnedApps.length) {
        this.#appendSection(
          list,
          "__space-pins__",
          "Pinned for this Space",
          "astra-app-hub-space-pins-title",
          pinnedApps,
          { collapsible: false, special: true }
        );
      }
    }

    const categoryOrder = this.#orderedCategories(state);
    let catalogSections = 0;
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
      catalogSections += 1;
    }

    if (
      this.#hubView === "browse" &&
      !this.#customizeMode &&
      !catalogSections &&
      !query
    ) {
      const empty = document.createXULElement("label");
      empty.classList.add("astra-app-hub-search-status");
      setL10nOrText(
        empty,
        "astra-app-hub-browse-empty",
        "No catalog apps are available right now."
      );
      list.appendChild(empty);
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

  #rebuildLaunchpad(list, state, appMap, hidden, query) {
    if (query) {
      const matches = [...appMap.values()].filter(
        app =>
          app &&
          !hidden.has(app.id) &&
          this.#appMatchesQuery(app, app.category || "", query)
      );
      this.#appendSection(
        list,
        SECTION_SEARCH,
        "Results",
        "astra-app-hub-search-results",
        matches.slice(0, 40),
        { collapsible: false, special: true }
      );
      if (!matches.length) {
        const empty = document.createXULElement("label");
        empty.classList.add("astra-app-hub-search-status");
        setL10nOrText(empty, "astra-app-hub-no-results", "No apps match your search.");
        list.appendChild(empty);
      }
      return;
    }

    const pinnedIds = (state.favorites || []).filter(
      id => appMap.has(id) && !hidden.has(id)
    );
    // Prefer favorites; if empty, surface custom apps as the personal launchpad.
    let pinnedApps = pinnedIds
      .map(id => appMap.get(id))
      .filter(Boolean)
      .slice(0, MAIN_PINNED_LIMIT);
    if (!pinnedApps.length) {
      pinnedApps = (state.customApps || [])
        .map(app => appMap.get(app.id))
        .filter(app => app && !hidden.has(app.id))
        .slice(0, MAIN_PINNED_LIMIT);
    }

    if (!pinnedApps.length) {
      this.#appendEmptyLaunchpad(list);
    } else {
      this.#appendSection(
        list,
        SECTION_PINNED,
        "Pinned",
        "astra-app-hub-pinned",
        pinnedApps,
        {
          collapsible: false,
          special: true,
          includeAddTile: true,
          richHeader: {
            icon: "pin",
            // Minimal launcher: title only — no subtitle chrome.
            showAll: true,
          },
        }
      );
    }

    // Space pins stay compact when already available.
    if (
      this.#spacePinIds.length &&
      !PrivateBrowsingUtils.isWindowPrivate(window)
    ) {
      const spaceApps = this.#spacePinIds
        .map(id => appMap.get(id))
        .filter(app => app && !hidden.has(app.id));
      if (spaceApps.length) {
        this.#appendSection(
          list,
          "__space-pins__",
          "Pinned for this Space",
          "astra-app-hub-space-pins-title",
          spaceApps.slice(0, MAIN_PINNED_LIMIT),
          { collapsible: false, special: true }
        );
      }
    }

    if (state.settings?.showRecent !== false) {
      const recentEntries = (state.recent || []).filter(
        e => appMap.has(e.id) && !hidden.has(e.id)
      );
      // Real usage only — hide the section when history is empty (no placeholders).
      if (recentEntries.length) {
        this.#appendRecentChips(list, recentEntries, appMap);
      }
    }

    this.#appendSuggestedSection(list, appMap, hidden, state);
  }

  /**
   * First-run / empty launchpad: message + Browse CTA so the panel does not
   * look like a broken empty grid.
   */
  #appendEmptyLaunchpad(list) {
    const section = document.createXULElement("vbox");
    section.classList.add("astra-app-hub-section", "astra-app-hub-empty-section");
    section.setAttribute("data-category-id", SECTION_PINNED);
    section.setAttribute("data-special", "true");

    const header = document.createXULElement("hbox");
    header.classList.add(
      "astra-app-hub-section-header",
      "zen-app-launcher-section-title"
    );
    header.setAttribute("align", "center");
    const title = document.createXULElement("label");
    title.classList.add("astra-app-hub-section-label");
    setL10nOrText(title, "astra-app-hub-pinned", "Pinned");
    header.appendChild(title);
    section.appendChild(header);

    const empty = document.createXULElement("vbox");
    empty.classList.add("astra-app-hub-empty");
    empty.setAttribute("role", "status");

    const emptyTitle = document.createXULElement("label");
    emptyTitle.classList.add("astra-app-hub-empty-title");
    setL10nOrText(
      emptyTitle,
      "astra-app-hub-empty-title",
      "No pinned apps yet"
    );
    empty.appendChild(emptyTitle);

    const emptyBody = document.createXULElement("label");
    emptyBody.classList.add("astra-app-hub-empty-body");
    setL10nOrText(
      emptyBody,
      "astra-app-hub-empty-body",
      "Browse the catalog or add a website to build your launchpad."
    );
    empty.appendChild(emptyBody);

    const actions = document.createXULElement("hbox");
    actions.classList.add("astra-app-hub-empty-actions");
    actions.setAttribute("align", "center");

    const browseBtn = document.createXULElement("toolbarbutton");
    browseBtn.classList.add("astra-app-hub-empty-btn", "primary");
    browseBtn.setAttribute("data-action", "browse-apps");
    setL10nOrText(browseBtn, "astra-app-hub-empty-browse", "Browse Apps");
    actions.appendChild(browseBtn);

    if (!PrivateBrowsingUtils.isWindowPrivate(window)) {
      const addBtn = document.createXULElement("toolbarbutton");
      addBtn.classList.add("astra-app-hub-empty-btn");
      addBtn.setAttribute("data-action", "add-app");
      setL10nOrText(addBtn, "astra-app-hub-empty-add", "Add website");
      actions.appendChild(addBtn);
    }

    empty.appendChild(actions);
    section.appendChild(empty);
    list.appendChild(section);
  }

  #appendRecentList(list, recentEntries, appMap) {
    // Legacy row layout kept for customize / browse modes.
    const section = document.createXULElement("vbox");
    section.classList.add("astra-app-hub-section", "astra-app-hub-recent-section");
    section.setAttribute("data-category-id", SECTION_RECENT);
    section.setAttribute("data-special", "true");

    const header = this.#createRichSectionHeader({
      icon: "history",
      title: "Recent",
      titleL10n: "astra-app-hub-recent",
    });
    section.appendChild(header);

    const rows = document.createXULElement("vbox");
    rows.classList.add("astra-app-hub-recent-list");
    for (const entry of recentEntries.slice(0, 6)) {
      const app = appMap.get(entry.id);
      if (!app) {
        continue;
      }
      rows.appendChild(this.#createRecentRow(app, entry.lastOpened));
    }
    section.appendChild(rows);
    list.appendChild(section);
  }

  /**
   * Launchpad Recent section — chip row from real usage history only.
   */
  #appendRecentChips(list, recentEntries, appMap) {
    if (!recentEntries?.length) {
      return;
    }
    const section = document.createXULElement("vbox");
    section.classList.add(
      "astra-app-hub-section",
      "astra-app-hub-recent-section",
      "astra-app-hub-chip-section"
    );
    section.setAttribute("data-category-id", SECTION_RECENT);
    section.setAttribute("data-special", "true");

    section.appendChild(
      this.#createRichSectionHeader({
        icon: "history",
        title: "Recent",
        titleL10n: "astra-app-hub-recent",
      })
    );

    const row = document.createXULElement("hbox");
    row.classList.add("astra-app-hub-chip-row");
    row.setAttribute("align", "center");

    // Deduped + most-recent-first (state.recent is already sorted that way).
    const apps = recentEntries
      .slice(0, 6)
      .map(e => appMap.get(e.id))
      .filter(Boolean);

    for (const app of apps) {
      row.appendChild(this.#createChipButton(app));
    }
    if (!apps.length) {
      return;
    }
    section.appendChild(row);
    list.appendChild(section);
  }

  #appendSuggestedSection(list, appMap, hidden, state) {
    const apps = this.#resolveSuggestedApps(appMap, hidden, state);
    if (!apps.length) {
      return;
    }

    const section = document.createXULElement("vbox");
    section.classList.add(
      "astra-app-hub-section",
      "astra-app-hub-suggested-section",
      "astra-app-hub-chip-section"
    );
    section.setAttribute("data-category-id", SECTION_SUGGESTED);
    section.setAttribute("data-special", "true");

    section.appendChild(
      this.#createRichSectionHeader({
        icon: "sparkles",
        title: "Suggested for you",
        titleL10n: "astra-app-hub-suggested",
      })
    );

    const row = document.createXULElement("hbox");
    row.classList.add("astra-app-hub-chip-row");
    row.setAttribute("align", "center");
    for (const app of apps) {
      row.appendChild(this.#createChipButton(app));
    }
    section.appendChild(row);
    list.appendChild(section);
  }

  /**
   * Category-based suggestions from local Pinned + Recent usage.
   * Fresh profiles (no pins/recents) fall back to DEFAULT_SUGGESTED_APPS.
   * Fully on-device — no network analytics.
   */
  #resolveSuggestedApps(appMap, hidden, state = gAstraAppHubState.data) {
    const pinnedIds = (state?.favorites || []).filter(id => appMap.has(id));
    const recentIds = (state?.recent || [])
      .map(e => e.id)
      .filter(id => appMap.has(id));
    const usedIds = new Set([...pinnedIds, ...recentIds]);

    const categoryCounts = new Map();
    for (const id of usedIds) {
      const app = appMap.get(id);
      const cat = app?.category;
      if (!cat || typeof cat !== "string") {
        continue;
      }
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }

    const out = [];
    const seen = new Set();

    const pushApp = app => {
      if (!app?.id || seen.has(app.id) || hidden.has(app.id) || usedIds.has(app.id)) {
        return false;
      }
      seen.add(app.id);
      out.push(app);
      return out.length >= SUGGESTED_LIMIT;
    };

    if (categoryCounts.size) {
      const rankedCats = [...categoryCounts.entries()]
        .sort(
          (a, b) =>
            b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))
        )
        .map(([cat]) => cat);

      for (const cat of rankedCats) {
        const candidates = [...appMap.values()]
          .filter(
            app =>
              app &&
              app.builtin !== false &&
              !app.softSuggestion &&
              app.category === cat &&
              !hidden.has(app.id) &&
              !usedIds.has(app.id)
          )
          .sort(
            (a, b) =>
              (a.order || 0) - (b.order || 0) ||
              String(a.name || "").localeCompare(String(b.name || ""))
          );
        for (const app of candidates) {
          if (pushApp(app)) {
            return out;
          }
        }
      }
    }

    // Fresh profile or not enough same-category matches → general defaults.
    for (const entry of DEFAULT_SUGGESTED_APPS) {
      if (!entry?.id || seen.has(entry.id) || usedIds.has(entry.id)) {
        continue;
      }
      if (appMap.has(entry.id)) {
        const app = appMap.get(entry.id);
        if (app && !hidden.has(app.id) && pushApp(app)) {
          return out;
        }
        continue;
      }
      // Soft suggestion (not in catalog yet).
      if (typeof entry.url === "string" && entry.url && entry.name) {
        const soft = {
          id: entry.id,
          name: entry.name,
          url: entry.url,
          monogram:
            entry.monogram ||
            String(entry.name).trim().slice(0, 2).toUpperCase() ||
            "?",
          builtin: false,
          softSuggestion: true,
        };
        if (pushApp(soft)) {
          return out;
        }
      }
    }
    return out;
  }

  #createRichSectionHeader({
    icon = null,
    title,
    titleL10n = null,
    subtitle = null,
    subtitleL10n = null,
    showAll = false,
  } = {}) {
    const header = document.createXULElement("hbox");
    header.classList.add(
      "astra-app-hub-section-header",
      "astra-app-hub-section-header-rich",
      "zen-app-launcher-section-title"
    );
    header.setAttribute("align", "start");

    const left = document.createXULElement("vbox");
    left.classList.add("astra-app-hub-section-heading");
    left.setAttribute("flex", "1");

    const titleRow = document.createXULElement("hbox");
    titleRow.classList.add("astra-app-hub-section-title-row");
    titleRow.setAttribute("align", "center");

    if (icon) {
      const iconEl = document.createXULElement("image");
      iconEl.classList.add("astra-app-hub-section-icon");
      iconEl.setAttribute("data-icon", icon);
      const iconSrc =
        icon === "sparkles"
          ? `${ICON_CHROME}sparkles.svg`
          : icon === "history"
            ? `${ICON_CHROME}history.svg`
            : icon === "pin"
              ? `${ICON_CHROME}pin.svg`
              : `${ICON_CHROME}${icon}.svg`;
      iconEl.setAttribute("src", iconSrc);
      iconEl.setAttribute("aria-hidden", "true");
      titleRow.appendChild(iconEl);
    }

    const titleEl = document.createXULElement("label");
    titleEl.classList.add(
      "astra-app-hub-section-label",
      "astra-app-hub-section-title"
    );
    if (titleL10n) {
      setL10nOrText(titleEl, titleL10n, title);
    } else {
      titleEl.setAttribute("value", title);
    }
    titleRow.appendChild(titleEl);
    left.appendChild(titleRow);

    if (subtitle || subtitleL10n) {
      const sub = document.createXULElement("label");
      sub.classList.add("astra-app-hub-section-subtitle");
      if (subtitleL10n) {
        setL10nOrText(sub, subtitleL10n, subtitle || "");
      } else {
        sub.setAttribute("value", subtitle);
      }
      left.appendChild(sub);
    }

    header.appendChild(left);

    if (showAll) {
      const showAllBtn = document.createXULElement("toolbarbutton");
      showAllBtn.classList.add("astra-app-hub-show-all");
      showAllBtn.setAttribute("data-action", "browse-apps");
      setL10nOrText(showAllBtn, "astra-app-hub-show-all", "Show all →");
      header.appendChild(showAllBtn);
    }

    return header;
  }

  #createChipButton(app) {
    const button = document.createXULElement("toolbarbutton");
    button.classList.add(
      "astra-app-hub-chip",
      "astra-app-hub-item"
    );
    button.setAttribute("data-app-id", app.id);
    button.setAttribute("data-url", app.url);
    button.setAttribute("tooltiptext", `${app.name} — Opens in new tab`);
    button.setAttribute("aria-label", app.name);
    if (app.softSuggestion) {
      button.setAttribute("data-soft-suggestion", "true");
    }

    const iconInfo = resolveAppIcon(app);
    const stack = document.createXULElement("stack");
    stack.classList.add(
      "zen-app-launcher-item-icon-stack",
      "astra-app-hub-item-icon-stack",
      "astra-app-hub-chip-icon-stack"
    );
    stack.setAttribute("aria-hidden", "true");
    const mono = document.createXULElement("label");
    mono.classList.add(
      "zen-app-launcher-item-monogram",
      "astra-app-hub-item-monogram"
    );
    mono.setAttribute(
      "value",
      iconInfo.monogram || iconInfo.text || app.monogram || "?"
    );
    mono.setAttribute("data-accent", String(iconInfo?.accent ?? 0));
    stack.appendChild(mono);
    if (
      iconInfo.type === "image" &&
      iconInfo.src &&
      !String(iconInfo.src).startsWith("http:") &&
      !String(iconInfo.src).startsWith("https:") &&
      !String(iconInfo.src).startsWith("//")
    ) {
      this.#appendSafeIconImage(stack, String(iconInfo.src));
    }
    button.appendChild(stack);

    const label = document.createXULElement("label");
    label.classList.add("astra-app-hub-chip-label");
    label.setAttribute("value", app.name);
    label.setAttribute("crop", "end");
    button.appendChild(label);
    return button;
  }

  #createRecentRow(app, lastOpened) {
    const row = document.createXULElement("toolbarbutton");
    row.classList.add("astra-app-hub-recent-row", "astra-app-hub-item");
    row.setAttribute("data-app-id", app.id);
    row.setAttribute("data-url", app.url);
    row.setAttribute("tooltiptext", `${app.name} — Opens in new tab`);
    row.setAttribute("aria-label", app.name);

    const iconInfo = resolveAppIcon(app);
    const stack = document.createXULElement("stack");
    stack.classList.add(
      "zen-app-launcher-item-icon-stack",
      "astra-app-hub-item-icon-stack",
      "astra-app-hub-recent-icon-stack"
    );
    stack.setAttribute("aria-hidden", "true");
    const mono = document.createXULElement("label");
    mono.classList.add(
      "zen-app-launcher-item-monogram",
      "astra-app-hub-item-monogram"
    );
    mono.setAttribute(
      "value",
      iconInfo.monogram || iconInfo.text || app.monogram || "?"
    );
    mono.setAttribute("data-accent", String(iconInfo?.accent ?? 0));
    stack.appendChild(mono);
    if (
      iconInfo.type === "image" &&
      iconInfo.src &&
      !String(iconInfo.src).startsWith("http:") &&
      !String(iconInfo.src).startsWith("https:") &&
      !String(iconInfo.src).startsWith("//")
    ) {
      this.#appendSafeIconImage(stack, String(iconInfo.src));
    }
    row.appendChild(stack);

    const name = document.createXULElement("label");
    name.classList.add("astra-app-hub-recent-name");
    name.setAttribute("flex", "1");
    name.setAttribute("crop", "end");
    name.setAttribute("value", app.name);
    row.appendChild(name);

    const when = document.createXULElement("label");
    when.classList.add("astra-app-hub-recent-when");
    when.setAttribute("value", formatRelativeTime(lastOpened));
    row.appendChild(when);
    return row;
  }

  #createAddAppTile() {
    const button = document.createXULElement("toolbarbutton");
    button.classList.add(
      "zen-app-launcher-item",
      "astra-app-hub-item",
      "astra-app-hub-add-tile"
    );
    button.setAttribute("data-action", "add-app");
    if (document.l10n) {
      try {
        document.l10n.setAttributes(button, "astra-app-hub-add-tile-tooltip");
      } catch {
        button.setAttribute(
          "tooltiptext",
          "Add website or drop a tab here"
        );
      }
    } else {
      button.setAttribute("tooltiptext", "Add website or drop a tab here");
    }
    button.setAttribute("aria-label", "Add website or drop a tab here");

    const stack = document.createXULElement("stack");
    stack.classList.add(
      "zen-app-launcher-item-icon-stack",
      "astra-app-hub-item-icon-stack"
    );
    stack.setAttribute("aria-hidden", "true");
    const mono = document.createXULElement("label");
    mono.classList.add(
      "zen-app-launcher-item-monogram",
      "astra-app-hub-item-monogram",
      "astra-app-hub-add-tile-mark"
    );
    mono.setAttribute("value", "+");
    stack.appendChild(mono);
    button.appendChild(stack);

    const label = document.createXULElement("label");
    label.classList.add(
      "zen-app-launcher-item-label",
      "astra-app-hub-item-label"
    );
    setL10nOrText(label, "astra-app-hub-add-tile", "Add app");
    button.appendChild(label);
    return button;
  }

  #updateHubChrome() {
    const backHeader = document.getElementById("astra-app-hub-back-header-btn");
    const addHeader = document.getElementById("astra-app-hub-add-header-btn");
    const customizeBtn = document.getElementById("astra-app-hub-customize-btn");
    const overflowHeader = document.getElementById(
      "astra-app-hub-overflow-header-btn"
    );
    const footer = document.getElementById("astra-app-hub-footer");
    const browsing = this.#hubView === "browse";
    const editing = !!this.#editorMode || this.#customizeMode;
    if (footer) {
      footer.hidden = true;
    }
    if (backHeader) {
      backHeader.hidden = !browsing || editing;
    }
    if (addHeader) {
      addHeader.hidden = editing || browsing;
    }
    if (customizeBtn) {
      customizeBtn.hidden = this.#customizeMode || !!this.#editorMode;
    }
    if (overflowHeader) {
      overflowHeader.hidden = editing;
    }
    try {
      this.panel?.setAttribute("app-hub-view", this.#hubView);
    } catch {
      // ignore
    }
  }

  #setHubView(view) {
    this.#hubView = view === "browse" ? "browse" : "launchpad";
    this.#rendered = false;
    this.#rebuildList();
    if (this.#searchQuery) {
      this.#applySearchFilter(this.#searchQuery);
    }
  }

  async #refreshSpacePins() {
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      this.#spacePinIds = [];
      return;
    }
    try {
      const { getPinsForCurrentSpace } = ChromeUtils.importESModule(
        "resource:///modules/zen/AstraSpaceAppBridge.mjs"
      );
      this.#spacePinIds = await getPinsForCurrentSpace(window);
    } catch {
      this.#spacePinIds = [];
    }
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

    if (options.richHeader) {
      const rich = this.#createRichSectionHeader({
        icon: options.richHeader.icon,
        title: label,
        titleL10n: l10nId,
        subtitle: options.richHeader.subtitle,
        subtitleL10n: options.richHeader.subtitleL10n,
        showAll: !!options.richHeader.showAll,
      });
      rich.setAttribute("data-category-id", categoryId);
      section.appendChild(rich);
    } else {
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
    }

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
    if (options.includeAddTile) {
      grid.appendChild(this.#createAddAppTile());
    }
    section.appendChild(grid);
    list.appendChild(section);
    return section;
  }

  #createAppButton(app, sectionOptions = {}) {
    const button = document.createXULElement("toolbarbutton");
    button.classList.add(
      "zen-app-launcher-item",
      "astra-app-hub-item"
    );
    button.setAttribute("data-app-id", app.id);
    button.setAttribute("data-url", app.url);
    button.setAttribute(
      "tooltiptext",
      `${app.name} — Opens in new tab`
    );
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

    // Icon stack: packaged/local image + monogram fallback (never http/https).
    const iconInfo = resolveAppIcon(app);
    const stack = document.createXULElement("stack");
    stack.classList.add(
      "zen-app-launcher-item-icon-stack",
      "astra-app-hub-item-icon-stack"
    );
    stack.setAttribute("aria-hidden", "true");

    const mono = document.createXULElement("label");
    mono.classList.add(
      "zen-app-launcher-item-monogram",
      "astra-app-hub-item-monogram"
    );
    mono.setAttribute(
      "value",
      iconInfo.monogram || iconInfo.text || app.monogram || "?"
    );
    mono.setAttribute(
      "data-accent",
      String(iconInfo?.accent ?? 0)
    );
    stack.appendChild(mono);

    if (iconInfo.type === "image" && iconInfo.src) {
      const safe = String(iconInfo.src);
      if (
        !safe.startsWith("http:") &&
        !safe.startsWith("https:") &&
        !safe.startsWith("//")
      ) {
        this.#appendSafeIconImage(stack, safe);
      }
    }
    button.appendChild(stack);

    const label = document.createXULElement("label");
    label.classList.add(
      "zen-app-launcher-item-label",
      "astra-app-hub-item-label",
      "astra-app-name"
    );
    label.setAttribute("value", app.name);
    button.appendChild(label);
    button.setAttribute("aria-label", app.name);

    if (
      app.builtin === false &&
      !sanitizeDataImageURI(app.customIconData) &&
      !sanitizeDataImageURI(app.cachedFaviconData)
    ) {
      void this.#enrichCustomAppIcon(button, app);
    }

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
    const mono = document.createXULElement("label");
    mono.classList.add("astra-app-hub-item-monogram");
    mono.setAttribute(
      "data-accent",
      String(iconInfo?.accent ?? 0)
    );
    mono.setAttribute(
      "value",
      iconInfo?.monogram || iconInfo?.text || app?.monogram || "?"
    );
    parent.appendChild(mono);
  }

  /**
   * For custom apps without stored data icons: migrate legacy profile filename
   * (once, Astra icon dir only) then Places → remote site-icon discovery.
   * Private windows keep monogram only. Monogram stays as intentional fallback.
   */
  async #enrichCustomAppIcon(button, app) {
    if (!button || !app || app.builtin !== false) {
      return;
    }
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      return;
    }
    const appId = app.id;
    const expectedUrl = app.url;
    if (typeof appId !== "string" || !appId.startsWith("custom-")) {
      return;
    }

    try {
      // Legacy filename → bounded PNG data URI inside astra-app-icons only.
      if (
        app.icon &&
        !sanitizeDataImageURI(app.customIconData) &&
        typeof migrateLegacyIconFileName === "function"
      ) {
        const migrated = await migrateLegacyIconFileName(app.icon);
        const latest = (gAstraAppHubState.data.customApps || []).find(
          a => a.id === appId
        );
        if (
          latest &&
          latest.url === expectedUrl &&
          !sanitizeDataImageURI(latest.customIconData)
        ) {
          if (migrated) {
            await gAstraAppHubState.updateCustomApp(appId, {
              customIconData: migrated,
              icon: "",
            });
            this.#lastAppliedRevision = gAstraAppHubState.revision;
            return;
          }
          // Unsafe / missing legacy file — drop the filename claim.
          if (latest.icon) {
            await gAstraAppHubState.updateCustomApp(appId, { icon: "" });
            this.#lastAppliedRevision = gAstraAppHubState.revision;
          }
        }
      }

      if (sanitizeDataImageURI(app.cachedFaviconData)) {
        return;
      }

      const faviconURI =
        typeof resolveCustomAppFaviconDataURI === "function"
          ? await resolveCustomAppFaviconDataURI(expectedUrl, {
              privateBrowsing: false,
            })
          : await resolvePlacesFaviconURL(expectedUrl, {
              privateBrowsing: false,
            });
      if (
        !faviconURI ||
        this.#destroyed ||
        window.closed ||
        !button.isConnected
      ) {
        return;
      }
      const safe = sanitizeDataImageURI(faviconURI);
      if (!safe) {
        return;
      }

      const still = (gAstraAppHubState.data.customApps || []).find(
        a => a.id === appId
      );
      if (
        !still ||
        still.url.toLowerCase() !== expectedUrl.toLowerCase() ||
        sanitizeDataImageURI(still.customIconData)
      ) {
        return;
      }

      try {
        await gAstraAppHubState.setCachedFaviconData(appId, safe, {
          expectedUrl,
        });
        this.#lastAppliedRevision = gAstraAppHubState.revision;
      } catch {
        // ignore persist errors; still paint this session
      }

      if (this.#destroyed || window.closed || !button.isConnected) {
        return;
      }
      if (sanitizeDataImageURI(still.customIconData)) {
        return;
      }
      const stack = button.querySelector(".astra-app-hub-item-icon-stack");
      if (!stack || stack.querySelector(".astra-app-hub-item-icon")) {
        return;
      }
      this.#paintIconOnStack(stack, safe);
    } catch {
      // monogram remains — intentional branded fallback
    }
  }

  /**
   * Reconcile icon stack state for already-decoded (often sync data:) images
   * so tiles do not stay stuck on the monogram when load never fires again.
   */
  #reconcileIconState(stack, image) {
    if (!stack || !image || !stack.isConnected) {
      return;
    }
    try {
      if (image.complete) {
        if (image.naturalWidth > 0) {
          stack.setAttribute("data-icon-loaded", "true");
          stack.removeAttribute("data-icon-error");
        } else {
          stack.setAttribute("data-icon-error", "true");
          stack.removeAttribute("data-icon-loaded");
        }
      }
    } catch {
      // ignore
    }
  }

  /** XHTML <img> — XUL <image> no longer fires load/error (Bug 1815229). */
  #appendSafeIconImage(stack, dataURI) {
    if (!stack || !dataURI) {
      return null;
    }
    const image = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "img"
    );
    image.classList.add(
      "zen-app-launcher-item-icon",
      "astra-app-hub-item-icon"
    );
    image.setAttribute("alt", "");
    image.setAttribute("draggable", "false");
    image.setAttribute("aria-hidden", "true");
    image.addEventListener(
      "load",
      () => {
        if (!stack.isConnected) {
          return;
        }
        stack.setAttribute("data-icon-loaded", "true");
        stack.removeAttribute("data-icon-error");
      },
      { once: true }
    );
    image.addEventListener(
      "error",
      () => {
        if (!stack.isConnected) {
          return;
        }
        stack.setAttribute("data-icon-error", "true");
        stack.removeAttribute("data-icon-loaded");
        try {
          image.removeAttribute("src");
        } catch {
          // ignore
        }
      },
      { once: true }
    );
    image.src = dataURI;
    stack.appendChild(image);
    this.#reconcileIconState(stack, image);
    return image;
  }

  #paintIconOnStack(stack, dataURI) {
    if (!stack || !dataURI) {
      return;
    }
    this.#appendSafeIconImage(stack, dataURI);
  }

  /**
   * After the user launches a custom app, capture the Places favicon once
   * the tab finishes loading (bounded; no permanent navigation listener).
   * Uses gBrowser.addTabsProgressListener — same interface as zen/tests/spaces.
   * Link-icon progress callbacks are intentionally unused (no in-tree precedent).
   */
  #beginFaviconCapture(app, tabHint = null) {
    if (
      this.#destroyed ||
      window.closed ||
      !app?.id ||
      app.builtin !== false ||
      PrivateBrowsingUtils.isWindowPrivate(window)
    ) {
      return;
    }
    if (this.#faviconCaptures.has(app.id)) {
      return;
    }
    const tab =
      tabHint ||
      window.gBrowser?.selectedTab ||
      null;
    const expectedUrl = app.url;
    const urlKey = String(expectedUrl || "").toLowerCase();
    const expectedOrigin = (() => {
      try {
        return new URL(expectedUrl).origin;
      } catch {
        return "";
      }
    })();

    if (!tab?.linkedBrowser) {
      void this.#tryPersistPlacesFavicon(app.id, expectedUrl, 0, {
        urlKey,
        expectedUrl,
      });
      return;
    }

    const session = {
      appId: app.id,
      expectedUrl,
      urlKey,
      expectedOrigin,
      tab,
      browser: tab.linkedBrowser,
      attempts: 0,
      done: false,
      cleaned: false,
      retryTimer: null,
      listener: null,
      onTabClose: null,
      onTabAttr: null,
    };

    const cleanup = () => {
      if (session.cleaned) {
        return;
      }
      session.cleaned = true;
      session.done = true;
      try {
        if (session.retryTimer) {
          clearTimeout(session.retryTimer);
          session.retryTimer = null;
        }
      } catch {
        // ignore
      }
      try {
        if (session.listener) {
          window.gBrowser?.removeTabsProgressListener?.(session.listener);
        }
      } catch {
        // ignore
      }
      try {
        if (session.onTabClose) {
          tab.removeEventListener("TabClose", session.onTabClose);
        }
        if (session.onTabAttr) {
          tab.removeEventListener("TabAttrModified", session.onTabAttr);
        }
      } catch {
        // ignore
      }
      this.#faviconCaptures.delete(app.id);
    };

    const tryCapture = async reason => {
      if (session.done || session.cleaned || this.#destroyed || window.closed) {
        cleanup();
        return;
      }
      const ok = await this.#tryPersistPlacesFavicon(
        app.id,
        session.expectedUrl,
        session.attempts,
        session
      );
      if (ok) {
        cleanup();
        return;
      }
      session.attempts += 1;
      // Cross-origin redirect: one Places attempt for the saved URL, then stop.
      if (session.attempts >= 2 || reason === "cross-origin-final") {
        cleanup();
        return;
      }
      // One delayed retry after first miss (favicon often lands after STATE_STOP).
      if (!session.retryTimer && reason !== "retry") {
        session.retryTimer = setTimeout(() => {
          session.retryTimer = null;
          void tryCapture("retry");
        }, 1500);
      }
    };

    // Proven tabs-progress methods: onStateChange / onLocationChange only.
    session.listener = {
      onStateChange(browser, webProgress, _request, flags, _status) {
        try {
          if (browser !== session.browser || !webProgress?.isTopLevel) {
            return;
          }
          const stop =
            flags & Ci.nsIWebProgressListener.STATE_STOP &&
            flags & Ci.nsIWebProgressListener.STATE_IS_NETWORK &&
            flags & Ci.nsIWebProgressListener.STATE_IS_WINDOW;
          if (stop) {
            void tryCapture("stop");
          }
        } catch {
          // ignore
        }
      },
      onLocationChange(browser, webProgress, _request, location) {
        try {
          if (browser !== session.browser || !webProgress?.isTopLevel) {
            return;
          }
          const spec =
            typeof location?.spec === "string"
              ? location.spec
              : location?.asciiSpec || "";
          if (!spec || !session.expectedOrigin) {
            return;
          }
          // same-origin only. Cross-site redirects must not drive capture;
          // Places lookup always uses the saved app URL (never redirect URL).
          const origin = new URL(spec).origin;
          if (origin !== session.expectedOrigin) {
            void tryCapture("cross-origin-final");
          }
        } catch {
          // ignore
        }
      },
    };

    session.onTabClose = () => cleanup();
    session.onTabAttr = event => {
      const changed = event?.detail?.changed;
      if (Array.isArray(changed) && changed.includes("image")) {
        void tryCapture("attr");
      }
    };

    try {
      if (typeof window.gBrowser?.addTabsProgressListener !== "function") {
        throw new Error("no-tabs-progress");
      }
      window.gBrowser.addTabsProgressListener(session.listener);
      tab.addEventListener("TabClose", session.onTabClose, { once: true });
      tab.addEventListener("TabAttrModified", session.onTabAttr);
      this.#faviconCaptures.set(app.id, { ...session, cleanup });
    } catch (error) {
      console.warn("[AstraAppHub] favicon capture setup failed:", error);
      cleanup();
      void this.#tryPersistPlacesFavicon(app.id, expectedUrl, 0, {
        urlKey,
        expectedUrl,
      });
    }
  }

  /**
   * Persist Places and/or remotely-discovered favicon for a custom app.
   * Guarantees: never blocks UI; monogram remains until a safe data URI lands.
   */
  async #tryPersistCustomAppFavicon(appId, pageUrl, session = null) {
    if (
      this.#destroyed ||
      window.closed ||
      PrivateBrowsingUtils.isWindowPrivate(window)
    ) {
      return false;
    }
    if (session?.cleaned || session?.done) {
      return false;
    }
    const expectedUrl = session?.expectedUrl || pageUrl || "";
    const urlKey = session?.urlKey || String(expectedUrl).toLowerCase();
    const allowRemote = session?.allowRemote !== false;
    try {
      const before = (gAstraAppHubState.data.customApps || []).find(
        a => a.id === appId
      );
      if (!before || before.url.toLowerCase() !== urlKey) {
        return false;
      }
      if (sanitizeDataImageURI(before.customIconData)) {
        return true;
      }
      if (sanitizeDataImageURI(before.cachedFaviconData) && !allowRemote) {
        return true;
      }

      // Always query the saved app URL — never a redirected tab URL.
      const faviconURI =
        typeof resolveCustomAppFaviconDataURI === "function"
          ? await resolveCustomAppFaviconDataURI(expectedUrl, {
              privateBrowsing: false,
              allowRemote,
              preferredIconHint: session?.preferredIconHint || null,
            })
          : await resolvePlacesFaviconURL(expectedUrl, {
              privateBrowsing: false,
            });
      if (
        !faviconURI ||
        this.#destroyed ||
        window.closed ||
        session?.cleaned
      ) {
        return false;
      }
      const safe = sanitizeDataImageURI(faviconURI);
      if (!safe) {
        return false;
      }

      const existing = (gAstraAppHubState.data.customApps || []).find(
        a => a.id === appId
      );
      if (!existing || existing.url.toLowerCase() !== urlKey) {
        return false;
      }
      if (session && this.#faviconCaptures.get(appId)?.cleaned) {
        return false;
      }
      if (existing.cachedFaviconData === safe) {
        return true;
      }
      await gAstraAppHubState.setCachedFaviconData(appId, safe, {
        expectedUrl,
      });
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      // Paint immediately so the tile upgrades from monogram without waiting
      // for a panel reopen (state notify may already have rebuilt, or may
      // have been skipped if revision was pre-applied).
      this.#paintCachedIconForApp(appId, safe);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upgrade any visible tile/chip for a custom app once a favicon data URI
   * is available. No-op when the image is already painted.
   */
  #paintCachedIconForApp(appId, dataURI) {
    if (!appId || !dataURI || !this.list) {
      return;
    }
    const safe = sanitizeDataImageURI(dataURI);
    if (!safe) {
      return;
    }
    let buttons;
    try {
      buttons = this.list.querySelectorAll(
        `.astra-app-hub-item[data-app-id="${CSS.escape(appId)}"]`
      );
    } catch {
      buttons = this.list.querySelectorAll(".astra-app-hub-item[data-app-id]");
      buttons = [...buttons].filter(
        el => el.getAttribute("data-app-id") === appId
      );
    }
    for (const button of buttons) {
      if (!button?.isConnected) {
        continue;
      }
      const stack = button.querySelector(".astra-app-hub-item-icon-stack");
      if (!stack || stack.querySelector(".astra-app-hub-item-icon")) {
        continue;
      }
      this.#paintIconOnStack(stack, safe);
    }
  }

  /**
   * Persist Places data URI for a custom app after revision/session guards.
   * Capture sessions use Places-only (tab load already populated Places).
   */
  async #tryPersistPlacesFavicon(appId, pageUrl, _attempt, session = null) {
    return this.#tryPersistCustomAppFavicon(appId, pageUrl, {
      ...(session || {}),
      expectedUrl: session?.expectedUrl || pageUrl,
      urlKey: session?.urlKey || String(pageUrl || "").toLowerCase(),
      // After launch, Places is authoritative; skip a second remote round-trip.
      allowRemote: session?.allowRemote === true,
    });
  }

  #cancelFaviconCapture(appId) {
    if (!appId) {
      return;
    }
    const session = this.#faviconCaptures.get(appId);
    try {
      session?.cleanup?.();
    } catch {
      // ignore
    }
    this.#faviconCaptures.delete(appId);
  }

  #stopAllFaviconCaptures() {
    for (const session of this.#faviconCaptures.values()) {
      try {
        session.cleanup?.();
      } catch {
        // ignore
      }
    }
    this.#faviconCaptures.clear();
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
      // Footer chrome retired — keep node empty/hidden for layout stability.
      footer.hidden = true;
    }
    const list = this.list;
    if (list) {
      list.hidden = !!this.#editorMode;
    }
    const editor = this.editor;
    if (editor) {
      editor.hidden = !this.#editorMode;
    }
    this.#updateHubChrome();
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
    // Debounce full rebuild / filter — each keystroke previously rebuilt the
    // launchpad DOM or walked every catalog item synchronously.
    if (this.#searchDebounceTimer) {
      clearTimeout(this.#searchDebounceTimer);
    }
    this.#searchDebounceTimer = setTimeout(() => {
      this.#searchDebounceTimer = null;
      if (this.#destroyed) {
        return;
      }
      if (this.#hubView === "launchpad" && !this.#customizeMode) {
        this.#rendered = false;
        this.#rebuildList();
        return;
      }
      this.#applySearchFilter(this.#searchQuery);
    }, 120);
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
    if (this.#searchDebounceTimer) {
      clearTimeout(this.#searchDebounceTimer);
      this.#searchDebounceTimer = null;
    }
    const search = this.searchInput;
    if (search) {
      search.value = "";
    }
    this.#searchQuery = "";
    const clearBtn = document.getElementById("astra-app-hub-search-clear");
    if (clearBtn) {
      clearBtn.hidden = true;
    }
    if (this.#hubView === "launchpad" && !this.#customizeMode) {
      this.#rendered = false;
      this.#rebuildList();
      return;
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
    const url = item.getAttribute("data-url");
    if (appId || url) {
      const map = this.#allAppsMap();
      const target =
        appId && map.has(appId)
          ? appId
          : url || appId;
      void this.openApp(target, { mode: "tab", source: "item" });
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
      case "retry-catalog":
        void this.#retryCatalog();
        break;
      case "browse-apps":
        this.#setHubView("browse");
        break;
      case "back-launchpad":
        this.#setHubView("launchpad");
        break;
      case "manage-apps":
      case "customize":
        this.#enterCustomizeMode();
        break;
      case "clear-search":
        this.#clearSearch();
        this.searchInput?.focus();
        break;
      case "done-customize":
        this.#exitCustomizeMode();
        this.#setHubView("launchpad");
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
      case "pin-space": {
        const pinId = this.#contextAppId || appId;
        if (pinId && !PrivateBrowsingUtils.isWindowPrivate(window)) {
          try {
            const { pinAppToCurrentSpace } = ChromeUtils.importESModule(
              "resource:///modules/zen/AstraSpaceAppBridge.mjs"
            );
            await pinAppToCurrentSpace(window, pinId);
            await this.#refreshSpacePins();
            this.#rendered = false;
            this.#rebuildList();
          } catch {
            // ignore
          }
        }
        break;
      }
      case "unpin-space": {
        const unpinId = this.#contextAppId || appId;
        if (unpinId && !PrivateBrowsingUtils.isWindowPrivate(window)) {
          try {
            const { unpinAppFromCurrentSpace } = ChromeUtils.importESModule(
              "resource:///modules/zen/AstraSpaceAppBridge.mjs"
            );
            await unpinAppFromCurrentSpace(window, unpinId);
            await this.#refreshSpacePins();
            this.#rendered = false;
            this.#rebuildList();
          } catch {
            // ignore
          }
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
        if (PrivateBrowsingUtils.isWindowPrivate(window)) {
          this.#setEditorErrorL10n("astra-app-hub-error-private-edit");
          break;
        }
        await this.#pickEditorIcon();
        break;
      case "reset-icon":
        if (PrivateBrowsingUtils.isWindowPrivate(window)) {
          this.#setEditorErrorL10n("astra-app-hub-error-private-edit");
          break;
        }
        this.#pendingIconData = null;
        this.#pendingResetIcon = true;
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
    const btn =
      document.getElementById("astra-app-hub-overflow-header-btn") ||
      document.getElementById("astra-app-hub-overflow-btn") ||
      document.getElementById("astra-app-hub-customize-btn");
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
    const isPrivate = PrivateBrowsingUtils.isWindowPrivate(window);
    const pinItem = document.getElementById("astra-app-hub-pin-current-space");
    const unpinItem = document.getElementById(
      "astra-app-hub-unpin-current-space"
    );
    const pinnedHere = this.#spacePinIds.includes(this.#contextAppId);
    if (pinItem) {
      pinItem.hidden = isPrivate || pinnedHere || !this.#contextAppId;
      pinItem.disabled = isPrivate;
    }
    if (unpinItem) {
      unpinItem.hidden = isPrivate || !pinnedHere;
      unpinItem.disabled = isPrivate;
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
    this.#cancelFaviconCapture(appId);
    try {
      const { onCustomAppDeleted } = ChromeUtils.importESModule(
        "resource:///modules/zen/AstraSpaceAppBridge.mjs"
      );
      await onCustomAppDeleted(appId);
    } catch {
      // ignore
    }
    this.#lastAppliedRevision = gAstraAppHubState.revision;
    this.#rendered = false;
    this.#rebuildList();
  }

  // —— Editor ——

  #openEditor(mode, appId = null) {
    this.#editorMode = mode;
    this.#editingAppId = appId;
    this.#pendingIconData = null;
    this.#pendingResetIcon = false;
    this.#updateCustomizeChrome();

    const nameEl = document.getElementById("astra-app-hub-editor-name");
    const urlEl = document.getElementById("astra-app-hub-editor-url");
    const catEl = document.getElementById("astra-app-hub-editor-category");
    const kwEl = document.getElementById("astra-app-hub-editor-keywords");
    const errEl = document.getElementById("astra-app-hub-editor-error");
    const iconBtn = document.getElementById("astra-app-hub-editor-icon-btn");
    const resetIconBtn = document.getElementById(
      "astra-app-hub-editor-reset-icon-btn"
    );
    const saveBtn = document.getElementById("astra-app-hub-editor-save");
    if (errEl) {
      errEl.hidden = true;
      errEl.removeAttribute("data-l10n-id");
      errEl.setAttribute("value", "");
    }

    const isPrivate = PrivateBrowsingUtils.isWindowPrivate(window);
    if (iconBtn) {
      iconBtn.disabled = isPrivate;
    }
    if (resetIconBtn) {
      resetIconBtn.disabled = isPrivate;
    }
    if (saveBtn) {
      saveBtn.disabled = isPrivate;
    }
    if (nameEl) {
      nameEl.disabled = isPrivate;
    }
    if (urlEl) {
      urlEl.disabled = isPrivate;
    }
    if (catEl) {
      catEl.disabled = isPrivate;
    }
    if (kwEl) {
      kwEl.disabled = isPrivate;
    }
    if (isPrivate) {
      this.#setEditorErrorL10n("astra-app-hub-error-private-edit");
    }

    // Populate categories (catalog when ready; otherwise stable fallback).
    if (catEl) {
      clearChildren(catEl);
      const categories =
        this.#catalog?.categories?.length > 0
          ? this.#catalog.categories
          : EDITOR_CATEGORY_FALLBACK;
      for (const cat of categories) {
        const opt = document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "option"
        );
        opt.value = cat.id;
        opt.textContent = cat.label;
        catEl.appendChild(opt);
      }
    }

    const saveBtnLabel =
      mode === "edit"
        ? ["astra-app-hub-editor-save", "Save"]
        : ["astra-app-hub-editor-add", "Add"];
    if (saveBtn) {
      setL10nOrText(saveBtn, saveBtnLabel[0], saveBtnLabel[1]);
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
        catEl.value = "work";
      }
      if (kwEl) {
        kwEl.value = "";
      }
    }
    if (!isPrivate) {
      nameEl?.focus();
    }
  }

  #closeEditor() {
    this.#editorMode = null;
    this.#editingAppId = null;
    this.#pendingIconData = null;
    this.#pendingResetIcon = false;
    this.#updateCustomizeChrome();
    this.#rendered = false;
    this.#rebuildList();
  }

  async #pickEditorIcon() {
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      this.#setEditorErrorL10n("astra-app-hub-error-private-edit");
      return;
    }
    try {
      const dataURI = await pickCustomIconAsDataURI(window);
      if (dataURI) {
        this.#pendingIconData = dataURI;
        this.#pendingResetIcon = false;
        this.#setEditorErrorL10n(null);
      }
    } catch (error) {
      console.warn("[AstraAppHub] icon pick failed:", error);
      const reason = error?.message || String(error);
      if (reason === "too-large") {
        this.#setEditorErrorL10n("astra-app-hub-error-icon-too-large");
      } else {
        this.#setEditorErrorL10n("astra-app-hub-error-icon-unsupported");
      }
    }
  }

  #setEditorErrorL10n(l10nId) {
    const errEl = document.getElementById("astra-app-hub-editor-error");
    if (!errEl) {
      return;
    }
    if (!l10nId) {
      errEl.hidden = true;
      errEl.removeAttribute("data-l10n-id");
      errEl.setAttribute("value", "");
      return;
    }
    errEl.hidden = false;
    setL10nOrText(
      errEl,
      l10nId,
      EDITOR_ERROR_FALLBACKS[l10nId] || "Could not save this app."
    );
  }

  /** @deprecated use #setEditorErrorL10n */
  #setEditorError(message) {
    const errEl = document.getElementById("astra-app-hub-editor-error");
    if (!errEl) {
      return;
    }
    errEl.removeAttribute("data-l10n-id");
    errEl.hidden = !message;
    errEl.setAttribute("value", message || "");
  }

  async #saveEditor() {
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      this.#setEditorErrorL10n("astra-app-hub-error-private-edit");
      return;
    }
    const nameEl = document.getElementById("astra-app-hub-editor-name");
    const urlEl = document.getElementById("astra-app-hub-editor-url");
    const catEl = document.getElementById("astra-app-hub-editor-category");
    const kwEl = document.getElementById("astra-app-hub-editor-keywords");
    const name = (nameEl?.value || "").trim();
    const url = (urlEl?.value || "").trim();
    const category = catEl?.value || "work";
    const keywords = (kwEl?.value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (!name) {
      this.#setEditorErrorL10n("astra-app-hub-error-empty-name");
      return;
    }
    const urlCheck = validateAppUrl(url);
    if (!urlCheck.ok) {
      this.#setEditorErrorL10n("astra-app-hub-error-url");
      return;
    }

    // Duplicate detection against custom apps and catalog apps (normalized).
    const nextKey = normalizeAppUrlKey(urlCheck.href);
    if (nextKey) {
      const conflict = [...this.#allAppsMap().values()].find(app => {
        if (!app?.url) {
          return false;
        }
        if (this.#editorMode === "edit" && app.id === this.#editingAppId) {
          return false;
        }
        return normalizeAppUrlKey(app.url) === nextKey;
      });
      if (conflict) {
        this.#setEditorErrorL10n("astra-app-hub-error-duplicate");
        return;
      }
    }

    const payload = {
      name,
      url: urlCheck.href,
      category,
      keywords,
    };
    if (this.#pendingResetIcon) {
      payload.clearCustomIcon = true;
    } else if (this.#pendingIconData) {
      payload.customIconData = this.#pendingIconData;
      payload.icon = "";
    }

    try {
      let savedId = this.#editingAppId;
      const hadCustomPick = !!this.#pendingIconData && !this.#pendingResetIcon;
      const prevApp =
        this.#editorMode === "edit" && this.#editingAppId
          ? (gAstraAppHubState.data.customApps || []).find(
              a => a.id === this.#editingAppId
            )
          : null;
      const urlChanged =
        !!prevApp &&
        prevApp.url.toLowerCase() !== urlCheck.href.toLowerCase();

      if (this.#editorMode === "edit" && this.#editingAppId) {
        if (urlChanged) {
          this.#cancelFaviconCapture(this.#editingAppId);
        }
        await gAstraAppHubState.updateCustomApp(this.#editingAppId, payload);
      } else {
        const before = new Set(
          (gAstraAppHubState.data.customApps || []).map(a => a.id)
        );
        await gAstraAppHubState.addCustomApp(payload);
        const added = (gAstraAppHubState.data.customApps || []).find(
          a => !before.has(a.id)
        );
        savedId = added?.id || null;
        if (savedId) {
          try {
            const favs = gAstraAppHubState.data.favorites || [];
            if (!favs.includes(savedId)) {
              await gAstraAppHubState.toggleFavorite(savedId);
            }
          } catch (favError) {
            console.warn("[AstraAppHub] auto-pin custom app failed:", favError);
          }
        }
      }
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      this.#closeEditor();

      // Non-blocking icon upgrade after save (monogram already visible).
      // Places first, then direct site-icon discovery — never blocks Add.
      if (
        savedId &&
        !hadCustomPick &&
        !PrivateBrowsingUtils.isWindowPrivate(window)
      ) {
        void this.#tryPersistCustomAppFavicon(savedId, urlCheck.href, {
          expectedUrl: urlCheck.href,
          urlKey: urlCheck.href.toLowerCase(),
          allowRemote: true,
        });
      }
    } catch (error) {
      const reason = error?.message || String(error);
      const l10nByReason = {
        "duplicate-url": "astra-app-hub-error-duplicate",
        "custom-limit": "astra-app-hub-error-generic",
        "empty-name": "astra-app-hub-error-empty-name",
        "not-found": "astra-app-hub-error-generic",
      };
      this.#setEditorErrorL10n(
        l10nByReason[reason] || "astra-app-hub-error-generic"
      );
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

  // —— External drag-and-drop (launchpad add) ——

  #canAcceptExternalDrop() {
    return (
      this.#hubView === "launchpad" &&
      !this.#customizeMode &&
      !this.#editorMode
    );
  }

  #setExternalDropActive(active) {
    if (this.#externalDropActive === active) {
      return;
    }
    this.#externalDropActive = active;
    const panel = this.panel;
    const list = this.list;
    if (panel) {
      if (active) {
        panel.setAttribute("data-external-drop-active", "true");
      } else {
        panel.removeAttribute("data-external-drop-active");
      }
    }
    if (list) {
      list.classList.toggle("astra-app-hub-drop-target-active", active);
    }
    for (const el of list?.querySelectorAll(
      ".astra-app-hub-add-tile, .astra-app-hub-empty"
    ) || []) {
      el.classList.toggle("astra-app-hub-drop-target-active", active);
    }
  }

  #clearExternalDropActive() {
    this.#externalDropDepth = 0;
    this.#setExternalDropActive(false);
  }

  #setDropAdding(active) {
    const tile = this.list?.querySelector(".astra-app-hub-add-tile");
    const label = tile?.querySelector(".astra-app-hub-item-label");
    if (tile) {
      if (active) {
        tile.setAttribute("data-drop-adding", "true");
      } else {
        tile.removeAttribute("data-drop-adding");
      }
    }
    if (label) {
      if (active) {
        setL10nOrText(label, "astra-app-hub-drop-adding", "Adding…");
      } else {
        setL10nOrText(label, "astra-app-hub-add-tile", "Add app");
      }
    }
    const status = document.getElementById("astra-app-hub-search-status");
    if (!tile && status && active && !this.#searchQuery) {
      status.hidden = false;
      status.classList.add("astra-app-hub-drop-status");
      setL10nOrText(status, "astra-app-hub-drop-adding", "Adding…");
    }
  }

  #showDropStatus(l10nId, durationMs = 3200) {
    const status = document.getElementById("astra-app-hub-search-status");
    if (!status || this.#searchQuery) {
      return;
    }
    if (this.#dropStatusTimer) {
      clearTimeout(this.#dropStatusTimer);
      this.#dropStatusTimer = null;
    }
    status.hidden = false;
    status.classList.add("astra-app-hub-drop-status");
    status.classList.toggle(
      "astra-app-hub-drop-error",
      String(l10nId || "").includes("error")
    );
    setL10nOrText(
      status,
      l10nId,
      DROP_STATUS_FALLBACKS[l10nId] || "Could not add this app."
    );
    this.#dropStatusTimer = setTimeout(() => {
      if (!this.#searchQuery) {
        status.hidden = true;
        status.removeAttribute("data-l10n-id");
        status.setAttribute("value", "");
        status.classList.remove(
          "astra-app-hub-drop-status",
          "astra-app-hub-drop-error"
        );
      }
      this.#dropStatusTimer = null;
    }, durationMs);
  }

  #extractExternalAppDrop(dt) {
    if (!dt || !dataTransferHasExternalAppPayload(dt)) {
      return null;
    }

    // Tab drag (often lacks text/x-moz-url).
    try {
      const types = new Set([
        ...(dt.types ? [...dt.types] : []),
        ...mozItemTypes(dt, 0),
      ]);
      if (types.has(TAB_DROP_TYPE)) {
        const tab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
        const browser = tab?.linkedBrowser;
        const spec =
          browser?.currentURI?.spec ||
          tab?.linkedBrowser?.documentURI?.spec ||
          "";
        if (typeof spec === "string" && spec) {
          const urlCheck = validateAppUrl(spec);
          if (urlCheck.ok) {
            let faviconHint = null;
            const image =
              (typeof tab?.image === "string" && tab.image) ||
              (typeof tab?.getAttribute === "function" &&
                tab.getAttribute("image")) ||
              "";
            if (typeof image === "string" && /^data:image\//i.test(image)) {
              faviconHint = image;
            }
            return {
              url: urlCheck.href,
              title: (tab?.label || tab?.getAttribute?.("label") || "").trim(),
              faviconHint,
              source: "tab",
            };
          }
        }
      }
    } catch {
      // fall through to link flavors
    }

    const mozUrl = readDataTransferString(dt, "text/x-moz-url");
    if (mozUrl) {
      const rawUrl = firstUrlLineFromText(mozUrl);
      const urlCheck = validateAppUrl(rawUrl);
      if (urlCheck.ok) {
        return {
          url: urlCheck.href,
          title: titleFromMozUrlPayload(mozUrl),
          faviconHint: null,
          source: "link",
        };
      }
    }

    for (const flavor of ["text/uri-list", "text/plain"]) {
      const raw = readDataTransferString(dt, flavor);
      if (!raw) {
        continue;
      }
      const rawUrl = firstUrlLineFromText(raw);
      const urlCheck = validateAppUrl(rawUrl);
      if (urlCheck.ok) {
        return {
          url: urlCheck.href,
          title: "",
          faviconHint: null,
          source: "link",
        };
      }
    }

    return null;
  }

  async #addCustomAppFromDrop(payload) {
    if (this.#externalDropInFlight) {
      return;
    }
    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
      this.#showDropStatus("astra-app-hub-drop-error-private");
      return;
    }
    if (!payload?.url) {
      this.#showDropStatus("astra-app-hub-drop-error-invalid");
      return;
    }

    const urlCheck = validateAppUrl(payload.url);
    if (!urlCheck.ok) {
      this.#showDropStatus("astra-app-hub-error-url");
      return;
    }

    const nextKey = normalizeAppUrlKey(urlCheck.href);
    if (nextKey) {
      const conflict = [...this.#allAppsMap().values()].find(app => {
        if (!app?.url) {
          return false;
        }
        return normalizeAppUrlKey(app.url) === nextKey;
      });
      if (conflict) {
        this.#showDropStatus("astra-app-hub-error-duplicate");
        return;
      }
    }

    this.#externalDropInFlight = true;
    this.#setDropAdding(true);
    try {
      const name =
        (payload.title || "").trim() ||
        urlCheck.hostname ||
        urlCheck.href;
      const appPayload = {
        name: name.slice(0, MAX_NAME_LENGTH),
        url: urlCheck.href,
        category: "work",
        keywords: [],
      };
      const preferredData = sanitizeDataImageURI(payload.faviconHint || "");
      if (preferredData) {
        appPayload.cachedFaviconData = preferredData;
      }

      const before = new Set(
        (gAstraAppHubState.data.customApps || []).map(a => a.id)
      );
      await gAstraAppHubState.addCustomApp(appPayload);
      const added = (gAstraAppHubState.data.customApps || []).find(
        a => !before.has(a.id)
      );
      const savedId = added?.id || null;
      if (savedId) {
        try {
          const favs = gAstraAppHubState.data.favorites || [];
          if (!favs.includes(savedId)) {
            await gAstraAppHubState.toggleFavorite(savedId);
          }
        } catch (favError) {
          console.warn("[AstraAppHub] auto-pin dropped app failed:", favError);
        }
      }
      this.#lastAppliedRevision = gAstraAppHubState.revision;
      this.#rendered = false;
      this.#rebuildList();

      if (
        savedId &&
        !preferredData &&
        !PrivateBrowsingUtils.isWindowPrivate(window)
      ) {
        void this.#tryPersistCustomAppFavicon(savedId, urlCheck.href, {
          expectedUrl: urlCheck.href,
          urlKey: urlCheck.href.toLowerCase(),
          allowRemote: true,
          preferredIconHint: payload.faviconHint || null,
        });
      }
    } catch (error) {
      console.warn("[AstraAppHub] external drop add failed:", error);
      const reason = error?.message || String(error);
      const l10nByReason = {
        "duplicate-url": "astra-app-hub-error-duplicate",
        "custom-limit": "astra-app-hub-error-generic",
      };
      this.#showDropStatus(
        l10nByReason[reason] || "astra-app-hub-drop-error-invalid"
      );
    } finally {
      this.#externalDropInFlight = false;
      this.#setDropAdding(false);
    }
  }

  #onDragEnter(event) {
    if (!this.#canAcceptExternalDrop()) {
      return;
    }
    if (this.#customizeMode && this.#dragState) {
      return;
    }
    if (!dataTransferHasExternalAppPayload(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    this.#externalDropDepth += 1;
    this.#setExternalDropActive(true);
  }

  #onDragLeave(event) {
    if (!this.#externalDropActive) {
      return;
    }
    const panel = this.panel;
    const related = event.relatedTarget;
    if (panel && related && panel.contains(related)) {
      return;
    }
    this.#externalDropDepth = Math.max(0, this.#externalDropDepth - 1);
    if (this.#externalDropDepth === 0) {
      this.#setExternalDropActive(false);
    }
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
    if (this.#customizeMode && this.#dragState) {
      event.preventDefault();
      try {
        event.dataTransfer.dropEffect = "move";
      } catch {
        // ignore
      }
      return;
    }
    if (!this.#canAcceptExternalDrop()) {
      return;
    }
    if (!dataTransferHasExternalAppPayload(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    try {
      event.dataTransfer.dropEffect = "copy";
    } catch {
      // ignore
    }
    this.#setExternalDropActive(true);
  }

  async #onDrop(event) {
    if (this.#customizeMode && this.#dragState) {
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
          const dragApp = this.#allAppsMap().get(this.#dragState.id);
          if (dragApp && dragApp.category !== dropCat) {
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
      return;
    }

    this.#clearExternalDropActive();
    if (!this.#canAcceptExternalDrop()) {
      return;
    }
    const payload = this.#extractExternalAppDrop(event.dataTransfer);
    if (!payload) {
      this.#showDropStatus("astra-app-hub-drop-error-invalid");
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    await this.#addCustomAppFromDrop(payload);
  }

  #onDragEnd() {
    if (this.#externalDropActive) {
      this.#clearExternalDropActive();
    }
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
      try {
        if (node.ownerGlobal && node.ownerGlobal !== window) {
          return false;
        }
      } catch {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };
    const eventAnchor = event?.sourceEvent?.target || event?.target;
    const candidates = [
      isUsableAnchor(eventAnchor) ? eventAnchor : null,
      document.getElementById("zen-app-launcher-button"),
      document.getElementById("zen-sidebar-top-buttons-separator"),
      document.getElementById("zen-sidebar-top-buttons"),
      document.getElementById("nav-bar"),
      document.getElementById("PersonalToolbar"),
      document.getElementById("browser"),
      document.documentElement,
    ];
    for (const node of candidates) {
      if (isUsableAnchor(node)) {
        return node;
      }
    }
    return document.documentElement;
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

  #onPopupShowing() {
    if (this.#destroyed) {
      return;
    }
    try {
      window.gZenCompactModeManager?.lockForPanel?.(
        "PanelUI-zen-app-launcher"
      );
    } catch {
      // Compact lock is best-effort; never block App Hub.
    }
  }

  #onPopupShown() {
    this.#popupTransition = false;
    if (this.#destroyed) {
      return;
    }
    // Reinforce lock in case openPopup path was skipped (e.g. restore).
    try {
      window.gZenCompactModeManager?.lockForPanel?.(
        "PanelUI-zen-app-launcher"
      );
    } catch {
      // Compact lock is best-effort; never block App Hub.
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
    try {
      window.gZenCompactModeManager?.unlockForPanel?.(
        "PanelUI-zen-app-launcher"
      );
    } catch {
      // ignore
    }
    let needsRebuild = false;
    if (this.#editorMode) {
      this.#editorMode = null;
      this.#editingAppId = null;
      this.#pendingIconData = null;
      this.#pendingResetIcon = false;
      needsRebuild = true;
      this.#updateCustomizeChrome();
    }
    if (this.#customizeMode) {
      this.#customizeMode = false;
      needsRebuild = true;
      this.#updateCustomizeChrome();
    }
    if (this.#hubView !== "launchpad") {
      this.#hubView = "launchpad";
      needsRebuild = true;
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
    this.#clearExternalDropActive();
    if (this.#dropStatusTimer) {
      clearTimeout(this.#dropStatusTimer);
      this.#dropStatusTimer = null;
    }
    this.#externalDropInFlight = false;
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

    // Enter in editor fields submits; otherwise rely on XUL toolbarbutton command.
    if (event.key === "Enter" || event.key === " ") {
      if (
        event.key === "Enter" &&
        this.#editorMode &&
        !PrivateBrowsingUtils.isWindowPrivate(window)
      ) {
        const tag = event.target?.localName?.toLowerCase?.();
        if (tag === "input") {
          event.preventDefault();
          void this.#saveEditor();
          return;
        }
      }
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
