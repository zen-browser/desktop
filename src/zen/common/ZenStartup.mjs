// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  var gZenStartup = {
    _watermarkIgnoreElements: ['zen-toast-container'],

    isReady: false,

    async init() {
      // important: We do this to ensure that some firefox components
      // are initialized before we start our own initialization.
      // please, do not remove this line and if you do, make sure to
      // test the startup process.
      await new Promise((resolve) => resolve());
      this.openWatermark();
      this._initBrowserBackground();
      this._changeSidebarLocation();
      this._zenInitBrowserLayout();
    },

    _initBrowserBackground() {
      const background = document.createXULElement('box');
      background.id = 'zen-browser-background';
      const grain = document.createXULElement('box');
      grain.id = 'zen-browser-grain';
      background.appendChild(grain);
      document.getElementById('browser').prepend(background);
    },

    _zenInitBrowserLayout() {
      if (this.__hasInitBrowserLayout) return;
      this.__hasInitBrowserLayout = true;
      try {
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
          document.getElementById('zen-appcontent-wrapper').prepend(deckTemplate);
        }

        gZenWorkspaces.init();
        setTimeout(() => {
          gZenUIManager.init();
          this._checkForWelcomePage();

          document.l10n.setAttributes(
            document.getElementById('tabs-newtab-button'),
            'tabs-toolbar-new-tab'
          );
        }, 0);
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
        delete gZenUIManager.promiseInitialized;
        this._initSearchBar();
        gZenCompactModeManager.init();
        // Fix for https://github.com/zen-browser/desktop/issues/7605, specially in compact mode
        if (gURLBar.hasAttribute('breakout-extend')) {
          gURLBar.focus();
        }
        // A bit of a hack to make sure the tabs toolbar is updated.
        // Just in case we didn't get the right size.
        gZenUIManager.updateTabsToolbar();
        this.closeWatermark();
        this.isReady = true;
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
        let elementsToIgnore = this._watermarkIgnoreElements.map((id) => '#' + id).join(', ');
        gZenUIManager.motion
          .animate(
            '#browser > *:not(' + elementsToIgnore + '), #urlbar, #tabbrowser-tabbox > *',
            {
              opacity: [0, 1],
            },
            {
              duration: 0.1,
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

    _initSearchBar() {
      // Only focus the url bar
      gURLBar.focus();
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

  window.addEventListener(
    'MozBeforeInitialXULLayout',
    () => {
      gZenStartup.init();
    },
    { once: true }
  );
}
