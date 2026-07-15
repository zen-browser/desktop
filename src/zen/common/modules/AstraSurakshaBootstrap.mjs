/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Stable per-window Suraksha Center entry point.
 * Always creates window.gAstraSuraksha. Advanced manager attaches later.
 * If the advanced manager is unavailable, opens the known-good static fallback.
 */

const PANEL_ID = "PanelUI-astra-suraksha";
const FALLBACK_ID = "PanelUI-astra-suraksha-fallback";
const ADVANCED_ID = "PanelUI-astra-suraksha-advanced";
const BUTTON_ITEM_ID = "astra-suraksha-button";
const APPMENU_ID = "appMenu-astra-suraksha-button";
const PREF_ENABLED = "astra.suraksha.enabled";
const LOG_PREFIX = "[AstraSuraksha]";
const MANAGER_URL =
  "chrome://browser/content/zen-components/AstraSurakshaManager.mjs";

class AstraSurakshaBootstrap {
  #manager = null;
  #advancedReady = false;
  #fallbackActive = true;
  #popupTransition = false;
  #listenersBound = false;
  #prefObserverBound = false;
  #destroyed = false;
  #managerRequested = false;
  #managerImportPromise = null;
  #lastErrorStage = null;
  #lastOpenAttempt = null;
  #boundPopupShown = null;
  #boundPopupHidden = null;
  #boundFallbackCommand = null;
  #boundUnload = null;
  #boundPrefObserver = null;
  #enabled = true;

  constructor() {
    window.gAstraSurakshaBootstrap = this;
    window.gAstraSuraksha = {
      init: () => this.init(),
      destroy: () => this.destroy(),
      open: (eventOrOptions, win = window) => this.open(eventOrOptions, win),
      close: options => this.close(options),
      toggle: (eventOrOptions, win = window) =>
        this.toggle(eventOrOptions, win),
      refresh: () => this.refresh(),
      openFallbackAction: (action, event) =>
        this.openFallbackAction(action, event),
    };
    window.gAstraSurakshaDiagnostics = this.#createDiagnostics();
    try {
      this.init();
    } catch (error) {
      console.error(`${LOG_PREFIX} bootstrap failed to initialize`, error);
      this.#lastErrorStage = "init";
    }
  }

