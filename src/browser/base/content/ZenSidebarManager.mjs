


var gZenBrowserManagerSidebar = {
  _sidebarElement: null,
  _currentPanel: null,
  _lastOpenedPanel: null,
  _hasChangedConfig: true,
  _splitterElement: null,
  _hSplitterElement: null,
  _isDragging: false,
  contextTab: null,

  DEFAULT_MOBILE_USER_AGENT: "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 Edg/114.0.1823.79",
  MAX_SIDEBAR_PANELS: 8, // +1 for the add panel button
  MAX_RUNS: 3,

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
    Services.prefs.addObserver("zen.sidebar.floating", this.handleEvent.bind(this));

    let sidebar = document.getElementById("zen-sidebar-web-panel");
    this.splitterElement.addEventListener("mousedown", (function(event) {
      let computedStyle = window.getComputedStyle(sidebar);
      let maxWidth = parseInt(computedStyle.getPropertyValue("max-width").replace("px", ""));
      let minWidth = parseInt(computedStyle.getPropertyValue("min-width").replace("px", ""));

      if (!this._isDragging) { // Prevent multiple resizes
        this._isDragging = true;
        let sidebarWidth = sidebar.getBoundingClientRect().width;
        let startX = event.clientX;
        let startWidth = sidebarWidth;
        let mouseMove = (function(e) {
          let newWidth = startWidth + e.clientX - startX;
          if (newWidth <= minWidth+10) {
            newWidth = minWidth+1;
          } else if (newWidth >= maxWidth-10) {
            newWidth = maxWidth-1;
          }
          sidebar.style.width = `${newWidth}px`;
        });
        let mouseUp = (function() {
          this.handleEvent();
          this._isDragging = false;
          document.removeEventListener("mousemove", mouseMove);
          document.removeEventListener("mouseup", mouseUp);
        }).bind(this);
        document.addEventListener("mousemove", mouseMove);
        document.addEventListener("mouseup", mouseUp);
      }
    }).bind(this));

    this.hSplitterElement.addEventListener("mousedown", (function(event) {
      let computedStyle = window.getComputedStyle(sidebar);
      const parent = sidebar.parentElement;
      // relative to avoid the top margin
      // 20px is the padding
      let parentRelativeHeight = parent.getBoundingClientRect().height - parent.getBoundingClientRect().top + 20;
      let minHeight = parseInt(computedStyle.getPropertyValue("min-height").replace("px", ""));
      if (!this._isDragging) { // Prevent multiple resizes
        this._isDragging = true;
        let sidebarHeight = sidebar.getBoundingClientRect().height;
        let startY = event.clientY;
        let startHeight = sidebarHeight;
        let mouseMove = (function(e) {
          let newHeight = startHeight + e.clientY - startY;
          if (newHeight <= minHeight+10) {
            newHeight = minHeight+1;
          } else if (newHeight >= parentRelativeHeight) { // 10px is the padding
            newHeight = parentRelativeHeight;
          }
          sidebar.style.height = `${newHeight}px`;
        });
        let mouseUp = (function() {
          this.handleEvent();
          this._isDragging = false;
          document.removeEventListener("mousemove", mouseMove);
          document.removeEventListener("mouseup", mouseUp);
        }).bind(this);
        document.addEventListener("mousemove", mouseMove);
        document.addEventListener("mouseup", mouseUp);
      }
    }).bind(this));

    this.handleEvent();
  },

  handleEvent() {
    this._hasChangedConfig = true;
    this.update();
    this._hasChangedConfig = false;

    const button = document.getElementById("zen-sidepanel-button");
    if (Services.prefs.getBoolPref("zen.sidebar.enabled")) {
      button.removeAttribute("hidden");
    } else {
      button.setAttribute("hidden", "true");
      this._closeSidebarPanel();
      return;
    }
  },

  toggle() {
    if (!this._currentPanel) {
      this._currentPanel = this._lastOpenedPanel;
      if (!this._currentPanel) {
        let data = this.sidebarData;
        this._currentPanel = data.index[0];
      }
      this.update();
      return;
    } 
    // already open?
    this.close();
  },

  update() {
    this._updateWebPanels();
    this._updateSidebarButton();
    this._updateWebPanel();
    this._updateButtons();
  },

  _updateSidebarButton() {
    let button = document.getElementById("zen-sidepanel-button");
    if (this._currentPanel) {
      button.setAttribute("open", "true");
    } else {
      button.removeAttribute("open");
    }
  },

  _updateWebPanels() {
    if (Services.prefs.getBoolPref("zen.sidebar.enabled")) {
      this.sidebarElement.removeAttribute("hidden");
    } else {
      this.sidebarElement.setAttribute("hidden", "true");
      this._closeSidebarPanel();
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
    const addButton = document.getElementById("zen-sidebar-add-panel-button");
    if (data.index.length < this.MAX_SIDEBAR_PANELS) {
      addButton.removeAttribute("hidden");
    } else {
      addButton.setAttribute("hidden", "true");
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

  _setPinnedToElements() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    sidebar.setAttribute("pinned", "true");
    document.getElementById("zen-sidebar-web-panel-pinned").setAttribute("pinned", "true");
  },

  _removePinnedFromElements() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    sidebar.removeAttribute("pinned");
    document.getElementById("zen-sidebar-web-panel-pinned").removeAttribute("pinned");
  },

  _openAndGetWebPanelWrapper() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    sidebar.removeAttribute("hidden");
    if (Services.prefs.getBoolPref("zen.sidebar.floating")) {
      this._setPinnedToElements();
    }
    return sidebar;
  },

  _closeSidebarPanel() {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    sidebar.setAttribute("hidden", "true");
    this._lastOpenedPanel = this._currentPanel;
    this._currentPanel = null;
  },

  _handleClick(event) {
    let target = event.target;
    let panelId = target.getAttribute("zen-sidebar-id");
    if (this._currentPanel === panelId) {
      return;
    }
    this._currentPanel = panelId;
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
      browser.docShellIsActive = false;
    }
  },

  _updateWebPanel() {
    this._updateButtons();
    let sidebar = this._openAndGetWebPanelWrapper();
    this._hideAllWebPanels();
    if (!this._currentPanel) {
      sidebar.setAttribute("hidden", "true");
      return;
    }
    let existantWebview = this._getCurrentBrowser();
    if (existantWebview) {
      existantWebview.docShellIsActive = true;
      existantWebview.removeAttribute("hidden");
      document.getElementById("zen-sidebar-web-panel-title").textContent = existantWebview.contentTitle;
      return;
    }
    let data = this._getWebPanelData(this._currentPanel);
    let browser = this._createWebPanelBrowser(data);
    let browserContainers = document.getElementById("zen-sidebar-web-panel-browser-containers");
    browserContainers.appendChild(browser);
    if (data.ua) {
      browser.browsingContext.customUserAgent = this.DEFAULT_MOBILE_USER_AGENT;
    }
    browser.docShellIsActive = true;
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
    const titleContainer = document.getElementById("zen-sidebar-web-panel-title");
    titleContainer.textContent = "Loading...";
    let browser = gBrowser.createBrowser({});
    browser.setAttribute("disablefullscreen", "true");
    browser.setAttribute("src", data.url);
    browser.setAttribute("zen-sidebar-id", data.id);
    browser.setAttribute("disableglobalhistory", "true");
    browser.setAttribute("autoscroll", "false");
    browser.setAttribute("autocompletepopup", "PopupAutoComplete");
    browser.setAttribute("contextmenu", "contentAreaContextMenu");
    browser.setAttribute("disablesecurity", "true");
    browser.addEventListener("pagetitlechanged", (function(event) {
      let browser = event.target;
      let title = browser.contentTitle;
      if (!title) {
        return;
      }
      let id = browser.getAttribute("zen-sidebar-id");
      if (id === this._currentPanel) {
        titleContainer.textContent = title;
      }
    }).bind(this));
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
    this._updateSidebarButton();
  },

  togglePinned(elem) {
    let sidebar = document.getElementById("zen-sidebar-web-panel");
    if (sidebar.hasAttribute("pinned")) {
      this._removePinnedFromElements();
    } else {
      this._setPinnedToElements();
    }
    Services.prefs.setBoolPref("zen.sidebar.floating", sidebar.hasAttribute("pinned"));
    this.update();
  },

  get sidebarElement() {
    if (!this._sidebarElement) {
      this._sidebarElement = document.getElementById("zen-sidebar-panels-sites");
    }
    return this._sidebarElement;
  },

  get splitterElement() {
    if (!this._splitterElement) {
      this._splitterElement = document.getElementById("zen-sidebar-web-panel-splitter");
    }
    return this._splitterElement;
  },

  get hSplitterElement() {
    if (!this._hSplitterElement) {
      this._hSplitterElement = document.getElementById("zen-sidebar-web-panel-hsplitter");
    }
    return this._hSplitterElement;
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

  contextOpenNewTab() {
    let browser = this._getBrowserById(this.contextTab);
    let data = this.sidebarData;
    let panel = data.data[this.contextTab];
    let url = (browser == null) ? panel.url : browser.currentURI.spec;
    let tab = gBrowser.addTrustedTab(url);    
    gBrowser.selectedTab = tab;
        this.close();
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
    if (browser) {
      browser.remove();
    }
    this._closeSidebarPanel();
    Services.prefs.setStringPref("zen.sidebar.data", JSON.stringify(data));
  },

  contextUnload() {
    let browser = this._getBrowserById(this.contextTab);
    browser.remove();
    this._closeSidebarPanel();
  },
};

gZenBrowserManagerSidebar.init();
