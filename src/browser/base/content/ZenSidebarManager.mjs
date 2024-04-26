
export var gZenBrowserManagerSidebar = {
  _sidebarElement: null,
  _currentPanel: null,

  DEFAULT_MOBILE_USER_AGENT: "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 Edg/114.0.1823.79",

  init() {
    this.update();
  },

  get sidebarData() {
    let services = Services.prefs.getStringPref("zen.sidebar.data");
    if (services === "") {
      return {};
    }
    return JSON.parse(services);
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

    let data = this.sidebarData;
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
    this._currentPanel = null;
    this._updateButtons();
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

  _hideAllWebPanels() {
    let sidebar = this._openAndGetWebPanelWrapper();
    for (let browser of sidebar.querySelectorAll("browser[zen-sidebar-id]")) {
      browser.setAttribute("hidden", "true");
    }
  },

  _updateWebPanel() {
    let sidebar = this._openAndGetWebPanelWrapper();
    this._hideAllWebPanels();
    let existantWebview = sidebar.querySelector(`browser[zen-sidebar-id="${this._currentPanel}"]`);
    if (existantWebview) {
      existantWebview.removeAttribute("hidden");
      return;
    }
    let data = this._getWebPanelData(this._currentPanel);
    let browser = this._createWebPanelBrowser(data);
    let browserContainers = document.getElementById("zen-sidebar-web-panel-browser-containers");
    browserContainers.appendChild(browser.linkedBrowser);
    if (data.ua) {
      browser.linkedBrowser.browsingContext.customUserAgent = this.DEFAULT_MOBILE_USER_AGENT;
    }
  },

  _getWebPanelData(id) {
    let data = this.sidebarData;
    let panel = data.data[id];
    if (!panel || !panel.url) {
      return {};
    }
    return {
      id: id,
      ...panel,
    };
  },

  _createWebPanelBrowser(data) {
    let tab = gBrowser.addTab(data.url, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    tab.linkedBrowser.setAttribute("disablefullscreen", "true");
    tab.linkedBrowser.setAttribute("src", data.url);
    tab.linkedBrowser.setAttribute("zen-sidebar-id", data.id);
    tab.linkedBrowser.setAttribute("type", "content");
    tab.linkedBrowser.setAttribute("flex", "1");
    tab.linkedBrowser.setAttribute("disableglobalhistory", "true");
    tab.linkedBrowser.setAttribute("autoscroll", "false");
    tab.linkedBrowser.setAttribute("remote", "true");
    tab.linkedBrowser.setAttribute("autocompletepopup", "PopupAutoComplete");
    tab.linkedBrowser.setAttribute("messagemanagergroup", "browsers");
    tab.linkedBrowser.setAttribute("message", "true");
    tab.setAttribute("hidden", "true");
    return tab;
  },

  _getWebPanelIcon(url) {
    return `url(page-icon:${url})`;
  },

  _getCurrentBrowser() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    return sidebar.querySelector(`browser[zen-sidebar-id="${this._currentPanel}"]`);
  },

  reload() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.reload();
    }
  },

  forward() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.goForward();
    }
  },

  back() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.goBack();
    }
  },

  home() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.gotoIndex();
    }
  },

  close() {
    this._hideAllWebPanels();
    this._closeSidebarPanel();
  },

  get sidebarElement() {
    if (!this._sidebarElement) {
      this._sidebarElement = document.getElementById("zen-sidebar-panels-wrapper");
    }
    return this._sidebarElement;
  },
};

gZenBrowserManagerSidebar.init();
