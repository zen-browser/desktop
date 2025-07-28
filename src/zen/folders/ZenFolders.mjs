// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class ZenFolders {
    constructor() {
      this.#initEventListeners();
    }

    #initEventListeners() {
      document.addEventListener('TabGrouped', this.#onTabGrouped.bind(this));
      document.addEventListener('TabUngrouped', this.#onTabUngrouped.bind(this));
      document.addEventListener('TabGroupRemoved', this.#onTabGroupRemoved.bind(this));
      document.addEventListener('TabGroupCreate', this.#onTabGroupCreate.bind(this));
      document.addEventListener('TabPinned', this.#onTabPinned.bind(this));
      document.addEventListener('TabUnpinned', this.#onTabUnpinned.bind(this));
    }

    #onTabGrouped(event) {
      const tab = event.detail;
      const group = tab.group;
      group.pinned = tab.pinned;

      if (group.hasAttribute('split-view-group') && group.hasAttribute('zen-pinned-changed')) {
        // zen-pinned-changed remove it and set it to had-zen-pinned-changed to keep
        // track of the original pinned state
        group.removeAttribute('zen-pinned-changed');
        group.setAttribute('had-zen-pinned-changed', true);
      }
    }

    #onTabUngrouped(event) {
      const tab = event.detail;
      const group = event.target;
      if (group.hasAttribute('split-view-group') && tab.hasAttribute('had-zen-pinned-changed')) {
        tab.setAttribute('zen-pinned-changed', true);
        tab.removeAttribute('had-zen-pinned-changed');
      }
    }

    #onTabGroupCreate(event) {
      const group = event.target;
      const tabs = group.tabs;
      if (!group.pinned) {
        return;
      }
      for (const tab of tabs) {
        if (tab.hasAttribute('zen-pinned-changed')) {
          tab.removeAttribute('zen-pinned-changed');
          tab.setAttribute('had-zen-pinned-changed', true);
        }
      }
    }

    #onTabGroupRemoved() {}

    #onTabPinned(event) {
      const tab = event.target;
      const group = tab.group;
      if (group && group.hasAttribute('split-view-group')) {
        group.pinned = true;
      }
    }

    #onTabUnpinned(event) {
      const tab = event.target;
      const group = tab.group;
      if (group && group.hasAttribute('split-view-group')) {
        group.pinned = false;
      }
    }

    expandGroupTabs(group) {
      for (const tab of group.tabs.reverse()) {
        gBrowser.ungroupTab(tab);
      }
    }

    handleTabPin(tab) {
      const group = tab.group;
      if (!group) {
        return false;
      }
      if (group.hasAttribute('split-view-group') && !this._piningFolder) {
        this._piningFolder = true;
        for (const otherTab of group.tabs) {
          gZenPinnedTabManager.resetPinChangedUrl(otherTab);
          if (tab === otherTab) {
            continue;
          }
          gBrowser.pinTab(otherTab);
        }
        this._piningFolder = false;
        gBrowser.pinnedTabsContainer.insertBefore(group, gBrowser.pinnedTabsContainer.lastChild);
        gBrowser.tabContainer._invalidateCachedTabs();
        return true;
      }
      return this._piningFolder;
    }

    handleTabUnpin(tab) {
      const group = tab.group;
      if (!group) {
        return false;
      }
      if (group.hasAttribute('split-view-group') && !this._piningFolder) {
        this._piningFolder = true;
        for (const otherTab of group.tabs) {
          if (tab === otherTab) {
            continue;
          }
          gBrowser.unpinTab(otherTab);
        }
        this._piningFolder = false;
        gZenWorkspaces.activeWorkspaceStrip.prepend(group);
        gBrowser.tabContainer._invalidateCachedTabs();
        return true;
      }
      return this._piningFolder;
    }
  }

  window.gZenFolders = new ZenFolders();
}
