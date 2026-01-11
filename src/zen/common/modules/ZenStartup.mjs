// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import checkForZenUpdates, {
  createWindowUpdateAnimation,
} from 'chrome://browser/content/ZenUpdates.mjs';

class ZenStartup {
  #watermarkIgnoreElements = ['zen-toast-container'];
  #hasInitializedLayout = false;

  isReady = false;

  init() {
    this.openWatermark();
    this.#initBrowserBackground();
    this.#changeSidebarLocation();
    this.#zenInitBrowserLayout();
  }

  #initBrowserBackground() {
    const background = document.createXULElement('box');
    background.id = 'zen-browser-background';
    background.classList.add('zen-browser-generic-background');
    const grain = document.createXULElement('box');
    grain.classList.add('zen-browser-grain');
    background.appendChild(grain);
    document.getElementById('browser').prepend(background);
    const toolbarBackground = background.cloneNode(true);
    toolbarBackground.removeAttribute('id');
    toolbarBackground.classList.add('zen-toolbar-background');
    document.getElementById('titlebar').prepend(toolbarBackground);
  }

  #zenInitBrowserLayout() {
    if (this.#hasInitializedLayout) return;
    this.#hasInitializedLayout = true;
    gZenKeyboardShortcutsManager.beforeInit();
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
        this.#checkForWelcomePage();
      }, 0);
    } catch (e) {
      console.error('ZenThemeModifier: Error initializing browser layout', e);
    }
    if (gBrowserInit.delayedStartupFinished) {
      this.delayedStartupFinished();
    } else {
      Services.obs.addObserver(this, 'browser-delayed-startup-finished');
    }
  }

  observe(aSubject, aTopic) {
    // This nsIObserver method allows us to defer initialization until after
    // this window has finished painting and starting up.
    if (aTopic == 'browser-delayed-startup-finished' && aSubject == window) {
      Services.obs.removeObserver(this, 'browser-delayed-startup-finished');
      this.delayedStartupFinished();
    }
  }

  delayedStartupFinished() {
    gZenWorkspaces.promiseInitialized.then(async () => {
      await delayedStartupPromise;
      await SessionStore.promiseAllWindowsRestored;
      delete gZenUIManager.promiseInitialized;
      this.#initSearchBar();
      gZenCompactModeManager.init();
      // Fix for https://github.com/zen-browser/desktop/issues/7605, specially in compact mode
      if (gURLBar.hasAttribute('breakout-extend')) {
        gURLBar.focus();
      }
      // A bit of a hack to make sure the tabs toolbar is updated.
      // Just in case we didn't get the right size.
      gZenUIManager.updateTabsToolbar();
      this.closeWatermark();
      document.getElementById('tabbrowser-arrowscrollbox').setAttribute('orient', 'vertical');
      this.isReady = true;
    });
  }

  openWatermark() {
    if (!Services.prefs.getBoolPref('zen.watermark.enabled', false)) {
      document.documentElement.removeAttribute('zen-before-loaded');
      return;
    }
    for (let elem of document.querySelectorAll('#browser > *, #urlbar')) {
      elem.style.opacity = 0;
    }
  }

  closeWatermark() {
    document.documentElement.removeAttribute('zen-before-loaded');
    if (Services.prefs.getBoolPref('zen.watermark.enabled', false)) {
      let elementsToIgnore = this.#watermarkIgnoreElements.map((id) => '#' + id).join(', ');
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
  }

  #changeSidebarLocation() {
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
  }

  #initSearchBar() {
    // Only focus the url bar
    gURLBar.focus();
  }

  #checkForWelcomePage() {
    if (!Services.prefs.getBoolPref('zen.welcome-screen.seen', false)) {
      Services.prefs.setBoolPref('zen.welcome-screen.seen', true);
      Services.prefs.setStringPref('zen.updates.last-build-id', Services.appinfo.appBuildID);
      Services.prefs.setStringPref('zen.updates.last-version', Services.appinfo.version);
      Services.scriptloader.loadSubScript(
        'chrome://browser/content/zen-components/ZenWelcome.mjs',
        window
      );
    } else {
      this.#createUpdateAnimation();
    }
  }

  async #createUpdateAnimation() {
    checkForZenUpdates();
    return await createWindowUpdateAnimation();
  }
}

window.gZenStartup = new ZenStartup();

window.addEventListener(
  'MozBeforeInitialXULLayout',
  () => {
    gZenStartup.init();
  },
  { once: true }
);
