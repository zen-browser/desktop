// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenFullscreenManager {
  #initialized = false;
  #exitButton = null;
  #exitLabel = null;
  #wasSidebarExpandedBeforeFullscreen = null;

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;

    window.addEventListener("MozDOMFullscreen:Entered", () => this.onFullscreenEntered());
    window.addEventListener("MozDOMFullscreen:Exited", () => this.onFullscreenExited());

    // Exit DOM fullscreen when selecting another tab
    window.gBrowser?.tabContainer?.addEventListener("TabSelect", () => {
      if (document.documentElement.hasAttribute("inDOMFullscreen")) {
        this.exitFullscreen();
      }
    });

    this.#setupExitButton();
  }

  get inDOMFullscreen() {
    return document.documentElement.hasAttribute("inDOMFullscreen");
  }

  exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.mozFullScreenElement) {
      document.mozCancelFullScreen();
    }
  }

  onFullscreenEntered() {
    // Save whether the sidebar was expanded before entering DOM fullscreen
    this.#wasSidebarExpandedBeforeFullscreen = Services.prefs.getBoolPref(
      "zen.view.sidebar-expanded",
      true
    );

    // Default to compact sidebar in full screen
    if (this.#wasSidebarExpandedBeforeFullscreen) {
      Services.prefs.setBoolPref("zen.view.sidebar-expanded", false);
    }
  }

  onFullscreenExited() {
    // Restore sidebar expansion state to how it was before fullscreen
    if (this.#wasSidebarExpandedBeforeFullscreen !== null) {
      Services.prefs.setBoolPref(
        "zen.view.sidebar-expanded",
        this.#wasSidebarExpandedBeforeFullscreen
      );
      this.#wasSidebarExpandedBeforeFullscreen = null;
    }

    // Clear any hover / user-show attributes on the toolbox
    gNavToolbox?.removeAttribute("zen-user-show");
  }

  #setupExitButton() {
    // Create an overlay button inside #urlbar for "Exit Full Screen"
    const urlbar = document.getElementById("urlbar");
    if (!urlbar || document.getElementById("zen-fullscreen-exit-button")) {
      return;
    }

    const container = document.createElement("div");
    container.id = "zen-fullscreen-exit-button";
    container.setAttribute("role", "button");
    container.setAttribute("tabindex", "0");

    const icon = document.createElement("image");
    icon.id = "zen-fullscreen-exit-icon";
    container.appendChild(icon);

    const label = document.createElement("span");
    label.id = "zen-fullscreen-exit-label";
    label.textContent = "Exit Full Screen";
    container.appendChild(label);

    const onExitClick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.exitFullscreen();
    };

    container.addEventListener("click", onExitClick);
    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        onExitClick(e);
      }
    });

    urlbar.appendChild(container);
    this.#exitButton = container;
  }
}

window.gZenFullscreenManager = new ZenFullscreenManager();
