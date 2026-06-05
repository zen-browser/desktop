// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const FEATURE_PREF = "zen.tabs.scroll-switcher.enabled";
const WHEEL_THRESHOLD = 18;
const WHEEL_LOCK_MS = 90;

class ZenScrollTabSwitcher extends nsZenDOMOperatedFeature {
  #state = {
    open: false,
    panel: null,
    list: null,
    tabs: [],
    index: 0,
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

  #isAltX = event =>
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.code === "KeyX";

  #onGlobalKeydown = event => {
    if (!this.#isAltX(event)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.#toggle();
  };

  #toggle() {
    if (this.#state.open) {
      this.#commit();
      return;
    }

    this.#open();
  }

  #open() {
    this.#state.tabs = this.#visibleTabs();
    if (!this.#state.tabs.length) {
      return;
    }

    this.#installStyles();
    this.#state.originalTab = gBrowser.selectedTab;
    this.#state.index = Math.max(0, this.#state.tabs.indexOf(gBrowser.selectedTab));
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
    this.#state.tabs = [];
    this.#state.index = 0;
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
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#select(this.#state.index + 1, true);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#select(this.#state.index - 1, true);
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
    this.#select(this.#state.index + direction, true);
    this.#state.wheelTimer = setTimeout(() => {
      this.#state.wheelTimer = null;
    }, WHEEL_LOCK_MS);
  };

  #select(index, preview) {
    if (!this.#state.open || !this.#state.tabs.length) {
      return;
    }

    this.#state.index =
      (index + this.#state.tabs.length) % this.#state.tabs.length;

    for (const item of this.#state.list.querySelectorAll(
      ".zen-scroll-tab-switcher-item"
    )) {
      item.classList.toggle(
        "selected",
        Number(item.dataset.index) === this.#state.index
      );
    }

    this.#state.list
      .querySelector(".zen-scroll-tab-switcher-item.selected")
      ?.scrollIntoView({ block: "center" });

    if (preview && gBrowser.selectedTab !== this.#state.tabs[this.#state.index]) {
      gBrowser.selectedTab = this.#state.tabs[this.#state.index];
      this.#render();
    }
  }

  #render() {
    if (!this.#state.list) {
      return;
    }

    this.#state.list.textContent = "";

    for (const [index, tab] of this.#state.tabs.entries()) {
      const item = this.#htmlElement(
        "div",
        `zen-scroll-tab-switcher-item${
          index === this.#state.index ? " selected" : ""
        }`
      );
      item.dataset.index = String(index);

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

      item.addEventListener("mouseenter", () => this.#select(index, true));
      item.addEventListener("click", () => this.#commit());
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
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "") || url;
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

    const style = this.#htmlElement("style");
    style.id = "zen-scroll-tab-switcher-style";
    style.textContent = `
      #zen-scroll-tab-switcher {
        position: fixed;
        z-index: 2147483647;
        top: 8.5vh;
        left: 50%;
        transform: translateX(-50%);
        width: min(760px, calc(100vw - 96px));
        max-height: min(390px, calc(100vh - 140px));
        overflow: hidden;
        box-sizing: border-box;
        padding: 10px;
        color: #f7f7f8;
        background: rgba(18, 18, 20, 0.985);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        box-shadow: 0 18px 54px rgba(0, 0, 0, 0.42);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(24px);
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 360px;
        overflow: hidden;
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-item {
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        min-height: 48px;
        padding: 7px 10px;
        border-radius: 8px;
        color: #a7a7ad;
        user-select: none;
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-item.selected {
        color: #f7f7f8;
        background: rgba(255, 255, 255, 0.07);
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-favicon {
        width: 18px;
        height: 18px;
        border-radius: 5px;
        object-fit: contain;
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-copy {
        min-width: 0;
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-title,
      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-url {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-title {
        color: #f1f1f3;
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-url {
        color: #85858d;
        font-size: 12px;
        font-weight: 500;
        line-height: 17px;
      }

      #zen-scroll-tab-switcher .zen-scroll-tab-switcher-active {
        color: #8f8f96;
        font-size: 11px;
        font-weight: 600;
      }
    `;
    document.documentElement.append(style);
  }
}

window.gZenScrollTabSwitcher = new ZenScrollTabSwitcher();
