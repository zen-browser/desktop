/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, css } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";
import { nsZenPreloadedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

/**
 * Zen Library Component
 */
class ZenLibraryElement extends MozLitElement {
  static properties = {
    activeTab: { type: String },
  };

  constructor() {
    super();
    this.activeTab = "media"; // Default tab
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/ZenLibrary.css" />
      <div id="zen-library-sidebar-new">
        <div class="zen-library-sidebar-top"></div>
        <div class="zen-library-sidebar-items">
          ${this._renderSidebarItem("downloads", "Downloads", "downloads-icon")}
          ${this._renderSidebarItem("media", "Media", "media-icon")}
          ${this._renderSidebarItem("history", "History", "history-icon")}
          ${this._renderSidebarItem("spaces", "Spaces", "spaces-icon")}
        </div>
        <div class="zen-library-sidebar-bottom">
          <div
            class="sidebar-item exit-btn"
            data-id="exit"
            @click=${() => gZenLibrary.close()}
          >
            <div class="icon back-icon"></div>
            <span class="label">Exit Library</span>
          </div>
        </div>
      </div>
      <div id="zen-library-main-panel">
        <header class="library-header">
          <div class="search-container">
            <div class="search-icon"></div>
            <input
              type="text"
              placeholder="Search ${this._capitalize(this.activeTab)}..."
            />
          </div>
        </header>
        <div class="library-content">
          <div class="empty-state">
            <div
              class="empty-icon ${this.activeTab}-icon"
            ></div>
            <h3>Nothing here yet!</h3>
            <p>${this._getEmptyStateDescription()}</p>
            <button class="learn-more">Learn more</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderSidebarItem(id, label, iconClass) {
    const isActive = this.activeTab === id;
    return html`
      <div
        class="sidebar-item ${isActive ? "active" : ""}"
        data-id="${id}"
        title="${label}"
        @click=${() => (this.activeTab = id)}
      >
        <div class="icon ${iconClass}"></div>
        <span class="label">${label}</span>
      </div>
    `;
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _getEmptyStateDescription() {
    if (this.activeTab === "media") {
      return "Save media to your Documents, Desktop, and Download Folders to see them here.";
    }
    return `Content for ${this._capitalize(
      this.activeTab
    )} will be displayed here once available.`;
  }
}

customElements.define("zen-library", ZenLibraryElement);

class ZenLibrary extends nsZenPreloadedFeature {
  constructor() {
    super();
    this.name = "ZenLibrary";
    this._isOpen = false;
    this._element = null;
  }

  init() {
    console.log("ZenLibrary: Initializing...");
    window.addEventListener("keydown", (e) => this._onKeyDown(e), true);

    // Inject global stylesheet for animations affecting #navigator-toolbox
    if (!document.getElementById("zen-library-global-style")) {
      const link = document.createElement("link");
      link.id = "zen-library-global-style";
      link.rel = "stylesheet";
      link.href = "chrome://browser/content/zen-styles/ZenLibrary.css";
      document.head.appendChild(link);
    }
  }

  _onKeyDown(e) {
    if (e.altKey && e.shiftKey && e.code === "KeyB") {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    }
  }

  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this._isOpen || document.querySelector("zen-library")) return;

    const browser = document.getElementById("browser");
    if (!browser) return;

    this._isOpen = true;
    this._element = document.createElement("zen-library");
    this._element.id = "zen-library-container";

    // Measure the toolbox and splitter width to prevent layout jumps
    const toolbox = document.getElementById("navigator-toolbox");
    const splitter = document.getElementById("zen-sidebar-splitter");
    let startWidth = 0;
    if (toolbox) {
      startWidth += toolbox.getBoundingClientRect().width;
    }
    if (splitter) {
      startWidth += splitter.getBoundingClientRect().width;
    }

    if (startWidth > 0) {
      this._element.style.setProperty("--zen-library-start-width", `${startWidth}px`);
    }

    browser.prepend(this._element);

    document.documentElement.setAttribute("zen-library-open", "true");
    console.log("ZenLibrary: Opened (Lit)");
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;

    if (this._element) {
      this._element.classList.add("closing");

      let timer;
      const onEnd = () => {
        clearTimeout(timer);
        if (this._element) {
          this._element.remove();
          this._element = null;
        }
        document.documentElement.removeAttribute("zen-library-open");
      };

      this._element.addEventListener("animationend", onEnd, { once: true });

      // Fallback in case animationend doesn't fire
      timer = setTimeout(onEnd, 300);
    } else {
      document.documentElement.removeAttribute("zen-library-open");
    }
    console.log("ZenLibrary: Closed (Lit)");
  }
}

window.gZenLibrary = new ZenLibrary();
if (document.readyState !== "loading") {
  gZenLibrary.init();
}
