/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, css } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";
import { nsZenPreloadedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { ZenLibrarySpaces } from "chrome://browser/content/zen-components/features/spaces.sys.mjs";

/**
 * Zen Library Component
 */
class ZenLibraryElement extends MozLitElement {
  static properties = {
    activeTab: { type: String },
  };

  constructor() {
    super();
    this.activeTab = gZenLibrary.lastActiveTab || "downloads"; // Default persistence
  }

  /**
   * List of items to display in the sidebar.
   * @type {Array<{id: string, label: string, icon: string}>}
   */
  _sidebarItems = [
    { id: "downloads", label: "Downloads", icon: "downloads-icon" },
    { id: "media", label: "Media", icon: "media-icon" },
    { id: "history", label: "History", icon: "history-icon" },
    { id: "spaces", label: "Spaces", icon: "spaces-icon" },
  ];

  render() {
    return html`
      <link rel="stylesheet" href="chrome://browser/content/zen-styles/ZenLibrary.css" />
      <div id="zen-library-sidebar-new">
        <div class="zen-library-sidebar-top"></div>
        <div class="zen-library-sidebar-items">
          ${this._sidebarItems.map((item) =>
      this._renderSidebarItem(item.id, item.label, item.icon)
    )}
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
          ${this.activeTab !== "spaces"
        ? html`
            <div class="search-container">
              <div class="search-icon"></div>
              <input
                type="text"
                placeholder="Search ${this._capitalize(this.activeTab)}..."
              />
            </div>
            `
        : ""}
        </header>
        <div class="library-content">
          ${this._renderContent()}
        </div>
      </div>
    `;
  }

  firstUpdated() {
    // Initial entry animation is handled by open() setting the style.width explicitly.
    // We just need to clear it so the CSS transition can take over on the next frame.
    const host = this.shadowRoot.host;

    // Force reflow
    host.getBoundingClientRect();

    requestAnimationFrame(() => {
      host.style.width = ""; // Release control to CSS variable + transition
    });
  }

  updated(changedProperties) {
    if (changedProperties.has("activeTab")) {
      this.setAttribute("active-tab", this.activeTab);

      const host = this.shadowRoot.host;
      if (this.activeTab === "spaces") {
        const { width } = ZenLibrarySpaces.getData();
        host.style.setProperty("--zen-library-width", `${width}px`);

        setTimeout(() => {
          const grid = this.shadowRoot.querySelector(".library-workspace-grid");
          if (grid) grid.classList.add("animation-complete");
        }, 300);
      } else {
        host.style.setProperty("--zen-library-width", "340px");
      }
    }
  }

  _renderSidebarItem(id, label, iconClass) {
    const isActive = this.activeTab === id;
    return html`
      <div
        class="sidebar-item ${isActive ? "active" : ""}"
        data-id="${id}"
        title="${label}"
        @click=${() => {
        this.activeTab = id;
        gZenLibrary.lastActiveTab = id;
      }}
      >
        <div class="icon ${iconClass}"></div>
        <span class="label">${label}</span>
      </div>
    `;
  }

  _renderContent() {
    if (this.activeTab === "spaces") {
      const { workspaces } = ZenLibrarySpaces.getData();
      return html`
        <div 
          class="library-workspace-grid"
          @wheel=${this._handleGridScroll}
        >
          ${workspaces.map(ws => this._renderWorkspaceCard(ws))}
        </div>
      `;
    }

    // Default empty state for other tabs
    return html`
      <div class="empty-state">
        <div class="empty-icon ${this.activeTab}-icon"></div>
        <h3>Nothing here yet!</h3>
        <p>${this._getEmptyStateDescription()}</p>
        <button class="learn-more">Learn more</button>
      </div>
    `;
  }

  _renderWorkspaceCard(workspace) {
    return ZenLibrarySpaces.renderCard(html, workspace);
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _handleGridScroll(e) {
    if (e.deltaY !== 0) {
      e.preventDefault();
      const grid = this.shadowRoot.querySelector(".library-workspace-grid");
      if (grid) {
        // DeltaMode 0 is Pixel (Touchpad), 1 is Line (Mouse Wheel)
        if (e.deltaMode === 1) {
          // Mouse Wheel: Use smooth scrolling for animation
          // 30px per line is a comfortable standard
          const amount = e.deltaY * 30;
          grid.scrollBy({ left: amount, behavior: "smooth" });
        } else {
          // Touchpad: Use direct mapping for 1:1 control (browser handles inertia)
          // Boosting slightly (1.5x) but keeping it "instant" to avoid lag
          grid.scrollLeft += e.deltaY * 1.5;
        }
      }
    }
  }

  _getEmptyStateDescription() {
    if (this.activeTab === "media") {
      return "Save media to your Documents, Desktop, and Download Folders to see them here.";
    }
    return `Content for ${this._capitalize(
      this.activeTab
    )
      } will be displayed here once available.`;
  }
}

customElements.define("zen-library", ZenLibraryElement);

class ZenLibrary extends nsZenPreloadedFeature {
  constructor() {
    super();
    this.name = "ZenLibrary";
    this._isOpen = false;
    this._element = null;
    this.lastActiveTab = "downloads";
  }

  init() {
    console.log("ZenLibrary: Initializing...");
    window.addEventListener(
      "MozAfterPaint",
      () => {
        window.addEventListener("keydown", (e) => this._onKeyDown(e), true);

        // Inject global stylesheet for animations affecting #navigator-toolbox
        if (!document.getElementById("zen-library-global-style")) {
          const link = document.createElement("link");
          link.id = "zen-library-global-style";
          link.rel = "stylesheet";
          link.href = "chrome://browser/content/zen-styles/ZenLibrary.css";
          document.head.appendChild(link);
        }
      },
      { once: true }
    );
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
      this._element.style.setProperty(
        "--zen-library-start-width",
        `${startWidth}px`
      );
      // Immediately set width to prevent layout thrashing or 0-width start
      this._element.style.width = `${startWidth}px`;
    } else {
      this._element.style.width = "0px";
    }

    // Set initial active tab attribute to sync CSS variables immediately
    this._element.setAttribute("active-tab", this._element.activeTab || "media");

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
        document.documentElement.classList.add("zen-toolbox-fading-in");
        setTimeout(
          () =>
            document.documentElement.classList.remove("zen-toolbox-fading-in"),
          300
        );
      };

      this._element.addEventListener("animationend", (e) => {
        if (
          e.animationName === "slideAndPushOut" &&
          e.target === this._element
        ) {
          onEnd();
        }
      });

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
