var ZenWorkspaces = new (class extends ZenMultiWindowFeature {
  /**
   * Stores workspace IDs and their last selected tabs.
   */
  _lastSelectedWorkspaceTabs = {};
  _inChangingWorkspace = false;
  draggedElement = null;

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

  workspaceIndicatorXUL = `
    <hbox class="zen-current-workspace-indicator-icon"></hbox>
    <hbox class="zen-current-workspace-indicator-name"></hbox>
  `;

  async waitForPromises() {
    await Promise.all([this.promiseDBInitialized, this.promisePinnedInitialized, SessionStore.promiseAllWindowsRestored]);
  }

  async init() {
    if (!this.shouldHaveWorkspaces) {
      document.getElementById('zen-current-workspace-indicator-container').setAttribute('hidden', 'true');
      console.warn('ZenWorkspaces: !!! ZenWorkspaces is disabled in hidden windows !!!');
      return; // We are in a hidden window, don't initialize ZenWorkspaces
    }

    this.ownerWindow = window;
    XPCOMUtils.defineLazyPreferenceGetter(this, 'activationMethod', 'zen.workspaces.scroll-modifier-key', 'ctrl');
    XPCOMUtils.defineLazyPreferenceGetter(this, 'naturalScroll', 'zen.workspaces.natural-scroll', true);
    XPCOMUtils.defineLazyPreferenceGetter(this, 'shouldWrapAroundNavigation', 'zen.workspaces.wrap-around-navigation', true);
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldShowIconStrip',
      'zen.workspaces.show-icon-strip',
      true,
      this._expandWorkspacesStrip.bind(this)
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
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'containerSpecificEssentials',
      'zen.workspaces.container-specific-essentials-enabled',
      false
    );
    ChromeUtils.defineLazyGetter(this, 'tabContainer', () => document.getElementById('tabbrowser-tabs'));
    this._activeWorkspace = Services.prefs.getStringPref('zen.workspaces.active', '');
  }

  async afterLoadInit() {
    await SessionStore.promiseInitialized;
    if (!this._hasInitializedTabsStrip) {
      await this.delayedStartup();
    }
    await this.promiseSectionsInitialized;
    console.info('ZenWorkspaces: ZenWorkspaces initialized');

    await this.initializeWorkspaces();
    if (Services.prefs.getBoolPref('zen.workspaces.swipe-actions', false) && this.workspaceEnabled) {
      this.initializeGestureHandlers();
      this.initializeWorkspaceNavigation();
    }

    Services.obs.addObserver(this, 'weave:engine:sync:finish');
    Services.obs.addObserver(
      async function observe(subject) {
        this._workspaceBookmarksCache = null;
        await this.workspaceBookmarks();
        this._invalidateBookmarkContainers();
      }.bind(this),
      'workspace-bookmarks-updated'
    );
  }

  selectEmptyTab() {
    if (this._emptyTab && gZenVerticalTabsManager._canReplaceNewTab) {
      gBrowser.selectedTab = this._emptyTab;
      return this._emptyTab;
    }
    let tab = gZenUIManager.openAndChangeToTab(Services.prefs.getStringPref('browser.startup.homepage'));
    if (window.uuid) {
      tab.setAttribute('zen-workspace-id', this.activeWorkspace);
    }
    return tab;
  }

  async delayedStartup() {
    if (!this.workspaceEnabled) {
      return;
    }
    this._pinnedTabsResizeObserver = new ResizeObserver(this.onPinnedTabsResize.bind(this));
    await this.waitForPromises();
    await this._createDefaultWorkspaceIfNeeded();
    await this.initializeTabsStripSections();
    this._resolveSectionsInitialized();
    this._initializeEmptyTab();
  }

  async _createDefaultWorkspaceIfNeeded() {
    const workspaces = await this._workspaces();
    if (!workspaces.workspaces.length) {
      await this.createAndSaveWorkspace('Default Workspace', true, '🏠', true);
      this._workspaceCache = null;
    }
  }

  _initializeEmptyTab() {
    gBrowser._forZenEmptyTab = true;
    this._emptyTab = gBrowser.addTrustedTab('about:blank', { inBackground: true, userContextId: 0 });
    this._emptyTab.setAttribute('zen-empty-tab', 'true');
  }

  registerPinnedResizeObserver() {
    if (!this._hasInitializedTabsStrip) {
      return;
    }
    this._pinnedTabsResizeObserver.disconnect();
    for (let element of document.getElementById('vertical-pinned-tabs-container').children) {
      if (element.classList.contains('tabbrowser-tab')) {
        continue;
      }
      this._pinnedTabsResizeObserver.observe(element);
    }
  }

  get activeWorkspaceStrip() {
    if (!this._hasInitializedTabsStrip) {
      return gBrowser.tabContainer.arrowScrollbox;
    }
    const activeWorkspace = this.activeWorkspace;
    return document.querySelector(
      `#tabbrowser-arrowscrollbox .zen-workspace-tabs-section[zen-workspace-id="${activeWorkspace}"]`
    );
  }

  get activeWorkspaceIndicator() {
    return document.querySelector(
      `#zen-current-workspace-indicator-container .zen-workspace-tabs-section[zen-workspace-id="${this.activeWorkspace}"]`
    );
  }

  get tabboxChildren() {
    return Array.from(this.activeWorkspaceStrip?.children || []);
  }

  get tabboxChildrenWithoutEmpty() {
    return this.tabboxChildren.filter((child) => !child.hasAttribute('zen-empty-tab'));
  }

  get pinnedTabsContainer() {
    if (!this.workspaceEnabled || !this._hasInitializedTabsStrip) {
      return document.getElementById('vertical-pinned-tabs-container');
    }
    return document.querySelector(
      `#vertical-pinned-tabs-container .zen-workspace-tabs-section[zen-workspace-id="${this.activeWorkspace}"]`
    );
  }

  async initializeTabsStripSections() {
    const perifery = document.getElementById('tabbrowser-arrowscrollbox-periphery');
    const tabs = gBrowser.tabContainer.allTabs;
    const workspaces = await this._workspaces();
    for (const workspace of workspaces.workspaces) {
      await this._createWorkspaceTabsSection(workspace, tabs, perifery);
    }
    if (tabs.length) {
      const defaultSelectedContainer = document.querySelector(
        `#tabbrowser-arrowscrollbox .zen-workspace-tabs-section[zen-workspace-id="${this.activeWorkspace}"]`
      );
      const essentialsContaienr = document.getElementById('zen-essentials-container');
      // New profile with no workspaces does not have a default selected container
      if (defaultSelectedContainer) {
        const pinnedContainer = document.querySelector(
          `#vertical-pinned-tabs-container .zen-workspace-tabs-section[zen-workspace-id="${this.activeWorkspace}"]`
        );
        for (const tab of tabs) {
          if (tab.hasAttribute('zen-essential')) {
            essentialsContaienr.appendChild(tab);
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
  }

  _createWorkspaceSection(workspace) {
    const section = document.createXULElement('vbox');
    section.className = 'zen-workspace-tabs-section';
    section.setAttribute('flex', '1');
    section.setAttribute('zen-workspace-id', workspace.uuid);
    return section;
  }

  async _createWorkspaceTabsSection(workspace, tabs, perifery) {
    const container = gBrowser.tabContainer.arrowScrollbox;
    const section = this._createWorkspaceSection(workspace);
    container.appendChild(section);

    const pinnedContainer = document.getElementById('vertical-pinned-tabs-container');
    const pinnedSection = this._createWorkspaceSection(workspace);
    this._organizeTabsToWorkspaceSections(workspace, section, pinnedSection, tabs);
    section.appendChild(perifery.cloneNode(true));
    pinnedSection.appendChild(
      window.MozXULElement.parseXULToFragment(`
        <html:div class="vertical-pinned-tabs-container-separator"></html:div>
      `)
    );
    pinnedContainer.appendChild(pinnedSection);

    const workspaceIndicator = this._createWorkspaceSection(workspace);
    workspaceIndicator.classList.add('zen-current-workspace-indicator');
    workspaceIndicator.appendChild(window.MozXULElement.parseXULToFragment(this.workspaceIndicatorXUL));
    document.getElementById('zen-current-workspace-indicator-container').appendChild(workspaceIndicator);
    this.initIndicatorContextMenu(workspaceIndicator);
  }

  _organizeTabsToWorkspaceSections(workspace, section, pinnedSection, tabs) {
    const workspaceTabs = Array.from(tabs).filter((tab) => tab.getAttribute('zen-workspace-id') === workspace.uuid);
    for (const tab of workspaceTabs) {
      if (tab.hasAttribute('zen-essential')) {
        continue; // Ignore essentials as they need to be in their own section
      }
      // remove tab from list
      tabs.splice(tabs.indexOf(tab), 1);
      if (tab.pinned) {
        pinnedSection.insertBefore(tab, pinnedSection.nextSibling);
      } else {
        section.insertBefore(tab, section.lastChild);
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
    return document.getElementById('navigator-toolbox').hasAttribute('zen-has-hover');
  }

  _handleAppCommand(event) {
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
  }

  _setupSidebarHandlers() {
    const toolbox = document.getElementById('navigator-toolbox');

    const scrollCooldown = 200; // Milliseconds to wait before allowing another scroll
    const scrollThreshold = 2; // Minimum scroll delta to trigger workspace change

    toolbox.addEventListener(
      'wheel',
      async (event) => {
        if (!this.workspaceEnabled) return;

        // Only process non-gesture scrolls
        if (event.deltaMode !== 1) return;

        const isVerticalScroll = event.deltaY && !event.deltaX;
        const isHorizontalScroll = event.deltaX && !event.deltaY;

        //if the scroll is vertical this checks that a modifier key is used before proceeding
        if (isVerticalScroll) {
          const activationKeyMap = {
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey,
          };

          if (this.activationMethod in activationKeyMap && !activationKeyMap[this.activationMethod]) {
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
      document.getElementById('navigator-toolbox'),
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
  }

  _handleSwipeMayStart(event) {
    if (!this.workspaceEnabled) return;

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

    event.preventDefault();
    event.stopPropagation();
    this._swipeState = {
      isGestureActive: true,
      lastDelta: 0,
      direction: null,
    };
  }

  _handleSwipeUpdate(event) {
    if (!this.workspaceEnabled || !this._swipeState?.isGestureActive) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = event.delta * 300;
    const stripWidth = document.getElementById('tabbrowser-tabs').getBoundingClientRect().width;
    let translateX = this._swipeState.lastDelta + delta;
    // Add a force multiplier as we are translating the strip depending on how close to the edge we are
    let forceMultiplier = Math.min(1, 1 - Math.abs(translateX) / (stripWidth * 4.5)); // 4.5 instead of 4 to add a bit of a buffer
    if (forceMultiplier > 0.5) {
      translateX *= forceMultiplier;
      this._swipeState.lastDelta = delta + (translateX - delta) * 0.5;
    } else {
      translateX = this._swipeState.lastDelta;
    }

    if (Math.abs(delta) > 1) {
      this._swipeState.direction = delta > 0 ? 'left' : 'right';
    }

    // Apply a translateX to the tab strip to give the user feedback on the swipe
    const currentWorkspace = this.activeWorkspace;
    this._organizeWorkspaceStripLocations({ uuid: currentWorkspace }, true, translateX);
  }

  async _handleSwipeEnd(event) {
    if (!this.workspaceEnabled || !this._swipeState?.isGestureActive) return;
    event.preventDefault();
    event.stopPropagation();
    const isRTL = document.documentElement.matches(':-moz-locale-dir(rtl)');
    const moveForward = (this._swipeState.direction === 'right') !== isRTL;

    let rawDirection = moveForward ? 1 : -1;
    if (this._swipeState.direction) {
      let direction = this.naturalScroll ? -1 : 1;
      this.changeWorkspaceShortcut(rawDirection * direction, true);
    } else {
      this._cancelSwipeAnimation();
    }

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
      let docElement = document.documentElement;
      this._shouldHaveWorkspaces = !(
        docElement.hasAttribute('privatebrowsingmode') ||
        docElement.getAttribute('chromehidden').includes('toolbar') ||
        docElement.getAttribute('chromehidden').includes('menubar')
      );
      return this._shouldHaveWorkspaces;
    }
    return this._shouldHaveWorkspaces;
  }

  get workspaceEnabled() {
    if (typeof this._workspaceEnabled === 'undefined') {
      this._workspaceEnabled =
        !Services.prefs.getBoolPref('zen.workspaces.disabled_for_testing', false) && this.shouldHaveWorkspaces;
      return this._workspaceEnabled;
    }
    return this._workspaceEnabled;
  }

  getActiveWorkspaceFromCache() {
    try {
      return this._workspaceCache.workspaces.find((workspace) => workspace.uuid === this.activeWorkspace);
    } catch (e) {
      return null;
    }
  }

  async _workspaces() {
    if (this._workspaceCache) {
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
      const activeWorkspace = this._workspaceCache.workspaces.find((w) => w.uuid === activeWorkspaceId);
      // Set the active workspace ID to the first one if the one with selected id doesn't exist
      if (!activeWorkspace) {
        this.activeWorkspace = this._workspaceCache.workspaces[0]?.uuid;
      }
    } else {
      // Set the active workspace ID to the first one if active workspace doesn't exist
      this.activeWorkspace = this._workspaceCache.workspaces[0]?.uuid;
    }
    // sort by position
    this._workspaceCache.workspaces.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

    return this._workspaceCache;
  }

  async workspaceBookmarks() {
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
    await this.initializeWorkspacesButton();
    if (this.workspaceEnabled) {
      this._initializeWorkspaceCreationIcons();
      this._initializeWorkspaceTabContextMenus();
      await this.workspaceBookmarks();
      window.addEventListener('TabBrowserInserted', this.onTabBrowserInserted.bind(this));
      window.addEventListener('TabOpen', this.updateTabsContainers.bind(this));
      window.addEventListener('TabClose', this.updateTabsContainers.bind(this));
      let activeWorkspace = await this.getActiveWorkspace();
      this.activeWorkspace = activeWorkspace?.uuid;
      try {
        if (activeWorkspace) {
          window.gZenThemePicker = new ZenThemePicker();
          await this.changeWorkspace(activeWorkspace, { onInit: true });
          gBrowser.tabContainer._positionPinnedTabs();
        }
      } catch (e) {
        console.error('ZenWorkspaces: Error initializing theme picker', e);
      }
      this._selectStartPage();
    }
  }

  _selectStartPage() {
    const currentTab = gBrowser.selectedTab;
    let showed = false;
    if (currentTab.pinned) {
      this.selectEmptyTab();
      try {
        gZenTabUnloader.explicitUnloadTabs([currentTab]);
      } catch (e) {
        console.error('ZenWorkspaces: Error unloading tab', e);
      }
      showed = true;
    } else {
      const currentTabURL = currentTab.linkedBrowser?.currentURI?.spec;
      // Check for empty tab being restored
      if (
        (currentTab.isEmpty &&
          (currentTab.getAttribute('image') === gPageIcons[currentTabURL] || !currentTab.hasAttribute('image'))) ||
        currentTab.hasAttribute('zen-empty-tab')
      ) {
        this.selectEmptyTab();
        this._removedByStartupPage = true;
        gBrowser.removeTab(currentTab);
        showed = true;
      }
    }
    if (gZenVerticalTabsManager._canReplaceNewTab && showed) {
      BrowserCommands.openTab();
    }
  }

  initIndicatorContextMenu(indicator) {
    const th = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openWorkspacesDialog(event);
    };
    indicator.addEventListener('contextmenu', th);
    indicator.addEventListener('click', th);
  }

  shouldCloseWindow() {
    return !window.toolbar.visible || Services.prefs.getBoolPref('browser.tabs.closeWindowWithLastTab');
  }

  handleTabBeforeClose(tab) {
    if (!this.workspaceEnabled || this.__contextIsDelete || this._removedByStartupPage) {
      return null;
    }

    let workspaceID = tab.getAttribute('zen-workspace-id');
    if (!workspaceID) {
      return null;
    }

    let tabs = gBrowser.visibleTabs;
    let tabsPinned = tabs.filter((t) => !this.shouldOpenNewTabIfLastUnpinnedTabIsClosed || !t.pinned);

    const shouldCloseWindow = this.shouldCloseWindow();
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

  searchIcons(input, icons) {
    input = input.toLowerCase();

    if (input === ':' || input === '') {
      return icons;
    }
    const emojiScores = [];

    function calculateSearchScore(inputLength, targetLength, weight = 100) {
      return parseInt((inputLength / targetLength) * weight);
    }

    for (let currentEmoji of icons) {
      let alignmentScore = -1;

      let normalizedEmojiName = currentEmoji[1].toLowerCase();
      let keywordList = currentEmoji[2].split(',').map((keyword) => keyword.trim().toLowerCase());
      if (input[0] === ':') {
        let searchTerm = input.slice(1);
        let nameMatchIndex = normalizedEmojiName.indexOf(searchTerm);

        if (nameMatchIndex !== -1 && nameMatchIndex === 0) {
          alignmentScore = calculateSearchScore(searchTerm.length, normalizedEmojiName.length, 100);
        }
      } else {
        if (input === currentEmoji[0]) {
          alignmentScore = 999;
        }
        let nameMatchIndex = normalizedEmojiName.replace(/_/g, ' ').indexOf(input);
        if (nameMatchIndex !== -1) {
          if (nameMatchIndex === 0) {
            alignmentScore = calculateSearchScore(input.length, normalizedEmojiName.length, 150);
          } else if (input[input.length - 1] !== ' ') {
            alignmentScore += calculateSearchScore(input.length, normalizedEmojiName.length, 40);
          }
        }
        for (let keyword of keywordList) {
          let keywordMatchIndex = keyword.indexOf(input);
          if (keywordMatchIndex !== -1) {
            if (keywordMatchIndex === 0) {
              alignmentScore += calculateSearchScore(input.length, keyword.length, 50);
            } else if (input[input.length - 1] !== ' ') {
              alignmentScore += calculateSearchScore(input.length, keyword.length, 5);
            }
          }
        }
      }

      //if match score is not -1, add it
      if (alignmentScore !== -1) {
        emojiScores.push({ emoji: currentEmoji[0], score: alignmentScore });
      }
    }
    // Sort the emojis by their score in descending order
    emojiScores.sort((a, b) => b.score - a.score);

    // Return the emojis in the order of their rank
    let filteredEmojiScores = emojiScores;
    return filteredEmojiScores.map((score) => score.emoji);
  }

  resetWorkspaceIconSearch() {
    let container = document.getElementById('PanelUI-zen-workspaces-icon-picker-wrapper');
    let searchInput = document.getElementById('PanelUI-zen-workspaces-icon-search-input');

    // Clear the search input field
    searchInput.value = '';
    for (let button of container.querySelectorAll('.toolbarbutton-1')) {
      button.style.display = '';
    }
  }

  _initializeWorkspaceCreationIcons() {
    let container = document.getElementById('PanelUI-zen-workspaces-icon-picker-wrapper');
    let searchInput = document.getElementById('PanelUI-zen-workspaces-icon-search-input');
    searchInput.value = '';
    for (let iconData of this.emojis) {
      const icon = iconData[0];
      let button = document.createXULElement('toolbarbutton');
      button.className = 'toolbarbutton-1 workspace-icon-button';
      button.setAttribute('label', icon);
      button.onclick = (event) => {
        const button = event.target;
        let wasSelected = button.hasAttribute('selected');
        for (let button of container.children) {
          button.removeAttribute('selected');
        }
        if (!wasSelected) {
          button.setAttribute('selected', 'true');
        }
        if (this.onIconChangeConnectedCallback) {
          this.onIconChangeConnectedCallback(icon);
        } else {
          this.onWorkspaceIconChangeInner('create', icon);
        }
      };
      container.appendChild(button);
    }
  }

  conductSearch() {
    const container = document.getElementById('PanelUI-zen-workspaces-icon-picker-wrapper');
    const searchInput = document.getElementById('PanelUI-zen-workspaces-icon-search-input');
    const query = searchInput.value.toLowerCase();

    if (query === '') {
      this.resetWorkspaceIconSearch();
      return;
    }

    const buttons = Array.from(container.querySelectorAll('.toolbarbutton-1'));
    buttons.forEach((button) => (button.style.display = 'none'));

    const filteredIcons = this.searchIcons(query, this.emojis);

    filteredIcons.forEach((emoji) => {
      const matchingButton = buttons.find((button) => button.getAttribute('label') === emoji);
      if (matchingButton) {
        matchingButton.style.display = '';
        container.appendChild(matchingButton);
      }
    });
  }

  async saveWorkspace(workspaceData, preventPropagation = false) {
    await ZenWorkspacesStorage.saveWorkspace(workspaceData);
    if (!preventPropagation) {
      await this._propagateWorkspaceData();
      await this._updateWorkspacesChangeContextMenu();
    }
  }

  async removeWorkspace(windowID) {
    let workspacesData = await this._workspaces();
    console.info('ZenWorkspaces: Removing workspace', windowID);
    await this.changeWorkspace(workspacesData.workspaces.find((workspace) => workspace.uuid !== windowID));
    this._deleteAllTabsInWorkspace(windowID);
    delete this._lastSelectedWorkspaceTabs[windowID];
    await ZenWorkspacesStorage.removeWorkspace(windowID);
    await this._propagateWorkspaceData();
    await this._updateWorkspacesChangeContextMenu();
  }

  isWorkspaceActive(workspace) {
    return workspace.uuid === this.activeWorkspace;
  }

  async getActiveWorkspace() {
    const workspaces = await this._workspaces();
    return (
      workspaces.workspaces.find((workspace) => workspace.uuid === this.activeWorkspace) ??
      workspaces.workspaces.find((workspace) => workspace.default) ??
      workspaces.workspaces[0]
    );
  }
  // Workspaces dialog UI management

  openSaveDialog() {
    let parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');

    // randomly select an icon
    let icon = this.emojis[Math.floor(Math.random() * (this.emojis.length - 257))][0];
    this._workspaceCreateInput.textContent = '';
    this._workspaceCreateInput.value = '';
    this._workspaceCreateInput.setAttribute('data-initial-value', '');
    document.querySelectorAll('#PanelUI-zen-workspaces-icon-picker-wrapper toolbarbutton').forEach((button) => {
      if (button.label === icon) {
        button.setAttribute('selected', 'true');
      } else {
        button.removeAttribute('selected');
      }
    });
    document.querySelector('.PanelUI-zen-workspaces-icons-container.create').textContent = icon;

    PanelUI.showSubView('PanelUI-zen-workspaces-create', parentPanel);
  }

  async openEditDialog(workspaceUuid) {
    this._workspaceEditDialog.setAttribute('data-workspace-uuid', workspaceUuid);
    document.getElementById('PanelUI-zen-workspaces-edit-save').setAttribute('disabled', 'true');
    let workspaces = (await this._workspaces()).workspaces;
    let workspaceData = workspaces.find((workspace) => workspace.uuid === workspaceUuid);
    this._workspaceEditInput.textContent = workspaceData.name;
    this._workspaceEditInput.value = workspaceData.name;
    this._workspaceEditInput.setAttribute('data-initial-value', workspaceData.name);
    this._workspaceEditIconsContainer.setAttribute('data-initial-value', workspaceData.icon);
    this.onIconChangeConnectedCallback = (...args) => {
      this.onWorkspaceIconChangeInner('edit', ...args);
      this.onWorkspaceEditChange(...args);
    };
    document.querySelectorAll('#PanelUI-zen-workspaces-icon-picker-wrapper toolbarbutton').forEach((button) => {
      if (button.label === workspaceData.icon) {
        button.setAttribute('selected', 'true');
      } else {
        button.removeAttribute('selected');
      }
    });
    document.querySelector('.PanelUI-zen-workspaces-icons-container.edit').textContent = this.getWorkspaceIcon(workspaceData);
    let parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');
    PanelUI.showSubView('PanelUI-zen-workspaces-edit', parentPanel);
  }

  onWorkspaceIconChangeInner(type = 'create', icon) {
    const container = document.querySelector(`.PanelUI-zen-workspaces-icons-container.${type}`);
    if (container.textContent !== icon) {
      container.textContent = icon;
    }
    this.goToPreviousSubView();
  }

  onWorkspaceIconContainerClick(event) {
    event.preventDefault();
    const parentPanel = document.getElementById('PanelUI-zen-workspaces-edit');
    PanelUI.showSubView('PanelUI-zen-workspaces-icon-picker', parentPanel);

    const container = parentPanel.parentNode.querySelector('.panel-viewcontainer');
    setTimeout(() => {
      if (container) {
        container.style.minHeight = 'unset';
      }
    });
  }

  goToPreviousSubView() {
    const parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');
    parentPanel.goBack();
  }

  workspaceHasIcon(workspace) {
    return workspace.icon && workspace.icon !== '';
  }

  getWorkspaceIcon(workspace) {
    if (this.workspaceHasIcon(workspace)) {
      return workspace.icon;
    }
    if (typeof Intl.Segmenter !== 'undefined') {
      return new Intl.Segmenter().segment(workspace.name).containing().segment.toUpperCase();
    }
    return Array.from(workspace.name)[0].toUpperCase();
  }

  get shouldShowContainers() {
    return (
      Services.prefs.getBoolPref('privacy.userContext.ui.enabled') && ContextualIdentityService.getPublicIdentities().length > 0
    );
  }

  async _propagateWorkspaceData({ ignoreStrip = false, clearCache = true } = {}) {
    await this.foreachWindowAsActive(async (browser) => {
      // Do not update the window if workspaces are not enabled in it.
      // For example, when the window is in private browsing mode.
      if (!browser.ZenWorkspaces.workspaceEnabled) {
        return;
      }
      let workspaceList = browser.document.getElementById('PanelUI-zen-workspaces-list');
      const createWorkspaceElement = (workspace) => {
        let element = browser.document.createXULElement('toolbarbutton');
        element.className = 'subviewbutton zen-workspace-button';
        element.setAttribute('tooltiptext', workspace.name);
        element.setAttribute('zen-workspace-id', workspace.uuid);
        if (this.isWorkspaceActive(workspace)) {
          element.setAttribute('active', 'true');
        }
        if (workspace.default) {
          element.setAttribute('default', 'true');
        }
        let containerGroup = undefined;
        try {
          containerGroup = browser.ContextualIdentityService.getPublicIdentities().find(
            (container) => container.userContextId === workspace.containerTabId
          );
        } catch (e) {
          console.warn('ZenWorkspaces: Error setting container color', e);
        }
        if (containerGroup) {
          element.classList.add('identity-color-' + containerGroup.color);
          element.setAttribute('data-usercontextid', containerGroup.userContextId);
        }
        if (this.isReorderModeOn(browser)) {
          element.setAttribute('draggable', 'true');
        }
        element.addEventListener(
          'dragstart',
          function (event) {
            if (this.isReorderModeOn(browser)) {
              this.draggedElement = element;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', element.getAttribute('zen-workspace-id'));
              element.classList.add('dragging');
            } else {
              event.preventDefault();
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragover',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragenter',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              element.classList.add('dragover');
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragleave',
          function (event) {
            element.classList.remove('dragover');
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'drop',
          async function (event) {
            event.preventDefault();
            element.classList.remove('dragover');
            if (this.isReorderModeOn(browser)) {
              const draggedWorkspaceId = event.dataTransfer.getData('text/plain');
              const targetWorkspaceId = element.getAttribute('zen-workspace-id');
              if (draggedWorkspaceId !== targetWorkspaceId) {
                await this.moveWorkspace(draggedWorkspaceId, targetWorkspaceId);
              }
              if (this.draggedElement) {
                this.draggedElement.classList.remove('dragging');
                this.draggedElement = null;
              }
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragend',
          function (event) {
            if (this.draggedElement) {
              this.draggedElement.classList.remove('dragging');
              this.draggedElement = null;
            }
            const workspaceElements = browser.document.querySelectorAll('.zen-workspace-button');
            for (const elem of workspaceElements) {
              elem.classList.remove('dragover');
            }
          }.bind(browser.ZenWorkspaces)
        );

        let childs = browser.MozXULElement.parseXULToFragment(`
          <div class="zen-workspace-icon">
          </div>
          <vbox>
            <div class="zen-workspace-name">
            </div>
            <div class="zen-workspace-container" ${containerGroup ? '' : 'hidden="true"'}>
            </div>
          </vbox>
            <image class="toolbarbutton-icon zen-workspace-actions-reorder-icon" ></image>
          <toolbarbutton closemenu="none" class="toolbarbutton-1 zen-workspace-actions">
            <image class="toolbarbutton-icon" id="zen-workspace-actions-menu-icon"></image>
          </toolbarbutton>
        `);

        // use text content instead of innerHTML to avoid XSS
        childs.querySelector('.zen-workspace-icon').textContent = browser.ZenWorkspaces.getWorkspaceIcon(workspace);
        childs.querySelector('.zen-workspace-name').textContent = workspace.name;
        if (containerGroup) {
          childs.querySelector('.zen-workspace-container').textContent = ContextualIdentityService.getUserContextLabel(
            containerGroup.userContextId
          );
        }

        childs.querySelector('.zen-workspace-actions').addEventListener(
          'command',
          ((event) => {
            let button = event.target;
            this._contextMenuId = button.closest('toolbarbutton[zen-workspace-id]').getAttribute('zen-workspace-id');
            const popup = button.ownerDocument.getElementById('zenWorkspaceActionsMenu');
            popup.openPopup(button, 'after_end');
          }).bind(browser.ZenWorkspaces)
        );
        element.appendChild(childs);
        element.onclick = (async () => {
          if (this.isReorderModeOn(browser)) {
            return; // Return early if reorder mode is on
          }
          if (event.target.closest('.zen-workspace-actions')) {
            return; // Ignore clicks on the actions button
          }
          const workspaceId = element.getAttribute('zen-workspace-id');
          const workspaces = await this._workspaces();
          const workspace = workspaces.workspaces.find((w) => w.uuid === workspaceId);
          await this.changeWorkspace(workspace);
          let panel = this.ownerWindow.document.getElementById('PanelUI-zen-workspaces');
          PanelMultiView.hidePopup(panel);
          this.ownerWindow.document.getElementById('zen-workspaces-button').removeAttribute('open');
        }).bind(browser.ZenWorkspaces);
        return element;
      };

      const createLastPositionDropTarget = () => {
        const element = browser.document.createXULElement('div');
        element.className = 'zen-workspace-last-place-drop-target';

        element.addEventListener(
          'dragover',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragenter',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              element.classList.add('dragover');
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragleave',
          function (event) {
            element.classList.remove('dragover');
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'drop',
          async function (event) {
            event.preventDefault();
            element.classList.remove('dragover');

            if (this.isReorderModeOn(browser)) {
              const draggedWorkspaceId = event.dataTransfer.getData('text/plain');
              await this.moveWorkspaceToEnd(draggedWorkspaceId);

              if (this.draggedElement) {
                this.draggedElement.classList.remove('dragging');
                this.draggedElement = null;
              }
            }
          }.bind(browser.ZenWorkspaces)
        );

        return element;
      };

      if (clearCache) {
        browser.ZenWorkspaces._workspaceCache = null;
        browser.ZenWorkspaces._workspaceBookmarksCache = null;
      }
      let workspaces = await browser.ZenWorkspaces._workspaces();
      await browser.ZenWorkspaces.workspaceBookmarks();
      workspaceList.innerHTML = '';
      workspaceList.parentNode.style.display = 'flex';
      if (workspaces.workspaces.length <= 0) {
        workspaceList.innerHTML = 'No workspaces available';
        workspaceList.setAttribute('empty', 'true');
      } else {
        workspaceList.removeAttribute('empty');
      }

      for (let workspace of workspaces.workspaces) {
        let workspaceElement = createWorkspaceElement(workspace);
        workspaceList.appendChild(workspaceElement);
      }

      workspaceList.appendChild(createLastPositionDropTarget());

      if (!ignoreStrip) {
        await browser.ZenWorkspaces._expandWorkspacesStrip(browser);
        browser.ZenWorkspaces._fixIndicatorsNames(workspaces);
      }
    });
  }

  handlePanelHidden() {
    const workspacesList = document.getElementById('PanelUI-zen-workspaces-list');
    const reorderModeButton = document.getElementById('PanelUI-zen-workspaces-reorder-mode');

    workspacesList?.removeAttribute('reorder-mode');
    reorderModeButton?.removeAttribute('active');
    this.resetWorkspaceIconSearch();
    this.clearEmojis();
  }

  async moveWorkspaceToEnd(draggedWorkspaceId) {
    const workspaces = (await this._workspaces()).workspaces;
    const draggedIndex = workspaces.findIndex((w) => w.uuid === draggedWorkspaceId);
    const draggedWorkspace = workspaces.splice(draggedIndex, 1)[0];
    workspaces.push(draggedWorkspace);

    await ZenWorkspacesStorage.updateWorkspacePositions(workspaces);
    await this._propagateWorkspaceData();
  }

  isReorderModeOn(browser) {
    return browser.document.getElementById('PanelUI-zen-workspaces-list').getAttribute('reorder-mode') === 'true';
  }

  toggleReorderMode() {
    const workspacesList = document.getElementById('PanelUI-zen-workspaces-list');
    const reorderModeButton = document.getElementById('PanelUI-zen-workspaces-reorder-mode');
    const isActive = workspacesList.getAttribute('reorder-mode') === 'true';
    if (isActive) {
      workspacesList.removeAttribute('reorder-mode');
      reorderModeButton.removeAttribute('active');
    } else {
      workspacesList.setAttribute('reorder-mode', 'true');
      reorderModeButton.setAttribute('active', 'true');
    }

    // Update draggable attribute
    const workspaceElements = document.querySelectorAll('.zen-workspace-button');
    workspaceElements.forEach((elem) => {
      if (isActive) {
        elem.removeAttribute('draggable');
      } else {
        elem.setAttribute('draggable', 'true');
      }
    });
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

  async openWorkspacesDialog(event) {
    if (!this.workspaceEnabled) {
      return;
    }
    let target = event.target.closest('.zen-current-workspace-indicator') || document.getElementById('zen-workspaces-button');
    let panel = document.getElementById('PanelUI-zen-workspaces');
    await this._propagateWorkspaceData({
      ignoreStrip: true,
      clearCache: false,
    });
    PanelMultiView.openPopup(panel, target, {
      position: 'bottomright topright',
      triggerEvent: event,
    }).catch(console.error);
  }

  async initializeWorkspacesButton() {
    if (!this.workspaceEnabled) {
      return;
    } else if (document.getElementById('zen-workspaces-button')) {
      let button = document.getElementById('zen-workspaces-button');
      button.removeAttribute('hidden');
      return;
    }
    await this._expandWorkspacesStrip();
  }

  async _expandWorkspacesStrip(browser = window) {
    if (typeof browser.ZenWorkspaces === 'undefined') {
      browser = window;
    }
    let button = browser.document.getElementById('zen-workspaces-button');

    while (button.firstChild) {
      button.firstChild.remove();
    }

    if (this._workspacesButtonClickListener) {
      button.removeEventListener('click', this._workspacesButtonClickListener);
      this._workspacesButtonClickListener = null;
    }
    if (this._workspaceButtonContextMenuListener) {
      button.removeEventListener('contextmenu', this._workspaceButtonContextMenuListener);
      this._workspaceButtonContextMenuListener = null;
    }

    button.setAttribute('showInPrivateBrowsing', 'false');
    button.setAttribute('tooltiptext', 'Workspaces');
    if (this.shouldShowIconStrip) {
      let workspaces = await this._workspaces();

      for (let workspace of workspaces.workspaces) {
        let workspaceButton = browser.document.createXULElement('toolbarbutton');
        workspaceButton.className = 'subviewbutton';
        workspaceButton.setAttribute('tooltiptext', workspace.name);
        workspaceButton.setAttribute('zen-workspace-id', workspace.uuid);

        if (this.isWorkspaceActive(workspace)) {
          workspaceButton.setAttribute('active', 'true');
        } else {
          workspaceButton.removeAttribute('active');
        }
        if (workspace.default) {
          workspaceButton.setAttribute('default', 'true');
        } else {
          workspaceButton.removeAttribute('default');
        }

        workspaceButton.addEventListener('click', async (event) => {
          if (event.button !== 0) {
            return;
          }
          await this.changeWorkspace(workspace);
        });

        let icon = browser.document.createXULElement('div');
        icon.className = 'zen-workspace-icon';
        icon.textContent = this.getWorkspaceIcon(workspace);
        workspaceButton.appendChild(icon);
        button.appendChild(workspaceButton);
      }

      if (workspaces.workspaces.length <= 1) {
        button.setAttribute('dont-show', true);
      } else {
        button.removeAttribute('dont-show');
      }

      this._workspaceButtonContextMenuListener = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openWorkspacesDialog(event);
      };
      button.addEventListener('contextmenu', this._workspaceButtonContextMenuListener.bind(browser.ZenWorkspaces));
    } else {
      let activeWorkspace = await this.getActiveWorkspace();
      if (activeWorkspace) {
        button.setAttribute('as-button', 'true');
        button.classList.add('toolbarbutton-1', 'zen-sidebar-action-button');

        this._workspacesButtonClickListener = browser.ZenWorkspaces.openWorkspacesDialog.bind(browser.ZenWorkspaces);
        button.addEventListener('click', this._workspacesButtonClickListener);

        const wrapper = browser.document.createXULElement('hbox');
        wrapper.className = 'zen-workspace-sidebar-wrapper';

        const icon = browser.document.createXULElement('div');
        icon.className = 'zen-workspace-sidebar-icon';
        icon.textContent = this.getWorkspaceIcon(activeWorkspace);

        const name = browser.document.createXULElement('div');
        name.className = 'zen-workspace-sidebar-name';
        name.textContent = activeWorkspace.name;

        if (!this.workspaceHasIcon(activeWorkspace)) {
          icon.setAttribute('no-icon', 'true');
        }

        wrapper.appendChild(icon);
        wrapper.appendChild(name);

        button.appendChild(wrapper);
      }
    }
  }

  closeWorkspacesSubView() {
    let parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');
    parentPanel.goBack(parentPanel);
  }

  // Workspaces management

  get _workspaceCreateInput() {
    return document.getElementById('PanelUI-zen-workspaces-create-input');
  }

  get _workspaceEditDialog() {
    return document.getElementById('PanelUI-zen-workspaces-edit');
  }

  get _workspaceEditInput() {
    return document.getElementById('PanelUI-zen-workspaces-edit-input');
  }

  get _workspaceEditIconsContainer() {
    return document.getElementById('PanelUI-zen-workspaces-icon-picker');
  }

  _deleteAllTabsInWorkspace(workspaceID) {
    for (let tab of gBrowser.tabs) {
      if (tab.getAttribute('zen-workspace-id') === workspaceID) {
        gBrowser.removeTab(tab, {
          animate: true,
          skipSessionStore: true,
          closeWindowWithLastTab: false,
        });
      }
    }
  }

  moveTabToWorkspace(tab, workspaceID) {
    if (tab.getAttribute('zen-workspace-id') === workspaceID) {
      return;
    }
    tab.setAttribute('zen-workspace-id', workspaceID);
    if (tab.hasAttribute('zen-essential')) {
      return;
    }
    const parent = tab.pinned ? '#vertical-pinned-tabs-container ' : '#tabbrowser-arrowscrollbox ';
    const container = document.querySelector(parent + `.zen-workspace-tabs-section[zen-workspace-id="${workspaceID}"]`);
    if (container) {
      container.insertBefore(tab, container.lastChild);
    }
    // also change glance tab if it's the same tab
    const glanceTab = tab.querySelector('.tabbrowser-tab[zen-glance-tab]');
    if (glanceTab) {
      glanceTab.setAttribute('zen-workspace-id', workspaceID);
    }
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

  async saveWorkspaceFromCreate() {
    let workspaceName = this._workspaceCreateInput.value;
    if (!workspaceName) {
      return;
    }
    this._workspaceCreateInput.value = '';
    let icon = document.querySelector('#PanelUI-zen-workspaces-icon-picker-wrapper [selected]');
    icon?.removeAttribute('selected');
    await this.createAndSaveWorkspace(workspaceName, false, icon?.label);
    this.goToPreviousSubView();
  }

  async saveWorkspaceFromEdit() {
    let workspaceUuid = this._workspaceEditDialog.getAttribute('data-workspace-uuid');
    let workspaceName = this._workspaceEditInput.value;
    if (!workspaceName) {
      return;
    }
    this._workspaceEditInput.value = '';
    let icon = document.querySelector('#PanelUI-zen-workspaces-icon-picker-wrapper [selected]');
    icon?.removeAttribute('selected');
    let workspaces = (await this._workspaces()).workspaces;
    let workspaceData = workspaces.find((workspace) => workspace.uuid === workspaceUuid);
    workspaceData.name = workspaceName;
    workspaceData.icon = icon?.label;
    await this.saveWorkspace(workspaceData);
    this.goToPreviousSubView();
  }

  onWorkspaceCreationNameChange(event) {
    let button = document.getElementById('PanelUI-zen-workspaces-create-save');
    if (this._workspaceCreateInput.value === '') {
      button.setAttribute('disabled', 'true');
      return;
    }
    button.removeAttribute('disabled');
  }

  onWorkspaceEditChange(icon) {
    let button = document.getElementById('PanelUI-zen-workspaces-edit-save');
    let name = this._workspaceEditInput.value;
    if (
      name === this._workspaceEditInput.getAttribute('data-initial-value') &&
      icon === this._workspaceEditIconsContainer.getAttribute('data-initial-value')
    ) {
      button.setAttribute('disabled', 'true');
      return;
    }
    button.removeAttribute('disabled');
  }

  addChangeListeners(func) {
    if (!this._changeListeners) {
      this._changeListeners = [];
    }
    this._changeListeners.push(func);
  }

  async changeWorkspace(window, ...args) {
    if (!this.workspaceEnabled || this._inChangingWorkspace) {
      return;
    }
    this._inChangingWorkspace = true;
    try {
      await this._performWorkspaceChange(window, ...args);
    } finally {
      this._inChangingWorkspace = false;
    }
  }

  _cancelSwipeAnimation() {
    const currentWorkspace = this.activeWorkspace;
    this._animateTabs({ uuid: currentWorkspace }, true);
  }

  async _performWorkspaceChange(window, { onInit = false, alwaysChange = false, whileScrolling = false } = {}) {
    const previousWorkspace = await this.getActiveWorkspace();
    alwaysChange = alwaysChange || onInit;

    if (previousWorkspace && previousWorkspace.uuid === window.uuid && !alwaysChange) {
      this._cancelSwipeAnimation();
      return;
    }

    this.activeWorkspace = window.uuid;
    const containerId = window.containerTabId?.toString();
    const workspaces = await this._workspaces();

    // Refresh tab cache
    gBrowser.verticalPinnedTabsContainer = this.pinnedTabsContainer;
    gBrowser.tabContainer.verticalPinnedTabsContainer = this.pinnedTabsContainer;
    // Move empty tab to the new workspace
    this._moveEmptyTabToWorkspace(window.uuid);

    this.tabContainer._invalidateCachedTabs();
    if (!whileScrolling) {
      await this._organizeWorkspaceStripLocations(previousWorkspace);
    }

    // First pass: Handle tab visibility and workspace ID assignment
    const prevTabUsed = this._processTabVisibility(window.uuid, containerId, workspaces, onInit);

    // Second pass: Handle tab selection
    this.tabContainer._invalidateCachedTabs();
    const tabToSelect = await this._handleTabSelection(
      window,
      onInit,
      containerId,
      workspaces,
      previousWorkspace.uuid,
      prevTabUsed
    );

    // Update UI and state
    await this._updateWorkspaceState(window, onInit, tabToSelect);
  }

  _moveEmptyTabToWorkspace(workspaceUuid) {
    const emptyTab = this._emptyTab;
    if (emptyTab) {
      this.moveTabToWorkspace(emptyTab, workspaceUuid);
    }
  }

  _makeSureEmptyTabIsLast() {
    const emptyTab = this._emptyTab;
    if (emptyTab) {
      const container = this.activeWorkspaceStrip;
      if (container) {
        container.insertBefore(emptyTab, container.lastChild);
      }
    }
  }

  _updateMarginTopPinnedTabs(arrowscrollbox, pinnedContainer) {
    if (arrowscrollbox) {
      arrowscrollbox.style.marginTop = pinnedContainer.getBoundingClientRect().height + 'px';
    }
  }

  async _organizeWorkspaceStripLocations(workspace, justMove = false, offsetPixels = 0) {
    const workspaces = await this._workspaces();
    let workspaceIndex = workspaces.workspaces.findIndex((w) => w.uuid === workspace.uuid);
    if (!justMove) {
      this._fixIndicatorsNames(workspaces);
    }
    for (const otherWorkspace of workspaces.workspaces) {
      const selector = `.zen-workspace-tabs-section[zen-workspace-id="${otherWorkspace.uuid}"]`;
      const newTransform = -(workspaceIndex - workspaces.workspaces.indexOf(otherWorkspace)) * 100;
      for (const container of document.querySelectorAll(selector)) {
        container.style.transform = `translateX(${newTransform + offsetPixels / 2}%)`;
        if (!offsetPixels && !container.hasAttribute('active')) {
          container.setAttribute('hidden', 'true');
        } else {
          container.removeAttribute('hidden');
        }
      }
    }
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
    indicatorIcon.textContent = this.getWorkspaceIcon(currentWorkspace);
    indicatorName.textContent = currentWorkspace.name;
  }

  _fixIndicatorsNames(workspaces) {
    for (const workspace of workspaces.workspaces) {
      const workspaceIndicator = document.querySelector(
        `#zen-current-workspace-indicator-container .zen-workspace-tabs-section[zen-workspace-id="${workspace.uuid}"]`
      );
      this.updateWorkspaceIndicator(workspace, workspaceIndicator);
    }
  }

  async _animateTabs(newWorkspace, shouldAnimate, tabToSelect = null) {
    this._animatingChange = true;
    const animations = [];
    const workspaces = await this._workspaces();
    const newWorkspaceIndex = workspaces.workspaces.findIndex((w) => w.uuid === newWorkspace.uuid);
    for (const element of document.querySelectorAll('.zen-workspace-tabs-section')) {
      const existingTransform = element.style.transform;
      const elementWorkspaceId = element.getAttribute('zen-workspace-id');
      const elementWorkspaceIndex = workspaces.workspaces.findIndex((w) => w.uuid === elementWorkspaceId);
      const offset = -(newWorkspaceIndex - elementWorkspaceIndex) * 100;
      const newTransform = `translateX(${offset}%)`;
      const isCurrent = offset === 0;
      if (shouldAnimate) {
        element.removeAttribute('hidden');
        animations.push(
          gZenUIManager.motion.animate(
            element,
            {
              transform: existingTransform ? [existingTransform, newTransform] : newTransform,
            },
            {
              type: 'spring',
              bounce: 0,
              duration: 0.3,
            }
          )
        );
      }
      if (offset === 0) {
        element.setAttribute('active', 'true');
        if (tabToSelect != gBrowser.selectedTab) {
          gBrowser.selectedTab = tabToSelect;
        }
      } else {
        element.removeAttribute('active');
      }
    }
    await Promise.all(animations);
    this._animatingChange = false;
  }

  _processTabVisibility(workspaceUuid, containerId, workspaces, onInit) {
    const hiddenTabs = [];
    const visibleTabs = gBrowser.tabContainer.visibleTabs;
    for (const tab of gBrowser.tabs) {
      if (!this._shouldShowTab(tab, workspaceUuid, containerId, workspaces)) {
        hiddenTabs.push(tab);
      } else if (tab.hasAttribute('zen-essential')) {
        gBrowser.showTab(tab, undefined, true);
      }
    }
    // If there's no more visible tabs, make a new tab visible
    // or if ALL the visible tabs are essentials or we have our selected
    // tab hidden, select a new tab
    let prevTabUsed = null;
    if (
      (hiddenTabs.length === visibleTabs.length ||
        visibleTabs.every((tab) => tab.getAttribute('zen-essential') === 'true') ||
        hiddenTabs.includes(gBrowser.selectedTab)) &&
      gZenVerticalTabsManager._canReplaceNewTab &&
      !onInit
    ) {
      prevTabUsed = gBrowser.selectedTab;
      this.selectEmptyTab();
    }
    for (const tab of hiddenTabs) {
      gBrowser.hideTab(tab, undefined, true);
    }
    return prevTabUsed;
  }

  // Only use it in gZenPinnedTabsManager, when initializing essential tabs
  essentialShouldShowTab(tab) {
    if (tab.getAttribute('zen-essential') !== 'true') {
      return true;
    }
    const workspaces = this._workspaceCache;
    if (!workspaces) {
      return true;
    }
    const containerId = (
      workspaces.workspaces.find((workspace) => workspace.uuid === this.activeWorkspace) || {}
    )?.containerTabId?.toString();
    return this._shouldShowTab(tab, this.activeWorkspace, containerId, workspaces);
  }

  _shouldShowTab(tab, workspaceUuid, containerId, workspaces) {
    const isEssential = tab.getAttribute('zen-essential') === 'true';
    const tabWorkspaceId = tab.getAttribute('zen-workspace-id');
    const tabContextId = tab.getAttribute('usercontextid');

    // Handle essential tabs
    if (isEssential) {
      if (!this.containerSpecificEssentials) {
        return true; // Show all essential tabs when containerSpecificEssentials is false
      }

      if (containerId) {
        // In workspaces with default container: Show essentials that match the container
        return tabContextId === containerId;
      } else {
        // In workspaces without a default container: Show essentials that aren't in container-specific workspaces
        // or have usercontextid="0" or no usercontextid
        return (
          !tabContextId ||
          tabContextId === '0' ||
          !workspaces.workspaces.some((workspace) => workspace.containerTabId === parseInt(tabContextId, 10))
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

  _shouldChangeToTab(aTab) {
    return !(aTab.hasAttribute('zen-essential') || (aTab.pinned && aTab.hasAttribute('pending')));
  }

  async _handleTabSelection(window, onInit, containerId, workspaces, previousWorkspaceId, prevTabUsed) {
    const currentSelectedTab = prevTabUsed || gBrowser.selectedTab;
    const oldWorkspaceId = previousWorkspaceId;
    const lastSelectedTab = this._lastSelectedWorkspaceTabs[window.uuid];

    // Save current tab as last selected for old workspace if it shouldn't be visible in new workspace
    if (oldWorkspaceId && oldWorkspaceId !== window.uuid) {
      this._lastSelectedWorkspaceTabs[oldWorkspaceId] = currentSelectedTab;
    }

    let tabToSelect = null;
    // Try last selected tab if it is visible
    if (lastSelectedTab && this._shouldShowTab(lastSelectedTab, window.uuid, containerId, workspaces)) {
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
    if (tabToSelect) {
      tabToSelect._visuallySelected = true;
    }

    // Always make sure we always unselect the tab from the old workspace
    if (currentSelectedTab && currentSelectedTab !== tabToSelect) {
      currentSelectedTab._selected = false;
      if (
        !this._shouldShowTab(currentSelectedTab, window.uuid, containerId, workspaces) &&
        currentSelectedTab.hasAttribute('zen-essential')
      ) {
        gBrowser.hideTab(currentSelectedTab, undefined, true);
      }
    }
    return tabToSelect;
  }

  async _updateWorkspaceState(workspace, onInit, tabToSelect) {
    // Update document state
    document.documentElement.setAttribute('zen-workspace-id', workspace.uuid);

    // Recalculate new tab observers
    gBrowser.tabContainer.observe(null, 'nsPref:changed', 'privacy.userContext.enabled');

    // Update workspace UI
    await this._updateWorkspacesChangeContextMenu();
    gZenUIManager.updateTabsToolbar();
    await this._propagateWorkspaceData({ clearCache: false });

    gZenThemePicker.onWorkspaceChange(workspace);

    document.getElementById('zen-tabs-wrapper').style.scrollbarWidth = 'none';
    await this._animateTabs(workspace, !onInit && !this._animatingChange, tabToSelect);
    await this._organizeWorkspaceStripLocations(workspace, true);
    document.getElementById('zen-tabs-wrapper').style.scrollbarWidth = '';

    // Notify listeners
    if (this._changeListeners?.length) {
      for (const listener of this._changeListeners) {
        await listener(workspace, onInit);
      }
    }

    // Reset bookmarks
    this._invalidateBookmarkContainers();

    // Update workspace indicator
    await this.updateWorkspaceIndicator(workspace, this.workspaceIndicator);

    // Fix ctrl+tab behavior. Note, we dont call it with "await" because we dont want to wait for it
    this._fixCtrlTabBehavior();

    // Bug: When updating from previous versions, we used to hide the tabs not used in the new workspace
    //  we now need to show them again
    if (onInit) {
      for (const tab of this.allStoredTabs) {
        if (!tab.hasAttribute('zen-essential')) {
          gBrowser.showTab(tab);
        }
      }
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

      if (workspace.uuid === activeWorkspace.uuid) {
        menuItem.setAttribute('disabled', 'true');
      }

      menuPopup.appendChild(menuItem);
    }
  }

  _createWorkspaceData(name, isDefault, icon, tabs, moveTabs = true) {
    let window = {
      uuid: gZenUIManager.generateUuidv4(),
      default: isDefault,
      icon: icon,
      name: name,
      theme: ZenThemePicker.getTheme([]),
    };
    if (moveTabs) {
      this._prepareNewWorkspace(window);
      const perifery = document.querySelector('#tabbrowser-arrowscrollbox-periphery[hidden]');
      perifery?.removeAttribute('hidden');
      this._createWorkspaceTabsSection(window, tabs, perifery);
      perifery.setAttribute('hidden', 'true');
    }
    return window;
  }

  async createAndSaveWorkspace(name = 'New Workspace', isDefault = false, icon = undefined, dontChange = false) {
    if (!this.workspaceEnabled) {
      return;
    }
    // get extra tabs remaning (e.g. on new profiles) and just move them to the new workspace
    const extraTabs = Array.from(gBrowser.tabContainer.arrowScrollbox.children).filter(
      (child) => child.tagName === 'tab' && !child.hasAttribute('zen-workspace-id')
    );
    let workspaceData = this._createWorkspaceData(name, isDefault, icon, extraTabs, !dontChange);
    await this.saveWorkspace(workspaceData, dontChange);
    if (!dontChange) {
      this.registerPinnedResizeObserver();
      let changed = extraTabs.length > 0;
      if (changed) {
        gBrowser.tabContainer._invalidateCachedTabs();
        gBrowser.selectedTab = extraTabs[0];
      }
      await this.changeWorkspace(workspaceData);
    }
    return workspaceData;
  }

  updateTabsContainers() {
    this.onPinnedTabsResize([{ target: this.pinnedTabsContainer }]);
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

  onPinnedTabsResize(entries) {
    if (!this._hasInitializedTabsStrip) {
      return;
    }
    for (const entry of entries) {
      const workspaceId = entry.target.getAttribute('zen-workspace-id');
      const arrowScrollbox = document.querySelector(
        `#tabbrowser-arrowscrollbox .zen-workspace-tabs-section[zen-workspace-id="${workspaceId}"]`
      );
      this._updateMarginTopPinnedTabs(arrowScrollbox, entry.target);
      this.updateShouldHideSeparator(arrowScrollbox, entry.target);
    }
  }

  async onTabBrowserInserted(event) {
    let tab = event.originalTarget;
    const isEssential = tab.getAttribute('zen-essential') === 'true';
    if (tab.getAttribute('zen-workspace-id') || !this.workspaceEnabled || isEssential) {
      return;
    }

    let activeWorkspace = await this.getActiveWorkspace();
    if (!activeWorkspace) {
      return;
    }
    tab.setAttribute('zen-workspace-id', activeWorkspace.uuid);
  }

  async onLocationChange(browser) {
    if (!this.workspaceEnabled || this._inChangingWorkspace || this._isClosingWindow) {
      return;
    }

    const parent = browser.ownerGlobal;
    const tab = gBrowser.getTabForBrowser(browser);
    const workspaceID = tab.getAttribute('zen-workspace-id');
    const isEssential = tab.getAttribute('zen-essential') === 'true';

    if (tab.hasAttribute('zen-empty-tab')) {
      return;
    }

    if (!isEssential) {
      const activeWorkspace = await parent.ZenWorkspaces.getActiveWorkspace();
      if (!activeWorkspace) {
        return;
      }

      // Only update last selected tab for non-essential tabs in their workspace
      if (!isEssential && workspaceID === activeWorkspace.uuid) {
        this._lastSelectedWorkspaceTabs[workspaceID] = tab;
      }

      // Switch workspace if needed
      if (workspaceID && workspaceID !== activeWorkspace.uuid && parent.ZenWorkspaces._hasInitializedTabsStrip) {
        await parent.ZenWorkspaces.changeWorkspace({ uuid: workspaceID });
      }
    }
  }

  makeSurePinTabIsInCorrectPosition() {
    if (!this.pinnedTabsContainer) {
      return 0; // until we initialize the pinned tabs container
    }
    const tabsInsidePinTab = Array.from(this.pinnedTabsContainer.parentElement.children).filter(
      (child) => child.tagName === 'tab'
    );
    let changed = false;
    for (const tab of tabsInsidePinTab) {
      if (tab.getAttribute('zen-glance-tab') === 'true') {
        continue;
      }
      if (tab.getAttribute('zen-essential') === 'true') {
        const container = document.getElementById('zen-essentials-container');
        container.appendChild(tab);
        changed = true;
        continue;
      }
      const workspaceId = tab.getAttribute('zen-workspace-id');
      if (!workspaceId) {
        continue;
      }
      const contaienr = document.querySelector(
        `#vertical-pinned-tabs-container .zen-workspace-tabs-section[zen-workspace-id="${workspaceId}"]`
      );
      contaienr.insertBefore(tab, contaienr.lastChild);
      changed = true;
    }
    if (changed) {
      gBrowser.tabContainer._invalidateCachedTabs();
    }
    // Return the number of essentials INSIDE the pinned tabs container so we can correctly change their parent
    return Array.from(this.pinnedTabsContainer.children).filter((child) => child.getAttribute('zen-essential') === 'true')
      .length;
  }

  // Context menu management

  _contextMenuId = null;
  async updateContextMenu(_) {
    console.assert(this._contextMenuId, 'No context menu ID set');
    document
      .querySelector(`#PanelUI-zen-workspaces [zen-workspace-id="${this._contextMenuId}"] .zen-workspace-actions`)
      .setAttribute('active', 'true');
    const workspaces = await this._workspaces();
    let deleteMenuItem = document.getElementById('context_zenDeleteWorkspace');
    if (
      workspaces.workspaces.length <= 1 ||
      workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId).default
    ) {
      deleteMenuItem.setAttribute('disabled', 'true');
    } else {
      deleteMenuItem.removeAttribute('disabled');
    }
    let defaultMenuItem = document.getElementById('context_zenSetAsDefaultWorkspace');
    if (workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId).default) {
      defaultMenuItem.setAttribute('disabled', 'true');
    } else {
      defaultMenuItem.removeAttribute('disabled');
    }
    let openMenuItem = document.getElementById('context_zenOpenWorkspace');
    if (
      workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId && this.isWorkspaceActive(workspace))
    ) {
      openMenuItem.setAttribute('disabled', 'true');
    } else {
      openMenuItem.removeAttribute('disabled');
    }
    const openInContainerMenuItem = document.getElementById('context_zenWorkspacesOpenInContainerTab');
    if (this.shouldShowContainers) {
      openInContainerMenuItem.removeAttribute('hidden');
    } else {
      openInContainerMenuItem.setAttribute('hidden', 'true');
    }
  }

  async contextChangeContainerTab(event) {
    let workspaces = await this._workspaces();
    let workspace = workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId);
    let userContextId = parseInt(event.target.getAttribute('data-usercontextid'));
    workspace.containerTabId = userContextId;
    await this.saveWorkspace(workspace);
  }

  onContextMenuClose() {
    let target = document.querySelector(
      `#PanelUI-zen-workspaces [zen-workspace-id="${this._contextMenuId}"] .zen-workspace-actions`
    );
    if (target) {
      target.removeAttribute('active');
    }
    this._contextMenuId = null;
  }

  findTabToBlur(tab) {
    if (!this._shouldChangeToTab(tab) && this._emptyTab) {
      return this._emptyTab;
    }
    return tab;
  }

  async setDefaultWorkspace() {
    await ZenWorkspacesStorage.setDefaultWorkspace(this._contextMenuId);
    await this._propagateWorkspaceData();
  }

  async openWorkspace() {
    let workspaces = await this._workspaces();
    let workspace = workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId);
    await this.changeWorkspace(workspace);
  }

  async contextDelete(event) {
    this.__contextIsDelete = true;
    event.stopPropagation();
    await this.removeWorkspace(this._contextMenuId);
    this.__contextIsDelete = false;
  }

  async contextEdit(event) {
    event.stopPropagation();
    await this.openEditDialog(this._contextMenuId);
  }

  get emojis() {
    if (this._emojis) {
      return this._emojis;
    }
    const lazy = {};
    Services.scriptloader.loadSubScript('chrome://browser/content/zen-components/ZenEmojies.mjs', lazy);
    this._emojis = lazy.zenGlobalEmojis();
    return this._emojis;
  }

  clearEmojis() {
    // Unload from memory
    this._emojis = null;
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
    const menu = document.createXULElement('menu');
    menu.setAttribute('id', 'context-zen-change-workspace-tab');
    menu.setAttribute('data-l10n-id', 'context-zen-change-workspace-tab');

    const menuPopup = document.createXULElement('menupopup');
    menuPopup.setAttribute('id', 'context-zen-change-workspace-tab-menu-popup');
    menuPopup.setAttribute('oncommand', "ZenWorkspaces.changeTabWorkspace(event.target.getAttribute('zen-workspace-id'))");

    menu.appendChild(menuPopup);

    document.getElementById('context_closeDuplicateTabs').after(menu);
  }

  async changeTabWorkspace(workspaceID) {
    const tabs = TabContextMenu.contextTab.multiselected ? gBrowser.selectedTabs : [TabContextMenu.contextTab];
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
    this._lastSelectedWorkspaceTabs[workspaceID] = tabs[tabs.length - 1];
    const workspaces = await this._workspaces();
    await this.changeWorkspace(workspaces.workspaces.find((workspace) => workspace.uuid === workspaceID));
  }

  // Tab browser utilities
  createContainerTabMenu(event) {
    let window = event.target.ownerGlobal;
    const workspace = this._workspaceCache.workspaces.find((workspace) => this._contextMenuId === workspace.uuid);
    let containerTabId = workspace.containerTabId;
    return window.createUserContextMenu(event, {
      isContextMenu: true,
      excludeUserContextId: containerTabId,
      showDefaultTab: true,
    });
  }

  getContextIdIfNeeded(userContextId, fromExternal, allowInheritPrincipal) {
    if (!this.workspaceEnabled) {
      return [userContextId, false, undefined];
    }

    if (this.shouldForceContainerTabsToWorkspace && typeof userContextId !== 'undefined' && this._workspaceCache?.workspaces) {
      // Find all workspaces that match the given userContextId
      const matchingWorkspaces = this._workspaceCache.workspaces.filter(
        (workspace) => workspace.containerTabId === userContextId
      );

      // Check if exactly one workspace matches
      if (matchingWorkspaces.length === 1) {
        const workspace = matchingWorkspaces[0];
        if (workspace.uuid !== this.getActiveWorkspaceFromCache().uuid) {
          window.addEventListener(
            'TabSelected',
            (event) => {
              this.changeWorkspace(workspace, { alwaysChange: true });
            },
            { once: true }
          );
          return [userContextId, true, workspace.uuid];
        }
      }
    }

    const activeWorkspace = this.getActiveWorkspaceFromCache();
    const activeWorkspaceUserContextId = activeWorkspace?.containerTabId;

    if (typeof userContextId !== 'undefined' && userContextId !== activeWorkspaceUserContextId) {
      return [userContextId, false, undefined];
    }
    return [activeWorkspaceUserContextId, true, undefined];
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

    for (const [workspaceUuid, bookmarkGuids] of Object.entries(this._workspaceBookmarksCache.bookmarks)) {
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
    if (!this._hasInitializedTabsStrip) {
      const children = this.tabboxChildren;
      children.pop(); // Remove the last child which is the new tab button
      return children;
    }

    if (this._allStoredTabs) {
      return this._allStoredTabs;
    }

    const tabs = [];
    // we need to go through each tab in each container
    const essentialsContainer = document.getElementById('zen-essentials-container');
    const pinnedContainers = document.querySelectorAll('#vertical-pinned-tabs-container .zen-workspace-tabs-section');
    const normalContainers = document.querySelectorAll('#tabbrowser-arrowscrollbox .zen-workspace-tabs-section');
    const containers = [essentialsContainer, ...pinnedContainers, ...normalContainers];
    for (const container of containers) {
      for (const tab of container.children) {
        if (tab.tagName === 'tab' || tab.tagName == 'tab-group') {
          tabs.push(tab);
          const glance = tab.querySelector('.tabbrowser-tab[glance-id]');
          if (glance) {
            tabs.push(glance);
          }
        }
      }
    }
    this._allStoredTabs = tabs;
    return this._allStoredTabs;
  }

  get allUsedBrowsers() {
    if (!this._hasInitializedTabsStrip) {
      return gBrowser.browsers;
    }
    return Array.from(gBrowser.tabpanels.querySelectorAll('browser'));
  }

  get pinnedTabCount() {
    return this.pinnedTabsContainer.children.length - 1;
  }

  get allWorkspaceTabs() {
    const currentWorkspace = this.activeWorkspace;
    return this.allStoredTabs.filter(
      (tab) => tab.hasAttribute('zen-essential') || tab.getAttribute('zen-workspace-id') === currentWorkspace
    );
  }

  reorganizeTabsAfterWelcome() {
    const children = gBrowser.tabContainer.arrowScrollbox.children;
    const remainingTabs = Array.from(children).filter((child) => child.tagName === 'tab');
    for (const tab of remainingTabs) {
      this.moveTabToWorkspace(tab, this.activeWorkspace);
    }
  }

  async switchIfNeeded(browser, i) {
    const tab = gBrowser.getTabForBrowser(browser);
    const workspaceId = tab.getAttribute('zen-workspace-id');
    if (!tab.hasAttribute('zen-essential') && workspaceId !== this.activeWorkspace) {
      await this.changeWorkspace({ uuid: workspaceId });
    }
    gBrowser.selectedTab = tab;
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
})();
