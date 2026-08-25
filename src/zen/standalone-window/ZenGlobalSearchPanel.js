/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global MozXULElement */

// UrlbarInput is deliberately reused instead of being copied. It is designed
// around a browser chrome window, so this file supplies only the narrow window
// contract it needs. No browser workspace, tabs or SessionStore are started.

const HTML_NS = "http://www.w3.org/1999/xhtml";
const BLANK_URI = Services.io.newURI("about:blank");

const gGlobalSearchTabContainer = new EventTarget();
const gGlobalSearchTab = {
  group: null,
  isEmpty: true,
  linkedBrowser: null,
  hasAttribute() {
    return false;
  },
  getAttribute() {
    return "";
  },
};

var gBrowser = {
  get selectedBrowser() {
    return document.getElementById("zen-global-search-context-browser");
  },
  get currentURI() {
    return this.selectedBrowser?.currentURI ?? BLANK_URI;
  },
  get contentTitle() {
    return "";
  },
  get selectedTab() {
    gGlobalSearchTab.linkedBrowser = this.selectedBrowser;
    return gGlobalSearchTab;
  },
  get selectedTabs() {
    return [this.selectedTab];
  },
  get tabs() {
    return [this.selectedTab];
  },
  get browsers() {
    return this.selectedBrowser ? [this.selectedBrowser] : [];
  },
  getTabForBrowser(browser) {
    return browser === this.selectedBrowser ? this.selectedTab : null;
  },
  tabContainer: gGlobalSearchTabContainer,
  userTypedValue: "",
  addTabsProgressListener() {},
  removeTabsProgressListener() {},
};

var gZenUIManager = {
  onUrlbarOpen() {},
  onFloatingURLBarOpen() {},
  onUrlbarClose() {},
  getOpenUILinkWhere(_url, _browser, where) {
    return where;
  },
};

var gZenVerticalTabsManager = {
  _hasSetSingleToolbar: false,
  recalculateURLBarHeight() {},
};

var gInitialPages = ["about:blank", "about:newtab", "about:home"];
var gURLBar = null;

// UrlbarValueFormatter normally waits for the full browser window's delayed
// startup before touching the search service. This component-only window has
// no browser startup, so expose its equivalent already-complete state.
var gBrowserInit = {
  delayedStartupFinished: true,
  isAdoptingTab() {
    return false;
  },
};
var delayedStartupPromise = Promise.resolve();

function isInitialPage(uri) {
  const spec = typeof uri == "string" ? uri : uri?.spec;
  return gInitialPages.includes(spec);
}

function isBlankPageURL(spec) {
  return spec == "about:blank";
}

function promiseDocumentFlushed(callback) {
  if (typeof window.windowUtils.promiseDocumentFlushed === "function") {
    return window.windowUtils.promiseDocumentFlushed(callback);
  }
  // The helper is normally installed by browser.xhtml startup, which this
  // component-only host deliberately skips. Preserve its async callback
  // contract without pulling the full browser window into the panel.
  return Promise.resolve().then(callback);
}

function UpdatePopupNotificationsVisibility() {}

function readFromClipboard() {
  return "";
}

function openTrustedLinkIn() {
  throw new Error("The global-search panel cannot load content");
}

function switchToTabHavingURI() {
  return false;
}

function openPreferences() {}

function goDoCommand(command) {
  const controller =
    document.commandDispatcher.getControllerForCommand(command);
  if (controller?.isCommandEnabled(command)) {
    controller.doCommand(command);
  }
}

async function initializeGlobalSearchHost() {
  gGlobalSearchTab.linkedBrowser = gBrowser.selectedBrowser;

  ChromeUtils.importESModule(
    "chrome://browser/content/urlbar/UrlbarInput.mjs",
    { global: "current" },
  );
  await customElements.whenDefined("moz-urlbar");

  Reflect.set(
    window,
    "gURLBar",
    document.createElementNS(HTML_NS, "moz-urlbar"),
  );
  gURLBar.id = "urlbar";
  gURLBar.className = "urlbar";
  gURLBar.setAttribute("popover", "manual");
  gURLBar.setAttribute("pageproxystate", "invalid");
  gURLBar.setAttribute("unifiedsearchbutton-available", "");
  gURLBar.setAttribute("sap-name", "urlbar");
  gURLBar.setAttribute("breakout", "true");
  gURLBar.setAttribute("zen-newtab", "true");
  gURLBar.setAttribute("zen-floating-urlbar", "true");

  // UrlbarSearchOneOffs consumes this light-DOM slot. browser.xhtml normally
  // supplies it, so the component host must provide it explicitly as well.
  const searchOneOffs = document.createElementNS(HTML_NS, "div");
  searchOneOffs.className = "search-one-offs";
  searchOneOffs.setAttribute("includecurrentengine", "true");
  searchOneOffs.setAttribute("disabletab", "true");
  searchOneOffs.setAttribute("urlbar-slot", "search-one-offs");
  gURLBar.append(searchOneOffs);

  document.getElementById("urlbar-container").append(gURLBar);

  window.dispatchEvent(new CustomEvent("zen-global-search-panel-ready"));
}

window.addEventListener(
  "DOMContentLoaded",
  () => initializeGlobalSearchHost().catch(console.error),
  { once: true },
);
