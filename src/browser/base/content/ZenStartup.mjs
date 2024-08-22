
var ZenStartup = {
  init() {
    this._changeSidebarLocation();
    this._zenInitBrowserLayout();
    this._focusSearchBar();
  },

  _zenInitBrowserLayout() {
    if (this.__hasInitBrowserLayout) return;
    this.__hasInitBrowserLayout = true;
    this.openWatermark();
    console.info("ZenThemeModifier: init browser layout");
    const kNavbarItems = [
      "nav-bar",
      "PersonalToolbar"
    ];
    const kNewContainerId = "zen-appcontent-navbar-container";
    let newContainer = document.getElementById(kNewContainerId);
    for (let id of kNavbarItems) {
      const node = document.getElementById(id);
      console.assert(node, "Could not find node with id: " + id);
      if (!node) continue;
      newContainer.appendChild(node);
    }

    // Fix notification deck
    document.getElementById("zen-appcontent-navbar-container")
      .appendChild(document.getElementById("tab-notification-deck-template"));

    gZenVerticalTabsManager.init();
    gZenCompactModeManager.init();
    gZenKeyboardShortcuts.init();

    function throttle(f, delay) {
      let timer = 0;
      return function(...args) {
          clearTimeout(timer);
          timer = setTimeout(() => f.apply(this, args), delay);
      }
    }

    new ResizeObserver(throttle(
      this._updateTabsToolbar.bind(this), 1000
    )).observe(document.getElementById("tabbrowser-tabs"));

    this.closeWatermark();
  },

  _updateTabsToolbar() {
    // Set tabs max-height to the "toolbar-items" height
    const toolbarItems = document.getElementById("tabbrowser-tabs");
    const tabs = document.getElementById("tabbrowser-arrowscrollbox");
    tabs.style.maxHeight = '0px'; // reset to 0
    const toolbarRect = toolbarItems.getBoundingClientRect();
    // -5 for the controls padding
    tabs.style.maxHeight = toolbarRect.height - 5 + "px";
    console.info("ZenThemeModifier: set tabs max-height to", toolbarRect.height + "px");
  },

  openWatermark() {
    if (!Services.prefs.getBoolPref("zen.watermark.enabled", false)) {
      return;
    }
    const watermark = window.MozXULElement.parseXULToFragment(`
      <html:div id="zen-watermark">
        <image src="chrome://branding/content/about-logo.png" />
      </html:div>
    `);
    document.body.appendChild(watermark);
  },

  closeWatermark() {
    const watermark = document.getElementById("zen-watermark");
    if (watermark) {
      watermark.setAttribute("hidden", "true");
    }
  },

  _changeSidebarLocation() {
    const kElementsToAppend = [
      "sidebar-splitter",
      "sidebar-box",
      "navigator-toolbox",
    ];
    const wrapper = document.getElementById("zen-tabbox-wrapper");
    const appWrapepr = document.getElementById("zen-sidebar-box-container");
    for (let id of kElementsToAppend) {
      const elem = document.getElementById(id);
      if (elem) {
        wrapper.prepend(elem);
      }
    }
    appWrapepr.setAttribute("hidden", "true");

    // Set a splitter to navigator-toolbox
    const splitter = document.createXULElement("splitter");
    splitter.setAttribute("id", "zen-sidebar-splitter");
    splitter.setAttribute("orient", "horizontal");
    splitter.setAttribute("resizebefore", "sibling");
    splitter.setAttribute("resizeafter", "none");
    const titlebar = document.getElementById("navigator-toolbox");
    titlebar.insertAdjacentElement("afterend", splitter);
  },

  _focusSearchBar() {
    gURLBar.focus();
  },
};

ZenStartup.init();
