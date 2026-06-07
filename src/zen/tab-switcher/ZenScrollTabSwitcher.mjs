// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const FEATURE_PREF = "zen.tabs.scroll-switcher.enabled";
const STYLE_URL =
  "chrome://browser/content/zen-components/ZenScrollTabSwitcher.css";
const WHEEL_THRESHOLD = 18;
const WHEEL_LOCK_MS = 90;

class ZenScrollTabSwitcher extends nsZenDOMOperatedFeature {
  #state = {
    open: false,
    panel: null,
    list: null,
    originalTab: null,
    wheelDelta: 0,
    wheelTimer: null,
    listeners: [],
  };

  init() {
    if (!Services.prefs.getBoolPref(FEATURE_PREF, false)) {
      return;
    }

    window.addEventListener("keydown", this.#onGlobalKeydown, {
      capture: true,
    });
    window.addEventListener("unload", this.#destroy, { once: true });
  }

  #isAltX(event) {
    return (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.code === "KeyX"
    );
  }

  #onGlobalKeydown = event => {
    if (!this.#isAltX(event)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.#state.open ? this.#commit() : this.#open();
  };

  #open() {
    if (!gBrowser?.tabs?.length) {
      return;
    }

    this.#installStyles();
    this.#state.originalTab = gBrowser.selectedTab;
    this.#state.panel = this.#htmlElement("div");
    this.#state.panel.id = "zen-scroll-tab-switcher";
    this.#state.list = this.#htmlElement("div", "zen-scroll-tab-switcher-list");
    this.#state.panel.append(this.#state.list);
    document.documentElement.append(this.#state.panel);
    this.#state.open = true;
    this.#render();

    this.#addSessionListener(window, "wheel", this.#onWheel, {
      capture: true,
      passive: false,
    });
    this.#addSessionListener(window, "keydown", this.#onSessionKeydown, {
      capture: true,
    });
    this.#addSessionListener(window, "unload", this.#onUnload, { once: true });
  }

  #commit() {
    this.#close({ restore: false });
  }

  #cancel() {
    this.#close({ restore: true });
  }

  #close({ restore }) {
    if (!this.#state.open) {
      return;
    }

    const originalTab = this.#state.originalTab;
    this.#state.open = false;
    this.#removeSessionListeners();
    this.#state.panel?.remove();
    this.#state.panel = null;
    this.#state.list = null;
    this.#state.originalTab = null;
    this.#state.wheelDelta = 0;

    if (restore && originalTab && !originalTab.closing) {
      gBrowser.selectedTab = originalTab;
    }
  }

  #destroy = () => {
    window.removeEventListener("keydown", this.#onGlobalKeydown, {
      capture: true,
    });
    this.#close({ restore: false });
  };

  #onUnload = () => {
    this.#close({ restore: false });
  };

  #onSessionKeydown = event => {
    if (!this.#state.open) {
      return;
    }

    if (this.#isAltX(event) || event.key === "Enter") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#commit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#cancel();
    }
  };

  #onWheel = event => {
    if (!this.#state.open) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.#state.wheelDelta += event.deltaY;

    if (
      this.#state.wheelTimer ||
      Math.abs(this.#state.wheelDelta) < WHEEL_THRESHOLD
    ) {
      return;
    }

    const direction = this.#state.wheelDelta > 0 ? -1 : 1;
    this.#state.wheelDelta = 0;
    try {
      gBrowser.tabContainer.advanceSelectedTab(direction, true);
      this.#syncSelection();
    } catch (error) {
      console.error("[ZenScrollTabSwitcher] Failed to switch tabs:", error);
      this.#close({ restore: false });
      return;
    }

    this.#state.wheelTimer = setTimeout(() => {
      this.#state.wheelTimer = null;
    }, WHEEL_LOCK_MS);
  };

  #syncSelection() {
    this.#render();
    this.#state.list
      ?.querySelector(".zen-scroll-tab-switcher-item.selected")
      ?.scrollIntoView({ block: "center" });
  }

  #render() {
    if (!this.#state.list) {
      return;
    }

    this.#state.list.textContent = "";

    for (const tab of this.#visibleTabs()) {
      const item = this.#htmlElement(
        "div",
        `zen-scroll-tab-switcher-item${
          tab === gBrowser.selectedTab ? " selected" : ""
        }`
      );

      const icon = this.#htmlElement("img", "zen-scroll-tab-switcher-favicon");
      icon.setAttribute("alt", "");
      icon.setAttribute(
        "src",
        tab.getAttribute("image") || "chrome://branding/content/icon32.png"
      );

      const copy = this.#htmlElement("div", "zen-scroll-tab-switcher-copy");
      const title = this.#htmlElement("div", "zen-scroll-tab-switcher-title");
      title.textContent = tab.label || "Untitled tab";
      const url = this.#htmlElement("div", "zen-scroll-tab-switcher-url");
      url.textContent = this.#tabUrlLabel(tab);
      copy.append(title, url);

      item.append(icon, copy);
      if (tab === gBrowser.selectedTab) {
        const active = this.#htmlElement("div", "zen-scroll-tab-switcher-active");
        active.textContent = "Active";
        item.append(active);
      }
      item.addEventListener("click", () => {
        gBrowser.selectedTab = tab;
        this.#commit();
      });
      this.#state.list.append(item);
    }
  }

  #visibleTabs() {
    return Array.from(gBrowser.tabs).filter(tab => !tab.hidden && !tab.closing);
  }

  #tabUrlLabel(tab) {
    const url =
      tab.linkedBrowser?.currentURI?.displaySpec ||
      tab.linkedBrowser?.currentURI?.spec ||
      "";

    if (!url) {
      return "";
    }

    try {
      const { hostname } = new URL(url);
      return hostname.replace(/^www\./, "") || url;
    } catch {
      return url;
    }
  }

  #addSessionListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.#state.listeners.push({ target, type, handler, options });
  }

  #removeSessionListeners() {
    for (const listener of this.#state.listeners.splice(0)) {
      listener.target.removeEventListener(
        listener.type,
        listener.handler,
        listener.options
      );
    }

    if (this.#state.wheelTimer) {
      clearTimeout(this.#state.wheelTimer);
      this.#state.wheelTimer = null;
    }
  }

  #htmlElement(tag, className) {
    const element = document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    if (className) {
      element.className = className;
    }
    return element;
  }

  #installStyles() {
    if (document.getElementById("zen-scroll-tab-switcher-style")) {
      return;
    }

    const link = this.#htmlElement("link");
    link.id = "zen-scroll-tab-switcher-style";
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", STYLE_URL);
    document.documentElement.append(link);
  }
}

window.gZenScrollTabSwitcher = new ZenScrollTabSwitcher();
