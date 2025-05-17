var gZenUIManager = {
  _popupTrackingElements: [],
  _hoverPausedForExpand: false,
  _hasLoadedDOM: false,
  testingEnabled: Services.prefs.getBoolPref('zen.testing.enabled', false),

  _toastTimeouts: [],

  init() {
    document.addEventListener('popupshowing', this.onPopupShowing.bind(this));
    document.addEventListener('popuphidden', this.onPopupHidden.bind(this));
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'sidebarHeightThrottle',
      'zen.view.sidebar-height-throttle',
      500
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'contentElementSeparation',
      'zen.theme.content-element-separation',
      0
    );
    XPCOMUtils.defineLazyPreferenceGetter(this, 'urlbarWaitToClear', 'zen.urlbar.wait-to-clear', 0);
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'urlbarShowDomainOnly',
      'zen.urlbar.show-domain-only-in-sidebar',
      true
    );

    gURLBar._zenTrimURL = this.urlbarTrim.bind(this);

    ChromeUtils.defineLazyGetter(this, 'motion', () => {
      return ChromeUtils.importESModule('chrome://browser/content/zen-vendor/motion.min.mjs', {
        global: 'current',
      });
    });

    ChromeUtils.defineLazyGetter(this, '_toastContainer', () => {
      return document.getElementById('zen-toast-container');
    });

    new ResizeObserver(this.updateTabsToolbar.bind(this)).observe(
      document.getElementById('TabsToolbar')
    );

    new ResizeObserver(
      gZenCommonActions.throttle(
        gZenCompactModeManager.getAndApplySidebarWidth.bind(gZenCompactModeManager),
        this.sidebarHeightThrottle
      )
    ).observe(gNavToolbox);

    SessionStore.promiseAllWindowsRestored.then(() => {
      this._hasLoadedDOM = true;
      this.updateTabsToolbar();
    });

    window.addEventListener('TabClose', this.onTabClose.bind(this));
    this.tabsWrapper.addEventListener('scroll', this.saveScrollbarState.bind(this));

    gZenMediaController.init();
  },

  updateTabsToolbar() {
    const kUrlbarHeight = 440;
    gURLBar.textbox.style.setProperty(
      '--zen-urlbar-top',
      `${window.innerHeight / 2 - Math.max(kUrlbarHeight, gURLBar.textbox.getBoundingClientRect().height) / 2}px`
    );
    gZenVerticalTabsManager.actualWindowButtons.removeAttribute('zen-has-hover');
    gZenVerticalTabsManager.recalculateURLBarHeight();
    setTimeout(gURLBar.formatValue.bind(gURLBar), 350);
    if (!this._preventToolbarRebuild) {
      setTimeout(() => {
        gZenWorkspaces.updateTabsContainers();
      }, 0);
    }
    delete this._preventToolbarRebuild;
  },

  get tabsWrapper() {
    if (this._tabsWrapper) {
      return this._tabsWrapper;
    }
    this._tabsWrapper = document.getElementById('zen-tabs-wrapper');
    return this._tabsWrapper;
  },

  saveScrollbarState() {
    this._scrollbarState = this.tabsWrapper.scrollTop;
  },

  restoreScrollbarState() {
    this.tabsWrapper.scrollTop = this._scrollbarState;
  },

  onTabClose(event = undefined) {
    if (!event?.target?._closedInMultiselection) {
      this.updateTabsToolbar();
      this.restoreScrollbarState();
    }
  },

  onFloatingURLBarOpen() {
    requestAnimationFrame(() => {
      this.updateTabsToolbar();
    });
  },

  openAndChangeToTab(url, options) {
    if (window.ownerGlobal.parent) {
      const tab = window.ownerGlobal.parent.gBrowser.addTrustedTab(url, options);
      window.ownerGlobal.parent.gBrowser.selectedTab = tab;
      return tab;
    }
    const tab = window.gBrowser.addTrustedTab(url, options);
    window.gBrowser.selectedTab = tab;
    return tab;
  },

  generateUuidv4() {
    return Services.uuid.generateUUID().toString();
  },

  toogleBookmarksSidebar() {
    const button = document.getElementById('zen-bookmark-button');
    SidebarController.toggle('viewBookmarksSidebar', button);
  },

  createValidXULText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  /**
   * Adds the 'has-popup-menu' attribute to the element when popup is opened on it.
   * @param element element to track
   */
  addPopupTrackingAttribute(element) {
    this._popupTrackingElements.push(element);
  },

  removePopupTrackingAttribute(element) {
    this._popupTrackingElements.remove(element);
  },

  onPopupShowing(showEvent) {
    for (const el of this._popupTrackingElements) {
      // target may be inside a shadow root, not directly under the element
      // we also ignore menus inside panels
      if (
        !el.contains(showEvent.explicitOriginalTarget) ||
        (showEvent.explicitOriginalTarget instanceof Element &&
          showEvent.explicitOriginalTarget?.closest('panel'))
      ) {
        continue;
      }
      document.removeEventListener('mousemove', this.__removeHasPopupAttribute);
      el.setAttribute('has-popup-menu', '');
      this.__currentPopup = showEvent.target;
      this.__currentPopupTrackElement = el;
      break;
    }
  },

  onPopupHidden(hideEvent) {
    if (!this.__currentPopup || this.__currentPopup !== hideEvent.target) {
      return;
    }
    const element = this.__currentPopupTrackElement;
    if (document.getElementById('main-window').matches(':hover')) {
      element.removeAttribute('has-popup-menu');
    } else {
      this.__removeHasPopupAttribute = () => element.removeAttribute('has-popup-menu');
      document.addEventListener('mousemove', this.__removeHasPopupAttribute, { once: true });
    }
    this.__currentPopup = null;
    this.__currentPopupTrackElement = null;
  },

  // Section: URL bar

  get newtabButtons() {
    return document.querySelectorAll('#tabs-newtab-button');
  },

  _prevUrlbarLabel: null,
  _lastSearch: '',
  _clearTimeout: null,
  _lastTab: null,

  // Track tab switching state to prevent race conditions
  _tabSwitchState: {
    inProgress: false,
    lastSwitchTime: 0,
    debounceTime: 100, // ms to wait between tab switches
    queue: [],
    processingQueue: false,
  },

  // Queue tab switch operations to prevent race conditions
  async _queueTabOperation(operation) {
    // Add operation to queue
    this._tabSwitchState.queue.push(operation);

    // If already processing queue, just return
    if (this._tabSwitchState.processingQueue) {
      return;
    }

    // Start processing queue
    this._tabSwitchState.processingQueue = true;

    try {
      while (this._tabSwitchState.queue.length > 0) {
        // Get next operation
        const nextOp = this._tabSwitchState.queue.shift();

        // Check if we need to wait for debounce
        const now = Date.now();
        const timeSinceLastSwitch = now - this._tabSwitchState.lastSwitchTime;

        if (timeSinceLastSwitch < this._tabSwitchState.debounceTime) {
          await new Promise((resolve) =>
            setTimeout(resolve, this._tabSwitchState.debounceTime - timeSinceLastSwitch)
          );
        }

        // Execute operation
        this._tabSwitchState.inProgress = true;
        await nextOp();
        this._tabSwitchState.inProgress = false;
        this._tabSwitchState.lastSwitchTime = Date.now();
      }
    } finally {
      this._tabSwitchState.processingQueue = false;
    }
  },

  // Check if browser elements are in a valid state for tab operations
  _validateBrowserState() {
    // Check if browser window is still open
    if (window.closed) {
      return false;
    }

    // Check if gBrowser is available
    if (!gBrowser || !gBrowser.tabContainer) {
      return false;
    }

    // Check if URL bar is available
    if (!gURLBar) {
      return false;
    }

    return true;
  },

  handleNewTab(werePassedURL, searchClipboard, where) {
    // Validate browser state first
    if (!this._validateBrowserState()) {
      console.warn('Browser state invalid for new tab operation');
      return false;
    }

    if (this.testingEnabled) {
      return false;
    }

    const shouldOpenURLBar =
      gZenVerticalTabsManager._canReplaceNewTab &&
      !werePassedURL &&
      !searchClipboard &&
      where === 'tab';

    if (!shouldOpenURLBar) {
      return false;
    }

    // Queue the tab operation to prevent race conditions
    this._queueTabOperation(async () => {
      // Clear any existing timeout
      if (this._clearTimeout) {
        clearTimeout(this._clearTimeout);
        this._clearTimeout = null;
      }

      // Store the current tab
      this._lastTab = gBrowser.selectedTab;
      if (!this._lastTab) {
        console.warn('No selected tab found when creating new tab');
        return false;
      }

      // Set visual state with proper validation
      if (this._lastTab && !this._lastTab.closing) {
        this._lastTab._visuallySelected = false;
      }

      // Store URL bar state
      this._prevUrlbarLabel = gURLBar._untrimmedValue || '';

      // Set up URL bar for new tab
      gURLBar._zenHandleUrlbarClose = this.handleUrlbarClose.bind(this);
      gURLBar.setAttribute('zen-newtab', true);

      // Update newtab buttons
      for (const button of this.newtabButtons) {
        button.setAttribute('in-urlbar', true);
      }

      // Open location command
      try {
        // Wait for a small delay to ensure DOM is ready
        await new Promise((resolve) => setTimeout(resolve, 10));

        document.getElementById('Browser:OpenLocation').doCommand();
        gURLBar.search(this._lastSearch || '');
      } catch (e) {
        console.error('Error opening location in new tab:', e);
        this.handleUrlbarClose(false);
        return false;
      }
    });

    return true;
  },

  clearUrlbarData() {
    this._prevUrlbarLabel = null;
    this._lastSearch = '';
  },

  handleUrlbarClose(onSwitch = false, onElementPicked = false) {
    // Validate browser state first
    if (!this._validateBrowserState()) {
      console.warn('Browser state invalid for URL bar close operation');
      return;
    }

    // Queue the operation to prevent race conditions
    this._queueTabOperation(async () => {
      // Reset URL bar state
      if (gURLBar._zenHandleUrlbarClose) {
        gURLBar._zenHandleUrlbarClose = null;
      }
      gURLBar.removeAttribute('zen-newtab');

      // Safely restore tab visual state with proper validation
      if (
        this._lastTab &&
        !this._lastTab.closing &&
        this._lastTab.ownerGlobal &&
        !this._lastTab.ownerGlobal.closed
      ) {
        this._lastTab._visuallySelected = true;
        this._lastTab = null;
      }

      // Reset newtab buttons
      for (const button of this.newtabButtons) {
        button.removeAttribute('in-urlbar');
      }

      // Handle search data
      if (!onElementPicked) {
        if (onSwitch) {
          this.clearUrlbarData();
        } else {
          this._lastSearch = gURLBar._untrimmedValue || '';

          if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
          }

          this._clearTimeout = setTimeout(() => {
            this.clearUrlbarData();
          }, this.urlbarWaitToClear);
        }

        // Safely restore URL bar state with proper validation
        if (this._prevUrlbarLabel) {
          gURLBar.setURI(this._prevUrlbarLabel, onSwitch, false, false, !onSwitch);
        }

        gURLBar.handleRevert();
      } else if (onElementPicked && onSwitch) {
        this.clearUrlbarData();
      }

      if (gURLBar.focused) {
        gURLBar.view.close({ elementPicked: onSwitch });
        gURLBar.updateTextOverflow();

        // Ensure tab and browser are valid before updating state
        const selectedTab = gBrowser.selectedTab;
        if (selectedTab && selectedTab.linkedBrowser && !selectedTab.closing && onSwitch) {
          const browserState = gURLBar.getBrowserState(selectedTab.linkedBrowser);
          if (browserState) {
            browserState.urlbarFocused = false;
          }
        }
      }
    });
  },

  urlbarTrim(aURL) {
    if (gZenVerticalTabsManager._hasSetSingleToolbar && this.urlbarShowDomainOnly) {
      let url = BrowserUIUtils.removeSingleTrailingSlashFromURL(aURL);
      return url.startsWith('https://') ? url.split('/')[2] : url;
    }
    return BrowserUIUtils.trimURL(aURL);
  },

  // Section: Notification messages
  _createToastElement(messageId, options) {
    const createButton = () => {
      const button = document.createXULElement('button');
      button.id = options.button.id;
      button.classList.add('footer-button');
      button.classList.add('primary');
      button.addEventListener('command', options.button.command);
      return button;
    };

    // Check if this message ID already exists
    for (const child of this._toastContainer.children) {
      if (child._messageId === messageId) {
        child.removeAttribute('button');
        if (options.button) {
          const button = createButton();
          const existingButton = child.querySelector('button');
          if (existingButton) {
            existingButton.remove();
          }
          child.appendChild(button);
          child.setAttribute('button', true);
        }
        return [child, true];
      }
    }
    const wrapper = document.createXULElement('hbox');
    const element = document.createXULElement('vbox');
    const label = document.createXULElement('label');
    document.l10n.setAttributes(label, messageId, options);
    element.appendChild(label);
    if (options.descriptionId) {
      const description = document.createXULElement('label');
      description.classList.add('description');
      document.l10n.setAttributes(description, options.descriptionId, options);
      element.appendChild(description);
    }
    wrapper.appendChild(element);
    if (options.button) {
      const button = createButton();
      wrapper.appendChild(button);
      wrapper.setAttribute('button', true);
    }
    wrapper.classList.add('zen-toast');
    wrapper._messageId = messageId;
    return [wrapper, false];
  },

  async showToast(messageId, options = {}) {
    const [toast, reused] = this._createToastElement(messageId, options);
    this._toastContainer.removeAttribute('hidden');
    this._toastContainer.appendChild(toast);
    const timeoutFunction = () => {
      this.motion
        .animate(toast, { opacity: [1, 0], scale: [1, 0.5] }, { duration: 0.2, bounce: 0 })
        .then(() => {
          toast.remove();
          if (this._toastContainer.children.length === 0) {
            this._toastContainer.setAttribute('hidden', true);
          }
        });
    };
    if (reused) {
      await this.motion.animate(toast, { scale: 0.2 }, { duration: 0.1, bounce: 0 });
    } else {
      toast.addEventListener('mouseover', () => {
        if (this._toastTimeouts[messageId]) {
          clearTimeout(this._toastTimeouts[messageId]);
        }
      });
      toast.addEventListener('mouseout', () => {
        if (this._toastTimeouts[messageId]) {
          clearTimeout(this._toastTimeouts[messageId]);
        }
        this._toastTimeouts[messageId] = setTimeout(timeoutFunction, options.timeout || 2000);
      });
    }
    if (!toast.style.hasOwnProperty('transform')) {
      toast.style.transform = 'scale(0)';
    }
    await this.motion.animate(toast, { scale: 1 }, { type: 'spring', bounce: 0.2, duration: 0.5 });
    if (this._toastTimeouts[messageId]) {
      clearTimeout(this._toastTimeouts[messageId]);
    }
    this._toastTimeouts[messageId] = setTimeout(timeoutFunction, options.timeout || 2000);
  },

  get panelUIPosition() {
    return gZenVerticalTabsManager._hasSetSingleToolbar && !gZenVerticalTabsManager._prefsRightSide
      ? 'bottomleft topleft'
      : 'bottomright topright';
  },
};

