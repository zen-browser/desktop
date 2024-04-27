
export var gZenBrowserManagerSidebar = {
  _sidebarElement: null,
  _currentPanel: null,
  contextTab: null,

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
    this.sidebarElement.innerHTML = "";
    for (let site of data.index) {
      let panel = data.data[site];
      if (!panel || !panel.url) {
        continue;
      }
      let button = document.createXULElement("toolbarbutton");
      button.classList.add("zen-sidebar-panel-button", "toolbarbutton-1", "chromeclass-toolbar-additional");
      button.setAttribute("flex", "1");
      button.setAttribute("zen-sidebar-id", site);
      button.setAttribute("context", "zenWebPanelContextMenu");
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
      browser.browsingContext.isActive = false;
    }
  },

  _updateWebPanel() {
    let sidebar = this._openAndGetWebPanelWrapper();
    this._hideAllWebPanels();
    let existantWebview = sidebar.querySelector(`browser[zen-sidebar-id="${this._currentPanel}"]`);
    if (existantWebview) {
      existantWebview.browsingContext.isActive = true;
      existantWebview.removeAttribute("hidden");
      return;
    }
    let data = this._getWebPanelData(this._currentPanel);
    let browser = this._createWebPanelBrowser(data);
    let browserContainers = document.getElementById("zen-sidebar-web-panel-browser-containers");
    browserContainers.appendChild(browser.linkedBrowser.closest(".browserContainer"));
    if (data.ua) {
      browser.linkedBrowser.browsingContext.customUserAgent = this.DEFAULT_MOBILE_USER_AGENT;
    }
    browser.linkedBrowser.browsingContext.isActive = true;
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
      insertTab: false,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    tab.linkedBrowser.setAttribute("disablefullscreen", "true");
    tab.linkedBrowser.setAttribute("src", data.url);
    tab.linkedBrowser.setAttribute("zen-sidebar-id", data.id);
    tab.linkedBrowser.setAttribute("disableglobalhistory", "true");
    tab.linkedBrowser.setAttribute("autoscroll", "false");
    tab.linkedBrowser.setAttribute("autocompletepopup", "PopupAutoComplete");
    tab.linkedBrowser.setAttribute("contextmenu", "contentAreaContextMenu");
    return tab;
  },

  _getWebPanelIcon(url) {
    return `url(page-icon:${url})`;
  },

  _getBrowserById(id) {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    return sidebar.querySelector(`browser[zen-sidebar-id="${id}"]`);
  },

  _getCurrentBrowser() {
    return this._getBrowserById(this._currentPanel);
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

  // Context menu

  updateContextMenu(aPopupMenu) {
    let panel =
      aPopupMenu.triggerNode &&
      (aPopupMenu.triggerNode || aPopupMenu.triggerNode.closest("toolbarbutton[zen-sidebar-id]"));
    if (!panel) {
      return;
    }
    let id = panel.getAttribute("zen-sidebar-id");
    this.contextTab = id;
    let data = this._getWebPanelData(id);
    let browser = this._getBrowserById(id);
    let isMuted = browser && browser.audioMuted;
    let mutedContextItem = document.getElementById("context_zenToggleMuteWebPanel");
    document.l10n.setAttributes(mutedContextItem, 
      !isMuted ? "zen-web-side-panel-context-mute-panel" : "zen-web-side-panel-context-unmute-panel");
    if (!isMuted) {
      mutedContextItem.setAttribute("muted", "true");
    } else {
      mutedContextItem.removeAttribute("muted");
    }
    document.l10n.setAttributes(document.getElementById("context_zenToogleUAWebPanel"), 
      data.ua ? "zen-web-side-panel-context-disable-ua" : "zen-web-side-panel-context-enable-ua");
    if (!browser) {
      document.getElementById("context_zenUnloadWebPanel").setAttribute("disabled", "true");
    } else {
      document.getElementById("context_zenUnloadWebPanel").removeAttribute("disabled");
    }
  },

  contextToggleMuteAudio() {
    let browser = this._getBrowserById(this.contextTab);
    if (browser.audioMuted) {
      browser.unmute();
    } else {
      browser.mute();
    }
  },

  contextToggleUserAgent() {
    let browser = this._getBrowserById(this.contextTab);
    browser.browsingContext.customUserAgent = browser.browsingContext.customUserAgent ? null : this.DEFAULT_MOBILE_USER_AGENT;
    let data = this.sidebarData;
    data.data[this.contextTab].ua = !data.data[this.contextTab].ua;
    Services.prefs.setStringPref("zen.sidebar.data", JSON.stringify(data));
    browser.reload();
  },

  contextDelete() {
    let data = this.sidebarData;
    delete data.data[this.contextTab];
    data.index = data.index.filter(id => id !== this.contextTab);
    Services.prefs.setStringPref("zen.sidebar.data", JSON.stringify(data));
    this._updateWebPanels();
    let browser = this._getBrowserById(this.contextTab);
    browser.remove();
    this._closeSidebarPanel();
  },

  contextUnload() {
    let browser = this._getBrowserById(this.contextTab);
    browser.remove();
    this._closeSidebarPanel();
  },
};

gZenBrowserManagerSidebar.init();
