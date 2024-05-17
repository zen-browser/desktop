
var gZenViewSplitter = {
  /**
   * [ 
   *   {
   *     tabs: [
   *      tab1,
   *      tab2,
   *      tab3,
   *     ]
   *   }
   * ]
   */
  _data: [],
  currentView: -1,

  init() {
    Services.prefs.setBoolPref("zen.splitView.working", false);
    window.addEventListener("TabClose", this);
    console.log("ZenViewSplitter initialized");
  },

  handleEvent(event) {
    switch (event.type) {
      case "TabClose":
        this.onTabClose(event);
    }
  },

  get tabBrowserPanel() {
    if (!this._tabBrowserPanel) {
      this._tabBrowserPanel = document.getElementById("tabbrowser-tabpanels");
    }
    return this._tabBrowserPanel;
  },

  onTabClose(event) {
    const tab = event.target;
    let index = -2;
    while (index !== -1) {
      index = this._data.findIndex((group) => group.tabs.includes(tab));
      if (index !== -1) {
        this._data[index].tabs.splice(this._data[index].tabs.indexOf(tab), 1);
        if (this._data[index].tabs.length < 2) {
          this._data.tabs.splice(index, 1);
        }
      }
    }
    this._showSplitView(tab);
  },

  onLocationChange(browser) {
    if (!Services.prefs.getBoolPref("zen.splitView.working")) {
      return;
    }
    let tab = gBrowser.getTabForBrowser(browser);
    if (!tab) {
      return;
    }
    if (tab._zenSplitted) {
      this._showSplitView(tab);
    }
  },

  splitTabs(tabs) {
    if (tabs.length < 2) {
      return;
    }
    this._data.push({
      tabs,
    });
    this._showSplitView(tabs[0]);
  },

  _showSplitView(tab) {
    const splitData = this._data.find((group) => group.tabs.includes(tab));
    function modifyDecks(tabs, add) {
      for (const tab of tabs) {
        if (tab.linkedBrowser.docShellIsActive !== add) {
          tab.linkedBrowser.docShellIsActive = add;
        }
        let browser = tab.linkedBrowser.closest(".browserSidebarContainer");
        if (add) {
          browser.classList.add("deck-selected");
          continue;
        }
        browser.classList.remove("deck-selected");
      }
      setTimeout((() => {
        modifyDecks(tabs, add);
      }).bind(tabs, add), 300);
    }
    const handleClick = (tab) => {
      return ((event) => {
        gBrowser.selectedTab = tab;
      })
    };
    if (!splitData) {
      if (this.currentView < 0) {
        return;
      }
      for (const tab of this._data[this.currentView].tabs) {
        tab._zenSplitted = false;
        let container = tab.linkedBrowser.closest(".browserSidebarContainer");
        container.removeAttribute("zen-split-active");
        console.assert(container, "No container found for tab");
        container.removeAttribute("zen-split");
        container.removeEventListener("click", handleClick(tab));
      }
      this.tabBrowserPanel.removeAttribute("zen-split-view");
      Services.prefs.setBoolPref("zen.splitView.working", false);
      modifyDecks(this._data[this.currentView].tabs, false);
      this.currentView = -1;
      return;
    }
    this.tabBrowserPanel.setAttribute("zen-split-view", "true");
    Services.prefs.setBoolPref("zen.splitView.working", true);
    this.currentView = this._data.indexOf(splitData);
    for (const _tab of splitData.tabs) {
      _tab._zenSplitted = true;
      let container = _tab.linkedBrowser.closest(".browserSidebarContainer");
      container.removeAttribute("zen-split-active");
      if (_tab == tab) {
        container.setAttribute("zen-split-active", "true");
      }
      container.addEventListener("click", handleClick(_tab));
      console.assert(container, "No container found for tab");
      container.setAttribute("zen-split", "true");
    }
    modifyDecks(splitData.tabs, true);
  },
};

gZenViewSplitter.init();
