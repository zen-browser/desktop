
var ZenSidebarManager = {
  _sidebarElement: null,
  _currentPanel: null,

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
      button.setAttribute("zen-sidebar-id", site);
      button.style.listStyleImage = this._getWebPanelIcon(panel.url);
      button.addEventListener("click", this._handleClick.bind(this));
      this.sidebarElement.appendChild(button);
    }
  },

  _openAndGetWebPanelWrapper() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    sidebar.removeAttribute("hidden");
    return sidebar;
  },

  _closeSidebarPanel() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    sidebar.setAttribute("hidden", "true");
  },

  _handleClick(event) {
    let target = event.target;
    let panelId = target.getAttribute("zen-sidebar-id");
    if (this._currentPanel === panelId) {
      return;
    }
    this._currentPanel = panelId;
    this._updateButtons();
    this._updateWebPanel();
  },

  _updateButtons() {
    for (let button of this.sidebarElement.querySelectorAll(".zen-sidebar-panel-button")) {
      if (button.getAttribute("zen-sidebar-id") === this._currentPanel) {
        button.setAttribute("selected", "true");
      } else {
        button.removeAttribute("selected");
      }
    }
  },

  _updateWebPanel() {
    let sidebar = this._openAndGetWebPanelWrapper();
  },

  _getWebPanelIcon(url) {
    return `url(page-icon:${url})`;
  },

  reload() {

  },

  forward() {

  },

  back() {
      
  },

  home() {
        
  },

  close() {
    this._closeSidebarPanel();
  },

  get sidebarElement() {
    if (!this._sidebarElement) {
      this._sidebarElement = document.getElementById("zen-sidebar-panels-wrapper");
    }
    return this._sidebarElement;
  },
};

ZenSidebarManager.init();
