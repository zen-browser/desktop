/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

/* eslint-disable mozilla/valid-services -- Services.zen is Zen's custom XPCOM service. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  gZenStandaloneWindowManager:
    "resource:///modules/zen/standalonewindow/ZenStandaloneWindowManager.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
});

export const ZEN_GLOBAL_SEARCH_PANEL_TYPE = "zen:global-search-panel";
export const ZEN_GLOBAL_SEARCH_DEFAULT_SHORTCUT = "meta,alt|KeyT";
export const ZEN_GLOBAL_SEARCH_SHORTCUT_PREF =
  "zen.standalone-window.global-search-shortcut";

const ENABLED_PREF = "zen.standalone-window.enabled";
const OPEN_TOPIC = "zen-open-global-search-panel";
const NATIVE_HOTKEY_TOPIC = "zen-global-standalone-search";
const PANEL_DEACTIVATED_TOPIC = "zen-global-search-panel-deactivated";
const HOTKEY_STATUS_TOPIC = "zen-global-search-hotkey-status";
const PANEL_CHROME_URL =
  "chrome://browser/content/zen-global-search-panel.xhtml";
const PANEL_WIDTH = 680;
const PANEL_HEIGHT = 420;

const SUPPORTED_CODES = new Set([
  ...Array.from(
    { length: 26 },
    (_, index) => `Key${String.fromCharCode(65 + index)}`
  ),
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
  ...Array.from({ length: 20 }, (_, index) => `F${index + 1}`),
]);

export function parseGlobalSearchShortcut(serialized) {
  if (typeof serialized !== "string") {
    return null;
  }
  const [modifierString, code, extra] = serialized.split("|");
  if (extra !== undefined || !SUPPORTED_CODES.has(code)) {
    return null;
  }
  const modifiers = modifierString ? modifierString.split(",") : [];
  const allowed = new Set(["control", "alt", "shift", "meta"]);
  if (
    new Set(modifiers).size !== modifiers.length ||
    modifiers.some(modifier => !allowed.has(modifier)) ||
    !modifiers.some(modifier => ["control", "alt", "meta"].includes(modifier))
  ) {
    return null;
  }
  return { modifiers, code };
}

export function serializeGlobalSearchShortcut(event) {
  if (!SUPPORTED_CODES.has(event?.code)) {
    return null;
  }
  const modifiers = [];
  if (event.ctrlKey) {
    modifiers.push("control");
  }
  if (event.metaKey) {
    modifiers.push("meta");
  }
  if (event.altKey) {
    modifiers.push("alt");
  }
  if (event.shiftKey) {
    modifiers.push("shift");
  }
  const serialized = `${modifiers.join(",")}|${event.code}`;
  return parseGlobalSearchShortcut(serialized) ? serialized : null;
}

export function formatGlobalSearchShortcut(serialized) {
  const shortcut = parseGlobalSearchShortcut(serialized);
  if (!shortcut) {
    return "";
  }
  const symbols = { control: "⌃", meta: "⌘", alt: "⌥", shift: "⇧" };
  let key = shortcut.code;
  if (key.startsWith("Key")) {
    key = key.slice(3);
  } else if (key.startsWith("Digit")) {
    key = key.slice(5);
  }
  return `${shortcut.modifiers.map(modifier => symbols[modifier]).join(" ")} ${key}`;
}

class ZenGlobalSearchPanelController {
  #panelWindow = null;
  #registeredShortcut = null;
  #changingPreference = false;
  #lastStatus = Object.freeze({ ok: false, reason: "disabled" });

  init() {
    for (const topic of [
      OPEN_TOPIC,
      NATIVE_HOTKEY_TOPIC,
      PANEL_DEACTIVATED_TOPIC,
    ]) {
      Services.obs.addObserver(this, topic);
    }
    Services.obs.addObserver(this, "browser-delayed-startup-finished");
    Services.obs.addObserver(this, "profile-before-change");
    Services.prefs.addObserver(ENABLED_PREF, this);
    Services.prefs.addObserver(ZEN_GLOBAL_SEARCH_SHORTCUT_PREF, this);
  }

  observe(subject, topic) {
    if (topic === "browser-delayed-startup-finished") {
      Services.obs.removeObserver(this, topic);
      this.#syncHotkeyRegistration();
      return;
    }
    if (topic === "profile-before-change") {
      Services.zen.unregisterGlobalSearchHotkey();
      this.cancel("shutdown");
      return;
    }
    if (topic === OPEN_TOPIC || topic === NATIVE_HOTKEY_TOPIC) {
      this.open().catch(console.error);
      return;
    }
    if (topic === PANEL_DEACTIVATED_TOPIC) {
      this.cancel("deactivate");
      return;
    }
    if (topic === "nsPref:changed" && !this.#changingPreference) {
      this.#syncHotkeyRegistration();
    }
  }

  get panelWindow() {
    return this.#panelWindow;
  }

  get hotkeyStatus() {
    return this.#lastStatus;
  }

  async open({ initialValue = "" } = {}) {
    if (
      AppConstants.platform !== "macosx" ||
      !Services.prefs.getBoolPref(ENABLED_PREF, false) ||
      lazy.PrivateBrowsingUtils.permanentPrivateBrowsing
    ) {
      return null;
    }

    this.cancel("replace");

    let panelWindow;
    try {
      Services.zen.prepareGlobalSearchPanel();
      panelWindow = Services.ww.openWindow(
        null,
        PANEL_CHROME_URL,
        "_blank",
        `chrome,dialog=no,all,width=${PANEL_WIDTH},height=${PANEL_HEIGHT}`,
        null
      );
    } catch (error) {
      try {
        Services.zen.cancelPreparedGlobalSearchPanel();
      } catch {}
      console.error("Failed to construct the Zen global-search panel", error);
      return null;
    }

    if (!panelWindow) {
      Services.zen.cancelPreparedGlobalSearchPanel();
      return null;
    }

    panelWindow._zenGlobalSearchPanel = true;
    panelWindow.ZenGlobalSearchPanelType = ZEN_GLOBAL_SEARCH_PANEL_TYPE;
    this.#panelWindow = panelWindow;

    try {
      await this.#promisePanelHostReady(panelWindow);
      if (panelWindow.closed || this.#panelWindow !== panelWindow) {
        return null;
      }
      this.#initializeURLBar(panelWindow, initialValue);
      this.#configurePanel(panelWindow);
      return panelWindow;
    } catch (error) {
      console.error("Failed to initialize the Zen global-search panel", error);
      this.cancel("initialization-failure");
      return null;
    }
  }

  cancel(reason = "cancel") {
    const panelWindow = this.#panelWindow;
    this.#panelWindow = null;
    if (!panelWindow || panelWindow.closed) {
      return;
    }
    panelWindow._zenGlobalSearchPanelClosing = reason;
    try {
      panelWindow.gURLBar?.view?.close();
    } catch {}
    panelWindow.skipNextCanClose = true;
    panelWindow.close();
  }

  async #submit(panelWindow, url, event, openParams = {}) {
    if (
      this.#panelWindow !== panelWindow ||
      panelWindow.closed ||
      typeof url !== "string" ||
      !url
    ) {
      return;
    }

    const initialValue = panelWindow.gURLBar?.value ?? "";
    this.#panelWindow = null;
    panelWindow._zenGlobalSearchPanelClosing = "submitted";
    try {
      // Cancel the active query and invalidate deferred view/one-off callbacks
      // before the transient window loses its docshell.
      panelWindow.gURLBar?.view?.close({ elementPicked: true });
    } catch {}
    panelWindow.skipNextCanClose = true;
    panelWindow.close();

    const standaloneWindow =
      lazy.gZenStandaloneWindowManager.openGlobalSearchResultInStandalone({
        uriString: url,
        triggeringPrincipal: openParams.triggeringPrincipal ?? null,
        referrerInfo: openParams.referrerInfo ?? null,
        policyContainer: openParams.policyContainer ?? null,
        userContextId: openParams.userContextId ?? 0,
        postData: openParams.postData ?? null,
        sourceEvent: event ?? null,
      });

    if (!standaloneWindow) {
      await this.open({ initialValue });
      Services.obs.notifyObservers(
        null,
        "zen-global-search-standalone-open-failed"
      );
    }
  }

  #initializeURLBar(panelWindow, initialValue) {
    const { gURLBar } = panelWindow;
    if (!gURLBar || !panelWindow.gBrowser?.selectedBrowser) {
      throw new Error("Global-search host has no URL bar controller");
    }

    Object.defineProperty(gURLBar, "zenUrlbarBehavior", {
      configurable: true,
      value: "float",
    });
    gURLBar.setAttribute("action-override", "true");
    gURLBar._zenHandleUrlbarClose = (_onSwitch, onElementPicked) => {
      // UrlbarInput calls this hook immediately before its final _loadURL
      // boundary. Keep the host alive for that call; #submit closes it after
      // the selected search/result has been resolved. Other close paths are
      // genuine cancellations.
      if (!onElementPicked) {
        this.cancel("urlbar-close");
      }
    };
    gURLBar._loadURL = (url, event, _where, openParams) => {
      this.#submit(panelWindow, url, event, openParams).catch(console.error);
    };

    panelWindow.addEventListener(
      "keydown",
      event => {
        if (event.key !== "Escape") {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        this.cancel("escape");
      },
      true
    );
    panelWindow.addEventListener(
      "unload",
      () => {
        if (this.#panelWindow === panelWindow) {
          this.#panelWindow = null;
        }
      },
      { once: true }
    );

    gURLBar.search(initialValue);
    gURLBar.focus();
    gURLBar.select();
  }

  #configurePanel(panelWindow) {
    const baseWindow = panelWindow.docShell.treeOwner.QueryInterface(
      Ci.nsIBaseWindow
    );
    Services.zen.configureGlobalSearchPanel(
      baseWindow,
      PANEL_WIDTH,
      PANEL_HEIGHT
    );
    const { screen } = panelWindow;
    panelWindow.moveTo(
      Math.round(
        screen.availLeft + (screen.availWidth - panelWindow.outerWidth) / 2
      ),
      Math.round(
        screen.availTop + (screen.availHeight - panelWindow.outerHeight) / 2
      )
    );
  }

  #promisePanelHostReady(win) {
    return new Promise((resolve, reject) => {
      const isReady = () =>
        !win.closed &&
        !!win.gURLBar?.controller &&
        !!win.gBrowser?.selectedBrowser;
      if (isReady()) {
        resolve();
        return;
      }

      const timeoutId = lazy.setTimeout(() => {
        cleanup();
        reject(new Error("Global-search component host did not initialize"));
      }, 5000);
      const onReady = () => {
        cleanup();
        if (isReady()) {
          resolve();
        } else {
          reject(new Error("Global-search component host is incomplete"));
        }
      };
      const onWindowClosed = subject => {
        if (subject !== win) {
          return;
        }
        cleanup();
        reject(new Error("Global-search component host closed during startup"));
      };
      const cleanup = () => {
        lazy.clearTimeout(timeoutId);
        win.removeEventListener("zen-global-search-panel-ready", onReady);
        Services.obs.removeObserver(onWindowClosed, "domwindowclosed");
      };
      win.addEventListener("zen-global-search-panel-ready", onReady, {
        once: true,
      });
      // A window opened by nsIWindowWatcher first unloads its initial
      // about:blank document while navigating to PANEL_CHROME_URL. Observe the
      // outer window closing instead of treating that expected document
      // transition as a failed panel startup.
      Services.obs.addObserver(onWindowClosed, "domwindowclosed");
    });
  }

  #syncHotkeyRegistration() {
    if (AppConstants.platform !== "macosx") {
      this.#setStatus({ ok: false, reason: "unsupported" });
      return;
    }
    // Browser-chrome drives the internal observer entry point directly. Carbon
    // registration inside the automation harness can steal the harness window
    // before it dispatches mochitest-load, so system-wide delivery is covered
    // by native/unit and headful acceptance instead.
    if (Cu.isInAutomation) {
      Services.zen.unregisterGlobalSearchHotkey();
      this.#setStatus({ ok: false, reason: "automation" });
      return;
    }
    if (!Services.prefs.getBoolPref(ENABLED_PREF, false)) {
      Services.zen.unregisterGlobalSearchHotkey();
      this.#registeredShortcut = null;
      this.cancel("disabled");
      this.#setStatus({ ok: false, reason: "disabled" });
      return;
    }

    const stored = Services.prefs.getStringPref(
      ZEN_GLOBAL_SEARCH_SHORTCUT_PREF,
      ZEN_GLOBAL_SEARCH_DEFAULT_SHORTCUT
    );
    const candidate = parseGlobalSearchShortcut(stored)
      ? stored
      : ZEN_GLOBAL_SEARCH_DEFAULT_SHORTCUT;
    let result;
    try {
      result = JSON.parse(Services.zen.registerGlobalSearchHotkey(candidate));
    } catch (error) {
      result = { ok: false, reason: "registration-failed" };
      console.error("Failed to register the Zen global-search hotkey", error);
    }

    if (result.ok) {
      this.#registeredShortcut = candidate;
      if (stored !== candidate) {
        this.#replaceShortcutPreference(candidate);
      }
      this.#setStatus({ ...result, shortcut: candidate });
      return;
    }

    if (this.#registeredShortcut && stored !== this.#registeredShortcut) {
      this.#replaceShortcutPreference(this.#registeredShortcut);
    }
    this.#setStatus({ ...result, shortcut: this.#registeredShortcut });
  }

  #replaceShortcutPreference(value) {
    this.#changingPreference = true;
    try {
      Services.prefs.setStringPref(ZEN_GLOBAL_SEARCH_SHORTCUT_PREF, value);
    } finally {
      this.#changingPreference = false;
    }
  }

  #setStatus(status) {
    this.#lastStatus = Object.freeze(status);
    Services.obs.notifyObservers(
      null,
      HOTKEY_STATUS_TOPIC,
      JSON.stringify(status)
    );
  }
}

export const gZenGlobalSearchPanel = new ZenGlobalSearchPanelController();
