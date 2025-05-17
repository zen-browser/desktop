{
  class ZenGlanceManager extends ZenDOMOperatedFeature {
    _animating = false;
    _lazyPref = {};

    #glances = new Map();
    #currentGlanceID = null;

    #confirmationTimeout = null;

    init() {
      window.addEventListener('TabClose', this.onTabClose.bind(this));
      window.addEventListener('TabSelect', this.onLocationChange.bind(this));

      XPCOMUtils.defineLazyPreferenceGetter(
        this._lazyPref,
        'SHOULD_OPEN_EXTERNAL_TABS_IN_GLANCE',
        'zen.glance.open-essential-external-links',
        false
      );

      ChromeUtils.defineLazyGetter(this, 'sidebarButtons', () =>
        document.getElementById('zen-glance-sidebar-container')
      );
      document
        .getElementById('tabbrowser-tabpanels')
        .addEventListener('click', this.onOverlayClick.bind(this));
      Services.obs.addObserver(this, 'quit-application-requested');

      this.#addSidebarButtonListeners();
    }

    #addSidebarButtonListeners() {
      this.sidebarButtons.addEventListener('command', (event) => {
        const button = event.target.closest('toolbarbutton');
        if (!button) {
          return;
        }
        switch (button.id) {
          case 'zen-glance-sidebar-close':
            this.closeGlance({ onTabClose: true });
            break;
          case 'zen-glance-sidebar-open':
            this.fullyOpenGlance();
            break;
          case 'zen-glance-sidebar-split':
            this.splitGlance();
            break;
        }
      });
    }

    get #currentBrowser() {
      return this.#glances.get(this.#currentGlanceID)?.browser;
    }

    get #currentTab() {
      return this.#glances.get(this.#currentGlanceID)?.tab;
    }

    get #currentParentTab() {
      return this.#glances.get(this.#currentGlanceID)?.parentTab;
    }

    onOverlayClick(event) {
      if (event.target === this.overlay && event.originalTarget !== this.contentWrapper) {
        this.closeGlance({ onTabClose: true });
      }
    }

    observe(subject, topic) {
      switch (topic) {
        case 'quit-application-requested':
          this.onUnload();
          break;
      }
    }

    onUnload() {
      // clear everything
      for (let [id, glance] of this.#glances) {
        gBrowser.removeTab(glance.tab, { animate: false });
      }
    }

    getTabPosition(tab) {
      return tab._tPos;
    }

    createBrowserElement(url, currentTab, existingTab = null) {
      const newTabOptions = {
        userContextId: currentTab.getAttribute('usercontextid') || '',
        skipBackgroundNotify: true,
        insertTab: true,
        skipLoad: false,
        index: this.getTabPosition(currentTab) + 1,
      };
      currentTab._selected = true;
      const newUUID = gZenUIManager.generateUuidv4();
      const newTab =
        existingTab ?? gBrowser.addTrustedTab(Services.io.newURI(url).spec, newTabOptions);
      if (currentTab.hasAttribute('zenDefaultUserContextId')) {
        newTab.setAttribute('zenDefaultUserContextId', true);
      }
      currentTab.querySelector('.tab-content').appendChild(newTab);
      newTab.setAttribute('zen-glance-tab', true);
      newTab.setAttribute('glance-id', newUUID);
      currentTab.setAttribute('glance-id', newUUID);
      this.#glances.set(newUUID, {
        tab: newTab,
        parentTab: currentTab,
        browser: newTab.linkedBrowser,
      });
      this.#currentGlanceID = newUUID;
      gBrowser.selectedTab = newTab;
      return this.#currentBrowser;
    }

    fillOverlay(browser) {
      this.overlay = browser.closest('.browserSidebarContainer');
      this.browserWrapper = browser.closest('.browserContainer');
      this.contentWrapper = browser.closest('.browserStack');
    }

    showSidebarButtons(animate = false) {
      if (this.sidebarButtons.hasAttribute('hidden') && animate) {
        if (gZenVerticalTabsManager._prefsRightSide) {
          this.sidebarButtons.setAttribute('right', true);
        } else {
          this.sidebarButtons.setAttribute('right', false);
        }
        for (const button of this.sidebarButtons.querySelectorAll('toolbarbutton')) {
          button.style.opacity = 0;
        }
        gZenUIManager.motion.animate(
          this.sidebarButtons.querySelectorAll('toolbarbutton'),
          { x: [50, 0], opacity: [0, 1] },
          { delay: gZenUIManager.motion.stagger(0.1) }
        );
      }
      this.sidebarButtons.removeAttribute('hidden');
    }

    hideSidebarButtons() {
      this.sidebarButtons.setAttribute('hidden', true);
    }

    openGlance(data, existingTab = null, ownerTab = null) {
      if (this.#currentBrowser) {
        return;
      }
      if (gBrowser.selectedTab === this.#currentParentTab) {
        gBrowser.selectedTab = this.#currentTab;
        return;
      }
      this.animatingOpen = true;
      this._animating = true;

      const initialX = data.x;
      const initialY = data.y;
      const initialWidth = data.width;
      const initialHeight = data.height;

      this.browserWrapper?.removeAttribute('animate');
      this.browserWrapper?.removeAttribute('animate-end');
      this.browserWrapper?.removeAttribute('animate-full');
      this.browserWrapper?.removeAttribute('has-finished-animation');
      this.overlay?.removeAttribute('post-fade-out');

      const currentTab = ownerTab ?? gBrowser.selectedTab;

      const browserElement = this.createBrowserElement(data.url, currentTab, existingTab);

      this.fillOverlay(browserElement);

      this.overlay.classList.add('zen-glance-overlay');

      this.browserWrapper.removeAttribute('animate-end');
      return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
          this.quickOpenGlance({ dontOpenButtons: true });
          this.showSidebarButtons(true);

          gZenUIManager.motion.animate(
            this.#currentParentTab.linkedBrowser.closest('.browserSidebarContainer'),
            {
              scale: [1, 0.98],
              backdropFilter: ['blur(0px)', 'blur(5px)'],
              opacity: [1, 0.5],
            },
            {
              duration: 0.4,
              type: 'spring',
              bounce: 0.2,
            }
          );
          this.#currentBrowser.setAttribute('animate-glance-open', true);
          this.overlay.removeAttribute('fade-out');
          this.browserWrapper.setAttribute('animate', true);
          const top = initialY + initialHeight / 2;
          const left = initialX + initialWidth / 2;
          this.browserWrapper.style.top = `${top}px`;
          this.browserWrapper.style.left = `${left}px`;
          this.browserWrapper.style.width = `${initialWidth}px`;
          this.browserWrapper.style.height = `${initialHeight}px`;
          this.browserWrapper.style.opacity = 0.8;
          this.#glances.get(this.#currentGlanceID).originalPosition = {
            top: this.browserWrapper.style.top,
            left: this.browserWrapper.style.left,
            width: this.browserWrapper.style.width,
            height: this.browserWrapper.style.height,
          };
          this.browserWrapper.style.transform = 'translate(-50%, -50%)';
          this.overlay.style.overflow = 'visible';
          gZenUIManager.motion
            .animate(
              this.browserWrapper,
              {
                top: '50%',
                left: '50%',
                width: '85%',
                height: '100%',
                opacity: 1,
              },
              {
                duration: 0.3,
                type: 'spring',
                bounce: 0.2,
              }
            )
            .then(() => {
              this.#currentBrowser.removeAttribute('animate-glance-open');
              this.overlay.style.removeProperty('overflow');
              this.browserWrapper.removeAttribute('animate');
              this.browserWrapper.setAttribute('animate-end', true);
              this.browserWrapper.setAttribute('has-finished-animation', true);
              this._animating = false;
              this.animatingOpen = false;
              resolve(this.#currentTab);
            });
        });
      });
    }

    _clearContainerStyles(container) {
      const inset = container.style.inset;
      container.removeAttribute('style');
      container.style.inset = inset;
    }

    closeGlance({
      noAnimation = false,
      onTabClose = false,
      setNewID = null,
      isDifferent = false,
      hasFocused = false,
      skipPermitUnload = false,
    } = {}) {
      if (
        (this._animating && !onTabClose) ||
        !this.#currentBrowser ||
        (this.animatingOpen && !onTabClose) ||
        this._duringOpening
      ) {
        return;
      }

      if (!skipPermitUnload) {
        let { permitUnload } = this.#currentBrowser.permitUnload();
        if (!permitUnload) {
          return;
        }
      }

      if (onTabClose && hasFocused && !this.#confirmationTimeout) {
        const cancelButton = document.getElementById('zen-glance-sidebar-close');
        cancelButton.setAttribute('waitconfirmation', true);
        this.#confirmationTimeout = setTimeout(() => {
          cancelButton.removeAttribute('waitconfirmation');
          this.#confirmationTimeout = null;
        }, 3000);
        return;
      }

      this.browserWrapper.removeAttribute('has-finished-animation');
      if (noAnimation) {
        this._clearContainerStyles(
          this.#currentParentTab.linkedBrowser.closest('.browserSidebarContainer')
        );
        this.quickCloseGlance({ closeCurrentTab: false });
        return;
      }

      this.closingGlance = true;
      this._animating = true;

      gBrowser.zenInsertTabAtIndex(this.#currentTab, {
        index: this.getTabPosition(this.#currentParentTab),
      });

      let quikcCloseZen = false;
      if (onTabClose) {
        // Create new tab if no more ex
        if (gBrowser.tabs.length === 1) {
          BrowserCommands.openTab();
          return;
        }
      }

      // do NOT touch here, I don't know what it does, but it works...
      this.#currentTab.style.display = 'none';
      this.overlay.setAttribute('fade-out', true);
      this.overlay.style.pointerEvents = 'none';
      this.quickCloseGlance({ justAnimateParent: true, clearID: false });
      const originalPosition = this.#glances.get(this.#currentGlanceID).originalPosition;
      gZenUIManager.motion
        .animate(
          this.#currentParentTab.linkedBrowser.closest('.browserSidebarContainer'),
          {
            scale: [0.98, 1],
            backdropFilter: ['blur(5px)', 'blur(0px)'],
            opacity: [0.5, 1],
          },
          {
            duration: 0.4,
            type: 'spring',
            bounce: 0.2,
          }
        )
        .then(() => {
          this._clearContainerStyles(
            this.#currentParentTab.linkedBrowser.closest('.browserSidebarContainer')
          );
        });
      this.browserWrapper.style.opacity = 1;
      return new Promise((resolve) => {
        gZenUIManager.motion
          .animate(
            this.browserWrapper,
            {
              ...originalPosition,
              opacity: 0,
            },
            { type: 'spring', bounce: 0, duration: 0.5, easing: 'ease-in' }
          )
          .then(() => {
            this.browserWrapper.removeAttribute('animate');
            this.browserWrapper.removeAttribute('animate-end');
            if (!this.#currentParentTab) {
              return;
            }

            if (!onTabClose || quikcCloseZen) {
              this.quickCloseGlance({ clearID: false });
            }
            this.overlay.removeAttribute('fade-out');
            this.browserWrapper.removeAttribute('animate');

            this.lastCurrentTab = this.#currentTab;

            this.overlay.classList.remove('zen-glance-overlay');
            gBrowser
              ._getSwitcher()
              .setTabStateNoAction(this.lastCurrentTab, gBrowser.AsyncTabSwitcher.STATE_UNLOADED);

            if (!onTabClose) {
              this.#currentParentTab._visuallySelected = false;
            }

            // reset everything
            this.browserWrapper = null;
            this.overlay = null;
            this.contentWrapper = null;

            this.lastCurrentTab.removeAttribute('zen-glance-tab');
            this.lastCurrentTab._closingGlance = true;

            if (!isDifferent) {
              gBrowser.selectedTab = this.#currentParentTab;
            }
            this._ignoreClose = true;
            gBrowser.removeTab(this.lastCurrentTab, { animate: true, skipPermitUnload: true });
            gBrowser.tabContainer._invalidateCachedTabs();

            this.#currentParentTab.removeAttribute('glance-id');

            this.#glances.delete(this.#currentGlanceID);
            this.#currentGlanceID = setNewID;

            this.lastCurrentTab = null;
            this._duringOpening = false;

            this._animating = false;
            this.closingGlance = false;

            if (this.#currentGlanceID) {
              this.quickOpenGlance();
            }

            resolve();
          });
      });
    }

    quickOpenGlance({ dontOpenButtons = false } = {}) {
      if (!this.#currentBrowser || this._duringOpening) {
        return;
      }
      this._duringOpening = true;
      if (!dontOpenButtons) {
        this.showSidebarButtons();
      }

      const parentBrowserContainer = this.#currentParentTab.linkedBrowser.closest(
        '.browserSidebarContainer'
      );
      parentBrowserContainer.classList.add('zen-glance-background');
      parentBrowserContainer.classList.remove('zen-glance-overlay');
      parentBrowserContainer.classList.add('deck-selected');
      this.#currentParentTab.linkedBrowser.zenModeActive = true;
      this.#currentParentTab.linkedBrowser.docShellIsActive = true;
      this.#currentBrowser.zenModeActive = true;
      this.#currentBrowser.docShellIsActive = true;
      this.#currentBrowser.setAttribute('zen-glance-selected', true);
      this.fillOverlay(this.#currentBrowser);
      this.#currentParentTab._visuallySelected = true;

      this.overlay.classList.add('deck-selected');
      this.overlay.classList.add('zen-glance-overlay');

      this._duringOpening = false;
    }

    quickCloseGlance({
      closeCurrentTab = true,
      closeParentTab = true,
      justAnimateParent = false,
      clearID = true,
    } = {}) {
      const parentHasBrowser = !!this.#currentParentTab.linkedBrowser;
      this.hideSidebarButtons();
      if (parentHasBrowser) {
        this.#currentParentTab.linkedBrowser
          .closest('.browserSidebarContainer')
          .classList.remove('zen-glance-background');
      }
      if (!justAnimateParent && this.overlay) {
        if (parentHasBrowser) {
          if (closeParentTab) {
            this.#currentParentTab.linkedBrowser
              .closest('.browserSidebarContainer')
              .classList.remove('deck-selected');
          }
          this.#currentParentTab.linkedBrowser.zenModeActive = false;
        }
        this.#currentBrowser.zenModeActive = false;
        if (closeParentTab && parentHasBrowser) {
          this.#currentParentTab.linkedBrowser.docShellIsActive = false;
        }
        if (closeCurrentTab) {
          this.#currentBrowser.docShellIsActive = false;
          this.overlay.classList.remove('deck-selected');
          this.#currentTab._selected = false;
        }
        if (!this.#currentParentTab._visuallySelected && closeParentTab) {
          this.#currentParentTab._visuallySelected = false;
        }
        this.#currentBrowser.removeAttribute('zen-glance-selected');
        this.overlay.classList.remove('zen-glance-overlay');
      }
      if (clearID) {
        this.#currentGlanceID = null;
      }
    }

    onLocationChangeOpenGlance() {
      if (!this.animatingOpen) {
        this.quickOpenGlance();
      }
    }

    clearConfirmationTimeout() {
      if (this.#confirmationTimeout) {
        clearTimeout(this.#confirmationTimeout);
        this.#confirmationTimeout = null;
      }
      document.getElementById('zen-glance-sidebar-close')?.removeAttribute('waitconfirmation');
    }

    // note: must be sync to avoid timing issues
    onLocationChange(event) {
      const tab = event.target;
      this.clearConfirmationTimeout();
      if (this.animatingFullOpen || this.closingGlance) {
        return;
      }
      if (this._duringOpening || !tab.hasAttribute('glance-id')) {
        if (this.#currentGlanceID && !this._duringOpening) {
          this.quickCloseGlance();
        }
        return;
      }
      if (this.#currentGlanceID && this.#currentGlanceID !== tab.getAttribute('glance-id')) {
        this.quickCloseGlance();
      }
      this.#currentGlanceID = tab.getAttribute('glance-id');
      if (gBrowser.selectedTab === this.#currentParentTab && this.#currentBrowser) {
        const curTab = this.#currentTab;
        const prevTab = event.detail.previousTab;
        setTimeout(() => {
          gBrowser.selectedTab = curTab;
          if (prevTab?.linkedBrowser) {
            prevTab.linkedBrowser
              .closest('.browserSidebarContainer')
              .classList.remove('deck-selected');
          }
        }, 0);
      } else if (gBrowser.selectedTab === this.#currentTab) {
        setTimeout(this.onLocationChangeOpenGlance.bind(this), 0);
      }
    }

    onTabClose(event) {
      if (event.target === this.#currentParentTab) {
        this.closeGlance({ onTabClose: true });
      }
    }

    manageTabClose(tab) {
      if (tab.hasAttribute('glance-id')) {
        const oldGlanceID = this.#currentGlanceID;
        const newGlanceID = tab.getAttribute('glance-id');
        this.#currentGlanceID = newGlanceID;
        const isDifferent = newGlanceID !== oldGlanceID;
        if (this._ignoreClose) {
          this._ignoreClose = false;
          return false;
        }
        this.closeGlance({
          onTabClose: true,
          setNewID: isDifferent ? oldGlanceID : null,
          isDifferent,
        });
        // only keep continueing tab close if we are not on the currently selected tab
        return !isDifferent;
      }
      return false;
    }

    tabDomainsDiffer(tab1, url2) {
      try {
        if (!tab1) {
          return true;
        }
        let url1 = tab1.linkedBrowser.currentURI.spec;
        if (url1.startsWith('about:')) {
          return true;
        }
        // https://github.com/zen-browser/desktop/issues/7173: Only glance up links that are http(s) or file
        const url2Spec = url2.spec;
        if (
          !url2Spec.startsWith('http') &&
          !url2Spec.startsWith('https') &&
          !url2Spec.startsWith('file')
        ) {
          return false;
        }
        return Services.io.newURI(url1).host !== url2.host;
      } catch (e) {
        return true;
      }
    }

    shouldOpenTabInGlance(tab, uri) {
      let owner = tab.owner;
      return (
        owner &&
        owner.pinned &&
        this._lazyPref.SHOULD_OPEN_EXTERNAL_TABS_IN_GLANCE &&
        owner.linkedBrowser?.browsingContext?.isAppTab &&
        this.tabDomainsDiffer(owner, uri) &&
        Services.prefs.getBoolPref('zen.glance.enabled', true)
      );
    }

    onTabOpen(browser, uri) {
      let tab = gBrowser.getTabForBrowser(browser);
      if (!tab) {
        return;
      }
      try {
        if (this.shouldOpenTabInGlance(tab, uri)) {
          const browserRect = gBrowser.tabbox.getBoundingClientRect();
          this.openGlance(
            {
              url: undefined,
              x: browserRect.width / 2,
              y: browserRect.height / 2,
              width: 0,
              height: 0,
            },
            tab,
            tab.owner
          );
        }
      } catch (e) {
        console.error(e);
      }
    }

    finishOpeningGlance() {
      gZenWorkspaces.updateTabsContainers();
      this.browserWrapper.removeAttribute('animate-full');
      this.overlay.classList.remove('zen-glance-overlay');
      this._clearContainerStyles(this.browserWrapper);
      this.animatingFullOpen = false;
      this.closeGlance({ noAnimation: true, skipPermitUnload: true });
      this.#glances.delete(this.#currentGlanceID);
    }

    async fullyOpenGlance({ forSplit = false } = {}) {
      this.animatingFullOpen = true;
      this.#currentTab.setAttribute('zen-dont-split-glance', true);

      gBrowser.zenInsertTabAtIndex(this.#currentTab, this.getTabPosition(this.#currentTab));

      this.#currentTab.removeAttribute('zen-glance-tab');
      this._clearContainerStyles(this.browserWrapper);
      this.browserWrapper.removeAttribute('has-finished-animation');
      this.browserWrapper.setAttribute('animate-full', true);
      this.#currentTab.removeAttribute('glance-id');
      this.#currentParentTab.removeAttribute('glance-id');
      gBrowser.selectedTab = this.#currentTab;
      this.#currentParentTab.linkedBrowser
        .closest('.browserSidebarContainer')
        .classList.remove('zen-glance-background');
      this.#currentParentTab._visuallySelected = false;
      this.hideSidebarButtons();
      if (gReduceMotion || forSplit) {
        this.finishOpeningGlance();
        return;
      }
      await gZenUIManager.motion.animate(
        this.browserWrapper,
        {
          width: ['85%', '100%'],
          height: ['100%', '100%'],
        },
        {
          duration: 0.4,
          type: 'spring',
        }
      );
      this.finishOpeningGlance();
    }

    openGlanceForBookmark(event) {
      const activationMethod = Services.prefs.getStringPref('zen.glance.activation-method', 'ctrl');

      if (activationMethod === 'ctrl' && !event.ctrlKey) {
        return;
      } else if (activationMethod === 'alt' && !event.altKey) {
        return;
      } else if (activationMethod === 'shift' && !event.shiftKey) {
        return;
      } else if (activationMethod === 'meta' && !event.metaKey) {
        return;
      } else if (activationMethod === 'mantain' || typeof activationMethod === 'undefined') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = event.target.getBoundingClientRect();
      const data = {
        url: event.target._placesNode.uri,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };

      this.openGlance(data);

      return false;
    }

    getFocusedTab(aDir) {
      return aDir < 0 ? this.#currentParentTab : this.#currentTab;
    }

    async splitGlance() {
      if (this.#currentGlanceID) {
        const currentTab = this.#currentTab;
        const currentParentTab = this.#currentParentTab;

        await this.fullyOpenGlance({ forSplit: true });
        gZenViewSplitter.splitTabs([currentTab, currentParentTab], 'vsep', 1);
        const browserContainer = currentTab.linkedBrowser?.closest('.browserSidebarContainer');
        if (!gReduceMotion && browserContainer) {
          gZenViewSplitter.animateBrowserDrop(browserContainer);
        }
      }
    }

    getTabOrGlanceParent(tab) {
      if (tab.hasAttribute('glance-id')) {
        const parentTab = this.#glances.get(tab.getAttribute('glance-id')).parentTab;
        if (parentTab) {
          return parentTab;
        }
      }
      return tab;
    }
  }

  window.gZenGlanceManager = new ZenGlanceManager();

  function registerWindowActors() {
    if (Services.prefs.getBoolPref('zen.glance.enabled', true)) {
      gZenActorsManager.addJSWindowActor('ZenGlance', {
        parent: {
          esModuleURI: 'chrome://browser/content/zen-components/actors/ZenGlanceParent.sys.mjs',
        },
        child: {
          esModuleURI: 'chrome://browser/content/zen-components/actors/ZenGlanceChild.sys.mjs',
          events: {
            DOMContentLoaded: {},
            keydown: {
              capture: true,
            },
          },
        },
        allFrames: true,
        matches: ['*://*/*'],
      });
    }
  }

  registerWindowActors();
}
