{
  var ZenStartup = {
    init() {
      this.openWatermark();
      this._changeSidebarLocation();
      this._zenInitBrowserLayout();
      this._initSearchBar();
    },

    _zenInitBrowserLayout() {
      if (this.__hasInitBrowserLayout) return;
      this.__hasInitBrowserLayout = true;
      try {
        console.info('ZenThemeModifier: init browser layout');
        const kNavbarItems = ['nav-bar', 'PersonalToolbar'];
        const kNewContainerId = 'zen-appcontent-navbar-container';
        let newContainer = document.getElementById(kNewContainerId);
        for (let id of kNavbarItems) {
          const node = document.getElementById(id);
          console.assert(node, 'Could not find node with id: ' + id);
          if (!node) continue;
          newContainer.appendChild(node);
        }

        // Fix notification deck
        const deckTemplate = document.getElementById('tab-notification-deck-template');
        if (deckTemplate) {
          document.getElementById('zen-appcontent-navbar-container').appendChild(deckTemplate);
        }

        this._initSidebarScrolling();
        this._hideUnusedElements();

        gZenWorkspaces.init();
        gZenVerticalTabsManager.init();
        gZenUIManager.init();

        this._checkForWelcomePage();

        document.l10n.setAttributes(
          document.getElementById('tabs-newtab-button'),
          'tabs-toolbar-new-tab'
        );
      } catch (e) {
        console.error('ZenThemeModifier: Error initializing browser layout', e);
      }
      if (gBrowserInit.delayedStartupFinished) {
        this.delayedStartupFinished();
      } else {
        Services.obs.addObserver(this, 'browser-delayed-startup-finished');
      }
    },

    observe(aSubject, aTopic) {
      // This nsIObserver method allows us to defer initialization until after
      // this window has finished painting and starting up.
      if (aTopic == 'browser-delayed-startup-finished' && aSubject == window) {
        Services.obs.removeObserver(this, 'browser-delayed-startup-finished');
        this.delayedStartupFinished();
      }
    },

    delayedStartupFinished() {
      gZenWorkspaces.promiseInitialized.then(async () => {
        await delayedStartupPromise;
        await SessionStore.promiseAllWindowsRestored;
        setTimeout(() => {
          gZenCompactModeManager.init();
          setTimeout(() => {
            // Fix for https://github.com/zen-browser/desktop/issues/7605, specially in compact mode
            if (gURLBar.hasAttribute('breakout-extend')) {
              gURLBar.focus();
            }
            setTimeout(() => {
              // A bit of a hack to make sure the tabs toolbar is updated.
              // Just in case we didn't get the right size.
              gZenUIManager.updateTabsToolbar();
            }, 0);
          }, 100);
        }, 0);
        this.closeWatermark();
      });
    },

    openWatermark() {
      if (!Services.prefs.getBoolPref('zen.watermark.enabled', false)) {
        document.documentElement.removeAttribute('zen-before-loaded');
        return;
      }
      for (let elem of document.querySelectorAll('#browser > *, #urlbar')) {
        elem.style.opacity = 0;
      }
    },

    closeWatermark() {
      document.documentElement.removeAttribute('zen-before-loaded');
      if (Services.prefs.getBoolPref('zen.watermark.enabled', false)) {
        gZenUIManager.motion
          .animate(
            '#browser > *, #urlbar, #tabbrowser-tabbox > *',
            {
              opacity: [0, 1],
            },
            {
              delay: 0.6,
              easing: 'ease-in-out',
            }
          )
          .then(() => {
            for (let elem of document.querySelectorAll(
              '#browser > *, #urlbar, #tabbrowser-tabbox > *'
            )) {
              elem.style.removeProperty('opacity');
            }
          });
      }
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new window.Event('resize')); // To recalculate the layout
      });
    },

    _changeSidebarLocation() {
      const kElementsToAppend = ['sidebar-splitter', 'sidebar-box'];

      const browser = document.getElementById('browser');
      browser.prepend(gNavToolbox);

      const sidebarPanelWrapper = document.getElementById('tabbrowser-tabbox');
      for (let id of kElementsToAppend) {
        const elem = document.getElementById(id);
        if (elem) {
          sidebarPanelWrapper.prepend(elem);
        }
      }
    },

    _hideUnusedElements() {
      const kElements = ['firefox-view-button'];
      for (let id of kElements) {
        const elem = document.getElementById(id);
        if (elem) {
          elem.setAttribute('hidden', 'true');
        }
      }
    },

    _initSidebarScrolling() {
      // Disable smooth scroll
      const canSmoothScroll = Services.prefs.getBoolPref(
        'zen.startup.smooth-scroll-in-tabs',
        false
      );
      const tabsWrapper = document.getElementById('zen-tabs-wrapper');
      gBrowser.tabContainer.addEventListener('wheel', (event) => {
        if (canSmoothScroll) return;
        event.preventDefault(); // Prevent the smooth scroll behavior
        gBrowser.tabContainer.scrollTop += event.deltaY * 20; // Apply immediate scroll
      });
      // Detect overflow and underflow
      const observer = new ResizeObserver((_) => {
        const tabContainer = gBrowser.tabContainer;
        // const isVertical = tabContainer.getAttribute('orient') === 'vertical';
        // let contentSize = tabsWrapper.getBoundingClientRect()[isVertical ? 'height' : 'width'];
        // NOTE: This should be contentSize > scrollClientSize, but due
        // to how Gecko internally rounds in those cases, we allow for some
        // minor differences (the internal Gecko layout size is 1/60th of a
        // pixel, so 0.02 should cover it).
        //let overflowing = contentSize - tabContainer.arrowScrollbox.scrollClientSize > 0.02;
        let overflowing = true; // cheatign the system, because we want to always show make the element overflowing

        window.requestAnimationFrame(() => {
          tabContainer.arrowScrollbox.toggleAttribute('overflowing', overflowing);
          tabContainer.arrowScrollbox.dispatchEvent(
            new CustomEvent(overflowing ? 'overflow' : 'underflow')
          );
        });
      });
      observer.observe(tabsWrapper);
    },

    _initSearchBar() {
      // Only focus the url bar
      gURLBar.focus();

      gURLBar._initCopyCutController();
      gURLBar._initPasteAndGo();
      gURLBar._initStripOnShare();
    },

    _checkForWelcomePage() {
      if (!Services.prefs.getBoolPref('zen.welcome-screen.seen', false)) {
        Services.prefs.setBoolPref('zen.welcome-screen.seen', true);
        Services.scriptloader.loadSubScript(
          'chrome://browser/content/zen-components/ZenWelcome.mjs',
          window
        );
      }
    },
  };

  ZenStartup.init();
}
