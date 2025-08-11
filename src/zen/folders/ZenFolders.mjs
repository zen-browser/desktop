// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  function formatRelativeTime(timestamp) {
    const now = Date.now();

    const sec = Math.floor((now - timestamp) / 1000);
    if (sec < 60) {
      return 'Just now';
    }

    const min = Math.floor(sec / 60);
    if (min < 60) {
      return `${min} minute${min === 1 ? '' : 's'} ago`;
    }

    const hour = Math.floor(min / 60);
    if (hour < 24) {
      return `${hour} hour${hour === 1 ? '' : 's'} ago`;
    }

    const day = Math.floor(hour / 24);
    if (day < 30) {
      return `${day} day${day === 1 ? '' : 's'} ago`;
    }

    const month = Math.floor(day / 30);
    return `${month} month${month === 1 ? '' : 's'} ago`;
  }

  const ZEN_MAX_SUBFOLDERS = Services.prefs.getIntPref('zen.folders.max-subfolders');

  class nsZenFolders extends nsZenPreloadedFeature {
    #popup = null;
    #popupTimer = null;
    #mouseTimer = null;
    #lastHighlightedGroup = null;

    #lastFolderContextMenu = null;

    #foldersEnabled = false;
    #folderAnimCache = new Map();

    init() {
      this.#foldersEnabled = !gZenWorkspaces.privateWindowOrDisabled;

      if (!this.#foldersEnabled) {
        return;
      }

      this.#initContextMenu();
      this.#initTabsPopup();
      this.#initEventListeners();
    }

    #initContextMenu() {
      const contextMenuItems = window.MozXULElement.parseXULToFragment(
        `<menuitem id="zen-context-menu-new-folder" data-l10n-id="zen-toolbar-context-new-folder"/>`
      );
      document.getElementById('context_moveTabToGroup').before(contextMenuItems);

      const folderActionsMenu = document.getElementById('zenFolderActions');
      folderActionsMenu.addEventListener('popupshowing', (event) => {
        const folder =
          event.explicitOriginalTarget?.group || event.explicitOriginalTarget.parentElement?.group;
        // We only want to rename zen-folders as firefox groups don't work well with this
        if (!folder?.isZenFolder) {
          return;
        }
        this.#lastFolderContextMenu = folder;
        const changeFolderSpace = document
          .getElementById('context_zenChangeFolderSpace')
          .querySelector('menupopup');
        changeFolderSpace.innerHTML = '';
        for (const workspace of [...gZenWorkspaces._workspaceCache.workspaces].reverse()) {
          const item = document.createXULElement('menuitem');
          item.className = 'zen-workspace-context-menu-item';
          item.setAttribute('zen-workspace-id', workspace.uuid);
          item.setAttribute('disabled', workspace.uuid === gZenWorkspaces.activeWorkspace);
          let name = workspace.name;
          const iconIsSvg = workspace.icon && workspace.icon.endsWith('.svg');
          if (workspace.icon && workspace.icon !== '' && !iconIsSvg) {
            name = `${workspace.icon}  ${name}`;
          }
          item.setAttribute('label', name);
          if (iconIsSvg) {
            item.setAttribute('image', workspace.icon);
          }
          item.addEventListener('command', (event) => {
            if (!this.#lastFolderContextMenu) return;
            this.changeFolderToSpace(
              this.#lastFolderContextMenu,
              event.target.closest('menuitem').getAttribute('zen-workspace-id')
            );
          });
          changeFolderSpace.appendChild(item);
        }
      });

      folderActionsMenu.addEventListener(
        'popuphidden',
        (event) => {
          if (event.target === folderActionsMenu) {
            this.#lastFolderContextMenu = null;
          }
        },
        { once: true }
      );

      folderActionsMenu.addEventListener('command', (event) => {
        if (!this.#lastFolderContextMenu) return;
        switch (event.target.id) {
          case 'context_zenFolderRename':
            this.#lastFolderContextMenu.rename();
            break;
          case 'context_zenFolderExpand':
            this.#lastFolderContextMenu.expandGroupTabs();
            break;
          case 'context_zenFolderDelete':
            this.#lastFolderContextMenu.delete();
            break;
          case 'context_zenFolderToSpace':
            this.#convertFolderToSpace(this.#lastFolderContextMenu);
            break;
          case 'context_zenFolderChangeIcon':
            this.changeFolderUserIcon(this.#lastFolderContextMenu);
            break;
        }
      });
    }

    #initTabsPopup() {
      this.#popup = document.getElementById('zen-folder-tabs-popup');

      const search = this.#popup.querySelector('#zen-folder-tabs-list-search');
      const tabsList = this.#popup.querySelector('#zen-folder-tabs-list');

      search.addEventListener('input', () => {
        const query = search.value.toLowerCase();
        for (const item of tabsList.children) {
          item.hidden = !item.getAttribute('data-label').includes(query);
        }
      });

      this.#popup.addEventListener('mouseenter', () => {
        clearTimeout(this.#popupTimer);
      });

      this.#popup.addEventListener('mouseleave', () => {
        this.#popupTimer = setTimeout(() => {
          if (this.#popup.matches(':hover')) return;
          this.#popup.hidePopup();
        }, 200);
      });
    }

    #initEventListeners() {
      window.addEventListener('TabGrouped', this.#onTabGrouped.bind(this));
      window.addEventListener('TabUngrouped', this.#onTabUngrouped.bind(this));
      window.addEventListener('TabGroupRemoved', this.#onTabGroupRemoved.bind(this));
      window.addEventListener('TabGroupCreate', this.#onTabGroupCreate.bind(this));
      window.addEventListener('TabPinned', this.#onTabPinned.bind(this));
      window.addEventListener('TabUnpinned', this.#onTabUnpinned.bind(this));
      window.addEventListener('TabGroupExpand', this.#onTabGroupExpand.bind(this));
      window.addEventListener('TabGroupCollapse', this.#onTabGroupCollapse.bind(this));
      window.addEventListener('FolderGrouped', this.#onFolderGrouped.bind(this));
      window.addEventListener('TabSelect', this.#onTabSelected.bind(this));
      document
        .getElementById('zen-context-menu-new-folder')
        .addEventListener('command', this.#onNewFolder.bind(this));
      SessionStore.promiseInitialized.then(() => {
        gBrowser.tabContainer.addEventListener('dragstart', this.cancelPopupTimer.bind(this));
      });
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

      if (group.collapsed && !this._sessionRestoring) {
        group.collapsed = false;
      }
    }

    #onFolderGrouped(event) {
      if (this._sessionRestoring) return;
      const folder = event.detail;
      folder.group.collapsed = false;
    }

    #onTabSelected(event) {
      const tab = event.target;
      const prevTab = event.detail.previousTab;
      const group = tab?.group;
      const isActive = group?.activeGroups?.length > 0;
      if (isActive) tab.setAttribute('folder-active', true);
      if (prevTab.hasAttribute('folder-active')) prevTab.removeAttribute('folder-active');
      if (tab.group?.collapsed) {
        this.expandToSelected(group);
      }
      gBrowser.tabContainer._invalidateCachedTabs();
    }

    #onTabUngrouped(event) {
      const tab = event.detail;
      const group = event.target;
      tab.removeAttribute('folder-active');
      if (group.hasAttribute('split-view-group') && tab.hasAttribute('had-zen-pinned-changed')) {
        tab.setAttribute('zen-pinned-changed', true);
        tab.removeAttribute('had-zen-pinned-changed');
      }
      const activeGroup = group.activeGroups;
      if (activeGroup?.length > 0) {
        for (const folder of activeGroup) {
          folder.removeAttribute('has-active');
          this.collapseVisibleTab(folder);
          this.updateFolderIcon(folder, 'close', false);
        }
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

    cancelPopupTimer() {
      if (this.#mouseTimer) {
        clearTimeout(this.#mouseTimer);
        this.#mouseTimer = null;
      }
      this.#popup.hidePopup();
    }

    async #onTabGroupCollapse(event) {
      const group = event.target;
      if (!group.isZenFolder) return;

      this.cancelPopupTimer();

      const tabsContainer = group.querySelector('.tab-group-container');
      const animations = [];
      const groupStart = group.querySelector('.zen-tab-group-start');
      let selectedItem = null;
      let selectedGroupId = null;
      let itemsAfterSelected = [];

      const items = group.childGroupsAndTabs.map((item) => {
        const isSplitView = item.group?.hasAttribute?.('split-view-group');
        const splitGroupId = isSplitView ? item.group.id : null;
        if (gBrowser.isTabGroupLabel(item) && !isSplitView) item = item.parentNode;

        if (item.hasAttribute('visuallyselected')) {
          selectedItem = item;
          selectedGroupId = splitGroupId;
        }

        return { item, splitGroupId };
      });

      // Calculate the height we need to hide until we reach the selected item.
      let heightUntilSelected;
      if (selectedItem) {
        heightUntilSelected =
          window.windowUtils.getBoundsWithoutFlushing(selectedItem).top -
          window.windowUtils.getBoundsWithoutFlushing(groupStart).bottom;
      } else {
        heightUntilSelected = window.windowUtils.getBoundsWithoutFlushing(tabsContainer).height;
      }

      let afterSelected = false;
      for (let { item, splitGroupId } of items) {
        if (item === selectedItem) {
          afterSelected = true;
          continue;
        }
        if (selectedGroupId && splitGroupId === selectedGroupId) continue;
        if (afterSelected && splitGroupId) item = item.group;
        if (afterSelected) itemsAfterSelected.push(item);
      }

      if (selectedItem) {
        group.setAttribute('has-active', 'true');
        selectedItem.setAttribute('folder-active', 'true');
        this.setFolderIndentation([selectedItem], group, /* for collapse = */ true);
      }

      for (const item of itemsAfterSelected) {
        animations.push(
          gZenUIManager.motion.animate(
            item,
            {
              opacity: 0,
              height: 0,
            },
            { duration: 0.1, ease: 'easeInOut' }
          )
        );
      }

      animations.push(...this.updateFolderIcon(group));
      animations.push(
        gZenUIManager.motion.animate(
          groupStart,
          {
            marginTop: [0, -(heightUntilSelected + 4 * !selectedItem)],
          },
          { duration: 0.15, ease: 'easeInOut' }
        )
      );
      await Promise.all(animations);
      if (!selectedItem) tabsContainer.setAttribute('hidden', true);
    }

    async #onTabGroupExpand(event) {
      const group = event.target;
      if (!group.isZenFolder) return;

      this.cancelPopupTimer();

      const tabsContainer = group.querySelector('.tab-group-container');
      tabsContainer.removeAttribute('hidden');

      const groupStart = group.querySelector('.zen-tab-group-start');
      const animations = [];
      tabsContainer.style.overflow = 'hidden';
      if (group.hasAttribute('has-active')) {
        group.removeAttribute('has-active');
      }

      // Since the folder is now expanded, we should remove active attribute
      // to the tab that was previously visible
      for (const tab of group.tabs) {
        if (tab.group === group && tab.hasAttribute('folder-active')) {
          tab.removeAttribute('folder-active');
        }
      }

      const groupItems = [];
      group.childGroupsAndTabs.forEach((item) => {
        if (gBrowser.isTabGroupLabel(item)) {
          if (item?.group?.hasAttribute('split-view-group')) {
            item = item.group;
          } else {
            item = item.parentNode;
          }
        }
        // If all the groups above the item are visible, remove the indentation
        if (gBrowser.isTab(item)) {
          let isVisible = true;
          let parent = item.group;
          while (parent) {
            if (parent.collapsed && !parent.hasAttribute('has-active')) {
              isVisible = false;
              break;
            }
            parent = parent.group;
          }
          if (isVisible) {
            item.style.removeProperty('--zen-folder-indent');
          }
        }
        groupItems.push(item);
      });

      groupItems.map((item) => {
        animations.push(
          gZenUIManager.motion.animate(
            item,
            {
              opacity: 1,
              height: 'auto',
            },
            { duration: 0.1, ease: 'easeInOut' }
          )
        );
      });

      animations.push(...this.updateFolderIcon(group));
      animations.push(
        gZenUIManager.motion.animate(
          groupStart,
          {
            marginTop: 0,
          },
          {
            duration: 0.15,
            ease: 'linear',
          }
        )
      );
      await Promise.all(animations);
      tabsContainer.style.overflow = '';
      groupItems.map((item) => {
        // Cleanup just in case
        item.style.opacity = '';
        item.style.height = '';
      });
    }

    #onNewFolder(event) {
      const contextMenu = event.target.parentElement;
      let tabs = [];
      let triggerTab =
        contextMenu.triggerNode &&
        (contextMenu.triggerNode.tab || contextMenu.triggerNode.closest('tab'));

      tabs.push(triggerTab, ...gBrowser.selectedTabs);

      const group = this.createFolder(tabs, { insertBefore: triggerTab, renameFolder: true });
      if (!group) return;
      this.#groupInit(group);
    }

    async #convertFolderToSpace(folder) {
      const currentWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
      let selectedTab = folder.tabs.find((tab) => tab.selected);
      const icon = folder.icon?.querySelector('svg #folder-icon image');

      const newSpace = await gZenWorkspaces.createAndSaveWorkspace(
        folder.label,
        /* icon= */ icon?.getAttribute('href'),
        /* dontChange= */ false,
        currentWorkspace.containerTabId,
        {
          beforeChangeCallback: async (newWorkspace) => {
            await new Promise((resolve) => {
              requestAnimationFrame(async () => {
                const workspacePinnedContainer = gZenWorkspaces.workspaceElement(
                  newWorkspace.uuid
                ).pinnedTabsContainer;
                const tabs = folder.allItems.filter((tab) => !tab.hasAttribute('zen-empty-tab'));
                workspacePinnedContainer.append(...tabs);
                await folder.delete();
                gBrowser.tabContainer._invalidateCachedTabs();
                if (selectedTab) {
                  selectedTab.setAttribute('zen-workspace-id', newWorkspace.uuid);
                  selectedTab.removeAttribute('folder-active');
                  gZenWorkspaces._lastSelectedWorkspaceTabs[newWorkspace.uuid] = selectedTab;
                }
                resolve();
              });
            });
          },
        }
      );
      // Change the ID for all tabs
      for (const tab of gBrowser.tabs) {
        if (!tab.hasAttribute('zen-essential')) {
          tab.setAttribute('zen-workspace-id', newSpace.uuid);
          tab.style.opacity = '';
          tab.style.height = '';
        }
        gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
        if (gZenWorkspaces._lastSelectedWorkspaceTabs[currentWorkspace.uuid] === tab) {
          // This tab is no longer the last selected tab in the previous workspace because it's being moved to
          // the current workspace
          delete gZenWorkspaces._lastSelectedWorkspaceTabs[currentWorkspace.uuid];
        }
      }
    }

    changeFolderToSpace(folder, workspaceId) {
      const currentWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
      if (currentWorkspace.uuid === workspaceId) {
        return;
      }
      const workspaceElement = gZenWorkspaces.workspaceElement(workspaceId);
      const pinnedTabsContainer = workspaceElement.pinnedTabsContainer;
      pinnedTabsContainer.insertBefore(folder, pinnedTabsContainer.lastChild);
      folder.setAttribute('zen-workspace-id', workspaceId);
      for (const tab of folder.tabs) {
        tab.setAttribute('zen-workspace-id', workspaceId);
        gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
        if (gZenWorkspaces._lastSelectedWorkspaceTabs[workspaceId] === tab) {
          // This tab is no longer the last selected tab in the previous workspace because it's being moved to a new workspace
          delete gZenWorkspaces._lastSelectedWorkspaceTabs[workspaceId];
        }
      }
      folder.dispatchEvent(new CustomEvent('ZenFolderChangedWorkspace', { bubbles: true }));
      gZenWorkspaces.changeWorkspaceWithID(workspaceId);
    }

    canDropElement(element, targetElement) {
      if (element?.isZenFolder && targetElement?.group?.level >= ZEN_MAX_SUBFOLDERS) {
        return false;
      }
      return true;
    }

    createFolder(tabs = [], options = {}) {
      for (const tab of tabs) {
        if (tab.hasAttribute('zen-essential')) return;
        if (tab.group?.hasAttribute('split-view-group')) return;

        gBrowser.pinTab(tab);
      }
      const pinnedContainer = options.workspaceId
        ? gZenWorkspaces.workspaceElement(options.workspaceId).pinnedTabsContainer
        : gZenWorkspaces.pinnedTabsContainer;
      const insertBefore =
        options.insertBefore || pinnedContainer.querySelector('.pinned-tabs-container-separator');
      const emptyTab = gBrowser.addTab('about:blank', {
        skipAnimation: true,
        pinned: true,
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        _forZenEmptyTab: true,
      });

      tabs = [...tabs, emptyTab];

      const folder = this._createFolderNode(options);
      if (options.initialPinId) {
        folder.setAttribute('zen-pin-id', options.initialPinId);
      }

      if (options.insertAfter) {
        options.insertAfter.after(folder);
      } else {
        insertBefore.before(folder);
      }
      gZenVerticalTabsManager.animateItemOpen(folder);

      folder.addTabs(tabs);

      // Fixes bug1953801 and bug1954689
      // Ensure that the tab state cache is updated immediately after creating
      // a group. This is necessary because we consider group creation a
      // deliberate user action indicating the tab has importance for the user.
      // Without this, it is not possible to save and close a tab group with
      // a short lifetime.
      folder.tabs.forEach((tab) => {
        gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
      });

      this.updateFolderIcon(folder, 'auto', false);

      if (options.renameFolder) {
        folder.rename();
      }
      return folder;
    }

    _createFolderNode(options = {}) {
      const folder = document.createXULElement('zen-folder', { is: 'zen-folder' });
      let id = options.id;
      if (!id) {
        // Note: If this changes, make sure to also update the
        // getExtTabGroupIdForInternalTabGroupId implementation in
        // browser/components/extensions/parent/ext-browser.js.
        // See: Bug 1960104 - Improve tab group ID generation in addTabGroup
        id = `${Date.now()}-${Math.round(Math.random() * 100)}`;
      }
      folder.id = id;
      folder.label = options.label || 'New Folder';
      folder.saveOnWindowClose = !!options.saveOnWindowClose;
      folder.color = 'zen-workspace-color';

      folder.setAttribute(
        'zen-workspace-id',
        options.workspaceId || gZenWorkspaces.activeWorkspace
      );

      // note: We set if the folder is collapsed some time after creation.
      //   we do this to ensure marginBottom is set correctly in the case
      //   that we want it to initially be collapsed.
      requestAnimationFrame(() => {
        folder.collapsed = !!options.collapsed;
      });
      return folder;
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

    openTabsPopup(event) {
      event.stopPropagation();
      if (document.documentElement.getAttribute('zen-renaming-tab')) {
        return;
      }

      const activeGroup = event.target.parentElement;
      if (activeGroup.tabs.filter((tab) => !tab.hasAttribute('zen-empty-tab')).length === 0) {
        // If the group has no tabs, we don't show the popup
        return;
      }
      document.getElementById('zen-folder-tabs-search-no-results').hidden = true;
      this.#populateTabsList(activeGroup);

      const search = this.#popup.querySelector('#zen-folder-tabs-list-search');
      document.l10n.setArgs(search, {
        'folder-name': activeGroup.name,
      });
      const tabsList = this.#popup.querySelector('#zen-folder-tabs-list');

      const onSearchInput = () => {
        const query = search.value.toLowerCase();
        let foundTabs = 0;
        for (const item of tabsList.children) {
          const found = item.getAttribute('data-label').includes(query);
          item.hidden = !found;
          if (found) {
            foundTabs++;
          }
        }
        document.getElementById('zen-folder-tabs-search-no-results').hidden = foundTabs > 0;
      };
      search.addEventListener('input', onSearchInput);

      const onKeyDown = (event) => {
        // Arrow down and up to navigate through the list
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const items = Array.from(tabsList.children).filter((item) => !item.hidden);
          if (items.length === 0) return;
          let index = items.indexOf(tabsList.querySelector('.folders-tabs-list-item[selected]'));
          if (event.key === 'ArrowDown') {
            index = (index + 1) % items.length;
          } else if (event.key === 'ArrowUp') {
            index = (index - 1 + items.length) % items.length;
          }
          items.forEach((item) => item.removeAttribute('selected'));
          const targetItem = items[index];
          targetItem.setAttribute('selected', 'true');
          targetItem.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } else if (event.key === 'Enter') {
          // Enter to select the currently highlighted item
          const highlightedItem = tabsList.querySelector('.folders-tabs-list-item[selected]');
          if (highlightedItem) {
            highlightedItem.click();
          }
        }
      };
      document.addEventListener('keydown', onKeyDown);

      const target = event.target;
      target.setAttribute('open', true);

      const handlePopupHidden = (event) => {
        if (event.target !== this.#popup) return;
        search.value = '';
        target.removeAttribute('open');
        search.removeEventListener('input', onSearchInput);
        document.removeEventListener('keydown', onKeyDown);
      };

      this.#popup.addEventListener(
        'popupshown',
        () => {
          search.focus();
          search.select();
        },
        { once: true }
      );

      this.#popup.addEventListener('popuphidden', handlePopupHidden, { once: true });
      this.#popup.openPopup(target, this.#searchPopupOptions);
    }

    get #searchPopupOptions() {
      const isRightSide = gZenVerticalTabsManager._prefsRightSide;
      const position = isRightSide ? 'topleft topright' : 'topright topleft';
      return {
        position: position,
        x: 5,
        y: -25,
      };
    }

    #populateTabsList(group) {
      const tabsList = this.#popup.querySelector('#zen-folder-tabs-list');
      tabsList.replaceChildren();

      for (const tab of group.tabs) {
        if (tab.hidden || tab.hasAttribute('zen-empty-tab')) continue;

        const item = document.createElement('div');
        item.className = 'folders-tabs-list-item';

        const content = document.createElement('div');
        content.className = 'folders-tabs-list-item-content';

        const icon = document.createElement('img');
        icon.className = 'folders-tabs-list-item-icon';

        let tabURL = tab.linkedBrowser?.currentURI?.spec || '';
        try {
          // Get the hostname from the URL
          const url = new URL(tabURL);
          tabURL = url.hostname || tabURL;
        } catch {
          // We don't need to do anything if the URL is invalid. e.g. about:blank
        }
        let tabLabel = tab.label || '';
        let iconURL =
          gBrowser.getIcon(tab) ||
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3C/svg%3E";

        icon.src = iconURL;

        const labelsContainer = document.createElement('div');
        labelsContainer.className = 'folders-tabs-list-item-labels';

        const mainLabel = document.createElement('div');
        mainLabel.className = 'folders-tabs-list-item-label';
        mainLabel.textContent = tabLabel;

        const secondaryLabel = document.createElement('div');
        secondaryLabel.className = 'tab-list-item-secondary-label';
        secondaryLabel.textContent = formatRelativeTime(tab.lastAccessed);

        labelsContainer.append(mainLabel, secondaryLabel);
        content.append(icon, labelsContainer);
        item.append(content);

        if (tab.selected) {
          item.setAttribute('selected', 'true');
        }

        item.setAttribute('data-label', `${tabLabel.toLowerCase()} ${tabURL.toLowerCase()}`);

        item.addEventListener('click', () => {
          group.setAttribute('has-active', 'true');
          gBrowser.selectedTab = tab;
          this.#popup.hidePopup();
        });

        item.addEventListener('mouseenter', () => {
          for (const sibling of tabsList.children) {
            sibling.removeAttribute('selected');
          }
          item.setAttribute('selected', 'true');
        });

        tabsList.appendChild(item);
      }
    }

    updateFolderIcon(group, state = 'auto', play = true) {
      const svg = group.querySelector('svg');
      if (!svg) return [];
      let animations = this.#folderAnimCache.get(group);
      if (!animations) {
        animations = svg.querySelectorAll('animate, animateTransform, animateMotion');
        this.#folderAnimCache.set(group, animations);
      }

      const isCollapsed = group.collapsed;
      svg.setAttribute('state', state === 'auto' ? (isCollapsed ? 'close' : 'open') : state);
      const hasActive = group.hasAttribute('has-active');

      const OPACITY = {
        'folder-dots': { active: '0;1', baseOrig: '0;0' },
        'folder-icon': { active: '1;0', baseOrig: '1;1' },
      };

      animations.forEach((animation) => {
        const parentId = animation.parentElement.id;
        const isOpacity = animation.getAttribute('attributeName') === 'opacity';

        if (!animation.dataset.origValues) {
          animation.dataset.origValues = animation.getAttribute('values');
        }

        const origValues = animation.dataset.origValues;
        const [fromValue, toValue] = origValues.split(';');

        const isActiveState = isCollapsed && hasActive && isOpacity;

        if (!play && !isActiveState) {
          if (isOpacity && OPACITY[parentId]) {
            const staticValue = OPACITY[parentId].baseOrig;
            animation.dataset.origValues = staticValue;
            animation.setAttribute('values', staticValue);
            animation.beginElement();
          }
          return;
        }

        if (isOpacity && OPACITY[parentId]) {
          animation.dataset.origValues = OPACITY[parentId].baseOrig;
        }

        let newValues;

        if (isActiveState && OPACITY[parentId]) {
          newValues = OPACITY[parentId].active;
          const [activeFrom, activeTo] = newValues.split(';');
          animation.dataset.origValues = `${activeTo};${activeFrom}`;
        } else {
          const stateValues = {
            open: `${fromValue};${toValue}`,
            close: `${toValue};${fromValue}`,
            auto: isCollapsed ? `${toValue};${fromValue}` : `${fromValue};${toValue}`,
          };
          newValues = stateValues[state] || stateValues.auto;
        }

        if (animation.getAttribute('values') !== newValues) {
          animation.setAttribute('values', newValues);
          animation.beginElement();
        }
      });

      return [];
    }

    setFolderIndentation(tabs, group = undefined, forCollapse = true) {
      if (!gZenPinnedTabManager.expandedSidebarMode) {
        return;
      }
      const tab = tabs[0];
      let isTab = false;
      if (!group && tab?.group) {
        group = tab; // So we can set isTab later
      }
      if (gBrowser.isTab(group) && !group.hasAttribute('zen-empty-tab')) {
        group = group.group;
        isTab = true;
      }
      if (!isTab && !group?.hasAttribute('selected') && !forCollapse) {
        group = null; // Don't indent if the group is not selected
      }
      const level = group?.level + 1 || 0;
      const baseSpacing = 14; // Base spacing for each level
      let tabToAnimate = tab;
      if (gBrowser.isTabGroupLabel(tab)) {
        tabToAnimate = tab.group;
      }
      const tabLevel = tabToAnimate?.group?.level || 0;
      const spacing = (level - tabLevel) * baseSpacing;
      for (const tab of tabs) {
        if (gBrowser.isTabGroupLabel(tab)) {
          tab.group.style.setProperty('--zen-folder-indent', `${spacing}px`);
          continue;
        }
        tab.style.setProperty('--zen-folder-indent', `${spacing}px`);
      }
    }

    changeFolderUserIcon(group) {
      if (!group) return;

      gZenEmojiPicker
        .open(group.labelElement, { onlySvgIcons: true })
        .then((icon) => {
          this.setFolderUserIcon(group, icon);
          group.dispatchEvent(new CustomEvent('ZenFolderIconChanged', { bubbles: true }));
        })
        .catch((err) => {
          console.error(err);
          return;
        });
    }

    setFolderUserIcon(group, icon) {
      const svgIcon = group.icon.querySelector('svg #folder-icon image');
      if (!svgIcon) return;
      svgIcon.setAttribute('href', icon ?? '');
      if (svgIcon.getAttribute('href') !== icon) {
        svgIcon.style.opacity = '0';
      } else {
        svgIcon.style.opacity = '1';
      }
    }

    collapseVisibleTab(group, onlyIfActive = false) {
      if (!group?.isZenFolder) return;
      if (onlyIfActive && !group.hasAttribute('has-active')) return;

      const groupStart = group.querySelector('.zen-tab-group-start');
      groupStart.setAttribute('old-margin', groupStart.style.marginTop);
      let itemHeight = 0;
      for (const item of group.allItems) {
        itemHeight += item.getBoundingClientRect().height;
        if (item.hasAttribute('folder-active')) {
          item.removeAttribute('folder-active');
          if (!onlyIfActive) {
            item.setAttribute('was-folder-active', 'true');
          }
        }
      }
      const newMargin = -(itemHeight + 4);
      groupStart.setAttribute('new-margin', newMargin);

      if (onlyIfActive) {
        group.removeAttribute('has-active');
        this.updateFolderIcon(group, 'close', false);
      }

      gZenUIManager.motion.animate(
        groupStart,
        {
          marginTop: newMargin,
        },
        { duration: 0.15, ease: 'easeInOut' }
      );
    }

    expandVisibleTab(group) {
      if (!group?.isZenFolder) return;

      const groupStart = group.querySelector('.zen-tab-group-start');
      let oldMargin = groupStart.getAttribute('old-margin');
      let newMargin = groupStart.getAttribute('new-margin');

      for (const item of group.allItems) {
        if (item.hasAttribute('was-folder-active')) {
          item.setAttribute('folder-active', 'true');
          item.removeAttribute('was-folder-active');
        }
      }

      gZenUIManager.motion.animate(
        groupStart,
        {
          marginTop: [newMargin, oldMargin],
        },
        { duration: 0.15, ease: 'easeInOut' }
      );
      groupStart.removeAttribute('old-margin');
      groupStart.removeAttribute('new-margin');
    }

    expandToSelected(group) {
      const tabsContainer = group.querySelector('.tab-group-container');
      const animations = [];
      const groupStart = group.querySelector('.zen-tab-group-start');
      let selectedItem = null;
      let selectedGroupId = null;

      const groupItems = [];
      group.childGroupsAndTabs.forEach((item) => {
        if (gBrowser.isTabGroupLabel(item)) {
          if (item?.group?.hasAttribute('split-view-group')) {
            item = item.group;
          } else {
            item = item.parentNode;
          }
        }
        groupItems.push(item);
      });

      groupItems.map((item) => {
        animations.push(
          gZenUIManager.motion.animate(
            item,
            {
              opacity: 1,
              height: 'auto',
            },
            { duration: 0.1, ease: 'easeInOut' }
          )
        );
      });

      const items = group.childGroupsAndTabs.map((item) => {
        const isSplitView = item.group?.hasAttribute?.('split-view-group');
        const splitGroupId = isSplitView ? item.group.id : null;
        if (gBrowser.isTabGroupLabel(item) && !isSplitView) item = item.parentNode;
        if (item.selected) {
          selectedItem = item;
          selectedGroupId = splitGroupId;
        }
        return { item, splitGroupId };
      });

      if (tabsContainer.hasAttribute('hidden')) {
        tabsContainer.removeAttribute('hidden');
      }

      const curMarginTop = parseInt(groupStart.style.marginTop) || 0;

      animations.push(
        gZenUIManager.motion.animate(
          groupStart,
          {
            marginTop: [curMarginTop, 0],
          },
          { duration: 0.15, ease: 'easeInOut' }
        )
      );

      for (let { item, splitGroupId } of items) {
        if (item === selectedItem || (selectedGroupId && splitGroupId === selectedGroupId)) {
          continue;
        }

        if (item && splitGroupId) item = item.group;

        animations.push(
          gZenUIManager.motion.animate(
            item,
            {
              opacity: 0,
              height: 0,
            },
            { duration: 0.1, ease: 'easeInOut' }
          )
        );
      }

      selectedItem.setAttribute('folder-active', 'true');

      animations.push(...this.updateFolderIcon(group, 'close', false));

      return Promise.all(animations);
    }

    #groupInit(group, stateData) {
      // Setup zen-folder icon to the correct position
      this.updateFolderIcon(group, 'auto', false);
      if (stateData?.userIcon) {
        this.setFolderUserIcon(group, stateData.userIcon);
      }

      if (group.collapsed) {
        this.#onTabGroupCollapse({ target: group });
      }

      const labelContainer = group.querySelector('.tab-group-label-container');
      // Setup mouseenter/mouseleave events for the folder
      labelContainer.addEventListener('mouseenter', (event) => {
        if (!group.collapsed || !Services.prefs.getBoolPref('zen.folders.search.enabled')) {
          return;
        }
        this.#mouseTimer = setTimeout(() => {
          this.openTabsPopup(event);
        }, Services.prefs.getIntPref('zen.folders.search.hover-delay'));
      });
      labelContainer.addEventListener('mouseleave', () => {
        clearTimeout(this.#mouseTimer);
        if (!group.collapsed) return;
        this.#mouseTimer = setTimeout(() => {
          // If popup is focused don't hide it
          if (this.#popup.matches(':hover')) return;
          this.#popup.hidePopup();
        }, 200);
      });
    }

    storeDataForSessionStore() {
      const folders = Array.from(gBrowser.tabContainer.querySelectorAll('zen-folder'));
      const splitGroups = Array.from(
        gBrowser.tabContainer.querySelectorAll('tab-group[split-view-group]')
      );
      const allData = [...folders, ...splitGroups];

      // Sort elements in the order in which they appear in the DOM
      allData.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      const storedData = [];

      for (const folder of allData) {
        const parentFolder = folder.parentElement.closest('zen-folder');
        // Skip split-view-group if it's not a zen-folder child
        if (!parentFolder && folder.hasAttribute('split-view-group')) continue;
        const emptyFolderTabs = folder.tabs
          .filter((tab) => tab.hasAttribute('zen-empty-tab'))
          .map((tab) => tab.getAttribute('zen-pin-id'));

        let prevSiblingInfo = null;
        const prevSibling = folder.previousElementSibling;
        const userIcon = folder?.icon?.querySelector('svg #folder-icon image');

        if (prevSibling) {
          if (gBrowser.isTabGroup(prevSibling)) {
            prevSiblingInfo = { type: 'group', id: prevSibling.id };
          } else if (gBrowser.isTab(prevSibling)) {
            const zenPinId = prevSibling.getAttribute('zen-pin-id');
            prevSiblingInfo = { type: 'tab', id: zenPinId };
          } else {
            prevSiblingInfo = { type: 'start', id: null };
          }
        }

        storedData.push({
          pinned: folder.pinned,
          essential: folder.essential,
          splitViewGroup: folder.hasAttribute('split-view-group'),
          id: folder.id,
          name: folder.label,
          collapsed: folder.collapsed,
          saveOnWindowClose: folder.saveOnWindowClose,
          parentId: parentFolder ? parentFolder.id : null,
          prevSiblingInfo: prevSiblingInfo,
          emptyTabIds: emptyFolderTabs,
          userIcon: userIcon?.getAttribute('href'),
          pinId: folder.getAttribute('zen-pin-id'),
          // note: We shouldn't be using the workspace-id anywhere, we are just
          //  remembering it for the pinned tabs manager to use it later.
          workspaceId: folder.getAttribute('zen-workspace-id'),
        });
      }
      return storedData;
    }

    restoreDataFromSessionStore(data) {
      if (!data || this._sessionRestoring) {
        return;
      }

      this._sessionRestoring = true;

      const tabFolderWorkingData = new Map();

      for (const folderData of data) {
        const workingData = {
          stateData: folderData,
          node: null,
          containingTabsFragment: document.createDocumentFragment(),
        };
        tabFolderWorkingData.set(folderData.id, workingData);

        const oldGroup = document.getElementById(folderData.id);
        folderData.emptyTabIds.forEach((zenPinId) => {
          oldGroup
            ?.querySelector(`tab[zen-pin-id="${zenPinId}"]`)
            ?.setAttribute('zen-empty-tab', true);
        });
        if (oldGroup) {
          if (!folderData.splitViewGroup) {
            const folder = this._createFolderNode({
              id: folderData.id,
              label: folderData.name,
              collapsed: folderData.collapsed,
              pinned: folderData.pinned,
              saveOnWindowClose: folderData.saveOnWindowClose,
              workspaceId: folderData.workspaceId,
            });
            folder.setAttribute('zen-pin-id', folderData.pinId);
            workingData.node = folder;
            oldGroup.before(folder);
          } else {
            workingData.node = oldGroup;
          }
          while (oldGroup.tabs.length > 0) {
            workingData.containingTabsFragment.appendChild(oldGroup.tabs[0]);
          }
          if (!folderData.splitViewGroup) {
            oldGroup.remove();
          }
        }
      }

      for (const { node, containingTabsFragment } of tabFolderWorkingData.values()) {
        if (node) {
          node.appendChild(containingTabsFragment);
        }
      }

      // Nesting folders into each other according to parentId.
      for (const { stateData, node } of tabFolderWorkingData.values()) {
        if (node && stateData.parentId) {
          const parentWorkingData = tabFolderWorkingData.get(stateData.parentId);
          if (parentWorkingData && parentWorkingData.node) {
            switch (stateData?.prevSiblingInfo?.type) {
              case 'group': {
                const folder = document.querySelector(`[id="${stateData.prevSiblingInfo.id}"]`);
                gBrowser.moveTabAfter(node, folder);
                break;
              }
              case 'tab': {
                const tab = parentWorkingData.node.querySelector(
                  `[zen-pin-id="${stateData.prevSiblingInfo.id}"]`
                );
                gBrowser.moveTabAfter(node, tab);
                break;
              }
              default: {
                const start = parentWorkingData.node.querySelector('.zen-tab-group-start');
                start.after(node);
              }
            }
          }
        }
      }

      // Initialize UI state for all folders.
      for (const { stateData, node } of tabFolderWorkingData.values()) {
        if (node && !stateData.splitViewGroup) {
          this.#groupInit(node, stateData);
        }
      }

      gBrowser.tabContainer._invalidateCachedTabs();
      this._sessionRestoring = false;
    }

    /**
     * Highlights the given tab group and removes highlight from any previously highlighted group.
     * @param {MozTabbrowserTabGroup|undefined|null} folder The folder to highlight, or null to clear highlight.
     * @param {Array<MozTabbrowserTab>|null} movingTabs The tabs being moved.
     */
    highlightGroupOnDragOver(folder, movingTabs) {
      if (folder === this.#lastHighlightedGroup) return;
      const tab = movingTabs ? movingTabs[0] : null;
      if (this.#lastHighlightedGroup && this.#lastHighlightedGroup !== folder) {
        this.#lastHighlightedGroup.removeAttribute('selected');
        if (this.#lastHighlightedGroup.collapsed) {
          this.updateFolderIcon(this.#lastHighlightedGroup, 'close');
        }
        this.#lastHighlightedGroup = null;
      }

      if (
        folder &&
        (!folder.hasAttribute('split-view-group') || !folder.hasAttribute('selected')) &&
        folder !== tab?.group &&
        !(
          folder.level >= ZEN_MAX_SUBFOLDERS && movingTabs?.some((t) => gBrowser.isTabGroupLabel(t))
        )
      ) {
        folder.setAttribute('selected', 'true');
        folder.style.transform = '';
        if (folder.collapsed) {
          this.updateFolderIcon(folder, 'open');
        }
        this.#lastHighlightedGroup = folder;
      }
    }

    /**
     * Ungroup a tab from all the active groups it belongs to.
     * @param {MozTabbrowserTab} tab The tab to ungroup.
     */
    ungroupTabFromActiveGroups(tab) {
      gBrowser.ungroupTabsUntilNoActive(tab);
    }

    /**
     * Handles the dragover logic when dragging a tab or tab group label over another tab group label.
     * This function determines where the dragged item should be visually dropped (before/after the group, or inside it)
     * and updates related styling and highlighting.
     *
     * @param {MozTabbrowserTabGroupLabel} currentDropElement The tab group label currently being dragged over.
     * @param {MozTabbrowserTab|MozTabbrowserTabGroupLabel} draggedTab The tab or tab group label being dragged.
     * @param {number} overlapPercent The percentage of overlap between the dragged item and the drop target.
     * @param {Array<MozTabbrowserTab>} movingTabs An array of tabs that are currently being dragged together.
     * @param {boolean} currentDropBefore Indicates if the current drop position is before the middle of the drop element.
     * @param {string|undefined} currentColorCode The current color code for dragover highlighting.
     * @returns {{dropElement: MozTabbrowserTabGroup|MozTabbrowserTab|MozTabbrowserTabGroupLabel, colorCode: string|undefined, dropBefore: boolean}}
     *   An object containing the updated drop element, color code for highlighting, and drop position.
     */
    handleDragOverTabGroupLabel(
      currentDropElement,
      draggedTab,
      overlapPercent,
      movingTabs,
      currentDropBefore,
      currentColorCode
    ) {
      let dropElement = currentDropElement;
      let dropBefore = currentDropBefore;
      let colorCode = currentColorCode;
      let dragUpThreshold =
        Services.prefs.getIntPref('zen.view.drag-and-drop.drop-inside-upper-threshold') / 100;
      let dragDownThreshold =
        Services.prefs.getIntPref('zen.view.drag-and-drop.drop-inside-lower-threshold') / 100;

      let dropElementGroup = dropElement.group;
      const isSplitGroup = dropElement?.group?.hasAttribute('split-view-group');
      let firstGroupElem =
        dropElementGroup.querySelector('.zen-tab-group-start').nextElementSibling;

      const isRestrictedGroup = isSplitGroup || dropElementGroup.collapsed;

      const shouldDropInside =
        !dropBefore &&
        overlapPercent >= dragDownThreshold &&
        overlapPercent <= dragUpThreshold &&
        !isSplitGroup;
      const shouldDropNear = overlapPercent < dragUpThreshold || overlapPercent > dragDownThreshold;

      if (shouldDropInside) {
        dropElement = firstGroupElem;
        dropBefore = true;
        this.highlightGroupOnDragOver(dropElementGroup, movingTabs);
      } else if (shouldDropNear) {
        if (dropBefore) {
          dropElement = dropElementGroup;
          colorCode = undefined;
        } else {
          if (isRestrictedGroup) {
            dropElement = dropElementGroup;
          } else {
            dropElement = firstGroupElem;
            dropBefore = true;
          }
        }
        this.highlightGroupOnDragOver(null);
      }

      return { dropElement, colorCode, dropBefore };
    }
  }

  window.gZenFolders = new nsZenFolders();
}
