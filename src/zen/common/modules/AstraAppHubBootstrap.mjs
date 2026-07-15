/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Stable per-window App Hub entry point.
 * Always creates window.gZenAppLauncher. Advanced manager attaches later.
 * If the advanced manager is unavailable, opens the known-good static fallback.
 */

const PANEL_ID = "PanelUI-zen-app-launcher";
const FALLBACK_ID = "PanelUI-zen-app-launcher-fallback";
const LOG_PREFIX = "[AstraAppHub]";

function isHttpsUrl(url) {
  try {
    const parsed = Services.io.newURI(url);
    return parsed?.scheme?.toLowerCase() === "https";
  } catch {
    return false;
  }
}

function openTrustedHttps(url) {
  if (!isHttpsUrl(url)) {
    console.error(`${LOG_PREFIX} blocked invalid URL`);
    return false;
  }
  const win = Services.wm.getMostRecentWindow("navigator:browser") || window;
  if (!win) {
    console.error(`${LOG_PREFIX} no browser window found`);
    return false;
  }
  try {
    if (typeof win.openTrustedLinkIn === "function") {
      win.openTrustedLinkIn(url, "tab", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        inBackground: false,
      });
      win.focus();
      return true;
    }
    if (win.gBrowser) {
      win.gBrowser.selectedTab = win.gBrowser.addTrustedTab(url, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        inBackground: false,
      });
      win.focus();
      return true;
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} open failed`, error);
    return false;
  }
  console.error(`${LOG_PREFIX} could not open URL`);
  return false;
}

class AstraAppHubBootstrap {
  #manager = null;
  #advancedReady = false;
  #fallbackActive = true;
  #popupTransition = false;
  #boundFallbackCommand = null;
  #boundPopupShown = null;
  #boundPopupHidden = null;
  #listenersBound = false;
  #lastErrorStage = null;
  #lastOpenAttempt = null;
  #loggedReady = false;
  #managerImportPromise = null;
  #managerImportFailed = false;

  constructor() {
    window.gAstraAppHubBootstrap = this;
    // Stable public facade — never replaced by the advanced manager.
    window.gZenAppLauncher = {
      open: (eventOrOptions, win = window) => this.open(eventOrOptions, win),
      close: options => this.close(options),
      toggle: (eventOrOptions, win = window) =>
        this.toggle(eventOrOptions, win),
      openApp: (appOrUrl, options) => this.openApp(appOrUrl, options),
    };
    window.gAstraAppHubDiagnostics = this.#createDiagnostics();
    console.log(`${LOG_PREFIX} bootstrap loaded`);
    this.#applyMode();
    this.#ensureListeners();
  }

  #createDiagnostics() {
    const self = this;
    return {
      get bootstrapReady() {
        return true;
      },
      get managerReady() {
        return self.#advancedReady && !!self.#manager;
      },
      get fallbackActive() {
        return self.#fallbackActive;
      },
      get lastErrorStage() {
        return self.#lastErrorStage;
      },
      get panelFound() {
        return !!document.getElementById(PANEL_ID);
      },
      get lastOpenAttempt() {
        return self.#lastOpenAttempt;
      },
    };
  }

  get panel() {
    return document.getElementById(PANEL_ID);
  }

  get fallback() {
    return document.getElementById(FALLBACK_ID);
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

  /**
   * Advanced manager registers here. Does not replace gZenAppLauncher.
   */
  attachManager(manager) {
    if (!manager) {
      return;
    }
    this.#manager = manager;
    this.#lastErrorStage = null;
  }

  setAdvancedReady(ready) {
    this.#advancedReady = !!ready && !!this.#manager;
    this.#fallbackActive = !this.#advancedReady;
    this.#applyMode();
    if (this.#advancedReady && !this.#loggedReady) {
      this.#loggedReady = true;
      console.log(`${LOG_PREFIX} advanced manager ready`);
    }
  }

  markManagerFailed(error, stage = "manager") {
    this.#manager = null;
    this.#advancedReady = false;
    this.#fallbackActive = true;
    this.#lastErrorStage = stage;
    this.#loggedReady = false;
    this.#applyMode();
    console.error(
      `${LOG_PREFIX} advanced manager failed; fallback active`,
      error || stage
    );
  }

  #applyMode() {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const mode = this.#advancedReady ? "advanced" : "fallback";
    panel.setAttribute("app-hub-mode", mode);
    const fallback = this.fallback;
    if (fallback) {
      fallback.hidden = mode === "advanced";
    }
  }

  #ensureListeners() {
    const panel = this.panel;
    if (!panel || this.#listenersBound) {
      return;
    }
    this.#boundPopupShown = () => {
      this.#popupTransition = false;
    };
    this.#boundPopupHidden = () => {
      this.#popupTransition = false;
    };
    this.#boundFallbackCommand = event => {
      try {
        const target = event.target;
        if (!target || typeof target.closest !== "function") {
          return;
        }
        const fallback = this.fallback;
        if (!fallback || fallback.hidden) {
          return;
        }
        const item = target.closest("[data-url]");
        if (!item || !fallback.contains(item)) {
          return;
        }
        const url = item.getAttribute("data-url");
        if (url) {
          this.openApp(url);
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} fallback command failed`, error);
      }
    };
    panel.addEventListener("popupshown", this.#boundPopupShown);
    panel.addEventListener("popuphidden", this.#boundPopupHidden);
    panel.addEventListener("command", this.#boundFallbackCommand);
    this.#listenersBound = true;
  }

  #normalizeArgs(eventOrOptions) {
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

  #isUsableAnchor(node) {
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
  }

  #resolveAnchor(event) {
    const doc = document;
    const eventAnchor = event?.sourceEvent?.target || event?.target;
    const candidates = [
      this.#isUsableAnchor(eventAnchor) ? eventAnchor : null,
      doc.getElementById("zen-app-launcher-button"),
      doc.getElementById("zen-sidebar-top-buttons-separator"),
      doc.getElementById("zen-sidebar-top-buttons"),
      doc.getElementById("nav-bar"),
      doc.getElementById("PersonalToolbar"),
      doc.getElementById("browser"),
      doc.documentElement,
    ];
    for (const node of candidates) {
      if (this.#isUsableAnchor(node)) {
        return node;
      }
    }
    return doc.documentElement;
  }

  async toggle(eventOrOptions, win = window) {
    if (win && win !== window && win.gAstraAppHubBootstrap) {
      return win.gAstraAppHubBootstrap.toggle(eventOrOptions, win);
    }
    this.#ensureListeners();
    this.#applyMode();
    if (this.#popupTransition || this.#isHiding) {
      if (this.#popupTransition && !this.isOpen && !this.#isHiding) {
        this.#popupTransition = false;
      } else {
        return;
      }
    }
    if (this.isOpen) {
      this.close({ restoreFocus: true });
      return;
    }
    await this.open(eventOrOptions, win);
  }

  /**
   * Lazy-import advanced manager on first open. Startup only loads bootstrap.
   * Catalog/profile IO must not compete with first navigation / session restore.
   */
  async #ensureManagerImported() {
    if (this.#manager || this.#managerImportFailed) {
      return;
    }
    if (this.#managerImportPromise) {
      await this.#managerImportPromise;
      return;
    }
    this.#managerImportPromise = (async () => {
      try {
        ChromeUtils.importESModule(
          "chrome://browser/content/zen-components/AstraAppHubManager.mjs",
          { global: "current" }
        );
        if (window.gAstraAppHubManager?.init) {
          // Await init so first open prefers advanced UI when catalog is ready.
          await window.gAstraAppHubManager.init();
        }
      } catch (error) {
        this.#managerImportFailed = true;
        this.markManagerFailed(error, "import");
      }
    })();
    try {
      await this.#managerImportPromise;
    } finally {
      this.#managerImportPromise = null;
    }
  }

  async open(eventOrOptions, win = window) {
    if (win && win !== window && win.gAstraAppHubBootstrap) {
      return win.gAstraAppHubBootstrap.open(eventOrOptions, win);
    }
    const options = this.#normalizeArgs(eventOrOptions);
    this.#lastOpenAttempt = Date.now();
    this.#ensureListeners();
    this.#applyMode();

    if (!this.#managerImportFailed && !this.#advancedReady) {
      await this.#ensureManagerImported();
    }

    if (this.#advancedReady && this.#manager) {
      try {
        const opened = await this.#manager.open(options);
        if (opened !== false) {
          return;
        }
      } catch (error) {
        this.markManagerFailed(error, "open");
      }
    }

    this.#openFallback(options);
  }

  #openFallback(options = {}) {
    const panel = this.panel;
    if (!panel) {
      this.#lastErrorStage = "panel-missing";
      console.error(`${LOG_PREFIX} panel missing`);
      return;
    }
    this.#fallbackActive = true;
    this.#advancedReady = false;
    this.#applyMode();

    if (this.isOpen || this.#popupTransition || this.#isHiding) {
      if (this.#popupTransition && !this.isOpen && !this.#isHiding) {
        this.#popupTransition = false;
      } else {
        return;
      }
    }

    const anchor = this.#resolveAnchor(options.event);
    this.#popupTransition = true;
    try {
      panel.openPopup(anchor, "after_start", 0, 0, false, false);
    } catch (error) {
      this.#popupTransition = false;
      this.#lastErrorStage = "openPopup";
      console.error(`${LOG_PREFIX} openPopup failed`, error);
      // Last resort: screen position if available in this build.
      try {
        if (typeof panel.openPopupAtScreen === "function") {
          const x = options.event?.screenX ?? options.event?.sourceEvent?.screenX;
          const y = options.event?.screenY ?? options.event?.sourceEvent?.screenY;
          if (Number.isFinite(x) && Number.isFinite(y)) {
            this.#popupTransition = true;
            panel.openPopupAtScreen(x, y, false);
            return;
          }
        }
      } catch (retryError) {
        this.#popupTransition = false;
        console.error(`${LOG_PREFIX} openPopup failed`, retryError);
      }
    }
  }

  close(options = {}) {
    if (this.#advancedReady && this.#manager?.close) {
      try {
        this.#manager.close(options);
        return;
      } catch (error) {
        console.error(`${LOG_PREFIX} advanced close failed`, error);
      }
    }
    const panel = this.panel;
    if (!panel) {
      return;
    }
    if (this.isOpen) {
      this.#popupTransition = true;
      try {
        panel.hidePopup();
      } catch (error) {
        this.#popupTransition = false;
        console.error(`${LOG_PREFIX} hidePopup failed`, error);
      }
    }
  }

  openApp(appOrUrl, options = {}) {
    if (this.#advancedReady && this.#manager?.openApp) {
      try {
        return this.#manager.openApp(appOrUrl, options);
      } catch (error) {
        this.markManagerFailed(error, "openApp");
      }
    }
    const url = typeof appOrUrl === "string" ? appOrUrl : appOrUrl?.url;
    if (!url) {
      return;
    }
    const ok = openTrustedHttps(url);
    if (ok) {
      try {
        this.panel?.hidePopup();
      } catch {
        // ignore
      }
    }
  }
}

new AstraAppHubBootstrap();
