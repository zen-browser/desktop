
var gZenViewSplitter = {
  /**
   * [ 
   *   {
   *     view: <element>,
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
    return;
    window.addEventListener("TabClose", this);
    window.addEventListener("TabChange", this);
  },

  handleEvent(event) {
    switch (event.type) {
      case "TabClose":
        this.onTabClose(event);
        break;
      case "TabChange":
        this.onTabChange(event);
        break;
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

  onTabChange(event) {
    const tab = event.target;
    this._showSplitView(tab);
  },

  splitTabs(tabs) {
    if (tabs.length < 2) {
      return;
    }
    let gridElement = document.createElement("div");
    gridElement.classList.add("zen-deck");
    tabs.forEach((tab) => {
      let container = tab.linkedBrowser.closest(".browserContainer");
      gridElement.appendChild(container);
    });
    this.tabBrowserPanel.appendChild(gridElement);
    this._data.push({
      tabs,
      element: gridElement,
    });
    this._showSplitView(tabs[0]);
  },

  _showSplitView(tab) {
    if (this.currentView !== -1) {
      this._data[this.currentView].element.classList.remove("deck-selected");
      for (const tab of this._data[this.currentView].tabs) {
        tab._zenSplitted = false;
        let container = tab.linkedBrowser.closest(".browserSidebarContainer");
        console.assert(container, "No container found for tab");
        container.classList.remove("deck-selected");
        container.removeAttribute("zen-split");
      }
    }
    const splitData = this._data.find((group) => group.tabs.includes(tab));
    console.log(splitData)
    if (!splitData) {
      return;
    }
    this.currentView = this._data.indexOf(splitData);
    splitData.element.classList.add("deck-selected");
    for (const tab of splitData.tabs) {
      tab._zenSplitted = true;
      let container = tab.linkedBrowser.closest(".browserSidebarContainer");
      console.assert(container, "No container found for tab");
      container.classList.add("deck-selected");
      container.setAttribute("zen-split", "true");
    }
    if (splitData.tabs.length < 2) {
      let tab = splitData.tabs[0];
      tab._zenSplitted = false;
      let container = tab.linkedBrowser.closest(".browserSidebarContainer");
      console.assert(container, "No container found for tab");
      this.tabBrowserPanel.appendChild(container);
      splitData.element.remove();
    }
  },
};

gZenViewSplitter.init();
