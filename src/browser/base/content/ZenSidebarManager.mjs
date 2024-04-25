
var ZenSidebarManager = {
  _sidebarElement: null,

  init() {
    this.update();
  },

  update() {
    this._updateWebPanels();
  },

  _updateWebPanels() {
    if (Services.prefs.getBoolPref("zen.sidebar.enabled")) {
      this.sidebarElement.removeAttribute("hidden");
    } else {
      this.sidebarElement.setAttribute("hidden", "true");
      return;
    }

    let services = Services.prefs.getStringPref("zen.sidebar.data");
    if (services === "") {
      return;
    }
    let data = JSON.parse(services);
    if (!data.data || !data.index) {
      return;
    }
    for (let site of data.index) {
      let panel = data.data[site];
      if (!panel || !panel.url) {
        continue;
      }
      let button = document.createXULElement("toolbarbutton");
      button.classList.add("zen-sidebar-panel-button", "toolbarbutton-1", "chromeclass-toolbar-additional");
      button.setAttribute("flex", "1");
      button.style.listStyleImage = this._getWebPanelIcon(panel.url);
      this.sidebarElement.appendChild(button);
    }
  },

  _getWebPanelIcon(url) {
    return `url(page-icon:${url})`;
  },

  get sidebarElement() {
    if (!this._sidebarElement) {
      this._sidebarElement = document.getElementById("zen-sidebar-panels-wrapper");
    }
    return this._sidebarElement;
  }
};

ZenSidebarManager.init();
