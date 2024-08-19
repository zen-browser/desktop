
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
    Services.prefs.addObserver('zen.view.sidebar-expanded.on-hover', this._updateOnHoverVerticalTabs.bind(this));
    this._updateMaxWidth();
    this._updateOnHoverVerticalTabs();
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

  _updateOnHoverVerticalTabs() {
    const active = Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover');
    const toolbox = document.getElementById('navigator-toolbox');
    // Use 'var' to avoid garbage collection so we can remove the listener later
    var listener = this._onHoverVerticalTabs.bind(this);
    var listenerOut = this._onBlurVerticalTabs.bind(this);
    if (active) {
      toolbox.addEventListener('mouseover', listener);
      toolbox.addEventListener('mouseout', listenerOut);
    } else {
      toolbox.removeEventListener('mouseover', listener);
      toolbox.removeEventListener('mouseout', listenerOut);
    }
  },

  get navigatorToolbox() {
    if (this._navigatorToolbox) {
      return this._navigatorToolbox;
    }
    this._navigatorToolbox = document.getElementById('navigator-toolbox');
    return this._navigatorToolbox;
  },

  _onHoverVerticalTabs(event) {
    const target = event.target;
    const isCompactMode = Services.prefs.getBoolPref('zen.view.compact');
    const isToolbar = target.id === 'navigator-toolbox' 
      || target.closest('#navigator-toolbox');
    if (isToolbar && !isCompactMode && !this.navigatorToolbox.hasAttribute('zen-user-show')) {
      this.navigatorToolbox.setAttribute('zen-user-show', 'true');
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', true);
    }
  },

  _onBlurVerticalTabs(event) {
    const target = event.target;
    const isToolbar = target.id === 'navigator-toolbox'
      || target.closest('#navigator-toolbox');
    if (isToolbar && this.navigatorToolbox.hasAttribute('zen-user-show')) {
      this.navigatorToolbox.removeAttribute('zen-user-show');
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', false);
    }
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

var gZenCompactModeManager = {
  init() {
  },

  get prefefence() {
    return Services.prefs.getBoolPref('zen.view.compact');
  },

  set preference(value) {
    Services.prefs.setBoolPref('zen.view.compact', value);
  },

  toggle() {
    this.preference = !this.prefefence;
  },

  toggleSidebar() {
    let sidebar = document.getElementById('navigator-toolbox');
    sidebar.toggleAttribute('zen-user-show');
  },

  toggleToolbar() {
    let toolbar = document.getElementById('zen-appcontent-navbar-container');
    toolbar.toggleAttribute('zen-user-show');
  }
};
