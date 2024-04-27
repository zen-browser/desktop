
export var gZenBrowserManagerSidebar = {
  _sidebarElement: null,
  _currentPanel: null,
  _hasRegisteredPinnedClickOutside: false,
  contextTab: null,

  DEFAULT_MOBILE_USER_AGENT: "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 Edg/114.0.1823.79",
  MAX_SIDEBAR_PANELS: 8, // +1 for the add panel button

  init() {
    this.update();
    this.close(); // avoid caching
    this.listenForPrefChanges();
  },

  get sidebarData() {
    let services = Services.prefs.getStringPref("zen.sidebar.data");
    if (services === "") {
      return {};
    }
    return JSON.parse(services);
  },

  listenForPrefChanges() {
    Services.prefs.addObserver("zen.sidebar.data", this.handleEvent.bind(this));
    Services.prefs.addObserver("zen.sidebar.enabled", this.handleEvent.bind(this));
    Services.prefs.addObserver("zen.sidebar.pinned", this.handleEvent.bind(this));
  },

  handleEvent() {
    this.update();

    if (Services.prefs.getBoolPref("zen.sidebar.pinned") && !this._hasRegisteredPinnedClickOutside) {
      document.addEventListener("mouseup", this._handleClickOutside.bind(this));
      this._hasRegisteredPinnedClickOutside = true;
    } else {
      document.removeEventListener("mouseup", this._handleClickOutside.bind(this));
      this._hasRegisteredPinnedClickOutside = false;
    }
  },

  _handleClickOutside(event) {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    if (!sidebar.hasAttribute("pinned") || !this._currentPanel) {
      return;
    }
    let target = event.target;
    if (target.closest("#zen-sidebar-web-panel") || target.closest("#zen-sidebar-panels-wrapper")) {
      return;
    }
    this.close();
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
      this._getWebPanelIcon(panel.url, button);
      button.addEventListener("click", this._handleClick.bind(this));
      this.sidebarElement.appendChild(button);
    }
    if (data.index.length < this.MAX_SIDEBAR_PANELS) {
      this.sidebarElement.appendChild(document.createXULElement("toolbarseparator"));
      let addPanelButton = document.createXULElement("toolbarbutton");
      addPanelButton.id = "zen-sidebar-add-panel-button";
      addPanelButton.classList.add("zen-sidebar-panel-button", "toolbarbutton-1", "chromeclass-toolbar-additional");
      addPanelButton.addEventListener("click", this._openAddPanelDialog.bind(this));
      this.sidebarElement.appendChild(addPanelButton);
    }
  },

  async _openAddPanelDialog() {
    let dialogURL = "chrome://browser/content/places/zenNewWebPanel.xhtml";
    let features = "centerscreen,chrome,modal,resizable=no";
    let aParentWindow = Services.wm.getMostRecentWindow("navigator:browser");

    if (aParentWindow?.gDialogBox) {
      await aParentWindow.gDialogBox.open(dialogURL, {});
    } else {
      aParentWindow.openDialog(dialogURL, "", features, {});
    }
  },

  _openAndGetWebPanelWrapper() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    sidebar.removeAttribute("hidden");
    if (Services.prefs.getBoolPref("zen.sidebar.pinned")) {
      sidebar.setAttribute("pinned", "true");
      document.getElementById("zen-sidebar-web-panel-pinned").setAttribute("pinned", "true");
    }
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
    browserContainers.appendChild(browser);
    if (data.ua) {
      browser.browsingContext.customUserAgent = this.DEFAULT_MOBILE_USER_AGENT;
    }
    browser.browsingContext.isActive = true;
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
    let browser = gBrowser.createBrowser({});
    browser.setAttribute("disablefullscreen", "true");
    browser.setAttribute("src", data.url);
    browser.setAttribute("zen-sidebar-id", data.id);
    browser.setAttribute("disableglobalhistory", "true");
    browser.setAttribute("autoscroll", "false");
    browser.setAttribute("autocompletepopup", "PopupAutoComplete");
    browser.setAttribute("contextmenu", "contentAreaContextMenu");
    return browser;
  },

  _getWebPanelIcon(url, element) {
    let { preferredURI } = Services.uriFixup.getFixupURIInfo(url);
    element.setAttribute("image", `page-icon:${preferredURI.spec}`);
    fetch(`https://s2.googleusercontent.com/s2/favicons?domain_url=${preferredURI.spec}`).then(async response => {
      if (response.ok) {
        let blob = await response.blob();
        let reader = new FileReader();
        reader.onload = function() {
          element.setAttribute("image", reader.result);
        };
        reader.readAsDataURL(blob);
      }
    });
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

  togglePinned(elem) {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    if (sidebar.hasAttribute("pinned")) {
      sidebar.removeAttribute("pinned");
    } else {
      sidebar.setAttribute("pinned", "true");
    }
    if (sidebar.hasAttribute("pinned")) {
      elem.setAttribute("pinned", "true");
    } else {
      elem.removeAttribute("pinned");
    }
    Services.prefs.setBoolPref("zen.sidebar.pinned", sidebar.hasAttribute("pinned"));
    this.update();
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
    let browser = this._getBrowserById(this.contextTab);
    browser.remove();
    this._closeSidebarPanel();
    Services.prefs.setStringPref("zen.sidebar.data", JSON.stringify(data));
  },

  contextUnload() {
    let browser = this._getBrowserById(this.contextTab);
    browser.remove();
    this._closeSidebarPanel();
  },
};
