/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Astra Suraksha entry point — opens Firefox's native protections popup
 * (gProtectionsHandler / #protections-popup) with light Astra branding and a
 * thin optional uBlock Origin status row. The legacy custom Suraksha panel is
 * no longer opened as the primary UI.
 */

const BUTTON_ITEM_ID = "astra-suraksha-button";
const APPMENU_ID = "appMenu-astra-suraksha-button";
const PREF_ENABLED = "astra.suraksha.enabled";
const LOG_PREFIX = "[AstraSuraksha]";
const NATIVE_POPUP_ID = "protections-popup";
const UBLOCK_ROW_ID = "astra-suraksha-ublock-row";
const PANEL_LOCK_TOKEN = "protections-popup";
const UBLOCK_MODULE_URL =
  "chrome://browser/content/zen-components/AstraSurakshaUBlock.mjs";

class AstraSurakshaBootstrap {
  #prefObserverBound = false;
  #destroyed = false;
  #lastErrorStage = null;
  #lastOpenAttempt = null;
  #boundUnload = null;
  #boundPrefObserver = null;
  #boundNativeShown = null;
  #boundNativeHidden = null;
  #boundUBlockCommand = null;
  #nativeListenersBound = false;
  #enabled = true;
  #ublockModule = null;

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
        return false;
      },
      get managerReady() {
        return false;
      },
      get fallbackActive() {
        return false;
      },
      get panelFound() {
        return !!document.getElementById(NATIVE_POPUP_ID);
      },
      get nativeMode() {
        return true;
      },
      get lastErrorStage() {
        return self.#lastErrorStage;
      },
    };
  }

  get nativePopup() {
    return document.getElementById(NATIVE_POPUP_ID);
  }

  get isOpen() {
    const panel = this.nativePopup;
    if (!panel) {
      return false;
    }
    const state = panel.state;
    return state === "open" || state === "showing";
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
    window.setTimeout(() => {
      if (!this.#destroyed) {
        this.#applyEnabledUI();
      }
    }, 0);
    this.#ensureUnload();
    this.#retireLegacyPanel();
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
    this.#teardownNativeListeners();
    this.#teardownPrefObserver();
    try {
      window.gZenCompactModeManager?.unlockForPanel?.(PANEL_LOCK_TOKEN);
    } catch {
      // ignore
    }
    if (this.#boundUnload) {
      window.removeEventListener("unload", this.#boundUnload);
      this.#boundUnload = null;
    }
  }

  #ensureUnload() {
    if (this.#boundUnload) {
      return;
    }
    this.#boundUnload = () => this.destroy();
    window.addEventListener("unload", this.#boundUnload, { once: true });
  }

  #ensurePrefObserver() {
    if (this.#prefObserverBound) {
      return;
    }
    this.#boundPrefObserver = () => {
      try {
        this.#enabled = Services.prefs.getBoolPref(PREF_ENABLED, true);
        this.#applyEnabledUI();
        if (!this.#enabled) {
          this.close({ restoreFocus: false });
        }
      } catch {
        // ignore
      }
    };
    try {
      Services.prefs.addObserver(PREF_ENABLED, this.#boundPrefObserver);
      this.#prefObserverBound = true;
    } catch {
      this.#prefObserverBound = false;
    }
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
    for (const id of [BUTTON_ITEM_ID, APPMENU_ID]) {
      const node = document.getElementById(id);
      if (!node) {
        continue;
      }
      node.hidden = !this.#enabled;
      if (this.#enabled) {
        node.removeAttribute("disabled");
      } else {
        node.setAttribute("disabled", "true");
      }
    }
  }

  /** Keep legacy custom panel out of the active runtime surface. */
  #retireLegacyPanel() {
    try {
      const legacy = document.getElementById("PanelUI-astra-suraksha");
      if (legacy) {
        legacy.hidden = true;
        legacy.setAttribute("astra-suraksha-retired", "true");
      }
    } catch {
      // ignore
    }
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

  #resolveAnchor(event) {
    try {
      const target = event?.target || event?.originalTarget || event?.srcElement;
      if (target?.closest) {
        const btn =
          target.closest(`#${BUTTON_ITEM_ID}`) ||
          target.closest(`#${APPMENU_ID}`) ||
          target.closest("#tracking-protection-icon-container");
        if (btn) {
          return btn;
        }
      }
    } catch {
      // fall through
    }
    return (
      document.getElementById(BUTTON_ITEM_ID) ||
      document.getElementById("tracking-protection-icon-container") ||
      document.getElementById(APPMENU_ID) ||
      document.documentElement
    );
  }

  async toggle(eventOrOptions, win = window) {
    if (win && win !== window && win.gAstraSurakshaBootstrap) {
      return win.gAstraSurakshaBootstrap.toggle(eventOrOptions, win);
    }
    if (!this.#enabled) {
      return;
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
    if (!this.#enabled || this.#destroyed) {
      return;
    }
    const options = this.#normalizeArgs(eventOrOptions);
    this.#lastOpenAttempt = Date.now();
    this.#openNativeProtections(options);
  }

  close(_options = {}) {
    try {
      const handler = window.gProtectionsHandler;
      if (handler && typeof handler._hidePopup === "function") {
        handler._hidePopup();
        return;
      }
    } catch {
      // fall through
    }
    try {
      const popup = this.nativePopup;
      if (popup && typeof PanelMultiView !== "undefined") {
        PanelMultiView.hidePopup(popup);
      } else {
        popup?.hidePopup?.();
      }
    } catch {
      // ignore
    }
  }

  refresh() {
    // Native popup refreshes itself on open / tab change.
  }

  openFallbackAction(action, event) {
    try {
      switch (action) {
        case "protections-panel":
          this.#openNativeProtections({ event });
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
      // ignore
    }
  }

  #openNativeProtections(options = {}) {
    const handler = window.gProtectionsHandler;
    if (!handler || typeof handler.showProtectionsPopup !== "function") {
      this.#lastErrorStage = "handler-missing";
      this.#openProtectionsDashboard();
      return;
    }

    // Ensure popup exists before wiring branding/listeners.
    try {
      handler._initializePopup?.();
    } catch {
      // ignore
    }

    this.#ensureNativeListeners();
    this.#applyNativeBranding();

    try {
      // Anchor preference: Suraksha button when available.
      const anchor = this.#resolveAnchor(options.event);
      let event = options.event;
      if (anchor && (!event || !event.target)) {
        event = {
          target: anchor,
          originalTarget: anchor,
          type: "command",
        };
      }
      handler.showProtectionsPopup({
        event,
        openingReason: "astraSuraksha",
      });
      if (handler.trustPanelEnabledPref) {
        this.#openProtectionsDashboard();
        return;
      }
      const popup = this.nativePopup;
      if (popup && popup.state === "closed") {
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
    } catch (error) {
      this.#lastErrorStage = "open-native";
      console.error(`${LOG_PREFIX} native protections open failed`, error);
      this.#openProtectionsDashboard();
    }
  }

  #ensureNativeListeners() {
    if (this.#nativeListenersBound) {
      return;
    }
    const popup = this.nativePopup;
    if (!popup) {
      return;
    }
    this.#boundNativeShown = () => {
      try {
        window.gZenCompactModeManager?.lockForPanel?.(PANEL_LOCK_TOKEN);
      } catch {
        // ignore
      }
      this.#applyNativeBranding();
      void this.#injectUBlockRow();
    };
    this.#boundNativeHidden = () => {
      try {
        window.gZenCompactModeManager?.unlockForPanel?.(PANEL_LOCK_TOKEN);
      } catch {
        // ignore
      }
    };
    popup.addEventListener("popupshown", this.#boundNativeShown);
    popup.addEventListener("popuphidden", this.#boundNativeHidden);
    this.#nativeListenersBound = true;
  }

  #teardownNativeListeners() {
    const popup = this.nativePopup;
    if (!this.#nativeListenersBound || !popup) {
      this.#nativeListenersBound = false;
      return;
    }
    if (this.#boundNativeShown) {
      popup.removeEventListener("popupshown", this.#boundNativeShown);
    }
    if (this.#boundNativeHidden) {
      popup.removeEventListener("popuphidden", this.#boundNativeHidden);
    }
    if (this.#boundUBlockCommand) {
      const row = document.getElementById(UBLOCK_ROW_ID);
      row?.removeEventListener("command", this.#boundUBlockCommand);
      row?.removeEventListener("click", this.#boundUBlockCommand);
    }
    this.#nativeListenersBound = false;
  }

  #applyNativeBranding() {
    try {
      const popup = this.nativePopup;
      if (!popup) {
        return;
      }
      popup.setAttribute("astra-suraksha-native", "true");
      const header = document.getElementById(
        "protections-popup-mainView-panel-header-span"
      );
      if (header) {
        document.l10n?.setAttributes?.(header, "astra-suraksha-title");
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} branding apply failed`, error);
    }
  }

  async #loadUBlockModule() {
    if (this.#ublockModule) {
      return this.#ublockModule;
    }
    try {
      this.#ublockModule = ChromeUtils.importESModule(UBLOCK_MODULE_URL, {
        global: "current",
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} uBlock module unavailable`, error);
      this.#ublockModule = null;
    }
    return this.#ublockModule;
  }

  async #injectUBlockRow() {
    const popup = this.nativePopup;
    const mainView = document.getElementById("protections-popup-mainView");
    if (!popup || !mainView) {
      return;
    }

    let row = document.getElementById(UBLOCK_ROW_ID);
    if (!row) {
      row = document.createXULElement("hbox");
      row.id = UBLOCK_ROW_ID;
      row.classList.add("astra-suraksha-ublock-row");
      row.setAttribute("align", "center");

      const textCol = document.createXULElement("vbox");
      textCol.setAttribute("flex", "1");
      textCol.classList.add("astra-suraksha-ublock-text");

      const title = document.createXULElement("label");
      title.classList.add("astra-suraksha-ublock-title");
      document.l10n?.setAttributes?.(
        title,
        "astra-suraksha-ublock-section-title"
      );

      const status = document.createXULElement("label");
      status.id = "astra-suraksha-ublock-status";
      status.classList.add("astra-suraksha-ublock-status");

      textCol.appendChild(title);
      textCol.appendChild(status);

      const action = document.createXULElement("toolbarbutton");
      action.id = "astra-suraksha-ublock-open";
      action.classList.add(
        "subviewbutton",
        "astra-suraksha-ublock-open",
        "toolbarbutton-1"
      );
      document.l10n?.setAttributes?.(
        action,
        "astra-suraksha-action-ublock-popup"
      );

      row.appendChild(textCol);
      row.appendChild(action);

      this.#boundUBlockCommand = event => {
        const t = event.target;
        if (!t?.closest) {
          return;
        }
        if (t.closest("#astra-suraksha-ublock-open")) {
          void this.#onOpenUBlock();
        }
      };
      row.addEventListener("command", this.#boundUBlockCommand);
      row.addEventListener("click", this.#boundUBlockCommand);

      // Place after the TP switch / category list when present.
      const footer = document.getElementById(
        "protections-popup-footer"
      );
      const tpSwitch = document.getElementById("protections-popup-tp-switch");
      const insertAfter =
        document.getElementById("protections-popup-category-list") ||
        tpSwitch?.parentElement ||
        null;
      if (footer?.parentElement) {
        footer.parentElement.insertBefore(row, footer);
      } else if (insertAfter?.parentElement) {
        insertAfter.parentElement.insertBefore(row, insertAfter.nextSibling);
      } else {
        mainView.appendChild(row);
      }
    }

    const statusEl = document.getElementById("astra-suraksha-ublock-status");
    const openBtn = document.getElementById("astra-suraksha-ublock-open");
    const mod = await this.#loadUBlockModule();
    if (!mod?.readUBlock) {
      if (statusEl) {
        document.l10n?.setAttributes?.(
          statusEl,
          "astra-suraksha-ublock-unavailable"
        );
      }
      if (openBtn) {
        openBtn.hidden = true;
      }
      return;
    }

    let result;
    try {
      result = await mod.readUBlock(window);
    } catch {
      result = null;
    }

    const state = result?.state || "error";
    const labelId =
      state === "active"
        ? "astra-suraksha-ublock-active"
        : state === "disabled" || state === "app-disabled"
          ? "astra-suraksha-ublock-disabled"
          : state === "missing"
            ? "astra-suraksha-ublock-missing"
            : "astra-suraksha-ublock-unavailable";

    if (statusEl) {
      document.l10n?.setAttributes?.(statusEl, labelId);
    }
    if (openBtn) {
      // Show open only when installed; otherwise offer manage/addons via same btn label.
      if (state === "missing") {
        document.l10n?.setAttributes?.(
          openBtn,
          "astra-suraksha-action-addons"
        );
        openBtn.hidden = false;
        openBtn.setAttribute("data-ublock-action", "addons");
      } else if (state === "error" || !result?.available) {
        openBtn.hidden = true;
      } else {
        document.l10n?.setAttributes?.(
          openBtn,
          "astra-suraksha-action-ublock-popup"
        );
        openBtn.hidden = false;
        openBtn.setAttribute("data-ublock-action", "popup");
      }
    }
  }

  async #onOpenUBlock() {
    const openBtn = document.getElementById("astra-suraksha-ublock-open");
    const action = openBtn?.getAttribute("data-ublock-action") || "popup";
    const mod = await this.#loadUBlockModule();
    if (!mod) {
      return;
    }
    try {
      this.close({ restoreFocus: false });
    } catch {
      // ignore
    }
    try {
      if (action === "addons") {
        mod.openAddonsManager?.(window);
      } else if (typeof mod.openUBlockBrowserAction === "function") {
        mod.openUBlockBrowserAction(window);
      } else {
        await mod.manageUBlock?.(window);
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} uBlock action failed`, error);
    }
  }

  #openSiteInfo(event) {
    try {
      this.close({ restoreFocus: false });
    } catch {
      // ignore
    }
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
      // fall through
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
      window.BrowserAddonUI?.openAddonsMgr?.("addons://list/extension");
    } catch {
      // ignore
    }
  }
}

new AstraSurakshaBootstrap();