  #createDiagnostics() {
    const self = this;
    return {
      get bootstrapReady() {
        return !self.#destroyed;
      },
      get managerRequested() {
        return self.#managerRequested;
      },
      get managerReady() {
        return self.#advancedReady && !!self.#manager;
      },
      get fallbackActive() {
        return self.#fallbackActive;
      },
      get panelFound() {
        return !!document.getElementById(PANEL_ID);
      },
      get lastErrorStage() {
        return self.#lastErrorStage;
      },
    };
  }

  get panel() {
    return document.getElementById(PANEL_ID);
  }

  get fallback() {
    return document.getElementById(FALLBACK_ID);
  }

  get advanced() {
    return document.getElementById(ADVANCED_ID);
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

  get enabled() {
    return this.#enabled;
  }

  init() {
    if (this.#destroyed) {
      return;
    }
    this.#enabled = Services.prefs.getBoolPref(PREF_ENABLED, true);
    this.#ensurePrefObserver();
    this.#applyEnabledUI();
    // Toolbar/App Menu nodes may appear after bootstrap; re-apply shortly.
    window.setTimeout(() => {
      if (!this.#destroyed) {
        this.#applyEnabledUI();
      }
    }, 0);
    this.#applyMode();
    this.#ensureListeners();
    this.#ensureUnload();
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    try {
      this.close({ restoreFocus: false });
    } catch {
      // ignore
    }
    this.#teardownListeners();
    this.#teardownPrefObserver();
    if (this.#boundUnload) {
      window.removeEventListener("unload", this.#boundUnload);
      this.#boundUnload = null;
    }
    try {
      this.#manager?.destroy?.();
    } catch {
      // ignore
    }
    this.#manager = null;
    this.#advancedReady = false;
    this.#fallbackActive = true;
  }

  attachManager(manager) {
    if (!manager || this.#destroyed) {
      return;
    }
    this.#manager = manager;
    this.#lastErrorStage = null;
  }

  setAdvancedReady(ready) {
    this.#advancedReady = !!ready && !!this.#manager;
    this.#fallbackActive = !this.#advancedReady;
    this.#applyMode();
  }

  markManagerFailed(error, stage = "manager") {
    this.#manager = null;
    this.#advancedReady = false;
    this.#fallbackActive = true;
    this.#lastErrorStage = stage;
    this.#managerImportPromise = null;
    this.#applyMode();
    console.error(
      `${LOG_PREFIX} manager import failed; fallback active`,
      error || stage
    );
  }

  #ensurePrefObserver() {
    if (this.#prefObserverBound) {
      return;
    }
    this.#boundPrefObserver = () => {
      try {
        this.#enabled = Services.prefs.getBoolPref(PREF_ENABLED, true);
        this.#applyEnabledUI();
        if (!this.#enabled && this.isOpen) {
          this.close({ restoreFocus: true });
        }
        // Deferred migration may still need to place the toolbar button.
        if (this.#enabled) {
          try {
            window.gZenUIManager?._addNewCustomizableButtonsIfNeeded?.();
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    };
    Services.prefs.addObserver(PREF_ENABLED, this.#boundPrefObserver);
    this.#prefObserverBound = true;
  }

  #teardownPrefObserver() {
    if (!this.#prefObserverBound || !this.#boundPrefObserver) {
      return;
    }
    try {
      Services.prefs.removeObserver(PREF_ENABLED, this.#boundPrefObserver);
    } catch {
      // ignore
    }
    this.#boundPrefObserver = null;
    this.#prefObserverBound = false;
  }

  #applyEnabledUI() {
    const hidden = !this.#enabled;
    for (const id of [BUTTON_ITEM_ID, APPMENU_ID]) {
      const node = document.getElementById(id);
      if (!node) {
        continue;
      }
      if (hidden) {
        node.setAttribute("hidden", "true");
      } else {
        node.removeAttribute("hidden");
      }
    }
  }

  #applyMode() {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const mode = this.#advancedReady ? "advanced" : "fallback";
    panel.setAttribute("astra-suraksha-mode", mode);
    const fallback = this.fallback;
    const advanced = this.advanced;
    if (fallback) {
      // Fallback remains in markup; only hide when advanced is ready.
      fallback.hidden = mode === "advanced";
    }
    if (advanced) {
      advanced.hidden = mode !== "advanced";
    }
  }

  #ensureUnload() {
    if (this.#boundUnload) {
      return;
    }
    this.#boundUnload = () => this.destroy();
    window.addEventListener("unload", this.#boundUnload, { once: true });
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
        const item = target.closest("[data-suraksha-action]");
        if (!item || !fallback.contains(item)) {
          return;
        }
        const action = item.getAttribute("data-suraksha-action");
        if (action) {
          this.openFallbackAction(action, event);
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

  #teardownListeners() {
    const panel = this.panel;
    if (!this.#listenersBound || !panel) {
      this.#listenersBound = false;
      return;
    }
    if (this.#boundPopupShown) {
      panel.removeEventListener("popupshown", this.#boundPopupShown);
    }
    if (this.#boundPopupHidden) {
      panel.removeEventListener("popuphidden", this.#boundPopupHidden);
    }
    if (this.#boundFallbackCommand) {
      panel.removeEventListener("command", this.#boundFallbackCommand);
    }
    this.#listenersBound = false;
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
      doc.getElementById(BUTTON_ITEM_ID),
      doc.getElementById("zen-app-launcher-button"),
      doc.getElementById("zen-sidebar-top-buttons-separator"),
      doc.getElementById("zen-sidebar-top-buttons"),
      doc.getElementById("PanelUI-menu-button"),
      doc.getElementById("nav-bar"),
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

  #requestManager() {
    if (this.#destroyed || this.#manager || this.#managerImportPromise) {
      return this.#managerImportPromise;
    }
    this.#managerRequested = true;
    this.#managerImportPromise = (async () => {
      try {
        await ChromeUtils.importESModule(MANAGER_URL, { global: "current" });
      } catch (error) {
        this.markManagerFailed(error, "import");
      }
    })();
    return this.#managerImportPromise;
  }

  async toggle(eventOrOptions, win = window) {
    if (win && win !== window && win.gAstraSurakshaBootstrap) {
      return win.gAstraSurakshaBootstrap.toggle(eventOrOptions, win);
    }
    if (!this.#enabled) {
      return;
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

  async open(eventOrOptions, win = window) {
    if (win && win !== window && win.gAstraSurakshaBootstrap) {
      return win.gAstraSurakshaBootstrap.open(eventOrOptions, win);
    }
    if (!this.#enabled) {
      return;
    }
    const options = this.#normalizeArgs(eventOrOptions);
    this.#lastOpenAttempt = Date.now();
    this.#ensureListeners();
    this.#applyMode();

    // Open shell immediately — never await adapters/manager.
    this.#openShell(options);

    // Kick off lazy manager import without blocking the popup.
    void this.#requestManager().then(() => {
      if (this.#destroyed || !this.#manager) {
        return;
      }
      try {
        if (this.#advancedReady) {
          void this.#manager.refresh?.(options);
        } else {
          void this.#manager.onShellOpened?.(options);
        }
      } catch (error) {
        this.markManagerFailed(error, "open");
      }
    });
  }

  #openShell(options = {}) {
    const panel = this.panel;
    if (!panel) {
      this.#lastErrorStage = "panel-missing";
      console.error(`${LOG_PREFIX} panel missing`);
      return;
    }
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
      if (options.source === "keyboard") {
        panel.removeAttribute("noautofocus");
      } else {
        panel.setAttribute("noautofocus", "true");
      }
      panel.openPopup(anchor, "after_start", 0, 0, false, false);
    } catch (error) {
      this.#popupTransition = false;
      this.#lastErrorStage = "openPopup";
      console.error(`${LOG_PREFIX} openPopup failed`, error);
      try {
        if (typeof panel.openPopupAtScreen === "function") {
          const x =
            options.event?.screenX ?? options.event?.sourceEvent?.screenX;
          const y =
            options.event?.screenY ?? options.event?.sourceEvent?.screenY;
          if (Number.isFinite(x) && Number.isFinite(y)) {
            this.#popupTransition = true;
            panel.openPopupAtScreen(x, y, false);
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

  refresh() {
    if (!this.#enabled || this.#destroyed) {
      return;
    }
    if (this.#advancedReady && this.#manager?.refresh) {
      try {
        void this.#manager.refresh();
        return;
      } catch (error) {
        this.markManagerFailed(error, "refresh");
      }
    }
    // Attempt lazy manager load so Refresh can upgrade from fallback.
    void this.#requestManager();
  }

  openFallbackAction(action, event) {
    try {
      switch (action) {
        case "protections-panel":
          this.#openProtectionsPanel(event);
          break;
        case "site-info":
          this.#openSiteInfo(event);
          break;
        case "protections-dashboard":
          this.#openProtectionsDashboard();
          break;
        case "addons":
          this.#openAddons();
          break;
        default:
          break;
      }
    } catch {
      // Individual fallback actions fail independently.
    }
  }

  #openProtectionsPanel(event) {
    const handler = window.gProtectionsHandler;
    if (!handler || typeof handler.showProtectionsPopup !== "function") {
      this.#openProtectionsDashboard();
      return;
    }
    try {
      this.close({ restoreFocus: false });
      handler.showProtectionsPopup({
        event,
        openingReason: "astraSuraksha",
      });
      // If trust-panel pref causes an early return, fall back to dashboard.
      const popup = document.getElementById("protections-popup");
      const trustGate = handler.trustPanelEnabledPref;
      if (trustGate) {
        this.#openProtectionsDashboard();
      } else if (popup && popup.state === "closed") {
        // Best-effort: if still closed shortly after, open dashboard.
        window.setTimeout(() => {
          try {
            if (popup.state === "closed") {
              this.#openProtectionsDashboard();
            }
          } catch {
            // ignore
          }
        }, 0);
      }
    } catch {
      this.#openProtectionsDashboard();
    }
  }

  #openSiteInfo(event) {
    try {
      this.close({ restoreFocus: false });
    } catch {
      // ignore
    }

    // Prefer the public identity-button path only when the location is valid.
    // Command/synthetic events are accepted by the type gate, but pageproxystate
    // can still cause a silent early return — fall back to Page Info.
    try {
      const handler = window.gIdentityHandler;
      const pageProxyValid =
        window.gURLBar?.getAttribute?.("pageproxystate") === "valid";
      if (
        handler &&
        pageProxyValid &&
        typeof handler.handleIdentityButtonEvent === "function"
      ) {
        const synthetic = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
        });
        handler.handleIdentityButtonEvent(synthetic);
        return;
      }
    } catch {
      // fall through to Page Info
    }

    try {
      if (typeof window.BrowserCommands?.pageInfo === "function") {
        window.BrowserCommands.pageInfo(null, "securityTab");
      }
    } catch {
      // ignore
    }
  }

  #openProtectionsDashboard() {
    try {
      this.close({ restoreFocus: false });
      const handler = window.gProtectionsHandler;
      if (handler && typeof handler.openProtections === "function") {
        handler.openProtections(true);
        return;
      }
      if (typeof window.switchToTabHavingURI === "function") {
        window.switchToTabHavingURI("about:protections", true, {
          replaceQueryString: true,
          relatedToCurrent: true,
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        });
      }
    } catch {
      // ignore
    }
  }

  #openAddons() {
    try {
      this.close({ restoreFocus: false });
      if (window.BrowserAddonUI?.openAddonsMgr) {
        window.BrowserAddonUI.openAddonsMgr("addons://list/extension");
      }
    } catch {
      // ignore
    }
  }
}

new AstraSurakshaBootstrap();
