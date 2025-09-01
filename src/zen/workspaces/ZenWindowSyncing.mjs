// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class nsZenWorkspaceWindowSync extends nsZenMultiWindowFeature {
    #ignoreNextEvents = false;
    #waitForPromise = null;

    constructor() {
      super();
      if (!window.closed) {
        this.init();
      }
    }

    async init() {
      await gZenWorkspaces.promiseInitialized;
      this.#makeSureAllTabsHaveIds();
      this.#setUpEventListeners();
    }

    #makeSureAllTabsHaveIds() {
      const allTabs = gZenWorkspaces.allStoredTabs;
      for (const tab of allTabs) {
        if (!tab.hasAttribute('zen-sync-id')) {
          const tabId = gZenUIManager.generateUuidv4();
          tab.setAttribute('zen-sync-id', tabId);
        }
      }
    }

    #setUpEventListeners() {
      const kEvents = [
        'TabClose',
        'TabOpen',
        'TabPinned',
        'TabUnpinned',
        'TabAddedToEssentials',
        'TabRemovedFromEssentials',
        'TabHide',
        'TabShow',
        'TabMove',
        'ZenTabIconChanged',
        'ZenTabLabelChanged',
      ];
      const eventListener = this.#handleEvent.bind(this);
      for (const event of kEvents) {
        window.addEventListener(event, eventListener);
      }

      window.addEventListener('unload', () => {
        for (const event of kEvents) {
          window.removeEventListener(event, eventListener);
        }
      });
    }

    #handleEvent(event) {
      this.#propagateToOtherWindows(event);
    }

    async #propagateToOtherWindows(event) {
      if (this.#ignoreNextEvents) {
        return;
      }
      if (this.#waitForPromise) {
        await this.#waitForPromise;
      }
      this.#waitForPromise = new Promise(async (resolve) => {
        await this.foreachWindowAsActive(async (browser) => {
          if (browser.gZenWorkspaceWindowSync && !this.windowIsActive(browser)) {
            await browser.gZenWorkspaceWindowSync.onExternalTabEvent(event);
          }
        });
        resolve();
      });
    }

    async onExternalTabEvent(event) {
      this.#ignoreNextEvents = true;
      switch (event.type) {
        case 'TabClose':
          this.#onTabClose(event);
          break;
        case 'TabOpen':
          await this.#onTabOpen(event);
          break;
        case 'TabPinned':
          this.#onTabPinned(event);
          break;
        case 'TabUnpinned':
          this.#onTabUnpinned(event);
          break;
        case 'TabAddedToEssentials':
          this.#onTabAddedToEssentials(event);
          break;
        case 'TabRemovedFromEssentials':
          this.#onTabRemovedFromEssentials(event);
          break;
        case 'TabHide':
          this.#onTabHide(event);
          break;
        case 'TabShow':
          this.#onTabShow(event);
          break;
        case 'TabMove':
          this.#onTabMove(event);
          break;
        case 'ZenTabIconChanged':
          this.#onTabIconChanged(event);
          break;
        case 'ZenTabLabelChanged':
          this.#onTabLabelChanged(event);
          break;
        default:
          console.warn(`Unhandled event type: ${event.type}`);
          break;
      }
      this.#ignoreNextEvents = false;
    }

    #getTabId(tab) {
      return tab.getAttribute('zen-sync-id');
    }

    #getTabWithId(tabId) {
      for (const tab of gZenWorkspaces.allStoredTabs) {
        if (this.#getTabId(tab) === tabId) {
          return tab;
        }
      }
      return null;
    }

    #onTabClose(event) {
      const targetTab = event.target;
      const tabId = this.#getTabId(targetTab);
      const tabToClose = this.#getTabWithId(tabId);
      if (tabToClose) {
        gBrowser.removeTab(tabToClose);
      }
    }

    #onTabPinned(event) {
      const targetTab = event.target;
      if (targetTab.hasAttribute('zen-essential')) {
        return this.#onTabAddedToEssentials(event);
      }
      const tabId = this.#getTabId(targetTab);
      const elementIndex = targetTab.elementIndex;
      const tabToPin = this.#getTabWithId(tabId);
      if (tabToPin) {
        gBrowser.pinTab(tabToPin);
        gBrowser.moveTabTo(tabToPin, { elementIndex, forceUngrouped: !!targetTab.group });
      }
    }

    #onTabUnpinned(event) {
      const targetTab = event.target;
      const tabId = this.#getTabId(targetTab);
      const tabToUnpin = this.#getTabWithId(tabId);
      if (tabToUnpin) {
        gBrowser.unpinTab(tabToUnpin);
      }
    }

    #onTabIconChanged(event) {
      this.#updateTabIconAndLabel(event);
    }

    #onTabLabelChanged(event) {
      this.#updateTabIconAndLabel(event);
    }

    #updateTabIconAndLabel(event) {
      const targetTab = event.target;
      if (targetTab.hasAttribute("pending")) {
        const tabId = this.#getTabId(targetTab);
        const tabToChange = this.#getTabWithId(tabId);
        if (tabToChange) {
          gBrowser.setIcon(tabToChange, gBrowser.getIcon(targetTab));
          gBrowser._setTabLabel(tabToChange, targetTab.label);
        }
      }
    }

    #onTabAddedToEssentials(event) {
      const targetTab = event.target;
      const tabId = this.#getTabId(targetTab);
      const tabToAdd = this.#getTabWithId(tabId);
      if (tabToAdd) {
        gZenPinnedTabManager.addToEssentials(tabToAdd);
      }
    }

    #onTabRemovedFromEssentials(event) {
      const targetTab = event.target;
      const tabId = this.#getTabId(targetTab);
      const tabToRemove = this.#getTabWithId(tabId);
      if (tabToRemove) {
        gZenPinnedTabManager.removeFromEssentials(tabToRemove);
      }
    }

    #onTabHide(event) {
      const targetTab = event.target;
      const tabId = this.#getTabId(targetTab);
      const tabToHide = this.#getTabWithId(tabId);
      if (tabToHide) {
        gBrowser.hideTab(tabToHide);
      }
    }

    #onTabShow(event) {
      const targetTab = event.target;
      const tabId = this.#getTabId(targetTab);
      const tabToShow = this.#getTabWithId(tabId);
      if (tabToShow) {
        gBrowser.showTab(tabToShow);
      }
    }

    #onTabMove(event) {
      const targetTab = event.target;
      const tabId = this.#getTabId(targetTab);
      const elementIndex = targetTab.elementIndex;
      const tabToMove = this.#getTabWithId(tabId);
      if (tabToMove) {
        gBrowser.moveTabTo(tabToMove, { elementIndex, forceUngrouped: !!targetTab.group });
      }
    }

    async #onTabOpen(event) {
      await new Promise((resolve) => {
        const targetTab = event.target;
        const isPinned = targetTab.pinned;
        const isEssential = isPinned && targetTab.hasAttribute('zen-essential');
        const elementIndex = targetTab.elementIndex;

        const duplicatedTab = SessionStore.duplicateTab(window, targetTab, 0);
        if (isEssential) {
          gZenPinnedTabManager.addToEssentials(duplicatedTab);
        } else if (isPinned) {
          gBrowser.pinTab(duplicatedTab);
        }

        gBrowser.moveTabTo(duplicatedTab, { elementIndex, forceUngrouped: !!targetTab.group });
        resolve();
      });
    }
  }

  window.gZenWorkspaceWindowSync = new nsZenWorkspaceWindowSync();
}
