
var gZenUIManager = {
  openAndChangeToTab(url, options) {
    if (window.ownerGlobal.parent) {
      let tab = window.ownerGlobal.parent.gBrowser.addTrustedTab(url, options);
      window.ownerGlobal.parent.gBrowser.selectedTab = tab;
      return tab;
    }
    let tab = window.gBrowser.addTrustedTab(url, options);
    window.gBrowser.selectedTab = tab;
    return tab;
  },

  generateUuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
  },
  
  toogleBookmarksSidebar() {
    const button = document.getElementById('zen-bookmark-button');
    SidebarController.toggle('viewBookmarksSidebar', button);
  },
};

var gZenVerticalTabsManager = {
  init() {
    //Services.prefs.addObserver('zen.view.compact', this._updateEvent.bind(this));
    Services.prefs.addObserver('zen.view.sidebar-expanded', this._updateEvent.bind(this));
    Services.prefs.addObserver('zen.view.sidebar-expanded.max-width', this._updateEvent.bind(this));
    this._updateMaxWidth();
    this.initRightSideOrderContextMenu();
  },

  initRightSideOrderContextMenu() {
    const kConfigKey = 'zen.tabs.vertical.right-side';
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuitem id="zen-toolbar-context-tabs-right"
                type="checkbox"
                ${Services.prefs.getBoolPref(kConfigKey) ? 'checked="true"' : ''}
                data-lazy-l10n-id="zen-toolbar-context-tabs-right"/>
    `);
    fragment.getElementById("zen-toolbar-context-tabs-right").addEventListener('click', () => {
      let rightSide = Services.prefs.getBoolPref(kConfigKey);
      Services.prefs.setBoolPref(kConfigKey, !rightSide);
    });
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
  },

  _updateEvent() {
    this._updateMaxWidth();
  },

  _updateMaxWidth() {
    let isCompactMode = Services.prefs.getBoolPref('zen.view.compact');
    let expanded = this.expanded;
    let maxWidth = Services.prefs.getIntPref('zen.view.sidebar-expanded.max-width');
    let toolbox = document.getElementById('navigator-toolbox');
    if (expanded && !isCompactMode) {
      toolbox.style.maxWidth = `${maxWidth}px`;
    } else {
      toolbox.style.removeProperty('maxWidth');
    }
  },

  get expanded() {
    return Services.prefs.getBoolPref('zen.view.sidebar-expanded');
  },

  get expandButton() {
    if (this._expandButton) {
      return this._expandButton;
    }
    this._expandButton = document.getElementById('zen-expand-sidebar-button');
    return this._expandButton;
  },

  //_updateExpandButton() {
  //  let isCompactMode = Services.prefs.getBoolPref('zen.view.compact');
  //  let button = this.expandButton;
  //  let expanded = this.expanded;
  //  if (expanded && !isCompactMode) {
  //    button.setAttribute('open', 'true');
  //  } else {
  //    button.removeAttribute('open');
  //  }
  //},

  toggleExpand() {
    let expanded = !this.expanded;
    Services.prefs.setBoolPref('zen.view.sidebar-expanded', expanded);
  },
};
