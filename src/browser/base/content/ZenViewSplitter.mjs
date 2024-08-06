
var gZenViewSplitter = {
  init() {
    this.initializeUI();
    console.log(gZenSplitViewsBase)
  },

  initializeUI() {
    this.initializeUpdateContextMenuItems();
    this.initializeTabContextMenu();
  },

  initializeTabContextMenu() {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuseparator/>
      <menuitem id="context_zenSplitTabs"
                data-lazy-l10n-id="tab-zen-split-tabs"
                oncommand="gZenViewSplitter.contextSplitTabs();"/>
    `);
    document.getElementById("tabContextMenu").appendChild(fragment);
  },

  initializeUpdateContextMenuItems() {
    const contentAreaContextMenu = document.getElementById("tabContextMenu");
    const tabCountInfo = JSON.stringify({
      tabCount:
        (window.gContextMenu?.contextTab.multiselected &&
          window.gBrowser.multiSelectedTabsCount) ||
        1,
    });

    contentAreaContextMenu.addEventListener("popupshowing", () => {
      document
        .getElementById("context_zenSplitTabs")
        .setAttribute("data-l10n-args", tabCountInfo);
      document.getElementById("context_zenSplitTabs").disabled =
        !this.contextCanSplitTabs();
    });
  },

  onLocationChange(browser) {
    gZenSplitViewsBase.onLocationChange(browser);
  },

  async openSplitViewPanel(event) {
    let panel = this._modifierElement;
    let target = event.target.parentNode;
    for (const gridType of ['horizontal', 'vertical', 'grid', 'unsplit']) {
      let selector = panel.querySelector(`.zen-split-view-modifier-preview.${gridType}`);
      selector.classList.remove("active");
      if (gZenSplitViewsBase.getActiveViewType() === gridType) {
        selector.classList.add("active");
      }
      if (this.__hasSetMenuListener) {
        continue;
      }
      selector.addEventListener("click", ((gridType) => {
        // TODO: Implement the split view
        panel.hidePopup();
      }).bind(this, gridType));
    } 
    this.__hasSetMenuListener = true;
    PanelMultiView.openPopup(panel, target, {
      position: "bottomright topright",
      triggerEvent: event,
    }).catch(console.error);
  },

  contextCanSplitTabs() {
    let tabs = window.gBrowser.selectedTabs;
    if (tabs.length < 2) {
      return false;
    }
    // Check if there are 2 tabs in different groups
    // Or if all the selected tabs are in the same group
    let group = gZenSplitViewsBase.getTabView(tabs[0]);
    for (let i = 1; i < tabs.length; i++) {
      // Check if they are not in the same group, but we do allow
      // if they are ungrouped
      let tabGroup = gZenSplitViewsBase.getTabView(tabs[i]);
      if (tabGroup === -1) {
        continue;
      }
      if (group !== tabGroup) {
        return false;
      }
    }
    return true;
  },

  contextSplitTabs() {
    let selectedTabs = gBrowser.selectedTabs;
    
  },
};

gZenViewSplitter.init();
