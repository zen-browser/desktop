
var gZenViewSplitter = {
  /**
   * [
   *  [
   *   tab1,
   *   tab2,
   *   tab3,
   *  ]
   * ]
   */
  _data: [],

  init() {
    return; // TODO: Fix this please
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

  onTabClose(event) {
    const tab = event.target;
    let index = -2;
    while (index !== -1) {
      index = this._data.findIndex((group) => group.includes(tabId));
      if (index !== -1) {
        this._data[index].splice(this._data[index].indexOf(tabId), 1);
        if (this._data[index].length < 2) {
          this._data.splice(index, 1);
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
    this._data.push(tabs);
    this._showSplitView(tabs[0]);
  },

  _showSplitView(tab) {
    const splitData = this._data.find((group) => group.includes(tab));
    console.log(splitData)
    if (!splitData) {
      return;
    }
    for (const tab of splitData) {
      tab._zenSplitted = true;
      let container = tab.linkedBrowser.closest(".browserSidebarContainer");
      console.assert(container, "No container found for tab");
      container.classList.add("deck-selected");
      container.setAttribute("zen-split", "true");
    }
  },
};

gZenViewSplitter.init();
