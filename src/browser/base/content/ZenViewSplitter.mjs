
var gZenViewSplitter = {
  /**
   * [ 
   *   {
   *     tabs: [
   *      tab1,
   *      tab2,
   *      tab3,
   *     ],
   *    gridType: "vsplit" | "hsplit" | "grid",
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
    let index = this._data.findIndex((group) => group.tabs.includes(tab));
    if (index < 0) {
      return;
    }
    let dataTab = this._data[index].tabs;
    dataTab.splice(dataTab.indexOf(tab), 1);
    tab._zenSplitted = false;
    tab.linkedBrowser.zenModeActive = false;
    tab.linkedBrowser.docShellIsActive = false;
    if (dataTab.length < 2) {
      this._data.splice(index, 1);
      if (this.currentView == index) {
        this.currentView = -1;
        this.tabBrowserPanel.removeAttribute("zen-split-view");
        Services.prefs.setBoolPref("zen.splitView.working", false);
      }
      return;
    }
    this._showSplitView(tab);
  },

  onLocationChange(browser) {
    let tab = gBrowser.getTabForBrowser(browser);
    if (!tab) {
      return;
    }

    this._showSplitView(tab);
  },

  splitTabs(tabs) {
    if (tabs.length < 2) {
      return;
    }
    this._data.push({
      tabs,
    });
    gBrowser.selectedTab = tabs[0];
    this._showSplitView(tabs[0]);
  },

  _showSplitView(tab) {
    const splitData = this._data.find((group) => group.tabs.includes(tab));
    function modifyDecks(tabs, add) {
      for (const tab of tabs) {
        tab.linkedBrowser.zenModeActive = add;
        tab.linkedBrowser.docShellIsActive = add;
        let browser = tab.linkedBrowser.closest(".browserSidebarContainer");
        if (add) {
          browser.setAttribute("zen-split", "true");
          continue;
        }
        browser.removeAttribute("zen-split");
      }
    }
    const handleClick = (tab) => {
      return ((event) => {
        gBrowser.selectedTab = tab;
      })
    };    
    if (!splitData || (this.currentView >= 0 && !this._data[this.currentView].tabs.includes(tab))) {
      if (this.currentView < 0) {
        return;
      }
      for (const tab of this._data[this.currentView].tabs) {
        //tab._zenSplitted = false;
        let container = tab.linkedBrowser.closest(".browserSidebarContainer");
        container.removeAttribute("zen-split-active");
        container.classList.remove("deck-selected");
        console.assert(container, "No container found for tab");
        container.removeEventListener("click", handleClick(tab));
        container.style.gridArea = "";
      }
      this.tabBrowserPanel.removeAttribute("zen-split-view");
      //this.tabBrowserPanel.style.gridTemplateAreas = "";
      Services.prefs.setBoolPref("zen.splitView.working", false);
      modifyDecks(this._data[this.currentView].tabs, false);
      this.currentView = -1;
      if (!splitData) {
        return;
      }
    }
    this.tabBrowserPanel.setAttribute("zen-split-view", "true");
    Services.prefs.setBoolPref("zen.splitView.working", true);
    this.currentView = this._data.indexOf(splitData);
    let gridType = splitData.gridType || "grid"; // TODO: let user decide the grid type
    let i = 0;
    // 2 rows, infinite columns
    let currentRowGridArea = ["", ""/* first row, second row */];
    let numberOfRows = 0;
    for (const _tab of splitData.tabs) {
      _tab._zenSplitted = true;
      let container = _tab.linkedBrowser.closest(".browserSidebarContainer");
      console.assert(container, "No container found for tab");
      container.removeAttribute("zen-split-active");
      if (_tab == tab) {
        container.setAttribute("zen-split-active", "true");
      }
      container.setAttribute("zen-split-anim", "true");
      container.addEventListener("click", handleClick(_tab));
      // Set the grid type for the container. If the grid type is not "grid", then set the grid type contain 
      // each column or row. If it's "grid", then try to create
      if (gridType == "grid") {
        // Each 2 tabs, create a new row
        if (i % 2 == 0) {
          currentRowGridArea[0] += ` tab${i + 1}`;
        } else {
          currentRowGridArea[1] += ` tab${i + 1}`;
          numberOfRows++;
        }
        container.style.gridArea = `tab${i + 1}`;
      }
      i++;
    }
    if (gridType == "grid") {
      if (numberOfRows < splitData.tabs.length / 2) {
        // Make the last tab occupy the last row
        currentRowGridArea[1] += ` tab${i}`;
      }
      this.tabBrowserPanel.style.gridTemplateAreas = `'${currentRowGridArea[0]}' '${currentRowGridArea[1]}'`;
    }
    modifyDecks(splitData.tabs, true);
  },

  contextSplitTabs() {
    let tabs = gBrowser.selectedTabs;
    this.splitTabs(tabs);
  },

  contextCanSplitTabs() {
    if (gBrowser.selectedTabs.length < 2) {
      return false;
    }
    // Check if any tab is already split
    for (const tab of gBrowser.selectedTabs) {
      if (tab._zenSplitted) {
        return false;
      }
    }
    return true;
  },
};

gZenViewSplitter.init();
