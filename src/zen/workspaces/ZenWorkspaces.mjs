// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var gZenWorkspaces = new (class extends nsZenMultiWindowFeature {
  /**
   * Stores workspace IDs and their last selected tabs.
   */
  _lastSelectedWorkspaceTabs = {};
  _inChangingWorkspace = false;
  draggedElement = null;

  #canDebug = Services.prefs.getBoolPref('zen.workspaces.debug', false);

  _swipeState = {
    isGestureActive: true,
    lastDelta: 0,
    direction: null,
  };

  _lastScrollTime = 0;

  bookmarkMenus = [
    'PlacesToolbar',
    'bookmarks-menu-button',
    'BMB_bookmarksToolbar',
    'BMB_unsortedBookmarks',
    'BMB_mobileBookmarks',
  ];

  promiseDBInitialized = new Promise((resolve) => {
    this._resolveDBInitialized = resolve;
  });

  promisePinnedInitialized = new Promise((resolve) => {
    this._resolvePinnedInitialized = resolve;
  });

  promiseSectionsInitialized = new Promise((resolve) => {
    this._resolveSectionsInitialized = resolve;
  });

  promiseInitialized = new Promise((resolve) => {
    this._resolveInitialized = resolve;
  });

  async #waitForPromises() {
    if (this.privateWindowOrDisabled) {
      return;
    }
    await Promise.all([this.promiseDBInitialized, this.promisePinnedInitialized]);
  }

  async init() {
    // Initialize tab selection state
    this._tabSelectionState = {
      inProgress: false,
      lastSelectionTime: 0,
      debounceTime: 100, // ms to wait between tab selections
    };

    // Initialize workspace change mutex
    this._workspaceChangeInProgress = false;

    if (!this.shouldHaveWorkspaces) {
      this._resolveInitialized();
      console.warn('gZenWorkspaces: !!! gZenWorkspaces is disabled in hidden windows !!!');
      return; // We are in a hidden window, don't initialize gZenWorkspaces
    }

    this.ownerWindow = window;
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'activationMethod',
      'zen.workspaces.scroll-modifier-key',
      'ctrl'
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'naturalScroll',
      'zen.workspaces.natural-scroll',
      true
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldWrapAroundNavigation',
      'zen.workspaces.wrap-around-navigation',
      true
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldForceContainerTabsToWorkspace',
      'zen.workspaces.force-container-workspace',
      true
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldOpenNewTabIfLastUnpinnedTabIsClosed',
      'zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed',
      false
    );
    this.containerSpecificEssentials = Services.prefs.getBoolPref(
      'zen.workspaces.separate-essentials',
      false
    );
    ChromeUtils.defineLazyGetter(this, 'tabContainer', () =>
      document.getElementById('tabbrowser-tabs')
    );
    ChromeUtils.defineLazyGetter(this, 'workspaceIcons', () =>
      document.getElementById('zen-workspaces-button')
    );
    this._activeWorkspace = Services.prefs.getStringPref('zen.workspaces.active', '');

    if (this.isPrivateWindow) {
      document.documentElement.setAttribute('zen-private-window', 'true');
    }

    this.popupOpenHandler = this._popupOpenHandler.bind(this);

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.addPopupListeners();

    await this.#waitForPromises();
    await this._workspaces();

    await this.afterLoadInit();
  }

  log(...args) {
    if (this.#canDebug) {
      console.debug(`[gZenWorkspaces]:`, ...args);
    }
  }

  async afterLoadInit() {
    if (!this._hasInitializedTabsStrip) {
      await this.delayedStartup();
    }
    this._initializeWorkspaceTabContextMenus();
    await this.initializeWorkspaces();
    await this.promiseSectionsInitialized;

    // Non UI related initializations
    if (
      Services.prefs.getBoolPref('zen.workspaces.swipe-actions', false) &&
      this.workspaceEnabled &&
      !this.isPrivateWindow
    ) {
      this.initializeGestureHandlers();
      this.initializeWorkspaceNavigation();
    }

    if (!this.privateWindowOrDisabled) {
      const observerFunction = async function observe() {
        this._workspaceBookmarksCache = null;
        await this.workspaceBookmarks();
        this._invalidateBookmarkContainers();
      };
      Services.obs.addObserver(this, 'weave:engine:sync:finish');
      Services.obs.addObserver(observerFunction, 'workspace-bookmarks-updated');
      window.addEventListener(
        'unload',
        () => {
          Services.obs.removeObserver(this, 'weave:engine:sync:finish');
          Services.obs.removeObserver(observerFunction, 'workspace-bookmarks-updated');
        },
        { once: true }
      );
    }
  }

  // Validate browser state before tab operations
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
  }

  // Safely select a tab with debouncing to prevent race conditions
  async _safelySelectTab(tab) {
    if (!tab || tab.closing || !tab.ownerGlobal || tab.ownerGlobal.closed) {
      return false;
    }

    // Check if we need to debounce
    const now = Date.now();
    const timeSinceLastSelection = now - this._tabSelectionState.lastSelectionTime;

    if (timeSinceLastSelection < this._tabSelectionState.debounceTime) {
      await new Promise((resolve) =>
        setTimeout(resolve, this._tabSelectionState.debounceTime - timeSinceLastSelection)
      );
    }

    // Mark selection as in progress
    this._tabSelectionState.inProgress = true;

    try {
      gBrowser.selectedTab = tab;
      this._tabSelectionState.lastSelectionTime = Date.now();
      return true;
    } catch (e) {
      console.error('Error selecting tab:', e);
      return false;
    } finally {
      this._tabSelectionState.inProgress = false;
    }
  }

  async selectEmptyTab(newTabTarget = null, selectURLBar = true) {
    // Validate browser state first
    if (!this._validateBrowserState()) {
      console.warn('Browser state invalid for empty tab selection');
      return null;
    }

    if (gZenUIManager.testingEnabled) {
      return null;
    }

    try {
      // Check if we have a valid empty tab and can replace new tab
      if (
        this._emptyTab &&
        !this._emptyTab.closing &&
        this._emptyTab.ownerGlobal &&
        !this._emptyTab.ownerGlobal.closed &&
        gZenVerticalTabsManager._canReplaceNewTab
      ) {
        // Only set up URL bar selection if we're switching to a different tab
        if (gBrowser.selectedTab !== this._emptyTab && selectURLBar) {
          const tabSelectListener = () => {
            // Remove the event listener first to prevent any chance of multiple executions
            window.removeEventListener('TabSelect', tabSelectListener);

            // Use requestAnimationFrame to ensure DOM is updated
            requestAnimationFrame(() => {
              // Then use setTimeout to ensure browser has time to process tab switch
              setTimeout(() => {
                if (gURLBar) {
                  try {
                    gURLBar.select();
                  } catch (e) {
                    console.warn('Error selecting URL bar:', e);
                  }
                }
              }, 50);
            });
          };

          window.addEventListener('TabSelect', tabSelectListener, { once: true });
        }

        // Safely switch to the empty tab using our debounced method
        const success = await this._safelySelectTab(this._emptyTab);
        if (!success) {
          throw new Error('Failed to select empty tab');
        }

        return this._emptyTab;
      }

      // Fall back to creating a new tab
      const newTabUrl = newTabTarget || Services.prefs.getStringPref('browser.startup.homepage');
      let tab = gZenUIManager.openAndChangeToTab(newTabUrl);

      // Set workspace ID if available
      if (window.uuid) {
        tab.setAttribute('zen-workspace-id', this.activeWorkspace);
      }
      return tab;
    } catch (e) {
      console.error('Error in selectEmptyTab:', e);

      // Create a fallback tab as a last resort, with proper validation
      try {
        if (this._validateBrowserState()) {
          return gBrowser.addTrustedTab('about:blank');
        }
      } catch (fallbackError) {
        console.error('Critical error creating fallback tab:', fallbackError);
      }
      return null;
    }
  }

  async delayedStartup() {
    if (!this.workspaceEnabled) {
      return;
    }
    this._pinnedTabsResizeObserver = new ResizeObserver(this.onPinnedTabsResize.bind(this));
    await this._createDefaultWorkspaceIfNeeded();
  }

  async _createDefaultWorkspaceIfNeeded() {
    const workspaces = await this._workspaces();
    if (!workspaces.workspaces.length) {
      await this.createAndSaveWorkspace('Space', null, true);
      this._workspaceCache = null;
    }
  }

  _initializeEmptyTab() {
    for (const tab of gBrowser.tabs) {
      // Check if session store has an empty tab
      if (tab.hasAttribute('zen-empty-tab') && !tab.pinned) {
        this.log('Found existing empty tab from session store!');
        this._emptyTab = tab;
        return;
      }
    }
    this._emptyTab = gBrowser.addTrustedTab('about:blank', {
      inBackground: true,
      userContextId: 0,
      _forZenEmptyTab: true,
    });
  }

  registerPinnedResizeObserver() {
    if (!this._hasInitializedTabsStrip) {
      return;
    }
    this._pinnedTabsResizeObserver.disconnect();
    for (let element of document.querySelectorAll('.zen-workspace-pinned-tabs-section')) {
      this._pinnedTabsResizeObserver.observe(element, { box: 'border-box' });
    }
    for (let element of document.getElementById('zen-essentials').children) {
      if (element.classList.contains('tabbrowser-tab')) {
        continue;
      }
      this._pinnedTabsResizeObserver.observe(element, { box: 'border-box' });
    }
  }

  get activeWorkspaceStrip() {
    if (!this._hasInitializedTabsStrip) {
      return gBrowser.tabContainer.arrowScrollbox;
    }
    return this.activeWorkspaceElement?.tabsContainer;
  }

  get pinnedTabsContainer() {
    if (!this.workspaceEnabled || !this._hasInitializedTabsStrip) {
      return document.getElementById('pinned-tabs-container');
    }
    return this.activeWorkspaceElement?.pinnedTabsContainer;
  }

  get activeWorkspaceIndicator() {
    return this.activeWorkspaceElement?.indicator;
  }

  get activeScrollbox() {
    return this.activeWorkspaceElement?.scrollbox ?? gBrowser.tabContainer.arrowScrollbox;
  }

  get tabboxChildren() {
    return Array.from(this.activeWorkspaceStrip?.children || []);
  }

  get tabboxChildrenWithoutEmpty() {
    return this.tabboxChildren.filter((child) => !child.hasAttribute('zen-empty-tab'));
  }

  get shouldAnimateEssentials() {
    return (
      this.containerSpecificEssentials ||
      document.documentElement.hasAttribute('zen-creating-workspace')
    );
  }

  get activeWorkspaceElement() {
    return this.workspaceElement(this.activeWorkspace);
  }

  workspaceElement(workspaceId) {
    if (typeof workspaceId !== 'string') {
      workspaceId = workspaceId?.uuid;
    }
    return document.getElementById(workspaceId);
  }

  async initializeTabsStripSections() {
    await SessionStore.promiseInitialized;
    await SessionStore.promiseAllWindowsRestored;
    const perifery = document.getElementById('tabbrowser-arrowscrollbox-periphery');
    perifery.setAttribute('hidden', 'true');
    await new Promise((resolve) => {
      setTimeout(async () => {
        const tabs = gBrowser.tabContainer.allTabs;
        const workspaces = await this._workspaces();
        for (const workspace of workspaces.workspaces) {
          await this._createWorkspaceTabsSection(workspace, tabs);
        }
        if (tabs.length) {
          const defaultSelectedContainer = this.workspaceElement(
            this.activeWorkspace
          )?.querySelector('.zen-workspace-normal-tabs-section');
          const pinnedContainer = this.workspaceElement(this.activeWorkspace).querySelector(
            '.zen-workspace-pinned-tabs-section'
          );
          // New profile with no workspaces does not have a default selected container
          if (defaultSelectedContainer) {
            for (const tab of tabs) {
              if (tab.hasAttribute('zen-essential')) {
                this.getEssentialsSection(tab).appendChild(tab);
                continue;
              } else if (tab.pinned) {
                pinnedContainer.insertBefore(tab, pinnedContainer.lastChild);
                continue;
              }
              // before to the last child (perifery)
              defaultSelectedContainer.insertBefore(tab, defaultSelectedContainer.lastChild);
            }
          }
          gBrowser.tabContainer._invalidateCachedTabs();
        }
        perifery.setAttribute('hidden', 'true');
        this._hasInitializedTabsStrip = true;
        this.registerPinnedResizeObserver();
        this._fixIndicatorsNames(workspaces);
        this._resolveSectionsInitialized();
        resolve();
      }, 0);
    });
  }

  getEssentialsSection(container = 0) {
    if (typeof container !== 'number') {
      container = container?.getAttribute('usercontextid');
    }
    container ??= 0;
    if (!this.containerSpecificEssentials) {
      container = 0;
    }
    let essentialsContainer = document.querySelector(
      `.zen-essentials-container[container="${container}"]:not([cloned])`
    );
    if (!essentialsContainer) {
      essentialsContainer = document.createXULElement('hbox');
      essentialsContainer.className = 'zen-essentials-container zen-workspace-tabs-section';
      essentialsContainer.setAttribute('flex', '1');
      essentialsContainer.setAttribute('container', container);
      document.getElementById('zen-essentials').appendChild(essentialsContainer);

      // Set an initial hidden state if the essentials section is not supposed
      // to be shown on the current workspace
      if (
        this.containerSpecificEssentials &&
        this.getActiveWorkspaceFromCache()?.containerTabId != container
      ) {
        essentialsContainer.setAttribute('hidden', 'true');
      }
    }
    return essentialsContainer;
  }

  getCurrentEssentialsContainer() {
    const currentWorkspace = this.getActiveWorkspaceFromCache();
    return this.getEssentialsSection(currentWorkspace?.containerTabId);
  }

  async _createWorkspaceTabsSection(workspace, tabs) {
    const workspaceWrapper = document.createXULElement('zen-workspace');
    const container = document.getElementById('tabbrowser-arrowscrollbox');
    workspaceWrapper.id = workspace.uuid;
    if (this.activeWorkspace === workspace.uuid) {
      workspaceWrapper.active = true;
    }

    if (document.documentElement.hasAttribute('zen-creating-workspace')) {
      workspaceWrapper.hidden = true; // Hide workspace while creating it
    }

    await new Promise((resolve) => {
      workspaceWrapper.addEventListener(
        'ZenWorkspaceAttached',
        () => {
          this._organizeTabsToWorkspaceSections(
            workspace,
            workspaceWrapper.tabsContainer,
            workspaceWrapper.pinnedTabsContainer,
            tabs
          );
          resolve();
        },
        { once: true }
      );
      container.appendChild(workspaceWrapper);
    });
  }

  _organizeTabsToWorkspaceSections(workspace, section, pinnedSection, tabs) {
    const workspaceTabs = Array.from(tabs).filter(
      (tab) => tab.getAttribute('zen-workspace-id') === workspace.uuid
    );
    let folders = new Set();
    const getFolderRoot = (tab) => {
      let root = tab?.group;
      while (root?.group) {
        root = root?.group;
      }
      return root || tab;
    };
    for (let i = workspaceTabs.length - 1; i >= 0; i--) {
      let tab = workspaceTabs[i];
      if (tab.hasAttribute('zen-essential')) continue; // Ignore essentials as they need to be in their own section
      // remove tab from list
      tabs.splice(tabs.indexOf(tab), 1);
      tab = tab.group ?? tab;

      if (gBrowser.isTabGroup(tab)) {
        let rootGroup = getFolderRoot(tab);

        if (folders.has(rootGroup)) continue;

        folders.add(rootGroup);
        tab = rootGroup;
      }

      if (tab.pinned) {
        pinnedSection.insertBefore(tab, pinnedSection.firstChild);
      } else {
        section.insertBefore(tab, section.firstChild);
      }
    }
  }

  initializeWorkspaceNavigation() {
    this._setupAppCommandHandlers();
    this._setupSidebarHandlers();
  }

  _setupAppCommandHandlers() {
    // Remove existing handler temporarily - this is needed so that _handleAppCommand is called before the original
    window.removeEventListener('AppCommand', HandleAppCommandEvent, true);

    // Add our handler first
    window.addEventListener('AppCommand', this._handleAppCommand.bind(this), true);

    // Re-add original handler
    window.addEventListener('AppCommand', HandleAppCommandEvent, true);
  }

  get _hoveringSidebar() {
    return gNavToolbox.hasAttribute('zen-has-hover');
  }

  _handleAppCommand(event) {
    // note: Dont use this._hoveringSidebar as it's not as reliable as checking for :hover
    if (!this.workspaceEnabled || !this._hoveringSidebar) {
      return;
    }

    const direction = this.naturalScroll ? -1 : 1;
    // event is forward or back
    switch (event.command) {
      case 'Forward':
        this.changeWorkspaceShortcut(1 * direction);
        event.stopImmediatePropagation();
        event.preventDefault();
        break;
      case 'Back':
        this.changeWorkspaceShortcut(-1 * direction);
        event.stopImmediatePropagation();
        event.preventDefault();
        break;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gNavToolbox.setAttribute('zen-has-hover', 'true');
      });
    });
  }

  _setupSidebarHandlers() {
    const toolbox = gNavToolbox;

    const scrollCooldown = 200; // Milliseconds to wait before allowing another scroll
    const scrollThreshold = 2; // Minimum scroll delta to trigger workspace change

    toolbox.addEventListener(
      'wheel',
      async (event) => {
        if (this.privateWindowOrDisabled) return;

        // Only process non-gesture scrolls
        if (event.deltaMode !== 1) return;

        const isVerticalScroll = event.deltaY && !event.deltaX;

        //if the scroll is vertical this checks that a modifier key is used before proceeding
        if (isVerticalScroll) {
          const activationKeyMap = {
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey,
          };

          if (
            this.activationMethod in activationKeyMap &&
            !activationKeyMap[this.activationMethod]
          ) {
            return;
          }
        }

        const currentTime = Date.now();
        if (currentTime - this._lastScrollTime < scrollCooldown) return;

        //this decides which delta to use
        const delta = isVerticalScroll ? event.deltaY : event.deltaX;
        if (Math.abs(delta) < scrollThreshold) return;

        // Determine scroll direction
        let rawDirection = delta > 0 ? 1 : -1;

        let direction = this.naturalScroll ? -1 : 1;
        this.changeWorkspaceShortcut(rawDirection * direction);

        this._lastScrollTime = currentTime;
      },
      { passive: true }
    );
  }

  initializeGestureHandlers() {
    const elements = [
      gNavToolbox,
      // event handlers do not work on elements inside shadow DOM so we need to attach them directly
      document.getElementById('tabbrowser-arrowscrollbox').shadowRoot.querySelector('scrollbox'),
    ];

    // Attach gesture handlers to each element
    for (const element of elements) {
      if (!element) continue;
      this.attachGestureHandlers(element);
    }
  }

  attachGestureHandlers(element) {
    element.addEventListener('MozSwipeGestureMayStart', this._handleSwipeMayStart.bind(this), true);
    element.addEventListener('MozSwipeGestureStart', this._handleSwipeStart.bind(this), true);
    element.addEventListener('MozSwipeGestureUpdate', this._handleSwipeUpdate.bind(this), true);

    // Use MozSwipeGesture instead of MozSwipeGestureEnd because MozSwipeGestureEnd is fired after animation ends,
    // while MozSwipeGesture is fired immediately after swipe ends.
    element.addEventListener('MozSwipeGesture', this._handleSwipeEnd.bind(this), true);

    element.addEventListener(
      'MozSwipeGestureEnd',
      () => {
        Services.prefs.setBoolPref('zen.swipe.is-fast-swipe', false);
        document.documentElement.removeAttribute('swipe-gesture');
        gZenUIManager.tabsWrapper.style.removeProperty('scrollbar-width');
        document.documentElement.style.setProperty('--zen-background-opacity', '1');
        delete this._hasAnimatedBackgrounds;
        this.updateTabsContainers();
        document.removeEventListener('popupshown', this.popupOpenHandler, { once: true });
      },
      true
    );
  }

  _popupOpenHandler() {
    // If a popup is opened, we should stop the swipe gesture
    if (this._swipeState?.isGestureActive) {
      document.documentElement.removeAttribute('swipe-gesture');
      gZenUIManager.tabsWrapper.style.removeProperty('scrollbar-width');
      this.updateTabsContainers();
      this._cancelSwipeAnimation();
    }
  }

  _handleSwipeMayStart(event) {
    if (this.privateWindowOrDisabled || this._inChangingWorkspace) return;
    if (event.target.closest('#zen-sidebar-foot-buttons')) return;

    // Only handle horizontal swipes
    if (event.direction === event.DIRECTION_LEFT || event.direction === event.DIRECTION_RIGHT) {
      event.preventDefault();
      event.stopPropagation();

      // Set allowed directions based on available workspaces
      event.allowedDirections |= event.DIRECTION_LEFT | event.DIRECTION_RIGHT;
    }
  }

  _handleSwipeStart(event) {
    if (!this.workspaceEnabled) return;

    document.documentElement.setAttribute('swipe-gesture', 'true');
    document.addEventListener('popupshown', this.popupOpenHandler, { once: true });

    event.preventDefault();
    event.stopPropagation();
    this._swipeState = {
      isGestureActive: true,
      lastDelta: 0,
      direction: null,
    };
    Services.prefs.setBoolPref('zen.swipe.is-fast-swipe', true);
  }

  _handleSwipeUpdate(event) {
    if (!this.workspaceEnabled || !this._swipeState?.isGestureActive) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = event.delta * 300;
    const stripWidth =
      document.getElementById('navigator-toolbox').getBoundingClientRect().width +
      document.getElementById('zen-sidebar-splitter').getBoundingClientRect().width * 2;
    let translateX = this._swipeState.lastDelta + delta;
    // Add a force multiplier as we are translating the strip depending on how close to the edge we are
    let forceMultiplier = Math.min(1, 1 - Math.abs(translateX) / (stripWidth * 4.5)); // 4.5 instead of 4 to add a bit of a buffer
    if (forceMultiplier > 0.5) {
      translateX *= forceMultiplier;
      this._swipeState.lastDelta = delta + (translateX - delta) * 0.5;
    } else {
      translateX = this._swipeState.lastDelta;
    }

    if (Math.abs(delta) > 0.8) {
      this._swipeState.direction = delta > 0 ? 'left' : 'right';
    }

    // Apply a translateX to the tab strip to give the user feedback on the swipe
    const currentWorkspace = this.getActiveWorkspaceFromCache();
    this._organizeWorkspaceStripLocations(currentWorkspace, true, translateX);
  }

  async _handleSwipeEnd(event) {
    if (!this.workspaceEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    const isRTL = document.documentElement.matches(':-moz-locale-dir(rtl)');
    const moveForward = (event.direction === SimpleGestureEvent.DIRECTION_RIGHT) !== isRTL;

    const rawDirection = moveForward ? 1 : -1;
    const direction = this.naturalScroll ? -1 : 1;
    await this.changeWorkspaceShortcut(rawDirection * direction, true);

    // Reset swipe state
    this._swipeState = {
      isGestureActive: false,
      lastDelta: 0,
      direction: null,
    };
  }

  get activeWorkspace() {
    return this._activeWorkspace;
  }

  set activeWorkspace(value) {
    this._activeWorkspace = value;
    if (this.privateWindowOrDisabled) {
      return;
    }
    Services.prefs.setStringPref('zen.workspaces.active', value);
  }

  async observe(subject, topic, data) {
    if (topic === 'weave:engine:sync:finish' && data === 'workspaces') {
      try {
        const lastChangeTimestamp = await ZenWorkspacesStorage.getLastChangeTimestamp();

        if (
          !this._workspaceCache ||
          !this._workspaceCache.lastChangeTimestamp ||
          lastChangeTimestamp > this._workspaceCache.lastChangeTimestamp
        ) {
          await this._propagateWorkspaceData();

          const currentWorkspace = await this.getActiveWorkspace();
          await gZenThemePicker.onWorkspaceChange(currentWorkspace);
        }
      } catch (error) {
        console.error('Error updating workspaces after sync:', error);
      }
    }
  }

  get shouldHaveWorkspaces() {
    if (typeof this._shouldHaveWorkspaces === 'undefined') {
      let chromeFlags = window.docShell.treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIAppWindow).chromeFlags;
      this._shouldHaveWorkspaces =
        chromeFlags & Ci.nsIWebBrowserChrome.CHROME_TOOLBAR ||
        chromeFlags & Ci.nsIWebBrowserChrome.CHROME_MENUBAR;
      return this._shouldHaveWorkspaces;
    }
    return this._shouldHaveWorkspaces;
  }

  get isPrivateWindow() {
    return PrivateBrowsingUtils.isWindowPrivate(window);
  }

  get privateWindowOrDisabled() {
    return this.isPrivateWindow || !this.shouldHaveWorkspaces;
  }

  get workspaceEnabled() {
    if (typeof this._workspaceEnabled === 'undefined') {
      this._workspaceEnabled =
        this.shouldHaveWorkspaces &&
        !Services.prefs.getBoolPref('zen.testing.profiling.enabled', false);
    }
    return this._workspaceEnabled && !window.closed;
  }

  getActiveWorkspaceFromCache() {
    return this.getWorkspaceFromId(this.activeWorkspace);
  }

  getWorkspaceFromId(id) {
    try {
      return this._workspaceCache.workspaces.find((workspace) => workspace.uuid === id);
    } catch {
      return null;
    }
  }

  async _workspaces() {
    if (this._workspaceCache) {
      return this._workspaceCache;
    }

    if (this.isPrivateWindow) {
      this._workspaceCache = {
        workspaces: this._privateWorkspace ? [this._privateWorkspace] : [],
        lastChangeTimestamp: 0,
      };
      this._activeWorkspace = this._privateWorkspace?.uuid;
      return this._workspaceCache;
    }

    const [workspaces, lastChangeTimestamp] = await Promise.all([
      ZenWorkspacesStorage.getWorkspaces(),
      ZenWorkspacesStorage.getLastChangeTimestamp(),
    ]);

    this._workspaceCache = { workspaces, lastChangeTimestamp };
    // Get the active workspace ID from preferences
    const activeWorkspaceId = this.activeWorkspace;

    if (activeWorkspaceId) {
      const activeWorkspace = this.getWorkspaceFromId(activeWorkspaceId);
      // Set the active workspace ID to the first one if the one with selected id doesn't exist
      if (!activeWorkspace) {
        this.activeWorkspace = this._workspaceCache.workspaces[0]?.uuid;
      }
    } else {
      // Set the active workspace ID to the first one if active workspace doesn't exist
      this.activeWorkspace = this._workspaceCache.workspaces[0]?.uuid;
    }
    // sort by position
    this._workspaceCache.workspaces.sort(
      (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity)
    );

    return this._workspaceCache;
  }

  async workspaceBookmarks() {
    if (this.privateWindowOrDisabled) {
      this._workspaceBookmarksCache = {
        bookmarks: [],
        lastChangeTimestamp: 0,
      };
      return this._workspaceBookmarksCache;
    }

    if (this._workspaceBookmarksCache) {
      return this._workspaceBookmarksCache;
    }

    const [bookmarks, lastChangeTimestamp] = await Promise.all([
      ZenWorkspaceBookmarksStorage.getBookmarkGuidsByWorkspace(),
      ZenWorkspaceBookmarksStorage.getLastChangeTimestamp(),
    ]);

    this._workspaceBookmarksCache = { bookmarks, lastChangeTimestamp };

    return this._workspaceCache;
  }

  async initializeWorkspaces() {
    let activeWorkspace = await this.getActiveWorkspace();
    this.activeWorkspace = activeWorkspace?.uuid;
    await gZenSessionStore.promiseInitialized;
    try {
      if (activeWorkspace) {
        window.gZenThemePicker = new nsZenThemePicker();
        await gZenThemePicker.onWorkspaceChange(activeWorkspace);
      }
    } catch (e) {
      console.error('gZenWorkspaces: Error initializing theme picker', e);
    }
    await this.workspaceBookmarks();
    await this.initializeTabsStripSections();
    this._initializeEmptyTab();
    await gZenPinnedTabManager.refreshPinnedTabs({ init: true });
    await this.changeWorkspace(activeWorkspace, { onInit: true });
    this.#fixTabPositions();
    this.onWindowResize();
    this._resolveInitialized();
    this._clearAnyZombieTabs(); // Dont call with await

    const tabUpdateListener = this.updateTabsContainers.bind(this);
    window.addEventListener('TabOpen', tabUpdateListener);
    window.addEventListener('TabClose', tabUpdateListener);
    window.addEventListener('TabAddedToEssentials', tabUpdateListener);
    window.addEventListener('TabRemovedFromEssentials', tabUpdateListener);
    window.addEventListener('TabPinned', tabUpdateListener);
    window.addEventListener('TabUnpinned', tabUpdateListener);
    window.addEventListener('aftercustomization', tabUpdateListener);
    window.addEventListener('TabSelect', this.onLocationChange.bind(this));

    window.addEventListener('TabBrowserInserted', this.onTabBrowserInserted.bind(this));
  }

  async selectStartPage() {
    if (!this.workspaceEnabled) {
      return;
    }
    await this.promiseInitialized;
    let showed = false;
    let resolveSelectPromise;
    let selectPromise = new Promise((resolve) => {
      resolveSelectPromise = resolve;
    });

    const cleanup = () => {
      delete this._tabToSelect;
      delete this._tabToRemoveForEmpty;
      resolveSelectPromise();
    };

    let removedEmptyTab = false;
    if (
      this._initialTab &&
      !(this._initialTab._shouldRemove && this._initialTab._veryPossiblyEmpty)
    ) {
      gBrowser.selectedTab = this._initialTab;
      this.moveTabToWorkspace(this._initialTab, this.activeWorkspace);
      gBrowser.moveTabTo(this._initialTab, { forceUngrouped: true, tabIndex: 0 });
      removedEmptyTab = true;
      delete this._initialTab;
    }

    if (this._tabToRemoveForEmpty && !removedEmptyTab) {
      const tabs = gBrowser.tabs.filter((tab) => !tab.collapsed);
      if (
        typeof this._tabToSelect === 'number' &&
        this._tabToSelect >= 0 &&
        tabs[this._tabToSelect] &&
        (await this.#shouldShowTabInCurrentWorkspace(tabs[this._tabToSelect])) &&
        tabs[this._tabToSelect] !== this._tabToRemoveForEmpty
      ) {
        this.log(`Found tab to select: ${this._tabToSelect}, ${tabs.length}`);
        setTimeout(() => {
          let tabToUse = gZenGlanceManager.getTabOrGlanceParent(
            tabs[this._tabToSelect + 1] || this._emptyTab
          );
          gBrowser.selectedTab = tabToUse;
          this._removedByStartupPage = true;
          gBrowser.removeTab(this._tabToRemoveForEmpty, {
            skipSessionStore: true,
          });
          cleanup();
        }, 0);
      } else {
        this.selectEmptyTab();
        showed = true;
        setTimeout(() => {
          this._removedByStartupPage = true;
          gBrowser.removeTab(this._tabToRemoveForEmpty, {
            skipSessionStore: true,
            animate: false,
          });
          cleanup();
        }, 0);
      }
    } else {
      setTimeout(() => {
        cleanup();
      }, 0);
    }

    await selectPromise;
    if (this._initialTab) {
      this._removedByStartupPage = true;
      gBrowser.removeTab(this._initialTab, {
        skipSessionStore: true,
      });
      delete this._initialTab;
    }

    if (gZenVerticalTabsManager._canReplaceNewTab && showed) {
      BrowserCommands.openTab();
    }

    if (
      !gZenVerticalTabsManager._canReplaceNewTab &&
      !Services.prefs.getBoolPref('zen.workspaces.continue-where-left-off')
    ) {
      // Go through each tab and see if there's another tab with the same startup URL.
      // If we do find one, remove it.
      const newTabUrl = Services.prefs.getStringPref('browser.startup.homepage');
      const tabs = gBrowser.tabs.filter(
        (tab) => !tab.collapsed && !tab.hasAttribute('zen-empty-tab') && !tab.pinned
      );
      for (const tab of tabs) {
        if (tab._originalUrl === newTabUrl && tab !== gBrowser.selectedTab) {
          gBrowser.removeTab(tab, {
            skipSessionStore: true,
          });
        }
      }
    }

    window.dispatchEvent(new CustomEvent('AfterWorkspacesSessionRestore', { bubbles: true }));
  }

  handleInitialTab(tab, isEmpty) {
    if (gZenUIManager.testingEnabled || !this.workspaceEnabled) {
      return;
    }
    // note: We cant access `gZenVerticalTabsManager._canReplaceNewTab` this early
    if (isEmpty && Services.prefs.getBoolPref('zen.urlbar.replace-newtab', true)) {
      this._tabToRemoveForEmpty = tab;
    } else {
      this._initialTab = tab;
      this._initialTab._veryPossiblyEmpty = isEmpty;
    }
  }

  changeWorkspaceIcon() {
    let anchor = this.activeWorkspaceIndicator?.querySelector(
      '.zen-current-workspace-indicator-icon'
    );
    if (this.#contextMenuData?.workspaceId) {
      anchor = this.#contextMenuData.originalTarget;
    }
    const workspaceId = this.#contextMenuData?.workspaceId || this.activeWorkspace;
    if (!anchor) {
      return;
    }
    const hasNoIcon = anchor.hasAttribute('no-icon');
    anchor.removeAttribute('no-icon');
    if (hasNoIcon) {
      anchor.textContent = '';
    }
    gZenEmojiPicker
      .open(anchor)
      .then(async (emoji) => {
        const workspace = this.getWorkspaceFromId(workspaceId);
        if (!workspace) {
          console.warn('No active workspace found to change icon');
          return;
        }
        workspace.icon = emoji;
        await this.saveWorkspace(workspace);
      })
      .catch((error) => {
        console.warn('Error changing workspace icon:', error);
        if (hasNoIcon) {
          anchor.setAttribute('no-icon', 'true');
        }
      });
  }

  shouldCloseWindow() {
    return (
      !window.toolbar.visible || Services.prefs.getBoolPref('browser.tabs.closeWindowWithLastTab')
    );
  }

  async _clearAnyZombieTabs() {
    const tabs = this.allStoredTabs;
    const workspaces = await this._workspaces();
    for (let tab of tabs) {
      const workspaceID = tab.getAttribute('zen-workspace-id');
      if (
        workspaceID &&
        !tab.hasAttribute('zen-essential') &&
        !workspaces.workspaces.find((workspace) => workspace.uuid === workspaceID)
      ) {
        // Remove any tabs where their workspace doesn't exist anymore
        gBrowser.unpinTab(tab);
        gBrowser.removeTab(tab, {
          skipSessionStore: true,
          closeWindowWithLastTab: false,
        });
      }
    }
  }

  handleTabBeforeClose(tab, closeWindowWithLastTab = false) {
    if (!this.workspaceEnabled || this.__contextIsDelete || this._removedByStartupPage) {
      return null;
    }

    let workspaceID = tab.getAttribute('zen-workspace-id');
    if (!workspaceID) {
      return null;
    }

    let tabs = gBrowser.visibleTabs;
    let tabsPinned = tabs.filter(
      (t) => !this.shouldOpenNewTabIfLastUnpinnedTabIsClosed || !t.pinned
    );
    const shouldCloseWindow = this.shouldCloseWindow() && closeWindowWithLastTab;
    if (tabs.length === 1 && tabs[0] === tab) {
      if (shouldCloseWindow) {
        // We've already called beforeunload on all the relevant tabs if we get here,
        // so avoid calling it again:
        window.skipNextCanClose = true;

        // Closing the tab and replacing it with a blank one is notably slower
        // than closing the window right away. If the caller opts in, take
        // the fast path.
        if (!gBrowser._removingTabs.size) {
          // This call actually closes the window, unless the user
          // cancels the operation.  We are finished here in both cases.
          this._isClosingWindow = true;
          // Inside a setTimeout to avoid reentrancy issues.
          setTimeout(() => {
            document.getElementById('cmd_closeWindow').doCommand();
          }, 100);
        }
        return null;
      }
    } else if (tabsPinned.length === 1 && tabsPinned[0] === tab) {
      return this.selectEmptyTab();
    }

    return null;
  }

  addPopupListeners() {
    const workspaceActions = document.getElementById('zenWorkspaceMoreActions');
    workspaceActions.addEventListener('popupshowing', this.updateWorkspaceActionsMenu.bind(this));
    workspaceActions.addEventListener('popuphidden', () => {
      setTimeout(() => {
        setTimeout(() => {
          this.#contextMenuData = null;
        }, 0);
      }, 0); // Delay to ensure the context menu data is cleared after the popup is hidden
    });

    const contextChangeContainerTabMenu = document.getElementById(
      'context_zenWorkspacesOpenInContainerTab'
    );
    contextChangeContainerTabMenu.addEventListener(
      'popupshowing',
      this.updateWorkspaceActionsMenuContainer.bind(this)
    );
    contextChangeContainerTabMenu.addEventListener(
      'command',
      this.contextChangeContainerTab.bind(this)
    );
  }

  #contextMenuData = null;
  updateWorkspaceActionsMenu(event) {
    if (event.target.id !== 'zenWorkspaceMoreActions') {
      return;
    }
    const openInContainerMenuItem = document.getElementById(
      'context_zenWorkspacesOpenInContainerTab'
    );
    if (this.shouldShowContainers) {
      openInContainerMenuItem.removeAttribute('hidden');
    } else {
      openInContainerMenuItem.setAttribute('hidden', 'true');
    }
    // Call parent node as on windows, the text can be double clicked
    let target;
    try {
      target = event.explicitOriginalTarget?.closest('toolbarbutton');
    } catch (e) {
      console.error('Error getting explicitOriginalTarget in context menu:', e);
    }
    this.#contextMenuData = {
      workspaceId: target?.getAttribute('zen-workspace-id'),
      originalTarget: target,
    };
    const workspaceName = document.getElementById('context_zenEditWorkspace');
    const themePicker = document.getElementById('context_zenChangeWorkspaceTheme');
    workspaceName.hidden =
      this.#contextMenuData.workspaceId &&
      this.#contextMenuData.workspaceId !== this.activeWorkspace;
    themePicker.hidden =
      this.#contextMenuData.workspaceId &&
      this.#contextMenuData.workspaceId !== this.activeWorkspace;
    const separator = document.getElementById('context_zenWorkspacesSeparator');
    for (const item of event.target.querySelectorAll('.zen-workspace-context-menu-item')) {
      item.remove();
    }
    if (!this.#contextMenuData.workspaceId) {
      separator.hidden = false;
      for (const workspace of [...this._workspaceCache.workspaces].reverse()) {
        const item = document.createXULElement('menuitem');
        item.className = 'zen-workspace-context-menu-item';
        item.setAttribute('zen-workspace-id', workspace.uuid);
        item.setAttribute('disabled', workspace.uuid === this.activeWorkspace);
        let name = workspace.name;
        const iconIsSvg = workspace.icon && workspace.icon.endsWith('.svg');
        if (workspace.icon && workspace.icon !== '' && !iconIsSvg) {
          name = `${workspace.icon}  ${name}`;
        }
        item.setAttribute('label', name);
        if (iconIsSvg) {
          item.setAttribute('image', workspace.icon);
        }
        item.addEventListener('command', (e) => {
          this.changeWorkspaceWithID(e.target.closest('menuitem').getAttribute('zen-workspace-id'));
        });
        separator.after(item);
      }
    } else {
      separator.hidden = true;
    }
    event.target.addEventListener(
      'popuphidden',
      () => {
        this.#contextMenuData = null;
      },
      { once: true }
    );
  }

  updateWorkspaceActionsMenuContainer(event) {
    let workspace;
    if (this.#contextMenuData?.workspaceId) {
      workspace = this.getWorkspaceFromId(this.#contextMenuData.workspaceId);
    } else {
      workspace = this.getActiveWorkspaceFromCache();
    }
    let containerTabId = workspace.containerTabId;
    return window.createUserContextMenu(event, {
      isContextMenu: true,
      excludeUserContextId: containerTabId,
      showDefaultTab: true,
    });
  }

  async saveWorkspace(workspaceData, preventPropagation = false) {
    if (this.privateWindowOrDisabled) {
      return;
    }
    await ZenWorkspacesStorage.saveWorkspace(workspaceData);
    if (!preventPropagation) {
      await this._propagateWorkspaceData();
      await this._updateWorkspacesChangeContextMenu();
    }
  }

  async removeWorkspace(windowID) {
    let workspacesData = await this._workspaces();
    await this.changeWorkspace(
      workspacesData.workspaces.find((workspace) => workspace.uuid !== windowID)
    );
    this._deleteAllTabsInWorkspace(windowID);
    delete this._lastSelectedWorkspaceTabs[windowID];
    await ZenWorkspacesStorage.removeWorkspace(windowID);
    // Remove the workspace from the cache
    this._workspaceCache.workspaces = this._workspaceCache.workspaces.filter(
      (workspace) => workspace.uuid !== windowID
    );
    await this._propagateWorkspaceData();
    await this._updateWorkspacesChangeContextMenu();
    this.workspaceElement(windowID)?.remove();
    this.onWindowResize();
    this.registerPinnedResizeObserver();
  }

  isWorkspaceActive(workspace) {
    return workspace.uuid === this.activeWorkspace;
  }

  async getActiveWorkspace() {
    const workspaces = await this._workspaces();
    return (
      workspaces.workspaces.find((workspace) => workspace.uuid === this.activeWorkspace) ??
      workspaces.workspaces[0]
    );
  }
  // Workspaces dialog UI management
  workspaceHasIcon(workspace) {
    return workspace.icon && workspace.icon !== '';
  }

  getWorkspaceIcon(workspace) {
    if (this.workspaceHasIcon(workspace)) {
      return workspace.icon;
    }
    return '';
  }

  get shouldShowContainers() {
    return (
      Services.prefs.getBoolPref('privacy.userContext.ui.enabled') &&
      ContextualIdentityService.getPublicIdentities().length > 0
    );
  }

  async _propagateWorkspaceDataForWindow(browser, { ignoreStrip = false, clearCache = true } = {}) {
    if (clearCache) {
      browser.gZenWorkspaces._workspaceCache = null;
      browser.gZenWorkspaces._workspaceBookmarksCache = null;
    }
    let workspaces = await browser.gZenWorkspaces._workspaces();
    browser.document
      .getElementById('cmd_zenCtxDeleteWorkspace')
      .setAttribute('disabled', workspaces.workspaces.length <= 1);
    if (clearCache) {
      browser.dispatchEvent(
        new CustomEvent('ZenWorkspacesUIUpdate', {
          bubbles: true,
          detail: { activeIndex: browser.gZenWorkspaces.activeWorkspace },
        })
      );
    }
    await browser.gZenWorkspaces.workspaceBookmarks();
    if (!ignoreStrip) {
      browser.gZenWorkspaces._fixIndicatorsNames(workspaces);
    }
  }

  async _propagateWorkspaceData({ ignoreStrip = false, clearCache = true, onInit = false } = {}) {
    const currentWindowIsPrivate = this.isPrivateWindow;
    if (onInit) {
      if (currentWindowIsPrivate) return;
      return await this._propagateWorkspaceDataForWindow(this.ownerWindow, {
        ignoreStrip,
        clearCache,
      });
    }
    await this.foreachWindowAsActive(async (browser) => {
      // Do not update the window if workspaces are not enabled in it.
      // For example, when the window is in private browsing mode.
      if (
        !browser.gZenWorkspaces.workspaceEnabled ||
        browser.gZenWorkspaces.isPrivateWindow !== currentWindowIsPrivate
      ) {
        return;
      }
      this._propagateWorkspaceDataForWindow(browser, {
        ignoreStrip,
        clearCache,
      }).catch(console.error);
    });
  }

  async reorderWorkspace(id, newPosition) {
    if (this.privateWindowOrDisabled) {
      return;
    }
    const workspaces = (await this._workspaces()).workspaces;
    const workspace = workspaces.find((w) => w.uuid === id);
    if (!workspace) {
      console.warn(`Workspace with ID ${id} not found for reordering.`);
      return;
    }
    // Remove the workspace from its current position
    const currentIndex = workspaces.indexOf(workspace);
    if (currentIndex === -1) {
      console.warn(`Workspace with ID ${id} not found in the list.`);
      return;
    }
    workspaces.splice(currentIndex, 1);
    // Insert the workspace at the new position
    if (newPosition < 0 || newPosition > workspaces.length) {
      console.warn(`Invalid position ${newPosition} for reordering workspace with ID ${id}.`);
      return;
    }
    workspaces.splice(newPosition, 0, workspace);
    // Update the positions in the storage
    await ZenWorkspacesStorage.updateWorkspacePositions(workspaces);
    // Propagate the changes
    await this._propagateWorkspaceData();
  }

  async moveWorkspace(draggedWorkspaceId, targetWorkspaceId) {
    const workspaces = (await this._workspaces()).workspaces;
    const draggedIndex = workspaces.findIndex((w) => w.uuid === draggedWorkspaceId);
    const draggedWorkspace = workspaces.splice(draggedIndex, 1)[0];
    const targetIndex = workspaces.findIndex((w) => w.uuid === targetWorkspaceId);
    workspaces.splice(targetIndex, 0, draggedWorkspace);

    await ZenWorkspacesStorage.updateWorkspacePositions(workspaces);
    await this._propagateWorkspaceData();
  }

  async openWorkspaceCreation() {
    let createForm;
    const previousWorkspace = await this.getActiveWorkspace();
    document.documentElement.setAttribute('zen-creating-workspace', 'true');
    await this.createAndSaveWorkspace('Space', undefined, false, 0, {
      beforeChangeCallback: async (workspace) => {
        createForm = document.createXULElement('zen-workspace-creation');
        createForm.setAttribute('workspace-id', workspace.uuid);
        createForm.setAttribute('previous-workspace-id', previousWorkspace?.uuid || '');
        gBrowser.tabContainer.after(createForm);
        await createForm.promiseInitialized;
      },
    });
    createForm.finishSetup();
  }

  // Workspaces management

  _deleteAllTabsInWorkspace(workspaceID) {
    gBrowser.removeTabs(
      Array.from(this.allStoredTabs).filter(
        (tab) =>
          tab.getAttribute('zen-workspace-id') === workspaceID &&
          !tab.hasAttribute('zen-empty-tab') &&
          !tab.hasAttribute('zen-essential')
      ),
      {
        animate: false,
        skipSessionStore: true,
        closeWindowWithLastTab: false,
      }
    );
  }

  moveTabToWorkspace(tab, workspaceID) {
    return this.moveTabsToWorkspace([tab], workspaceID);
  }

  moveTabsToWorkspace(tabs, workspaceID, justChangeId = false) {
    for (let tab of tabs) {
      const workspaceContainer = this.workspaceElement(workspaceID);
      const container = tab.pinned
        ? workspaceContainer?.pinnedTabsContainer
        : workspaceContainer?.tabsContainer;
      if (container?.contains(tab)) {
        continue;
      }

      tab.setAttribute('zen-workspace-id', workspaceID);
      if (tab.hasAttribute('zen-essential')) {
        continue;
      }

      if (container && !justChangeId) {
        if (tab.group?.hasAttribute('split-view-group')) {
          this.moveTabsToWorkspace(tab.group.tabs, workspaceID, true);
          container.insertBefore(tab.group, container.lastChild);
          continue;
        }
        container.insertBefore(tab, container.lastChild);
      }
      // also change glance tab if it's the same tab
      const glanceTab = tab.querySelector('.tabbrowser-tab[zen-glance-tab]');
      if (glanceTab) {
        glanceTab.setAttribute('zen-workspace-id', workspaceID);
      }
    }
    return true;
  }

  _prepareNewWorkspace(window) {
    document.documentElement.setAttribute('zen-workspace-id', window.uuid);
    let tabCount = 0;
    for (let tab of gBrowser.tabs) {
      const isEssential = tab.getAttribute('zen-essential') === 'true';
      if (!tab.hasAttribute('zen-workspace-id') && !tab.pinned && !isEssential) {
        this.moveTabToWorkspace(tab, window.uuid);
        tabCount++;
      }
    }
    if (tabCount === 0) {
      this.selectEmptyTab();
    }
  }

  addChangeListeners(
    func,
    opts = {
      once: false,
    }
  ) {
    if (!this._changeListeners) {
      this._changeListeners = [];
    }
    this._changeListeners.push({ func, opts });
  }

  removeChangeListeners(func) {
    if (!this._changeListeners) {
      return;
    }
    this._changeListeners = this._changeListeners.filter((listener) => listener.func !== func);
  }

  async changeWorkspaceWithID(workspaceID, ...args) {
    const workspace = this.getWorkspaceFromId(workspaceID);
    return await this.changeWorkspace(workspace, ...args);
  }

  async changeWorkspace(workspace, ...args) {
    if (!this.workspaceEnabled || this._inChangingWorkspace) {
      return;
    }
    this._inChangingWorkspace = true;
    try {
      this.log('Changing workspace to', workspace?.uuid);
      await this._performWorkspaceChange(workspace, ...args);
    } catch (e) {
      console.error('gZenWorkspaces: Error changing workspace', e);
    }
    this._inChangingWorkspace = false;
  }

  _cancelSwipeAnimation() {
    this._animateTabs(this.getActiveWorkspaceFromCache(), true);
  }

  async _performWorkspaceChange(
    workspace,
    { onInit = false, alwaysChange = false, whileScrolling = false } = {}
  ) {
    const previousWorkspace = await this.getActiveWorkspace();
    alwaysChange = alwaysChange || onInit;
    this.activeWorkspace = workspace.uuid;
    if (previousWorkspace && previousWorkspace.uuid === workspace.uuid && !alwaysChange) {
      this._cancelSwipeAnimation();
      return;
    }

    const workspaces = await this._workspaces();

    // Refresh tab cache
    for (const otherWorkspace of workspaces.workspaces) {
      const container = this.workspaceElement(otherWorkspace.uuid);
      container.active = otherWorkspace.uuid === workspace.uuid;
    }
    // note: We are calling this even though it is also called in `updateTabsContainers`. This is mostly
    // due to a race condition where the workspace strip is not updated before the tabs are moved.
    this.makeSureEmptyTabIsFirst();
    gBrowser.pinnedTabsContainer = this.pinnedTabsContainer || gBrowser.pinnedTabsContainer;
    gBrowser.tabContainer.pinnedTabsContainer =
      this.pinnedTabsContainer || gBrowser.tabContainer.pinnedTabsContainer;

    this.tabContainer._invalidateCachedTabs();
    if (!whileScrolling) {
      await this._organizeWorkspaceStripLocations(previousWorkspace);
    }

    // Second pass: Handle tab selection
    this.tabContainer._invalidateCachedTabs();
    const tabToSelect = await this._handleTabSelection(workspace, onInit, previousWorkspace.uuid);
    gBrowser.warmupTab(tabToSelect);

    // Update UI and state
    const previousWorkspaceIndex = workspaces.workspaces.findIndex(
      (w) => w.uuid === previousWorkspace.uuid
    );
    await this._updateWorkspaceState(workspace, onInit, tabToSelect, {
      previousWorkspaceIndex,
      previousWorkspace,
    });
  }

  makeSureEmptyTabIsFirst() {
    const emptyTab = this._emptyTab;
    if (emptyTab) {
      emptyTab.setAttribute('zen-workspace-id', this.activeWorkspace);
      gBrowser.TabStateFlusher.flush(emptyTab.linkedBrowser);
      const container = this.activeWorkspaceStrip;
      if (container) {
        container.insertBefore(emptyTab, container.firstChild);
      }
    }
    this.#fixTabPositions();
  }

  #fixTabPositions() {
    // Fix tabs _tPos values relative to the actual order
    const tabs = gBrowser.tabs;
    const usedGroups = new Set();
    let tPos = 0; // _tPos is used for the session store, not needed for folders
    let pPos = 0; // _pPos is used for the pinned tabs manager
    const recurseFolder = (tab) => {
      if (tab.group) {
        recurseFolder(tab.group);
        if (!usedGroups.has(tab.group.id)) {
          usedGroups.add(tab.group.id);
          tab.group._pPos = pPos++;
        }
      }
    };
    for (const tab of tabs) {
      recurseFolder(tab);
      tab._tPos = tPos++;
      if (!tab.hasAttribute('zen-empty-tab')) {
        tab._pPos = pPos++;
      }
    }
  }

  _updatePaddingTopOnTabs(
    workspaceElement,
    essentialContainer,
    forAnimation = false,
    animateContainer = false
  ) {
    if (
      workspaceElement &&
      !(this._inChangingWorkspace && !forAnimation && !this._alwaysAnimatePaddingTop)
    ) {
      delete this._alwaysAnimatePaddingTop;
      const essentialsHeight = essentialContainer.getBoundingClientRect().height;
      if (!forAnimation && animateContainer && gZenUIManager.motion && gZenStartup.isReady) {
        gZenUIManager.motion.animate(
          workspaceElement,
          {
            paddingTop: [workspaceElement.style.paddingTop, essentialsHeight + 'px'],
          },
          {
            type: 'spring',
            bounce: 0,
            duration: 0.2,
          }
        );
      } else {
        requestAnimationFrame(() => {
          workspaceElement.style.paddingTop = essentialsHeight + 'px';
        });
      }
    }
  }

  async _organizeWorkspaceStripLocations(workspace, justMove = false, offsetPixels = 0) {
    if (document.documentElement.hasAttribute('zen-creating-workspace')) {
      // If we are creating a workspace, we don't want to animate the strip
      return;
    }
    this._organizingWorkspaceStrip = true;
    const workspaces = await this._workspaces();
    let workspaceIndex = workspaces.workspaces.findIndex((w) => w.uuid === workspace.uuid);
    if (!justMove) {
      this._fixIndicatorsNames(workspaces);
    }
    const otherContainersEssentials = document.querySelectorAll(
      `#zen-essentials .zen-workspace-tabs-section`
    );
    const workspaceContextId = workspace.containerTabId;
    const nextWorkspaceContextId =
      workspaces.workspaces[workspaceIndex + (offsetPixels > 0 ? -1 : 1)]?.containerTabId;
    for (const otherWorkspace of workspaces.workspaces) {
      const element = this.workspaceElement(otherWorkspace.uuid);
      const newTransform = -(workspaceIndex - workspaces.workspaces.indexOf(otherWorkspace)) * 100;
      element.style.transform = `translateX(${newTransform + offsetPixels / 2}%)`;
    }
    // Hide other essentials with different containerTabId
    for (const container of otherContainersEssentials) {
      // Get the next workspace contextId, if it's the same, dont apply offsetPixels
      // if it's not we do apply it
      if (
        container.getAttribute('container') != workspace.containerTabId &&
        this.shouldAnimateEssentials
      ) {
        container.setAttribute('hidden', 'true');
      } else {
        container.removeAttribute('hidden');
      }
      if (
        nextWorkspaceContextId !== workspaceContextId &&
        offsetPixels &&
        this.shouldAnimateEssentials &&
        (container.getAttribute('container') == nextWorkspaceContextId ||
          container.getAttribute('container') == workspaceContextId)
      ) {
        container.removeAttribute('hidden');
        // Animate from the currently selected workspace
        if (container.getAttribute('container') == workspaceContextId) {
          container.style.transform = `translateX(${offsetPixels / 2}%)`;
        } else {
          // Animate from the next workspace, transitioning towards the current one
          container.style.transform = `translateX(${offsetPixels / 2 + (offsetPixels > 0 ? -100 : 100)}%)`;
        }
      }
    }
    if (offsetPixels) {
      // Find the next workspace we are scrolling to
      const nextWorkspace = workspaces.workspaces[workspaceIndex + (offsetPixels > 0 ? -1 : 1)];
      if (nextWorkspace) {
        const [nextGradient, nextGrain] =
          await gZenThemePicker.getGradientForWorkspace(nextWorkspace);
        const existingGrain = (await gZenThemePicker.getGradientForWorkspace(workspace))[1];
        const percentage = Math.abs(offsetPixels) / 200;
        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            document.documentElement.style.setProperty('--zen-background-opacity', 1 - percentage);
            if (!this._hasAnimatedBackgrounds) {
              this._hasAnimatedBackgrounds = true;
              document.documentElement.style.setProperty(
                '--zen-main-browser-background-old',
                nextGradient
              );
            }
            resolve();
          });
        });
        // Fit the offsetPixels into the grain limits. Both ends may be nextGrain and existingGrain,
        // so we need to use the min and max of both. For example, existing may be 0.2 and next may be 0.5,
        // meaning we should convert the offset to a percentage between 0.2 and 0.5. BUT if existingGrain
        // is 0.5 and nextGrain is 0.2, we should still convert the offset to a percentage between 0.2 and 0.5.
        const minGrain = Math.min(existingGrain, nextGrain);
        const maxGrain = Math.max(existingGrain, nextGrain);
        const grainValue =
          minGrain +
          (maxGrain - minGrain) * (existingGrain > nextGrain ? 1 - percentage : percentage);
        gZenThemePicker.updateNoise(grainValue);
      }
    } else {
      delete this._hasAnimatedBackgrounds;
    }
    delete this._organizingWorkspaceStrip;
  }

  updateWorkspaceIndicator(currentWorkspace, workspaceIndicator) {
    if (!workspaceIndicator) {
      return;
    }
    const indicatorName = workspaceIndicator.querySelector('.zen-current-workspace-indicator-name');
    const indicatorIcon = workspaceIndicator.querySelector('.zen-current-workspace-indicator-icon');

    if (this.workspaceHasIcon(currentWorkspace)) {
      indicatorIcon.removeAttribute('no-icon');
    } else {
      indicatorIcon.setAttribute('no-icon', 'true');
    }
    const icon = this.getWorkspaceIcon(currentWorkspace);
    indicatorIcon.innerHTML = '';
    if (icon?.endsWith('.svg')) {
      const img = document.createElement('img');
      img.src = icon;
      indicatorIcon.appendChild(img);
    } else {
      indicatorIcon.textContent = icon;
    }
    indicatorName.textContent = currentWorkspace.name;
  }

  _fixIndicatorsNames(workspaces) {
    for (const workspace of workspaces.workspaces) {
      const workspaceIndicator = this.workspaceElement(workspace.uuid)?.indicator;
      this.updateWorkspaceIndicator(workspace, workspaceIndicator);
    }
  }

  async _animateTabs(
    newWorkspace,
    shouldAnimate,
    tabToSelect = null,
    { previousWorkspaceIndex = null, previousWorkspace = null, onInit = false } = {}
  ) {
    gZenUIManager.tabsWrapper.style.scrollbarWidth = 'none';
    const kGlobalAnimationDuration = 0.3;
    this._animatingChange = true;
    const animations = [];
    const workspaces = await this._workspaces();
    const newWorkspaceIndex = workspaces.workspaces.findIndex((w) => w.uuid === newWorkspace.uuid);
    const isGoingLeft = newWorkspaceIndex <= previousWorkspaceIndex;
    const clonedEssentials = [];
    if (shouldAnimate && this.shouldAnimateEssentials && previousWorkspace) {
      for (const workspace of workspaces.workspaces) {
        const essentialsContainer = this.getEssentialsSection(workspace.containerTabId);
        if (clonedEssentials[clonedEssentials.length - 1]?.contextId == workspace.containerTabId) {
          clonedEssentials[clonedEssentials.length - 1].repeat++;
          clonedEssentials[clonedEssentials.length - 1].workspaces.push(workspace);
          continue;
        }
        essentialsContainer.setAttribute('hidden', 'true');
        const essentialsClone = essentialsContainer.cloneNode(true);
        essentialsClone.removeAttribute('hidden');
        essentialsClone.setAttribute('cloned', 'true');
        clonedEssentials.push({
          container: essentialsClone,
          workspaces: [workspace],
          contextId: workspace.containerTabId,
          originalContainer: essentialsContainer,
          repeat: 0,
        });
      }
    }
    document.documentElement.setAttribute('animating-background', 'true');
    if (shouldAnimate && previousWorkspace) {
      let previousBackgroundOpacity = document.documentElement.style.getPropertyValue(
        '--zen-background-opacity'
      );
      try {
        // Prevent NaN from being set
        if (previousBackgroundOpacity) {
          previousBackgroundOpacity = parseFloat(previousBackgroundOpacity);
        }
      } catch {
        previousBackgroundOpacity = 1;
      }
      if (previousBackgroundOpacity == 1 || !previousBackgroundOpacity) {
        previousBackgroundOpacity = 0;
      } else {
        previousBackgroundOpacity = 1 - previousBackgroundOpacity;
      }
      gZenThemePicker.previousBackgroundOpacity = previousBackgroundOpacity;
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          document.documentElement.style.setProperty(
            '--zen-background-opacity',
            previousBackgroundOpacity
          );
          animations.push(
            gZenUIManager.motion.animate(
              document.documentElement,
              {
                '--zen-background-opacity': [previousBackgroundOpacity, 1],
              },
              {
                type: 'spring',
                bounce: 0,
                duration: kGlobalAnimationDuration,
              }
            )
          );
          resolve();
        });
      });
    }
    for (const element of document.querySelectorAll('zen-workspace')) {
      if (element.classList.contains('zen-essentials-container')) {
        continue;
      }
      const existingTransform = element.style.transform;
      const elementWorkspaceId = element.id;
      const elementWorkspaceIndex = workspaces.workspaces.findIndex(
        (w) => w.uuid === elementWorkspaceId
      );
      const offset = -(newWorkspaceIndex - elementWorkspaceIndex) * 100;
      const newTransform = `translateX(${offset}%)`;
      if (shouldAnimate) {
        const existingPaddingTop = element.style.paddingTop;
        animations.push(
          gZenUIManager.motion.animate(
            element,
            {
              transform: existingTransform ? [existingTransform, newTransform] : newTransform,
              paddingTop: existingTransform
                ? [existingPaddingTop, existingPaddingTop]
                : existingPaddingTop,
            },
            {
              type: 'spring',
              bounce: 0,
              duration: kGlobalAnimationDuration,
            }
          )
        );
      }
      element.active = offset === 0;
      if (offset === 0) {
        if (tabToSelect != gBrowser.selectedTab && !onInit) {
          gBrowser.selectedTab = tabToSelect;
        }
      }
    }
    if (this.shouldAnimateEssentials && previousWorkspace) {
      // Animate essentials
      const newWorkspaceEssentialsContainer = clonedEssentials.find((cloned) =>
        cloned.workspaces.some((w) => w.uuid === newWorkspace.uuid)
      );
      // Get a list of essentials containers that are in between the first and last workspace
      const essentialsContainersInBetween = clonedEssentials.filter((cloned) => {
        const essentialsWorkspaces = cloned.workspaces;
        const firstIndex = workspaces.workspaces.findIndex(
          (w) => w.uuid === essentialsWorkspaces[0].uuid
        );
        const lastIndex = workspaces.workspaces.findIndex(
          (w) => w.uuid === essentialsWorkspaces[essentialsWorkspaces.length - 1].uuid
        );

        const [start, end] = [
          Math.min(previousWorkspaceIndex, newWorkspaceIndex),
          Math.max(previousWorkspaceIndex, newWorkspaceIndex),
        ];

        // Check if any part of the container overlaps with the movement range
        return firstIndex <= end && lastIndex >= start;
      });
      for (const cloned of clonedEssentials) {
        const container = cloned.container;
        const essentialsWorkspaces = cloned.workspaces;
        const repeats = cloned.repeat;
        // Animate like the workspaces above expect essentials are a bit more
        // complicated because they are not based on workspaces but on containers
        // So, if we have the following arangement:
        //  | [workspace1] [workspace2] [workspace3] [workspace4]
        //  | [container1] [container1] [container2] [container1]
        // And if we are changing from workspace 1 to workspace 4,
        // we should be doing the following:
        // First container (repeat 2 times) will stay in place until
        // we reach container 3, then animate to the left and container 2
        // also move to the left after that while container 1 in workspace 4
        // will slide in from the right

        // Get the index from first and last workspace
        const firstWorkspaceIndex = workspaces.workspaces.findIndex(
          (w) => w.uuid === essentialsWorkspaces[0].uuid
        );
        const lastWorkspaceIndex = workspaces.workspaces.findIndex(
          (w) => w.uuid === essentialsWorkspaces[essentialsWorkspaces.length - 1].uuid
        );
        cloned.originalContainer.style.removeProperty('transform');
        // Check if the container is even going to appear on the screen, to save on animation
        if (
          // We also need to check if the container is even going to appear on the screen.
          // In order to do this, we need to check if the container is between the first and last workspace.
          // Note that essential containers can have multiple workspaces,
          // so we need to check if any of the workspaces in the container are between the
          // first and last workspace.
          !essentialsContainersInBetween.find(
            (clonedEssentials) =>
              clonedEssentials.workspaces.some((w) => w.uuid === essentialsWorkspaces[0].uuid) &&
              clonedEssentials.workspaces.some(
                (w) => w.uuid === essentialsWorkspaces[essentialsWorkspaces.length - 1].uuid
              )
          )
        ) {
          continue;
        }
        cloned.originalContainer.parentNode.appendChild(container);
        let stepsInBetween =
          Math.abs(newWorkspaceIndex - (isGoingLeft ? firstWorkspaceIndex : lastWorkspaceIndex)) +
          1;
        const usingSameContainer =
          newWorkspaceEssentialsContainer.workspaces.some((w) => w.uuid === newWorkspace.uuid) &&
          newWorkspaceEssentialsContainer.workspaces.some((w) => w.uuid === previousWorkspace.uuid);
        let newOffset =
          -(
            newWorkspaceIndex -
            (isGoingLeft ? firstWorkspaceIndex : lastWorkspaceIndex) +
            (!isGoingLeft ? repeats - 1 : -repeats + 1)
          ) * 100;

        let existingOffset =
          -(
            newWorkspaceIndex -
            (isGoingLeft ? lastWorkspaceIndex : firstWorkspaceIndex) +
            (isGoingLeft ? repeats - 1 : -repeats + 1)
          ) * 100;

        // If we are on the same container and both new and old workspace are in the same "essentialsWorkspaces"
        // we can simply not animate the essentials
        if (
          usingSameContainer &&
          essentialsWorkspaces.some((w) => w.uuid === newWorkspace.uuid) &&
          essentialsWorkspaces.some((w) => w.uuid === previousWorkspace.uuid)
        ) {
          newOffset = 0;
          existingOffset = 0;
        }

        const needsOffsetAdjustment =
          stepsInBetween > essentialsWorkspaces.length || usingSameContainer;

        if (repeats > 0 && needsOffsetAdjustment) {
          if (!isGoingLeft) {
            if (existingOffset !== 0) existingOffset += 100;
            if (newOffset !== 0) newOffset += 100;
          } else {
            if (existingOffset !== 0) existingOffset -= 100;
            if (newOffset !== 0) newOffset -= 100;
          }
        }

        // Special case: going forward from single reused container to a new one
        if (!usingSameContainer && !isGoingLeft && lastWorkspaceIndex === newWorkspaceIndex - 1) {
          existingOffset = 0;
          newOffset = -100;
          stepsInBetween = 1;
        }
        if (!usingSameContainer && isGoingLeft && firstWorkspaceIndex === newWorkspaceIndex + 1) {
          existingOffset = 0;
          newOffset = 100;
          stepsInBetween = 1;
        }
        if (
          !usingSameContainer &&
          isGoingLeft &&
          (firstWorkspaceIndex === newWorkspaceIndex - 1 ||
            firstWorkspaceIndex === newWorkspaceIndex)
        ) {
          existingOffset = -100;
          newOffset = 0;
          stepsInBetween = 1;
        }
        if (!usingSameContainer && !isGoingLeft && firstWorkspaceIndex === newWorkspaceIndex) {
          existingOffset = 100;
          newOffset = 0;
          stepsInBetween = 1;
        }

        const newTransform = `translateX(${newOffset}%)`;
        let existingTransform = `translateX(${existingOffset}%)`;
        if (container.style.transform && container.style.transform !== 'none') {
          existingTransform = container.style.transform;
        }
        if (shouldAnimate) {
          container.style.transform = existingTransform;
          animations.push(
            gZenUIManager.motion.animate(
              container,
              {
                transform: [
                  existingTransform,
                  new Array(stepsInBetween).fill(newTransform).join(','),
                ],
              },
              {
                type: 'spring',
                bounce: 0,
                duration: kGlobalAnimationDuration,
              }
            )
          );
        }
      }
    }
    if (shouldAnimate) {
      gZenUIManager._preventToolbarRebuild = true;
      gZenUIManager.updateTabsToolbar();
    }
    await Promise.all(animations);
    document.documentElement.removeAttribute('animating-background');
    if (shouldAnimate) {
      for (const cloned of clonedEssentials) {
        cloned.container.remove();
      }
      this._alwaysAnimatePaddingTop = true;
      await this.updateTabsContainers();
    }
    const essentialsContainer = this.getEssentialsSection(newWorkspace.containerTabId);
    essentialsContainer.removeAttribute('hidden');
    essentialsContainer.style.transform = 'none';
    gBrowser.tabContainer._invalidateCachedTabs();
    gZenUIManager.tabsWrapper.style.removeProperty('scrollbar-width');
    this._animatingChange = false;
  }

  _shouldChangeToTab(aTab) {
    return !(aTab?.pinned && aTab?.hasAttribute('pending'));
  }

  async #shouldShowTabInCurrentWorkspace(tab) {
    const currentWorkspace = this.getActiveWorkspaceFromCache();
    return this._shouldShowTab(
      tab,
      currentWorkspace.uuid,
      currentWorkspace.containerTabId,
      await this._workspaces()
    );
  }

  _shouldShowTab(tab, workspaceUuid, containerId, workspaces) {
    const isEssential = tab.getAttribute('zen-essential') === 'true';
    const tabWorkspaceId = tab.getAttribute('zen-workspace-id');
    const tabContextId = tab.getAttribute('usercontextid') ?? '0';

    if (tab.hasAttribute('zen-glance-tab')) {
      return true; // Always show glance tabs
    }

    // Handle essential tabs
    if (isEssential) {
      if (!this.containerSpecificEssentials) {
        return true; // Show all essential tabs when containerSpecificEssentials is false
      }

      if (containerId) {
        // In workspaces with default container: Show essentials that match the container
        return tabContextId == containerId;
      } else {
        // In workspaces without a default container: Show essentials that aren't in container-specific workspaces
        // or have usercontextid="0" or no usercontextid
        return (
          !tabContextId ||
          tabContextId === '0' ||
          !workspaces.workspaces.some(
            (workspace) => workspace.containerTabId === parseInt(tabContextId, 10)
          )
        );
      }
    }

    // For non-essential tabs (both normal and pinned)
    if (!tabWorkspaceId) {
      // Assign workspace ID to tabs without one
      this.moveTabToWorkspace(tab, workspaceUuid);
      return true;
    }

    // Show if tab belongs to current workspace
    return tabWorkspaceId === workspaceUuid;
  }

  async _handleTabSelection(workspace, onInit, previousWorkspaceId) {
    const currentSelectedTab = gBrowser.selectedTab;
    const oldWorkspaceId = previousWorkspaceId;
    const lastSelectedTab = this._lastSelectedWorkspaceTabs[workspace.uuid];

    const containerId = workspace.containerTabId?.toString();
    const workspaces = await this._workspaces();

    // Save current tab as last selected for old workspace if it shouldn't be visible in new workspace
    if (oldWorkspaceId && oldWorkspaceId !== workspace.uuid) {
      this._lastSelectedWorkspaceTabs[oldWorkspaceId] =
        gZenGlanceManager.getTabOrGlanceParent(currentSelectedTab);
    }

    let tabToSelect = null;
    // Try last selected tab if it is visible
    if (
      lastSelectedTab &&
      this._shouldShowTab(lastSelectedTab, workspace.uuid, containerId, workspaces)
    ) {
      tabToSelect = lastSelectedTab;
    }
    // Find first suitable tab
    else {
      tabToSelect = gBrowser.visibleTabs.find((tab) => !tab.pinned);
      if (!tabToSelect && gBrowser.visibleTabs.length) {
        tabToSelect = gBrowser.visibleTabs[gBrowser.visibleTabs.length - 1];
      }
      if (!tabToSelect || !this._shouldChangeToTab(tabToSelect)) {
        // Never select an essential tab
        tabToSelect = null;
      }
    }

    // If we found a tab to select, select it
    if (!onInit && !tabToSelect) {
      // Create new tab if needed and no suitable tab was found
      const newTab = this.selectEmptyTab();
      tabToSelect = newTab;
    }
    if (tabToSelect && !onInit) {
      tabToSelect._visuallySelected = true;
    }

    // Always make sure we always unselect the tab from the old workspace
    if (currentSelectedTab && currentSelectedTab !== tabToSelect) {
      currentSelectedTab._selected = false;
    }
    return tabToSelect;
  }

  async _updateWorkspaceState(
    workspace,
    onInit,
    tabToSelect,
    { previousWorkspaceIndex, previousWorkspace } = {}
  ) {
    // Update document state
    document.documentElement.setAttribute('zen-workspace-id', workspace.uuid);

    // Recalculate new tab observers
    gBrowser.tabContainer.observe(null, 'nsPref:changed', 'privacy.userContext.enabled');

    gBrowser.tabContainer.arrowScrollbox = this.activeScrollbox;

    // Update workspace UI
    await this._updateWorkspacesChangeContextMenu();
    // gZenUIManager.updateTabsToolbar();
    await this._propagateWorkspaceData({ clearCache: false, onInit });

    gZenThemePicker.onWorkspaceChange(workspace);

    gZenUIManager.tabsWrapper.scrollbarWidth = 'none';
    this.workspaceIcons.activeIndex = workspace.uuid;
    await this._animateTabs(workspace, !onInit && !this._animatingChange, tabToSelect, {
      previousWorkspaceIndex,
      previousWorkspace,
      onInit,
    });
    await this._organizeWorkspaceStripLocations(workspace, true);
    gZenUIManager.tabsWrapper.style.scrollbarWidth = '';

    // Notify listeners
    if (this._changeListeners?.length) {
      for (const listener of this._changeListeners) {
        const { func, opts } = listener;
        await func({ workspace, onInit });
        if (opts.once) {
          this.removeChangeListeners(func);
        }
      }
    }

    // Reset bookmarks
    this._invalidateBookmarkContainers();

    // Update workspace indicator
    await this.updateWorkspaceIndicator(workspace, this.workspaceIndicator);

    // Fix ctrl+tab behavior. Note, we dont call it with "await" because we dont want to wait for it
    this._fixCtrlTabBehavior();

    // Bug: When updating from previous versions, we used to hide the tabs not used in the new workspace
    //  we now need to show them again.
    // TODO: Remove this on future versions
    if (onInit) {
      for (const tab of this.allStoredTabs) {
        gBrowser.showTab(tab);
      }
      for (const tab of gBrowser.tabs) {
        if (!tab.hasAttribute('zen-workspace-id') && !tab.hasAttribute('zen-workspace-id')) {
          tab.setAttribute('zen-workspace-id', workspace.uuid);
        }
      }
      window.dispatchEvent(
        new CustomEvent('ZenWorkspacesUIUpdate', {
          bubbles: true,
          detail: { activeIndex: workspace.uuid },
        })
      );
    }
  }

  async _fixCtrlTabBehavior() {
    ctrlTab.uninit();
    ctrlTab.readPref();
  }

  _invalidateBookmarkContainers() {
    for (let i = 0, len = this.bookmarkMenus.length; i < len; i++) {
      const element = document.getElementById(this.bookmarkMenus[i]);
      if (element && element._placesView) {
        const placesView = element._placesView;
        placesView.invalidateContainer(placesView._resultNode);
      }
    }
  }

  async _updateWorkspacesChangeContextMenu() {
    if (gZenWorkspaces.privateWindowOrDisabled) return;
    const workspaces = await this._workspaces();

    const menuPopup = document.getElementById('context-zen-change-workspace-tab-menu-popup');
    if (!menuPopup) {
      return;
    }
    menuPopup.innerHTML = '';

    const activeWorkspace = await this.getActiveWorkspace();

    for (let workspace of workspaces.workspaces) {
      const menuItem = document.createXULElement('menuitem');
      menuItem.setAttribute('label', workspace.name);
      menuItem.setAttribute('zen-workspace-id', workspace.uuid);
      menuItem.setAttribute('command', 'cmd_zenChangeWorkspaceTab');

      if (workspace.uuid === activeWorkspace.uuid) {
        menuItem.setAttribute('disabled', 'true');
      }

      menuPopup.appendChild(menuItem);
    }
  }

  async _createWorkspaceData(name, icon, tabs, moveTabs = true, containerTabId = 0) {
    let workspace = {
      uuid: gZenUIManager.generateUuidv4(),
      icon: icon,
      name: name,
      theme: nsZenThemePicker.getTheme([]),
      containerTabId,
    };
    if (moveTabs) {
      this._prepareNewWorkspace(workspace);
      await this._createWorkspaceTabsSection(workspace, tabs);
      await this._organizeWorkspaceStripLocations(workspace);
    }
    return workspace;
  }

  async createAndSaveWorkspace(
    name = 'Space',
    icon = undefined,
    dontChange = false,
    containerTabId = 0,
    { beforeChangeCallback } = { beforeChangeCallback: null } // Callback to run before changing workspace
  ) {
    if (!this.workspaceEnabled) {
      return;
    }
    if (this.isPrivateWindow) {
      name = 'Private ' + name;
    }
    // get extra tabs remaning (e.g. on new profiles) and just move them to the new workspace
    const extraTabs = Array.from(gBrowser.tabContainer.arrowScrollbox.children).filter(
      (child) =>
        child.tagName === 'tab' &&
        !child.hasAttribute('zen-workspace-id') &&
        !child.hasAttribute('zen-empty-tab') &&
        !child.hasAttribute('zen-essential')
    );
    let workspaceData = await this._createWorkspaceData(
      name,
      icon,
      extraTabs,
      !dontChange,
      containerTabId
    );
    if (this.isPrivateWindow) {
      this._privateWorkspace = workspaceData;
    } else {
      await this.saveWorkspace(workspaceData, dontChange);
    }
    if (!dontChange) {
      if (beforeChangeCallback) {
        try {
          await beforeChangeCallback(workspaceData);
        } catch (e) {
          console.error('Error in beforeChangeCallback:', e);
        }
      }
      this.registerPinnedResizeObserver();
      await this.updateTabsContainers({
        target: this.workspaceElement(workspaceData.uuid).pinnedTabsContainer,
      });
      let changed = extraTabs.length > 0;
      if (changed) {
        gBrowser.tabContainer._invalidateCachedTabs();
        gBrowser.selectedTab = extraTabs[0];
      }
      await this.changeWorkspace(workspaceData);
    }
    this.onWindowResize();
    return workspaceData;
  }

  async updateTabsContainers(target = undefined, forAnimation = false) {
    this.makeSureEmptyTabIsFirst();
    if (target && !target.target?.parentNode) {
      target = null;
    }
    // Only animate if it's from an event
    let animateContainer = target && target.target instanceof EventTarget;
    if (target?.type === 'TabClose') {
      animateContainer = target.target.pinned;
    }
    await this.onPinnedTabsResize(
      // This is what happens when we join a resize observer, an event listener
      // while using it as a method.
      [{ target: (target?.target ? target.target : target) ?? this.pinnedTabsContainer }],
      forAnimation,
      animateContainer
    );
  }

  updateShouldHideSeparator(arrowScrollbox, pinnedContainer) {
    // <= 2 because we have the empty tab and the new tab button
    const shouldHideSeparator =
      pinnedContainer.children.length === 1 ||
      Array.from(arrowScrollbox.children).filter(
        (child) => !child.hasAttribute('hidden') && !child.hasAttribute('zen-empty-tab')
      ).length <= 1;
    if (shouldHideSeparator) {
      pinnedContainer.setAttribute('hide-separator', 'true');
    } else {
      pinnedContainer.removeAttribute('hide-separator');
    }
  }

  async onPinnedTabsResize(entries, forAnimation = false, animateContainer = false) {
    if (
      !this._hasInitializedTabsStrip ||
      (this._organizingWorkspaceStrip && !forAnimation) ||
      document.documentElement.hasAttribute('zen-creating-workspace')
    ) {
      return;
    }
    if (document.documentElement.hasAttribute('customizing')) return;
    // forAnimation may be of type "ResizeObserver" if it's not a boolean, just ignore it
    if (typeof forAnimation !== 'boolean') {
      forAnimation = false;
    }
    for (const entry of entries) {
      let originalWorkspaceId = entry.target.getAttribute('zen-workspace-id');
      if (!originalWorkspaceId) {
        originalWorkspaceId = entry.target.closest('zen-workspace')?.id;
      }
      const workspacesIds = [];
      if (entry.target.closest('#zen-essentials')) {
        // Get all workspaces that have the same userContextId
        const activeWorkspace = await this.getActiveWorkspace();
        const userContextId = activeWorkspace.containerTabId;
        const workspaces = this._workspaceCache.workspaces.filter(
          (w) => w.containerTabId === userContextId && w.uuid !== originalWorkspaceId
        );
        workspacesIds.push(...workspaces.map((w) => w.uuid));
      } else {
        workspacesIds.push(originalWorkspaceId);
      }
      for (const workspaceId of workspacesIds) {
        const workspaceElement = this.workspaceElement(workspaceId);
        if (!workspaceElement) {
          continue;
        }
        const arrowScrollbox = workspaceElement.tabsContainer;
        const pinnedContainer = workspaceElement.pinnedTabsContainer;
        const workspaceObject = this.getWorkspaceFromId(workspaceId);
        const essentialContainer = this.getEssentialsSection(workspaceObject.containerTabId);
        const essentialNumChildren = essentialContainer.children.length;
        let essentialHackType = 0;
        if (essentialNumChildren === 6 || essentialNumChildren === 9) {
          essentialHackType = 1;
        } else if (essentialNumChildren % 2 === 0 && essentialNumChildren < 8) {
          essentialHackType = 2;
        } else if (essentialNumChildren === 5) {
          essentialHackType = 3;
        }
        if (essentialHackType > 0) {
          essentialContainer.setAttribute('data-hack-type', essentialHackType);
        } else {
          essentialContainer.removeAttribute('data-hack-type');
        }
        this._updatePaddingTopOnTabs(
          workspaceElement,
          essentialContainer,
          forAnimation,
          animateContainer
        );
        this.updateShouldHideSeparator(arrowScrollbox, pinnedContainer);
      }
    }
  }

  async onTabBrowserInserted(event) {
    let tab = event.originalTarget;
    const isEssential = tab.getAttribute('zen-essential') === 'true';
    const workspaceID = tab.getAttribute('zen-workspace-id');

    if (!this.workspaceEnabled || isEssential) {
      return;
    }

    if (workspaceID) {
      if (tab.hasAttribute('change-workspace') && this.moveTabToWorkspace(tab, workspaceID)) {
        this._lastSelectedWorkspaceTabs[workspaceID] = gZenGlanceManager.getTabOrGlanceParent(tab);
        tab.removeAttribute('change-workspace');
        const workspace = this.getWorkspaceFromId(workspaceID);
        await this.changeWorkspace(workspace);
      }
      return;
    }

    let activeWorkspace = await this.getActiveWorkspace();
    if (!activeWorkspace) {
      return;
    }
    tab.setAttribute('zen-workspace-id', activeWorkspace.uuid);
  }

  async onLocationChange(event) {
    let tab = event.target;
    gZenCompactModeManager.sidebar.toggleAttribute(
      'zen-has-empty-tab',
      gBrowser.selectedTab.hasAttribute('zen-empty-tab')
    );
    if (!this.workspaceEnabled || this._inChangingWorkspace || this._isClosingWindow) {
      return;
    }

    if (tab.hasAttribute('zen-glance-tab')) {
      // Extract from parent node so we are not selecting the wrong (current) tab
      tab = tab.parentNode.closest('.tabbrowser-tab');
      console.assert(tab, 'Tab not found for zen-glance-tab');
    }
    const workspaceID = tab.getAttribute('zen-workspace-id');
    const isEssential = tab.getAttribute('zen-essential') === 'true';

    if (tab.hasAttribute('zen-empty-tab')) {
      return;
    }

    if (!isEssential) {
      const activeWorkspace = await this.getActiveWorkspace();
      if (!activeWorkspace) {
        return;
      }

      // Only update last selected tab for non-essential tabs in their workspace
      if (workspaceID === activeWorkspace.uuid) {
        this._lastSelectedWorkspaceTabs[workspaceID] = gZenGlanceManager.getTabOrGlanceParent(tab);
      }

      // Switch workspace if needed
      if (workspaceID && workspaceID !== activeWorkspace.uuid && this._hasInitializedTabsStrip) {
        const workspaceToChange = this.getWorkspaceFromId(workspaceID);
        if (!workspaceToChange) {
          return;
        }
        await this.changeWorkspace(workspaceToChange);
      }
    }
  }

  // Context menu management
  async contextChangeContainerTab(event) {
    this._organizingWorkspaceStrip = true;
    let workspaces = await this._workspaces();
    let workspace = workspaces.workspaces.find(
      (workspace) => workspace.uuid === (this.#contextMenuData?.workspaceId || this.activeWorkspace)
    );
    let userContextId = parseInt(event.target.getAttribute('data-usercontextid'));
    workspace.containerTabId = userContextId + 0; // +0 to convert to number
    await this.saveWorkspace(workspace);
    await this._organizeWorkspaceStripLocations(this.getActiveWorkspaceFromCache(), true);
    await this.updateTabsContainers();
    this.tabContainer._invalidateCachedTabs();
  }

  async contextDeleteWorkspace() {
    const workspaceId = this.#contextMenuData?.workspaceId || this.activeWorkspace;
    const [title, body] = await document.l10n.formatValues([
      { id: 'zen-workspaces-delete-workspace-title' },
      {
        id: 'zen-workspaces-delete-workspace-body',
        args: { name: this.getWorkspaceFromId(workspaceId).name },
      },
    ]);
    if (Services.prompt.confirm(null, title, body)) {
      await this.removeWorkspace(workspaceId);
    }
  }

  findTabToBlur(tab) {
    if ((!this._shouldChangeToTab(tab) || !tab) && this._emptyTab) {
      return this._emptyTab;
    }
    return tab;
  }

  async changeWorkspaceShortcut(offset = 1, whileScrolling = false) {
    // Cycle through workspaces
    let workspaces = await this._workspaces();
    let activeWorkspace = await this.getActiveWorkspace();
    let workspaceIndex = workspaces.workspaces.indexOf(activeWorkspace);

    // note: offset can be negative
    let targetIndex = workspaceIndex + offset;
    if (this.shouldWrapAroundNavigation) {
      // Add length to handle negative indices and loop
      targetIndex = (targetIndex + workspaces.workspaces.length) % workspaces.workspaces.length;
    } else {
      // Clamp within bounds to disable looping
      targetIndex = Math.max(0, Math.min(workspaces.workspaces.length - 1, targetIndex));
    }

    let nextWorkspace = workspaces.workspaces[targetIndex];
    await this.changeWorkspace(nextWorkspace, { whileScrolling });
  }

  _initializeWorkspaceTabContextMenus() {
    if (this.privateWindowOrDisabled) {
      document.getElementById('cmd_zenOpenWorkspaceCreation').setAttribute('disabled', true);
      return;
    }
    const menu = document.createXULElement('menu');
    menu.setAttribute('id', 'context-zen-change-workspace-tab');
    menu.setAttribute('data-l10n-id', 'context-zen-change-workspace-tab');

    const menuPopup = document.createXULElement('menupopup');
    menuPopup.setAttribute('id', 'context-zen-change-workspace-tab-menu-popup');

    menu.appendChild(menuPopup);

    document.getElementById('context_closeDuplicateTabs').after(menu);
  }

  async changeTabWorkspace(workspaceID) {
    const tabs = TabContextMenu.contextTab.multiselected
      ? gBrowser.selectedTabs
      : [TabContextMenu.contextTab];
    document.getElementById('tabContextMenu').hidePopup();
    const previousWorkspaceID = document.documentElement.getAttribute('zen-workspace-id');
    for (let tab of tabs) {
      this.moveTabToWorkspace(tab, workspaceID);
      if (this._lastSelectedWorkspaceTabs[previousWorkspaceID] === tab) {
        // This tab is no longer the last selected tab in the previous workspace because it's being moved to
        // the current workspace
        delete this._lastSelectedWorkspaceTabs[previousWorkspaceID];
      }
    }
    // Make sure we select the last tab in the new workspace
    this._lastSelectedWorkspaceTabs[workspaceID] = gZenGlanceManager.getTabOrGlanceParent(
      tabs[tabs.length - 1]
    );
    const workspaces = await this._workspaces();
    await this.changeWorkspace(
      workspaces.workspaces.find((workspace) => workspace.uuid === workspaceID)
    );
  }

  // Tab browser utilities

  getContextIdIfNeeded(userContextId, fromExternal) {
    if (!this.workspaceEnabled) {
      return [userContextId, false, undefined];
    }

    if (
      this.shouldForceContainerTabsToWorkspace &&
      typeof userContextId !== 'undefined' &&
      this._workspaceCache?.workspaces &&
      !fromExternal
    ) {
      // Find all workspaces that match the given userContextId
      const matchingWorkspaces = this._workspaceCache.workspaces.filter(
        (workspace) => workspace.containerTabId === userContextId
      );

      // Check if exactly one workspace matches
      if (matchingWorkspaces.length === 1) {
        const workspace = matchingWorkspaces[0];
        if (workspace.uuid !== this.getActiveWorkspaceFromCache().uuid) {
          return [userContextId, true, workspace.uuid];
        }
      }
    }

    const activeWorkspace = this.getActiveWorkspaceFromCache();
    const activeWorkspaceUserContextId = activeWorkspace?.containerTabId;

    if (
      fromExternal !== true &&
      typeof userContextId !== 'undefined' &&
      userContextId !== activeWorkspaceUserContextId
    ) {
      return [userContextId, false, undefined];
    }
    return [activeWorkspaceUserContextId, true, undefined];
  }

  getTabsToExclude(aTab) {
    const tabWorkspaceId = aTab.getAttribute('zen-workspace-id');
    // Return all tabs that are not on the same workspace
    return this.allStoredTabs.filter(
      (tab) =>
        tab.getAttribute('zen-workspace-id') !== tabWorkspaceId &&
        !(
          this.containerSpecificEssentials &&
          tab.getAttribute('container') !== aTab.getAttribute('container')
        ) &&
        !tab.hasAttribute('zen-empty-tab')
    );
  }

  async shortcutSwitchTo(index) {
    const workspaces = await this._workspaces();
    // The index may be out of bounds, if it doesnt exist, don't do anything
    if (index >= workspaces.workspaces.length || index < 0) {
      return;
    }
    const workspaceToSwitch = workspaces.workspaces[index];
    await this.changeWorkspace(workspaceToSwitch);
  }

  isBookmarkInAnotherWorkspace(bookmark) {
    if (!this._workspaceBookmarksCache?.bookmarks) return false;
    const bookmarkGuid = bookmark.bookmarkGuid;
    const activeWorkspaceUuid = this.activeWorkspace;
    let isInActiveWorkspace = false;
    let isInOtherWorkspace = false;

    for (const [workspaceUuid, bookmarkGuids] of Object.entries(
      this._workspaceBookmarksCache.bookmarks
    )) {
      if (bookmarkGuids.includes(bookmarkGuid)) {
        if (workspaceUuid === activeWorkspaceUuid) {
          isInActiveWorkspace = true;
        } else {
          isInOtherWorkspace = true;
        }
      }
    }

    // Return true only if the bookmark is in another workspace and not in the active one
    return isInOtherWorkspace && !isInActiveWorkspace;
  }

  // Session restore functions
  get allStoredTabs() {
    if (this._allStoredTabs) {
      return this._allStoredTabs;
    }

    const tabs = [];
    // we need to go through each tab in each container
    const essentialsContainer = document.querySelectorAll(
      '#zen-essentials .zen-workspace-tabs-section'
    );
    let pinnedContainers = [];
    let normalContainers = [];
    if (!this._hasInitializedTabsStrip) {
      pinnedContainers = [document.getElementById('pinned-tabs-container')];
      normalContainers = [this.activeWorkspaceStrip];
    } else {
      for (const workspace of this._workspaceCache.workspaces) {
        const container = this.workspaceElement(workspace.uuid);
        if (container) {
          pinnedContainers.push(container.pinnedTabsContainer);
          normalContainers.push(container.tabsContainer);
        }
      }
    }
    const containers = [...essentialsContainer, ...pinnedContainers, ...normalContainers];
    for (const container of containers) {
      if (container.hasAttribute('cloned')) {
        continue;
      }
      for (const tab of container.children) {
        if (tab.tagName === 'tab') {
          tabs.push(tab);
          const glance = tab.querySelector('.tabbrowser-tab[glance-id]');
          if (glance) {
            tabs.push(glance);
          }
        } else if (gBrowser.isTabGroup(tab)) {
          for (const groupTab of tab.tabs) {
            tabs.push(groupTab);
            const glance = groupTab.querySelector('.tabbrowser-tab[glance-id]');
            if (glance) {
              tabs.push(glance);
            }
          }
        }
      }
    }
    this._allStoredTabs = tabs;
    return this._allStoredTabs;
  }

  get allTabGroups() {
    if (!this._hasInitializedTabsStrip) {
      let children = this.tabboxChildren;
      return children.filter((node) => gBrowser.isTabGroup(node));
    }
    const pinnedContainers = [];
    const normalContainers = [];
    for (const workspace of this._workspaceCache.workspaces) {
      const container = this.workspaceElement(workspace.uuid);
      if (container) {
        pinnedContainers.push(container.pinnedTabsContainer);
        normalContainers.push(container.tabsContainer);
      }
    }
    const containers = [...pinnedContainers, ...normalContainers];
    const tabGroups = [];
    for (const container of containers) {
      for (const tabGroup of container.querySelectorAll('tab-group')) {
        tabGroups.push(tabGroup);
      }
      for (const tabGroup of container.querySelectorAll('zen-folder')) {
        tabGroups.push(tabGroup);
      }
    }
    return tabGroups;
  }

  get allUsedBrowsers() {
    if (!this._hasInitializedTabsStrip) {
      return gBrowser.browsers;
    }
    const browsers = Array.from(gBrowser.tabpanels.querySelectorAll('browser'));
    // Sort browsers by making the current workspace first
    const currentWorkspace = this.activeWorkspace;
    const sortedBrowsers = browsers.sort((a, b) => {
      const aTab = gBrowser.getTabForBrowser(a);
      const bTab = gBrowser.getTabForBrowser(b);
      if (!bTab || !aTab) {
        return 0;
      }
      const aWorkspaceId = aTab.getAttribute('zen-workspace-id');
      const bWorkspaceId = bTab.getAttribute('zen-workspace-id');
      return aWorkspaceId === currentWorkspace ? -1 : bWorkspaceId === currentWorkspace ? 1 : 0;
    });
    return sortedBrowsers;
  }

  get pinnedTabCount() {
    return this.pinnedTabsContainer.children.length - 1;
  }

  get allWorkspaceTabs() {
    const currentWorkspace = this.activeWorkspace;
    return this.allStoredTabs.filter(
      (tab) =>
        tab.hasAttribute('zen-essential') ||
        tab.getAttribute('zen-workspace-id') === currentWorkspace
    );
  }

  reorganizeTabsAfterWelcome() {
    const children = gBrowser.tabContainer.arrowScrollbox.children;
    const remainingTabs = Array.from(children).filter((child) => child.tagName === 'tab');
    for (const tab of remainingTabs) {
      this.moveTabToWorkspace(tab, this.activeWorkspace);
    }
  }

  async switchIfNeeded(browser) {
    const tab = gBrowser.getTabForBrowser(browser);
    await this.switchTabIfNeeded(tab);
  }

  async switchTabIfNeeded(tab) {
    // Validate browser state first
    if (!this._validateBrowserState()) {
      console.warn('Browser state invalid for tab switching');
      return;
    }

    if (!tab) {
      console.warn('switchTabIfNeeded called with null tab');
      return;
    }

    // Validate tab state
    if (tab.closing || !tab.ownerGlobal || tab.ownerGlobal.closed || !tab.linkedBrowser) {
      console.warn('Tab is no longer valid, cannot select it');
      return;
    }

    try {
      const currentWorkspace = this.getActiveWorkspaceFromCache();
      // Check if we need to change workspace
      if (
        (tab.getAttribute('zen-workspace-id') !== this.activeWorkspace &&
          !tab.hasAttribute('zen-essential')) ||
        (currentWorkspace.containerTabId !== parseInt(tab.parentNode.getAttribute('container')) &&
          this.containerSpecificEssentials)
      ) {
        // Use a mutex-like approach to prevent concurrent workspace changes
        if (this._workspaceChangeInProgress) {
          console.warn('Workspace change already in progress, deferring tab switch');
          return;
        }

        let workspaceToSwitch = undefined;
        if (tab.hasAttribute('zen-essential')) {
          // Find first workspace with the same container
          const containerTabId = parseInt(tab.parentNode.getAttribute('container'));
          // +0 to convert to number
          workspaceToSwitch = this._workspaceCache.workspaces.find(
            (workspace) => workspace.containerTabId + 0 === containerTabId
          );
        } else {
          workspaceToSwitch = this.getWorkspaceFromId(tab.getAttribute('zen-workspace-id'));
        }
        if (!workspaceToSwitch) {
          console.error('No workspace found for tab, cannot switch');
          await this._safelySelectTab(tab);
          return;
        }

        this._workspaceChangeInProgress = true;
        try {
          this._lastSelectedWorkspaceTabs[workspaceToSwitch.uuid] =
            gZenGlanceManager.getTabOrGlanceParent(tab);
          await this.changeWorkspace(workspaceToSwitch);
        } finally {
          this._workspaceChangeInProgress = false;
        }
      }

      // Safely switch to the tab using our debounced method
      await this._safelySelectTab(tab);
    } catch (e) {
      console.error('Error in switchTabIfNeeded:', e);
    }
  }

  getDefaultContainer() {
    if (!this.workspaceEnabled) {
      return 0;
    }
    const workspaces = this._workspaceCache;
    if (!workspaces) {
      return 0;
    }
    const activeWorkspace = this.activeWorkspace;
    const workspace = workspaces.workspaces.find((workspace) => workspace.uuid === activeWorkspace);
    return workspace.containerTabId;
  }

  onWindowResize(event = undefined) {
    if (!(!event || event.target === window)) return;
    // Check if workspace icons overflow the parent container
    const parent = this.workspaceIcons;
    if (!parent || this._processingResize) {
      return;
    }
    if (!gZenPinnedTabManager.expandedSidebarMode) {
      for (const icon of parent.children) {
        if (icon.tagName === 'toolbarbutton') {
          icon.style.width = ''; // Reset to default size when in expanded mode
        }
      }
      parent.removeAttribute('icons-overflow');
      return;
    }
    const maxButtonSize = 26; // IMPORTANT: This should match the CSS size of the icons
    const minButtonSize = 15;
    const separation = 3; // Space between icons

    // Calculate the total width needed for all icons
    const totalWidth = Array.from(parent.children).reduce((width, icon) => {
      if (icon.tagName === 'toolbarbutton') {
        return width + minButtonSize + separation;
      }
      return width;
    }, 0);

    // Check if the total width exceeds the parent's width
    if (totalWidth > parent.clientWidth) {
      parent.setAttribute('icons-overflow', 'true');
    } else {
      parent.removeAttribute('icons-overflow');
    }

    // Set the width of each icon to the maximum size they can fit on
    const widthPerButton = Math.max(
      Math.floor(
        (parent.clientWidth - separation * (parent.children.length - 1)) / parent.children.length
      ),
      minButtonSize
    );
    for (const icon of parent.children) {
      if (icon.tagName === 'toolbarbutton') {
        icon.style.width = `${Math.min(widthPerButton, maxButtonSize)}px`;
      }
    }
  }

  fixTabInsertLocation(tab) {
    if (tab.hasAttribute('zen-essential')) {
      // Essential tabs should always be inserted at the end of the essentials section
      const essentialsSection = this.getEssentialsSection(tab);
      if (essentialsSection) {
        essentialsSection.appendChild(tab);
      }
    } else if (tab.pinned) {
      // Pinned tabs should always be inserted at the end of the pinned tabs container
      const pinnedContainer = this.pinnedTabsContainer;
      if (pinnedContainer) {
        pinnedContainer.insertBefore(tab, pinnedContainer.lastChild);
      }
    }
  }

  updateOverflowingTabs() {
    if (!this._hasInitializedTabsStrip) {
      return;
    }
    const currentWorkspaceStrip = this.workspaceElement(this.activeWorkspace);
    if (!currentWorkspaceStrip) {
      return;
    }
    if (currentWorkspaceStrip.overflows) {
      gBrowser.tabContainer.setAttribute('overflow', 'true');
    } else {
      gBrowser.tabContainer.removeAttribute('overflow');
    }
  }

  handleTabCloseWindow() {
    if (this.shouldCloseWindow()) {
      document.getElementById('cmd_closeWindow').doCommand();
    }
  }
})();
