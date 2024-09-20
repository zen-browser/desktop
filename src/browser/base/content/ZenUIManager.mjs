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
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    );
  },

  toogleBookmarksSidebar() {
    const button = document.getElementById('zen-bookmark-button');
    SidebarController.toggle('viewBookmarksSidebar', button);
  },

  createValidXULText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};

var gZenVerticalTabsManager = {
  init() {
    var updateEvent = this._updateEvent.bind(this);
    Services.prefs.addObserver('zen.view.sidebar-expanded', updateEvent);
    Services.prefs.addObserver('zen.tabs.vertical.right-side', updateEvent);
    Services.prefs.addObserver('zen.view.sidebar-expanded.max-width', updateEvent);
    Services.prefs.addObserver('zen.view.sidebar-expanded.on-hover', updateEvent);
    this._updateEvent();
    this.initRightSideOrderContextMenu();
  },

  get navigatorToolbox() {
    if (this._navigatorToolbox) {
      return this._navigatorToolbox;
    }
    this._navigatorToolbox = document.getElementById('navigator-toolbox');
    return this._navigatorToolbox;
  },

  _updateOnHoverVerticalTabs() {
    let onHover = Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover');
    let sidebar = this.navigatorToolbox;
    if (onHover) {
      sidebar.setAttribute('zen-user-hover', 'true');
    } else {
      sidebar.removeAttribute('zen-user-hover');
    }
  },

  initRightSideOrderContextMenu() {
    const kConfigKey = 'zen.tabs.vertical.right-side';
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuitem id="zen-toolbar-context-tabs-right"
                type="checkbox"
                ${Services.prefs.getBoolPref(kConfigKey) ? 'checked="true"' : ''}
                data-lazy-l10n-id="zen-toolbar-context-tabs-right"/>
    `);
    fragment.getElementById('zen-toolbar-context-tabs-right').addEventListener('click', () => {
      let rightSide = Services.prefs.getBoolPref(kConfigKey);
      Services.prefs.setBoolPref(kConfigKey, !rightSide);
    });
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
  },

  _updateEvent() {
    this._updateMaxWidth();
    const topButtons = document.getElementById('zen-sidebar-top-buttons');
    const customizationTarget = document.getElementById('nav-bar-customization-target');
    const tabboxWrapper = document.getElementById('zen-tabbox-wrapper');
    const browser = document.getElementById('browser');
    if (Services.prefs.getBoolPref('zen.tabs.vertical.right-side')) {
      this.navigatorToolbox.setAttribute('zen-right-side', 'true');
    } else {
      this.navigatorToolbox.removeAttribute('zen-right-side');
    }
    if (Services.prefs.getBoolPref('zen.view.sidebar-expanded')) {
      this.navigatorToolbox.setAttribute('zen-expanded', 'true');
    } else {
      this.navigatorToolbox.removeAttribute('zen-expanded');
    }

    if (this.navigatorToolbox.hasAttribute('zen-expanded') && !this.navigatorToolbox.hasAttribute('zen-right-side')
      && !Services.prefs.getBoolPref('zen.view.compact') && !Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover')) {
      this.navigatorToolbox.prepend(topButtons);
      browser.prepend(this.navigatorToolbox);
    } else {
      customizationTarget.prepend(topButtons);
      tabboxWrapper.prepend(this.navigatorToolbox);
    }

    // Always move the splitter next to the sidebar
    this.navigatorToolbox.after(document.getElementById('zen-sidebar-splitter'));

    this._updateOnHoverVerticalTabs();
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
    Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', false);
  },
};

var gZenCompactModeManager = {
  _flashSidebarTimeout: null,

  init() {
    Services.prefs.addObserver('zen.view.compact', this._updateEvent.bind(this));
    Services.prefs.addObserver('zen.view.compact.toolbar-flash-popup.duration', this._updatedSidebarFlashDuration.bind(this));
    Services.prefs.addObserver('zen.view.compact.visible-on-mouse-pass-duration', this._updateVisibleOnMousePassDuration.bind(this));
    Services.prefs.addObserver('zen.tabs.vertical.right-side', this._updateSidebarIsOnRight.bind(this));

    addEventListener('popupshowing', this.keepSidebarVisibleOnContextMenu.bind(this));
    this.sidebar.addEventListener('mouseleave', this.keepVisibleOnMousePass.bind(this));
  },

  get prefefence() {
    return Services.prefs.getBoolPref('zen.view.compact');
  },

  set preference(value) {
    Services.prefs.setBoolPref('zen.view.compact', value);
  },

  get sidebar() {
    if (!this._sidebar) {
      this._sidebar= document.getElementById('navigator-toolbox');
    }
    return this._sidebar;
  },

  get sidebarIsOnRight() {
    if (this._sidebarIsOnRight) {
      return this._sidebarIsOnRight;
    }
    return Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
  },

  _updateEvent() {
    Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', false);
  },

  toggle() {
    this.preference = !this.prefefence;
  },

  _updatedSidebarFlashDuration() {
    this._flashSidebarDuration = Services.prefs.getIntPref('zen.view.compact.toolbar-flash-popup.duration');
  },

  _updateSidebarIsOnRight() {
    this._sidebarIsOnRight = Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
  },

  _updateVisibleOnMousePassDuration() {
    this._visibleOnMousePassDuration = Services.prefs.getIntPref('zen.view.compact.visible-on-mouse-pass-duration');
  },

  toggleSidebar() {
    this.sidebar.toggleAttribute('zen-user-show');
  },

  get flashSidebarDuration() {
    if (this._flashSidebarDuration) {
      return this._flashSidebarDuration;
    }
    return Services.prefs.getIntPref('zen.view.compact.toolbar-flash-popup.duration');
  },

  get visibleOnMousePassDuration() {
    if (this._visibleOnMousePassDuration) {
      return this._visibleOnMousePassDuration;
    }
    return this._visibleOnMousePassDuration = Services.prefs.getIntPref('zen.view.compact.visible-on-mouse-pass-duration');
  },

  flashSidebar() {
    let tabPanels = document.getElementById('tabbrowser-tabpanels');
    if (this.sidebar.matches(':hover') || tabPanels.matches("[zen-split-view='true']")) {
      return;
    }
    if (this._flashSidebarTimeout) {
      clearTimeout(this._flashSidebarTimeout);
    } else {
      window.requestAnimationFrame(() => this.sidebar.setAttribute('flash-popup', ''));
    }
    this._flashSidebarTimeout = setTimeout(() => {
      window.requestAnimationFrame(() => {
        this.sidebar.removeAttribute('flash-popup');
        this._flashSidebarTimeout = null;
      });
    }, this.flashSidebarDuration);
  },

  keepSidebarVisibleOnContextMenu(event) {
    if (!this.sidebar.contains(event.explicitOriginalTarget)) {
      return;
    }
    this.sidebar.setAttribute('has-popup-menu', '');
    /* If the cursor is on the popup when it hides, the :hover effect will not be reapplied to the sidebar until the cursor moves,
     to mitigate this: Wait for mousemove when popup item selected
     */
    if (!this.__removeHasPopupAttribute) {
      this.__removeHasPopupAttribute = () => this.sidebar.removeAttribute('has-popup-menu');
    }
    removeEventListener('mousemove', this.__removeHasPopupAttribute);

    const waitForMouseMoveOnPopupSelect = (event) => {
      if (event.target.tagName === 'menuitem') {
        removeEventListener('click', waitForMouseMoveOnPopupSelect);
        removeEventListener('popuphidden', removeHasPopupOnPopupHidden);
        addEventListener('mousemove', this.__removeHasPopupAttribute, {once: true});
      }
    }
    const removeHasPopupOnPopupHidden = (hiddenEvent) => {
      if (event.target === hiddenEvent.target) {
        removeEventListener('click', waitForMouseMoveOnPopupSelect);
        removeEventListener('popuphidden', removeHasPopupOnPopupHidden);
        this.__removeHasPopupAttribute();
      }
    }
    addEventListener('click', waitForMouseMoveOnPopupSelect);
    addEventListener('popuphidden', removeHasPopupOnPopupHidden);
  },

  keepVisibleOnMousePass(event) {
    const errorMargin = 21;
    const mousePassedSidebarSide =
      this.sidebarIsOnRight ? (event.pageX >= document.body.getBoundingClientRect().right - errorMargin) : (event.pageX <= errorMargin);

    if (mousePassedSidebarSide) {
      this.sidebar.setAttribute('mouse-passed', '');
      addEventListener('mousemove', () => {
        this.sidebar.removeAttribute('mouse-passed');
        clearTimeout(this._visibleOnMousePassTimeout)
      }, {once: true});
      this._visibleOnMousePassTimeout = setTimeout(
        () => this.sidebar.removeAttribute('mouse-passed')
      , this.visibleOnMousePassDuration);
    }
  },

  toggleToolbar() {
    let toolbar = document.getElementById('zen-appcontent-navbar-container');
    toolbar.toggleAttribute('zen-user-show');
  },
};