var gZenVerticalTabsManager = {
  init() {
    this._multiWindowFeature = new ZenMultiWindowFeature();
    this._initWaitPromise();

    ChromeUtils.defineLazyGetter(this, 'isWindowsStyledButtons', () => {
      return !(
        window.AppConstants.platform === 'macosx' ||
        window.matchMedia('(-moz-gtk-csd-reversed-placement)').matches ||
        Services.prefs.getBoolPref('zen.view.experimental-force-window-controls-left')
      );
    });

    ChromeUtils.defineLazyGetter(this, 'hidesTabsToolbar', () => {
      return (
        document.documentElement.getAttribute('chromehidden').includes('toolbar') ||
        document.documentElement.getAttribute('chromehidden').includes('menubar')
      );
    });

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_canReplaceNewTab',
      'zen.urlbar.replace-newtab',
      true
    );
    var updateEvent = this._updateEvent.bind(this);
    var onPrefChange = this._onPrefChange.bind(this);

    this.initializePreferences(onPrefChange);
    this._toolbarOriginalParent = document.getElementById('nav-bar').parentElement;

    gZenCompactModeManager.addEventListener(updateEvent);
    this.initRightSideOrderContextMenu();

    window.addEventListener('customizationstarting', this._preCustomize.bind(this));
    window.addEventListener('aftercustomization', this._postCustomize.bind(this));

    this._updateEvent();

    if (!this.isWindowsStyledButtons) {
      document.documentElement.setAttribute('zen-window-buttons-reversed', true);
    }

    this._renameTabHalt = this.renameTabHalt.bind(this);
    gBrowser.tabContainer.addEventListener('dblclick', this.renameTabStart.bind(this));
  },

  toggleExpand() {
    const newVal = !Services.prefs.getBoolPref('zen.view.sidebar-expanded');
    Services.prefs.setBoolPref('zen.view.sidebar-expanded', newVal);
  },

  get navigatorToolbox() {
    return gNavToolbox;
  },

  initRightSideOrderContextMenu() {
    const kConfigKey = 'zen.tabs.vertical.right-side';
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuitem id="zen-toolbar-context-tabs-right"
                type="checkbox"
                ${Services.prefs.getBoolPref(kConfigKey) ? 'checked="true"' : ''}
                data-lazy-l10n-id="zen-toolbar-context-tabs-right"
                command="cmd_zenToggleTabsOnRight"
        />
    `);
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
  },

  get _topButtonsSeparatorElement() {
    if (this.__topButtonsSeparatorElement) {
      return this.__topButtonsSeparatorElement;
    }
    this.__topButtonsSeparatorElement = document.getElementById(
      'zen-sidebar-top-buttons-separator'
    );
    return this.__topButtonsSeparatorElement;
  },

  animateTab(aTab) {
    if (!gZenUIManager.motion || !aTab || !gZenUIManager._hasLoadedDOM) {
      return;
    }
    // get next visible tab
    const isLastTab = () => {
      const visibleTabs = gBrowser.visibleTabs;
      return visibleTabs[visibleTabs.length - 1] === aTab;
    };

    try {
      const tabSize = aTab.getBoundingClientRect().height;
      const transform = `-${tabSize}px`;
      gZenUIManager.motion
        .animate(
          aTab,
          {
            opacity: [0, 1],
            transform: ['scale(0.95)', 'scale(1)'],
            marginBottom: isLastTab() ? [] : [transform, '0px'],
          },
          {
            duration: 0.12,
            easing: 'ease-out',
          }
        )
        .then(() => {
          aTab.style.removeProperty('margin-bottom');
          aTab.style.removeProperty('transform');
          aTab.style.removeProperty('opacity');
        });
      gZenUIManager.motion
        .animate(
          aTab.querySelector('.tab-content'),
          {
            filter: ['blur(1px)', 'blur(0px)'],
          },
          {
            duration: 0.12,
            easing: 'ease-out',
          }
        )
        .then(() => {
          aTab.querySelector('.tab-stack').style.removeProperty('filter');
        });
    } catch (e) {
      console.error(e);
    }
  },

  get actualWindowButtons() {
    // we have multiple ".titlebar-buttonbox-container" in the DOM, because of the titlebar
    if (!this.__actualWindowButtons) {
      this.__actualWindowButtons = !this.isWindowsStyledButtons
        ? document.querySelector('.titlebar-buttonbox-container') // TODO: test if it works 100% of the time
        : document.querySelector('#nav-bar .titlebar-buttonbox-container');
      this.__actualWindowButtons.setAttribute('overflows', 'false');
    }
    return this.__actualWindowButtons;
  },

  async _preCustomize() {
    await this._multiWindowFeature.foreachWindowAsActive(async (browser) => {
      browser.gZenVerticalTabsManager._updateEvent({
        forCustomizableMode: true,
        dontRebuildAreas: true,
      });
    });
    this.rebuildAreas();
    this.navigatorToolbox.setAttribute('zen-sidebar-expanded', 'true');
    document.documentElement.setAttribute('zen-sidebar-expanded', 'true'); // force expanded sidebar
  },

  _postCustomize() {
    // No need to use `await` here, because the customization is already done
    this._multiWindowFeature.foreachWindowAsActive(async (browser) => {
      browser.gZenVerticalTabsManager._updateEvent({ dontRebuildAreas: true });
    });
  },

  initializePreferences(updateEvent) {
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_prefsVerticalTabs',
      'zen.tabs.vertical',
      true,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_prefsRightSide',
      'zen.tabs.vertical.right-side',
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_prefsUseSingleToolbar',
      'zen.view.use-single-toolbar',
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_prefsSidebarExpanded',
      'zen.view.sidebar-expanded',
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_prefsSidebarExpandedMaxWidth',
      'zen.view.sidebar-expanded.max-width',
      300,
      updateEvent
    );
  },

  _initWaitPromise() {
    this._waitPromise = new Promise((resolve) => {
      this._resolveWaitPromise = resolve;
    });
  },

  async _onPrefChange() {
    this._resolveWaitPromise();

    // only run if we are in the active window
    await this._multiWindowFeature.foreachWindowAsActive(async (browser) => {
      if (browser.gZenVerticalTabsManager._multiWindowFeature.windowIsActive(browser)) {
        return;
      }
      await browser.gZenVerticalTabsManager._waitPromise;
      browser.gZenVerticalTabsManager._updateEvent({ dontRebuildAreas: true });
      browser.gZenVerticalTabsManager._initWaitPromise();
    });

    if (ZenMultiWindowFeature.isActiveWindow) {
      this._updateEvent();
      this._initWaitPromise();
    }
  },

  recalculateURLBarHeight() {
    document.getElementById('urlbar').removeAttribute('--urlbar-height');
    if (!this._hasSetSingleToolbar) {
      document.getElementById('urlbar').style.setProperty('--urlbar-height', '32px');
    } else if (gURLBar.getAttribute('breakout-extend') !== 'true') {
      try {
        gURLBar.zenUpdateLayoutBreakout();
      } catch (e) {
        console.warn(e);
      }
    }
  },

  _updateEvent({ forCustomizableMode = false, dontRebuildAreas = false } = {}) {
    if (this._isUpdating) {
      return;
    }
    this._isUpdating = true;
    try {
      this._updateMaxWidth();

      if (window.docShell) {
        window.docShell.treeOwner
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIAppWindow)
          .rollupAllPopups();
      }

      const topButtons = document.getElementById('zen-sidebar-top-buttons');
      const isCompactMode = gZenCompactModeManager.preference && !forCustomizableMode;
      const isVerticalTabs = this._prefsVerticalTabs || forCustomizableMode;
      const isSidebarExpanded = this._prefsSidebarExpanded || !isVerticalTabs;
      const isRightSide = this._prefsRightSide && isVerticalTabs;
      const isSingleToolbar =
        ((this._prefsUseSingleToolbar && isVerticalTabs && isSidebarExpanded) || !isVerticalTabs) &&
        !forCustomizableMode &&
        !this.hidesTabsToolbar;
      const titlebar = document.getElementById('titlebar');

      gBrowser.tabContainer.setAttribute('orient', isVerticalTabs ? 'vertical' : 'horizontal');
      gBrowser.tabContainer.arrowScrollbox.setAttribute(
        'orient',
        isVerticalTabs ? 'vertical' : 'horizontal'
      );
      // on purpose, we set the orient to horizontal, because the arrowScrollbox is vertical
      gBrowser.tabContainer.arrowScrollbox.scrollbox.setAttribute(
        'orient',
        isVerticalTabs && gZenWorkspaces.workspaceEnabled ? 'horizontal' : 'vertical'
      );

      const buttonsTarget = document.getElementById('zen-sidebar-top-buttons-customization-target');
      if (isRightSide) {
        this.navigatorToolbox.setAttribute('zen-right-side', 'true');
        document.documentElement.setAttribute('zen-right-side', 'true');
      } else {
        this.navigatorToolbox.removeAttribute('zen-right-side');
        document.documentElement.removeAttribute('zen-right-side');
      }

      if (isSidebarExpanded) {
        this.navigatorToolbox.setAttribute('zen-sidebar-expanded', 'true');
        document.documentElement.setAttribute('zen-sidebar-expanded', 'true');
        gBrowser.tabContainer.setAttribute('expanded', 'true');
      } else {
        this.navigatorToolbox.removeAttribute('zen-sidebar-expanded');
        document.documentElement.removeAttribute('zen-sidebar-expanded');
        gBrowser.tabContainer.removeAttribute('expanded');
      }

      const appContentNavbarContaienr = document.getElementById('zen-appcontent-navbar-container');
      let shouldHide = false;
      if (
        ((!isRightSide && this.isWindowsStyledButtons) ||
          (isRightSide && !this.isWindowsStyledButtons) ||
          (isCompactMode && isSingleToolbar && this.isWindowsStyledButtons)) &&
        isSingleToolbar
      ) {
        appContentNavbarContaienr.setAttribute('should-hide', 'true');
        shouldHide = true;
      } else {
        appContentNavbarContaienr.removeAttribute('should-hide');
      }

      // Check if the sidebar is in hover mode
      if (!this.navigatorToolbox.hasAttribute('zen-right-side') && !isCompactMode) {
        this.navigatorToolbox.prepend(topButtons);
      }

      let windowButtons = this.actualWindowButtons;
      let doNotChangeWindowButtons = !isCompactMode && isRightSide && this.isWindowsStyledButtons;
      const navBar = document.getElementById('nav-bar');

      if (isSingleToolbar) {
        this._navbarParent = navBar.parentElement;
        let elements = document.querySelectorAll(
          '#nav-bar-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional):not(#urlbar-container):not(toolbarspring)'
        );
        elements = Array.from(elements).reverse();
        // Add separator if it doesn't exist
        if (!this._hasSetSingleToolbar) {
          buttonsTarget.append(this._topButtonsSeparatorElement);
        }
        for (const button of elements) {
          this._topButtonsSeparatorElement.after(button);
        }
        buttonsTarget.prepend(document.getElementById('unified-extensions-button'));
        const panelUIButton = document.getElementById('PanelUI-button');
        buttonsTarget.prepend(panelUIButton);
        panelUIButton.setAttribute('overflows', 'false');
        buttonsTarget.parentElement.append(document.getElementById('nav-bar-overflow-button'));
        if (this.isWindowsStyledButtons && !doNotChangeWindowButtons) {
          appContentNavbarContaienr.append(windowButtons);
        }
        if (isCompactMode) {
          titlebar.prepend(navBar);
          titlebar.prepend(topButtons);
        } else {
          titlebar.before(topButtons);
          titlebar.before(navBar);
        }
        document.documentElement.setAttribute('zen-single-toolbar', true);
        this._hasSetSingleToolbar = true;
      } else if (this._hasSetSingleToolbar) {
        this._hasSetSingleToolbar = false;
        // Do the opposite
        this._navbarParent.prepend(navBar);
        const elements = document.querySelectorAll(
          '#zen-sidebar-top-buttons-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional)'
        );
        for (const button of elements) {
          document.getElementById('nav-bar-customization-target').append(button);
        }
        this._topButtonsSeparatorElement.remove();
        document.documentElement.removeAttribute('zen-single-toolbar');
        const panelUIButton = document.getElementById('PanelUI-button');
        navBar.appendChild(panelUIButton);
        panelUIButton.removeAttribute('overflows');
        navBar.appendChild(document.getElementById('nav-bar-overflow-button'));
        this._toolbarOriginalParent.prepend(navBar);
        if (!dontRebuildAreas) {
          this.rebuildAreas();
        }
      }

      if (isCompactMode) {
        titlebar.prepend(topButtons);
      } else {
        if (isSidebarExpanded) {
          titlebar.before(topButtons);
        } else {
          titlebar.prepend(topButtons);
        }
      }

      // Case: single toolbar, not compact mode, not right side and macos styled buttons
      if (
        !doNotChangeWindowButtons &&
        isSingleToolbar &&
        !isCompactMode &&
        !isRightSide &&
        !this.isWindowsStyledButtons
      ) {
        topButtons.prepend(windowButtons);
      }
      // Case: single toolbar, compact mode, right side and windows styled buttons
      if (isSingleToolbar && isCompactMode && isRightSide && this.isWindowsStyledButtons) {
        topButtons.prepend(windowButtons);
      }

      if (doNotChangeWindowButtons) {
        if (isRightSide && !isSidebarExpanded) {
          navBar.appendChild(windowButtons);
        } else {
          topButtons.appendChild(windowButtons);
        }
      } else if (!isSingleToolbar && !isCompactMode) {
        if (this.isWindowsStyledButtons) {
          if (isRightSide) {
            appContentNavbarContaienr.append(windowButtons);
          } else {
            navBar.append(windowButtons);
          }
        } else {
          // not windows styled buttons
          if (isRightSide || !isSidebarExpanded) {
            navBar.prepend(windowButtons);
          } else {
            topButtons.prepend(windowButtons);
          }
        }
      } else if (!isSingleToolbar && isCompactMode) {
        navBar.appendChild(windowButtons);
      } else if (isSingleToolbar && isCompactMode) {
        if (!isRightSide && !this.isWindowsStyledButtons) {
          topButtons.prepend(windowButtons);
        }
      }

      if (shouldHide) {
        appContentNavbarContaienr.append(windowButtons);
      }

      gZenCompactModeManager.updateCompactModeContext(isSingleToolbar);
      this.recalculateURLBarHeight();

      // Always move the splitter next to the sidebar
      const splitter = document.getElementById('zen-sidebar-splitter');
      this.navigatorToolbox.after(splitter);
      window.dispatchEvent(new Event('resize'));
      if (!isCompactMode) {
        gZenCompactModeManager.getAndApplySidebarWidth();
      }
      gZenUIManager.updateTabsToolbar();
    } catch (e) {
      console.error(e);
    }
    this._isUpdating = false;
  },

  rebuildAreas() {
    CustomizableUI.zenInternalCU._rebuildRegisteredAreas(/* zenDontRebuildCollapsed */ true);
  },

  _updateMaxWidth() {
    const maxWidth = Services.prefs.getIntPref('zen.view.sidebar-expanded.max-width');
    const toolbox = gNavToolbox;
    if (!this._prefsCompactMode) {
      toolbox.style.maxWidth = `${maxWidth}px`;
    } else {
      toolbox.style.removeProperty('maxWidth');
    }
  },

  get expandButton() {
    if (this._expandButton) {
      return this._expandButton;
    }
    this._expandButton = document.getElementById('zen-expand-sidebar-button');
    return this._expandButton;
  },

  toggleTabsOnRight() {
    const newVal = !Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
    Services.prefs.setBoolPref('zen.tabs.vertical.right-side', newVal);
  },

  appendCustomizableItem(target, child, placements) {
    if (
      target.id === 'zen-sidebar-top-buttons-customization-target' &&
      this._hasSetSingleToolbar &&
      placements.includes(child.id)
    ) {
      return this._topButtonsSeparatorElement.before(child);
    }
    target.appendChild(child);
  },

  async renameTabKeydown(event) {
    if (event.key === 'Enter') {
      let label = this._tabEdited.querySelector('.tab-label-container-editing');
      let input = this._tabEdited.querySelector('#tab-label-input');
      let newName = input.value.trim();

      // Check if name is blank, reset if so
      // Always remove, so we can always rename and if it's empty,
      // it will reset to the original name anyway
      this._tabEdited.removeAttribute('zen-has-static-label');
      if (newName) {
        gBrowser._setTabLabel(this._tabEdited, newName);
        this._tabEdited.setAttribute('zen-has-static-label', 'true');
        gZenUIManager.showToast('zen-tabs-renamed');
      } else {
        gBrowser.setTabTitle(this._tabEdited);
      }
      if (this._tabEdited.getAttribute('zen-pin-id')) {
        // Update pin title in storage
        await gZenPinnedTabManager.updatePinTitle(
          this._tabEdited,
          this._tabEdited.label,
          !!newName
        );
      }
      document.documentElement.removeAttribute('zen-renaming-tab');

      // Maybe add some confetti here?!?
      gZenUIManager.motion.animate(
        this._tabEdited,
        {
          scale: [1, 0.98, 1],
        },
        {
          duration: 0.25,
        }
      );

      this._tabEdited.querySelector('.tab-editor-container').remove();
      label.classList.remove('tab-label-container-editing');

      this._tabEdited = null;
    } else if (event.key === 'Escape') {
      event.target.blur();
    }
  },

  renameTabStart(event) {
    if (
      this._tabEdited ||
      !Services.prefs.getBoolPref('zen.tabs.rename-tabs') ||
      Services.prefs.getBoolPref('browser.tabs.closeTabByDblclick') ||
      !gZenVerticalTabsManager._prefsSidebarExpanded
    )
      return;
    this._tabEdited = event.target.closest('.tabbrowser-tab');
    if (
      !this._tabEdited ||
      !this._tabEdited.pinned ||
      this._tabEdited.hasAttribute('zen-essential')
    ) {
      this._tabEdited = null;
      return;
    }
    document.documentElement.setAttribute('zen-renaming-tab', 'true');
    const label = this._tabEdited.querySelector('.tab-label-container');
    label.classList.add('tab-label-container-editing');

    const container = window.MozXULElement.parseXULToFragment(`
      <vbox class="tab-label-container tab-editor-container" flex="1" align="start" pack="center"></vbox>
    `);
    label.after(container);
    const containerHtml = this._tabEdited.querySelector('.tab-editor-container');
    const input = document.createElement('input');
    input.id = 'tab-label-input';
    input.value = this._tabEdited.label;
    input.addEventListener('keydown', this.renameTabKeydown.bind(this));

    containerHtml.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('blur', this._renameTabHalt);
  },

  renameTabHalt(event) {
    if (document.activeElement === event.target || !this._tabEdited) {
      return;
    }
    document.documentElement.removeAttribute('zen-renaming-tab');
    this._tabEdited.querySelector('.tab-editor-container').remove();
    const label = this._tabEdited.querySelector('.tab-label-container-editing');
    label.classList.remove('tab-label-container-editing');

    this._tabEdited = null;
  },
};
