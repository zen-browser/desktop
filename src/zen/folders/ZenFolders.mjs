// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

function formatRelativeTime(timestamp) {
  const now = Date.now();

  const sec = Math.floor((now - timestamp) / 1000);
  if (sec < 60) {
    return "Just now";
  }

  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min} minute${min === 1 ? "" : "s"} ago`;
  }

  const hour = Math.floor(min / 60);
  if (hour < 24) {
    return `${hour} hour${hour === 1 ? "" : "s"} ago`;
  }

  const day = Math.floor(hour / 24);
  if (day < 30) {
    return `${day} day${day === 1 ? "" : "s"} ago`;
  }

  const month = Math.floor(day / 30);
  return `${month} month${month === 1 ? "" : "s"} ago`;
}

function groupIsCollapsiblePins(group) {
  return group?.tagName.toLowerCase() === "zen-workspace-collapsible-pins";
}

class nsZenFolders extends nsZenDOMOperatedFeature {
  #ZEN_MAX_SUBFOLDERS = Services.prefs.getIntPref(
    "zen.folders.max-subfolders",
    5
  );

  #popup = null;
  #popupTimer = null;
  #mouseTimer = null;
  #lastHighlightedGroup = null;

  _ANIMATION_DURATION = {
    COLLAPSE_TRANSFORM: 180,
    COLLAPSE_HEIGHT: 200,
    COLLAPSE_ACTIVE_HEIGHT: 200,
    COLLAPSE_APPEND: 150,
    EXPAND_TRANSFORM: 220,
    EXPAND_HEIGHT: 220,
    OPACITY: 200,
  };

  #lastFolderContextMenu = null;

  #foldersEnabled = false;
  _sessionRestore = true;

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
    const contextMenuItems = window.MozXULElement.parseXULToFragment(`
      <menu data-l10n-id="zen-toolbar-context-move-to-folder" id="context_zenMoveToFolder">
        <menupopup>
          <menuseparator />
          <menuitem id="zen-context-menu-new-folder" data-l10n-id="zen-toolbar-context-new-folder"/>
        </menupopup>
      </menu>
    `);
    document.getElementById("context_moveTabToGroup").before(contextMenuItems);
    const contextMenuItemsToolbar = window.MozXULElement.parseXULToFragment(
      `<menuitem id="zen-context-menu-new-folder-toolbar" data-l10n-id="zen-toolbar-context-new-folder"/>
       <menu data-l10n-id="zen-panel-ui-live-folder-create" id="zen-panel-ui-live-folder-create">
         <menupopup>
           <menuitem
             data-l10n-id="zen-live-folder-github-pull-requests"
             command="cmd_zenNewLiveFolder"
             image="chrome://browser/skin/zen-icons/selectable/logo-github.svg" />
           <menuitem
             data-l10n-id="zen-live-folder-github-issues"
             command="cmd_zenNewLiveFolder"
             image="chrome://browser/skin/zen-icons/selectable/logo-github.svg" />
           <menuitem
             data-l10n-id="zen-live-folder-type-rss"
             command="cmd_zenNewLiveFolder"
             image="chrome://browser/skin/zen-icons/selectable/logo-rss.svg"/>
         </menupopup>
       </menu>`
    );
    document
      .getElementById("toolbar-context-openANewTab")
      .after(contextMenuItemsToolbar);

    const folderActionsMenu = document.getElementById("zenFolderActions");
    folderActionsMenu.addEventListener("popupshowing", event => {
      const target = event.explicitOriginalTarget;
      let folder;
      if (gBrowser.isTabGroupLabel(target)) {
        folder = target.group;
      } else if (gBrowser.isTabGroupLabel(target.parentElement)) {
        folder = target.parentElement.group;
      } else if (
        target.parentElement?.isZenFolder &&
        target?.classList.contains("tab-group-label-container")
      ) {
        folder = target.parentElement;
      }

      // We only want to rename zen-folders as firefox groups don't work well with this
      if (!folder?.isZenFolder) {
        return;
      }
      this.#lastFolderContextMenu = folder;
      gZenLiveFoldersUI.buildContextMenu(folder);

      const newSubfolderItem = document.getElementById(
        "context_zenFolderNewSubfolder"
      );
      newSubfolderItem.toggleAttribute(
        "disabled",
        folder.level >= this.#ZEN_MAX_SUBFOLDERS - 1
      );

      const changeFolderSpace = document
        .getElementById("context_zenChangeFolderSpace")
        .querySelector("menupopup");
      changeFolderSpace.innerHTML = "";
      for (const workspace of [...gZenWorkspaces.getWorkspaces()].reverse()) {
        const item = gZenWorkspaces.generateMenuItemForWorkspace(workspace);
        item.addEventListener("command", event => {
          if (!this.#lastFolderContextMenu) {
            return;
          }
          this.changeFolderToSpace(
            this.#lastFolderContextMenu,
            event.target.closest("menuitem").getAttribute("zen-workspace-id")
          );
        });
        changeFolderSpace.appendChild(item);
      }
    });

    folderActionsMenu.addEventListener(
      "popuphidden",
      event => {
        if (event.target === folderActionsMenu) {
          this.#lastFolderContextMenu = null;
        }
      },
      { once: true }
    );

    folderActionsMenu.addEventListener("command", event => {
      if (!this.#lastFolderContextMenu) {
        return;
      }
      switch (event.target.id) {
        case "context_zenFolderRename":
          this.#lastFolderContextMenu.rename();
          break;
        case "context_zenFolderUnpack":
          this.#lastFolderContextMenu.unpackTabs();
          break;
        case "context_zenFolderUnloadAll":
          this.#lastFolderContextMenu.unloadAllTabs(event);
          break;
        case "context_zenFolderNewSubfolder":
          this.#lastFolderContextMenu.createSubfolder();
          break;
        case "context_zenFolderDelete":
          this.#lastFolderContextMenu.delete();
          break;
        case "context_zenFolderToSpace":
          this.#convertFolderToSpace(this.#lastFolderContextMenu);
          break;
        case "context_zenFolderChangeIcon":
          this.changeFolderUserIcon(this.#lastFolderContextMenu);
          break;
      }
    });
  }

  #initTabsPopup() {
    this.#popup = document.getElementById("zen-folder-tabs-popup");

    const search = this.#popup.querySelector("#zen-folder-tabs-list-search");
    const tabsList = this.#popup.querySelector("#zen-folder-tabs-list");

    search.addEventListener("input", () => {
      const query = search.value.toLowerCase();
      for (const item of tabsList.children) {
        item.hidden = !item.getAttribute("data-label").includes(query);
      }
    });

    this.#popup.addEventListener("mouseover", () => {
      clearTimeout(this.#popupTimer);
    });

    this.#popup.addEventListener("mouseout", () => {
      this.#popupTimer = setTimeout(() => {
        if (this.#popup.matches(":hover")) {
          return;
        }
        this.#popup.hidePopup(true);
      }, 200);
    });
  }

  #initEventListeners() {
    window.addEventListener("TabGrouped", this);
    window.addEventListener("TabUngrouped", this);
    window.addEventListener("TabGroupCreate", this);
    window.addEventListener("TabPinned", this);
    window.addEventListener("TabUnpinned", this);
    window.addEventListener("TabGroupExpand", this);
    window.addEventListener("TabGroupCollapse", this);
    window.addEventListener("FolderGrouped", this);
    window.addEventListener("FolderUngrouped", this);
    window.addEventListener("TabSelect", this);
    window.addEventListener("TabOpen", this);
    const onNewFolder = this.#onNewFolder.bind(this);
    document
      .getElementById("zen-context-menu-new-folder")
      .addEventListener("command", onNewFolder);
    document
      .getElementById("zen-context-menu-new-folder-toolbar")
      .addEventListener("command", onNewFolder);
    this.#initMoveTabToFolder();
    SessionStore.promiseInitialized.then(() => {
      gBrowser.tabContainer.addEventListener(
        "dragstart",
        this.cancelPopupTimer.bind(this)
      );
    });
  }

  #initMoveTabToFolder() {
    const moveTabToFolderMenu = document.getElementById(
      "context_zenMoveToFolder"
    );
    moveTabToFolderMenu.addEventListener("popupshowing", () => {
      const separator = moveTabToFolderMenu.querySelector("menuseparator");
      let tabs = TabContextMenu.contextTab?.multiselected
        ? gBrowser.selectedTabs
        : [TabContextMenu.contextTab];
      let groups = gBrowser.tabGroups.filter(group => {
        const isZenFolder = group?.isZenFolder;
        const isLiveFolder = group?.isLiveFolder;
        const spaceId = group?.getAttribute("zen-workspace-id");
        if (
          !isZenFolder ||
          isLiveFolder ||
          spaceId !== gZenWorkspaces.activeWorkspace
        ) {
          return false;
        }
        return !tabs.some(tab => tab.group === group);
      });
      separator.hidden = groups.length === 0;
      for (const group of groups) {
        const icon = group.iconURL;
        const menuItem = document.createXULElement("menuitem");
        menuItem.setAttribute("label", group.label);
        menuItem.classList.add("context-zen-move-to-folder-item");
        if (icon) {
          menuItem.setAttribute("image", icon);
        }
        menuItem._group = group;
        separator.before(menuItem);
      }
    });

    moveTabToFolderMenu.addEventListener("popuphidden", () => {
      const items = moveTabToFolderMenu.querySelectorAll(
        ".context-zen-move-to-folder-item"
      );
      for (const item of items) {
        delete item._group;
        item.remove();
      }
    });

    moveTabToFolderMenu.addEventListener("command", event => {
      if (!event.target.classList.contains("context-zen-move-to-folder-item")) {
        return;
      }
      const group = event.target._group;
      if (!group) {
        return;
      }
      let tabs = TabContextMenu.contextTab?.multiselected
        ? gBrowser.selectedTabs
        : [TabContextMenu.contextTab];
      group.addTabs(tabs);
    });
  }

  handleEvent(aEvent) {
    let methodName = `on_${aEvent.type}`;
    if (methodName in this) {
      this[methodName](aEvent);
    } else {
      throw new Error(`Unexpected event ${aEvent.type}`);
    }
  }

  on_TabGrouped(event) {
    const tab = event.detail;
    const group = tab.group;
    if (group.isZenFolder && !group.collapsed && !this._sessionRestore) {
      group.updateTabOrder();
    }
    if (groupIsCollapsiblePins(group)) {
      return;
    }
    group.pinned = tab.pinned;
    const isActiveFolder = group?.activeGroups?.length > 0;

    if (isActiveFolder) {
      for (const folder of group.activeGroups) {
        folder.activeTabs = [tab];
      }
    }

    if (
      group.hasAttribute("split-view-group") &&
      group.hasAttribute("zen-pinned-changed")
    ) {
      // zen-pinned-changed remove it and set it to had-zen-pinned-changed to keep
      // track of the original pinned state
      group.removeAttribute("zen-pinned-changed");
      group.setAttribute("had-zen-pinned-changed", true);
    }

    if (group.collapsed && !group.isLiveFolder) {
      group.collapsed = group.hasActiveTab;
    }
  }

  on_FolderGrouped(event) {
    const folder = event.detail;
    const parentFolder = event.target;
    if (groupIsCollapsiblePins(parentFolder)) {
      return;
    }
    const isActiveFolder = parentFolder?.activeGroups?.length > 0;
    const isSplitView = folder.hasAttribute("split-view-group");
    if (isActiveFolder && isSplitView) {
      parentFolder.activeTabs = folder.tabs;
    }
    parentFolder.collapsed = isActiveFolder;
    if (!this._sessionRestore && !parentFolder.collapsed) {
      parentFolder.updateTabOrder();
    }
  }

  on_FolderUngrouped(event) {
    const parentFolder = event.target;
    const folder = event.detail;
    for (const tab of folder.tabs) {
      this.animateUnload(parentFolder, tab, true);
      delete tab._originalGroup;
    }
    if (!parentFolder.collapsed) {
      parentFolder.updateTabOrder();
    }
  }

  async on_TabSelect(event) {
    const tab = gZenGlanceManager.getTabOrGlanceParent(event.target);
    let group = tab?.group;
    if (group?.hasAttribute("split-view-group")) {
      group = group?.group;
    }
    if (!group?.isZenFolder) {
      return;
    }

    const collapsedRoot = group.rootMostCollapsedFolder;
    if (!collapsedRoot) {
      return;
    }

    await this.animateSelect(collapsedRoot);
    gBrowser.tabContainer._invalidateCachedTabs();
  }

  on_TabOpen(event) {
    const tab = event.target;
    const group = tab.group;
    if (!group?.isZenFolder || tab.pinned) {
      return;
    }
    // Edge case: In occations where we add a tab with an ownerTab
    // inside a folder, the tab gets added into the folder in an
    // unpinned state. We need to pin it and re-add it into the folder.
    if (Services.prefs.getBoolPref("zen.folders.owned-tabs-in-folder")) {
      gBrowser.pinTab(tab);
      group.addTabs([tab]);
    }
  }

  async on_TabUngrouped(event) {
    const tab = event.detail;
    const group = event.target;
    if (!group.isZenFolder) {
      return;
    }
    delete tab._originalGroup;
    if (
      tab.pinned &&
      group.hasAttribute("split-view-group") &&
      tab.hasAttribute("had-zen-pinned-changed")
    ) {
      tab.setAttribute("zen-pinned-changed", true);
      tab.removeAttribute("had-zen-pinned-changed");
    }

    await this.animateUnload(group, tab, true);
    if (!group.collapsed) {
      group.updateTabOrder();
    }
  }

  on_TabGroupCreate(event) {
    const group = event.target;
    const tabs = group.tabs;
    if (!group.pinned) {
      return;
    }
    for (const tab of tabs) {
      if (tab.hasAttribute("zen-pinned-changed")) {
        tab.removeAttribute("zen-pinned-changed");
        tab.setAttribute("had-zen-pinned-changed", true);
      }
    }
  }

  on_TabPinned(event) {
    const tab = event.target;
    const group = tab.group;
    if (group && group.hasAttribute("split-view-group")) {
      group.pinned = true;
    }
  }

  on_TabUnpinned(event) {
    const tab = event.target;
    const group = tab.group;
    if (group && group.hasAttribute("split-view-group")) {
      group.pinned = false;
    }
  }

  cancelPopupTimer() {
    if (this.#mouseTimer) {
      clearTimeout(this.#mouseTimer);
      this.#mouseTimer = null;
    }
    if (this.#popup) {
      this.#popup.hidePopup(true);
    }
  }

  async on_TabGroupCollapse(event) {
    const group = event.target;
    if (!group.isZenFolder) {
      return;
    }

    await this.animateCollapse(group);
  }

  async on_TabGroupExpand(event) {
    const group = event.target;
    if (!group.isZenFolder) {
      return;
    }

    await this.animateExpand(group);
  }

  #onNewFolder(event) {
    const isFromToolbar =
      event.target.id === "zen-context-menu-new-folder-toolbar";
    const contextMenu = event.target.parentElement;
    let tabs = TabContextMenu.contextTab?.multiselected
      ? gBrowser.selectedTabs
      : [TabContextMenu.contextTab];
    let triggerTab =
      contextMenu.triggerNode &&
      (contextMenu.triggerNode.tab || contextMenu.triggerNode.closest("tab"));

    const selectedTabs = gBrowser.selectedTabs;
    if (selectedTabs.length > 1) {
      tabs.push(triggerTab, ...gBrowser.selectedTabs);
    } else {
      tabs.push(triggerTab);
    }
    if (isFromToolbar) {
      tabs = [];
    }

    // Prevent create folder inside Live Folder
    const thereIsOneLiveFolderTab = tabs?.some(tab =>
      tab.hasAttribute("zen-live-folder-item-id")
    );
    if (thereIsOneLiveFolderTab) {
      return;
    }

    const canInsertBefore =
      !isFromToolbar &&
      !triggerTab.hasAttribute("zen-essential") &&
      !triggerTab?.group?.hasAttribute("split-view-group") &&
      this.canDropElement({ isZenFolder: true }, triggerTab);

    this.createFolder(tabs, {
      insertAfter: !canInsertBefore ? triggerTab?.group : null,
      insertBefore: canInsertBefore ? triggerTab : null,
      renameFolder: true,
    });
  }

  async #convertFolderToSpace(folder) {
    const currentWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
    let selectedTab = folder.tabs.find(tab => tab.selected);
    const icon = folder.icon?.querySelector("svg .icon image");

    const newSpace = await gZenWorkspaces.createAndSaveWorkspace(
      folder.label,
      /* icon= */ icon?.getAttribute("href"),
      /* dontChange= */ false,
      currentWorkspace.containerTabId,
      {
        beforeChangeCallback: async newWorkspace => {
          await new Promise(resolve => {
            requestAnimationFrame(async () => {
              const workspacePinnedContainer = gZenWorkspaces.workspaceElement(
                newWorkspace.uuid
              ).pinnedTabsContainer;
              const tabs = folder.allItems.filter(
                tab => !tab.hasAttribute("zen-empty-tab")
              );
              workspacePinnedContainer.append(...tabs);
              await folder.delete();
              gBrowser.tabContainer._invalidateCachedTabs();
              if (selectedTab) {
                selectedTab.setAttribute("zen-workspace-id", newWorkspace.uuid);
                gZenWorkspaces.lastSelectedWorkspaceTabs[newWorkspace.uuid] =
                  selectedTab;
              }
              resolve();
            });
          });
        },
      }
    );
    // Change the ID for all tabs
    for (const tab of gBrowser.tabs) {
      if (!tab.hasAttribute("zen-essential")) {
        tab.setAttribute("zen-workspace-id", newSpace.uuid);
        tab.style.opacity = "";
        tab.style.height = "";
      }
      gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
      if (
        gZenWorkspaces.lastSelectedWorkspaceTabs[currentWorkspace.uuid] === tab
      ) {
        // This tab is no longer the last selected tab in the previous workspace because it's being moved to
        // the current workspace
        delete gZenWorkspaces.lastSelectedWorkspaceTabs[currentWorkspace.uuid];
      }
    }
  }

  changeFolderToSpace(folder, workspaceId, { hasDndSwitch = false } = {}) {
    if (folder.getAttribute("zen-workspace-id") == workspaceId) {
      return;
    }

    const workspaceElement = gZenWorkspaces.workspaceElement(workspaceId);

    if (!hasDndSwitch) {
      const pinnedTabsContainer = workspaceElement.pinnedTabsContainer;
      pinnedTabsContainer.insertBefore(folder, pinnedTabsContainer.lastChild);
    }

    const { lastSelectedWorkspaceTabs } = gZenWorkspaces;

    for (const tab of folder.tabs) {
      // This sets the ID for the current folder and any sub-folder
      // we may encounter
      tab.setAttribute("zen-workspace-id", workspaceId);
      tab.group.setAttribute("zen-workspace-id", workspaceId);
      gBrowser.TabStateFlusher.flush(tab.linkedBrowser);

      if (lastSelectedWorkspaceTabs[workspaceId] === tab) {
        // This tab is no longer the last selected tab in the previous workspace because it's being moved to a new workspace
        delete lastSelectedWorkspaceTabs[workspaceId];
      }
    }

    folder.dispatchEvent(
      new CustomEvent("ZenFolderChangedWorkspace", { bubbles: true })
    );

    if (!hasDndSwitch) {
      gZenWorkspaces.changeWorkspaceWithID(workspaceId).then(() => {
        gBrowser.moveTabTo(folder, { elementIndex: 0, forceUngrouped: true });
      });
    }
  }

  canDropElement(element, targetElement) {
    const isZenFolder = element?.isZenFolder;
    const level = targetElement?.group?.level + 1;
    return !(isZenFolder && level >= this.#ZEN_MAX_SUBFOLDERS);
  }

  createFolder(tabs = [], options = {}) {
    const filteredTabs = tabs
      .filter(tab => !tab.hasAttribute("zen-essential"))
      .map(tab => {
        gBrowser.pinTab(tab);
        if (tab?.group?.hasAttribute("split-view-group")) {
          tab = tab.group;
        }
        return tab;
      });

    const workspacePinned = gZenWorkspaces.workspaceElement(
      options.workspaceId
    )?.pinnedTabsContainer;
    const pinnedContainer =
      options.workspaceId && workspacePinned
        ? workspacePinned
        : gZenWorkspaces.pinnedTabsContainer;
    const insertBefore = options.insertBefore || pinnedContainer.lastChild;
    const emptyTab = gBrowser.addTab("about:blank", {
      skipAnimation: true,
      pinned: true,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      _forZenEmptyTab: true,
    });

    gBrowser.pinTab(emptyTab);
    tabs = [emptyTab, ...filteredTabs];

    const folder = this._createFolderNode(options);

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
    folder.tabs.forEach(tab => {
      gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
    });

    this.updateFolderIcon(folder, "auto");

    if (options.renameFolder) {
      folder.rename();
    }

    this.#folderInit(folder);
    return folder;
  }

  _createFolderNode(options = {}) {
    const folder = document.createXULElement("zen-folder", {
      is: "zen-folder",
    });
    let id = options.id;
    if (!id) {
      // Note: If this changes, make sure to also update the
      // getExtTabGroupIdForInternalTabGroupId implementation in
      // browser/components/extensions/parent/ext-browser.js.
      // See: Bug 1960104 - Improve tab group ID generation in addTabGroup
      id = `${Date.now()}-${Math.round(Math.random() * 100)}`;
    }
    folder.id = id;
    folder.label = options.name || options.label || "New Folder";
    requestAnimationFrame(() => {
      folder.collapsed = options.collapsed;
    });
    folder.saveOnWindowClose = !!options.saveOnWindowClose;
    folder.color = "zen-workspace-color";

    folder.setAttribute(
      "zen-workspace-id",
      options.workspaceId || gZenWorkspaces.activeWorkspace
    );

    return folder;
  }

  handleTabPin(tab) {
    const group = tab.group;
    if (!group) {
      return false;
    }
    if (group.hasAttribute("split-view-group") && !this._piningFolder) {
      this._piningFolder = true;
      for (const otherTab of group.tabs) {
        gZenPinnedTabManager.resetPinChangedUrl(otherTab);
        if (tab === otherTab) {
          continue;
        }
        gBrowser.pinTab(otherTab);
      }
      this._piningFolder = false;
      gBrowser.pinnedTabsContainer.insertBefore(
        group,
        gBrowser.pinnedTabsContainer.lastChild
      );
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
    if (group.hasAttribute("split-view-group") && !this._piningFolder) {
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
    if (
      document.documentElement.getAttribute("zen-renaming-tab") ||
      gURLBar.focused
    ) {
      return;
    }

    const activeGroup = event.target.parentElement;
    if (
      activeGroup.tabs.filter(tab =>
        this.#shouldAppearOnTabSearch(tab, activeGroup)
      ).length === 0
    ) {
      // If the group has no tabs, we don't show the popup
      return;
    }
    document.getElementById("zen-folder-tabs-search-no-results").hidden = true;
    this.#populateTabsList(activeGroup);

    const search = this.#popup.querySelector("#zen-folder-tabs-list-search");
    document.l10n.setArgs(search, {
      "folder-name": activeGroup.name,
    });
    const tabsList = this.#popup.querySelector("#zen-folder-tabs-list");

    const onSearchInput = () => {
      const query = search.value.toLowerCase();
      let foundTabs = 0;
      for (const item of tabsList.children) {
        const found = item.getAttribute("data-label").includes(query);
        item.hidden = !found;
        if (found) {
          foundTabs++;
        }
      }
      document.getElementById("zen-folder-tabs-search-no-results").hidden =
        foundTabs > 0;
    };
    search.addEventListener("input", onSearchInput);

    const onKeyDown = event => {
      // Arrow down and up to navigate through the list
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Tab"
      ) {
        event.preventDefault();
        let isUp =
          event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
        const items = Array.from(tabsList.children).filter(
          item => !item.hidden
        );
        if (items.length === 0) {
          return;
        }
        let index = items.indexOf(
          tabsList.querySelector(".folders-tabs-list-item[selected]")
        );
        if (!isUp) {
          index = (index + 1) % items.length;
        } else {
          index = (index - 1 + items.length) % items.length;
        }
        items.forEach(item => item.removeAttribute("selected"));
        const targetItem = items[index];
        targetItem.setAttribute("selected", "true");
        targetItem.scrollIntoView({ block: "start", behavior: "smooth" });
      } else if (event.key === "Enter") {
        // Enter to select the currently highlighted item
        const highlightedItem = tabsList.querySelector(
          ".folders-tabs-list-item[selected]"
        );
        if (highlightedItem) {
          highlightedItem.click();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const target = event.target;
    target.setAttribute("open", true);

    const handlePopupHidden = event => {
      if (event.target !== this.#popup) {
        return;
      }
      search.value = "";
      target.removeAttribute("open");
      search.removeEventListener("input", onSearchInput);
      document.removeEventListener("keydown", onKeyDown);
    };

    this.#popup.addEventListener(
      "popupshown",
      () => {
        search.focus();
        search.select();
      },
      { once: true }
    );

    this.#popup.addEventListener("popuphidden", handlePopupHidden, {
      once: true,
    });
    this.#popup.openPopup(target, this.#searchPopupOptions);
  }

  get #searchPopupOptions() {
    const isRightSide = gZenVerticalTabsManager._prefsRightSide;
    const position = isRightSide ? "topleft topright" : "topright topleft";
    let size = Math.min(
      this.#popup.querySelector("#zen-folder-tabs-list").children.length,
      6
    );
    size *= 48;
    return {
      position,
      x: isRightSide ? -10 : 10,
      y: size / -2,
    };
  }

  #shouldAppearOnTabSearch(tab, group) {
    // Note that tab.visible and tab.hidden act in different ways.
    // We don't want to show already visible tabs in the search results.
    // That's why we need to do the active tab search, tab.hidden doesn't
    // account for the visibility of the tab itself, it's just a literal
    // representation of the `hidden` attribute.
    const tabIsInActiveGroup = group.activeTabs.includes(tab);
    return (
      !tabIsInActiveGroup && !(tab.hidden || tab.hasAttribute("zen-empty-tab"))
    );
  }

  #populateTabsList(group) {
    const tabsList = this.#popup.querySelector("#zen-folder-tabs-list");
    tabsList.replaceChildren();

    for (const tab of group.tabs) {
      if (!this.#shouldAppearOnTabSearch(tab, group)) {
        continue;
      }

      const item = document.createElement("div");
      item.className = "folders-tabs-list-item";

      const content = document.createElement("div");
      content.className = "folders-tabs-list-item-content";

      const icon = document.createElement("img");
      icon.className = "folders-tabs-list-item-icon";

      let tabURL = tab.linkedBrowser?.currentURI?.spec || "";
      try {
        // Get the hostname from the URL
        const url = new URL(tabURL);
        tabURL = url.hostname || tabURL;
      } catch {
        // We don't need to do anything if the URL is invalid. e.g. about:blank
      }
      let tabLabel = tab.label || "";
      let iconURL =
        gBrowser.getIcon(tab) || PlacesUtils.favicons.defaultFavicon.spec;

      icon.src = iconURL;

      const labelsContainer = document.createElement("div");
      labelsContainer.className = "folders-tabs-list-item-labels";

      const mainLabel = document.createElement("div");
      mainLabel.className = "folders-tabs-list-item-label";
      mainLabel.textContent = tabLabel;

      const secondaryLabel = document.createElement("div");
      secondaryLabel.className = "tab-list-item-secondary-label";
      secondaryLabel.textContent = `${formatRelativeTime(tab.lastAccessed)} • ${tab.group.label}`;

      labelsContainer.append(mainLabel, secondaryLabel);
      content.append(icon, labelsContainer);
      item.append(content);

      if (tab.selected) {
        item.setAttribute("selected", "true");
      }

      item.setAttribute(
        "data-label",
        `${tabLabel.toLowerCase()} ${tabURL.toLowerCase()}`
      );

      item.addEventListener("click", () => {
        gBrowser.selectedTab = tab;
      });

      item.addEventListener("mouseenter", () => {
        for (const sibling of tabsList.children) {
          sibling.removeAttribute("selected");
        }
        item.setAttribute("selected", "true");
      });

      tabsList.appendChild(item);
    }
  }

  updateFolderIcon(group, state = "auto") {
    const svg = group.querySelector("svg");
    if (!svg) {
      return [];
    }

    const isCollapsed = group.collapsed;
    let stateValue = state;
    if (state === "auto") {
      stateValue = isCollapsed ? "close" : "open";
    }
    svg.setAttribute("state", stateValue);
    const hasActive = group.hasActiveTab;
    const activeValue = hasActive && isCollapsed ? "true" : "false";
    svg.setAttribute("active", activeValue);

    return [];
  }

  changeFolderUserIcon(group) {
    if (!group) {
      return;
    }

    gZenEmojiPicker.open(group.icon, {
      onlySvgIcons: true,
      allowNone: Boolean(group.iconURL),
      closeOnSelect: false,
      onSelect: icon => {
        this.setFolderUserIcon(group, icon);
        group.dispatchEvent(
          new CustomEvent("TabGroupUpdate", { bubbles: true })
        );
      },
    });
  }

  setFolderUserIcon(group, icon) {
    const svgIcon = group.icon.querySelector("svg .icon image");
    if (!svgIcon) {
      return;
    }
    svgIcon.setAttribute("href", icon ?? "");
    if (svgIcon.getAttribute("href") !== icon) {
      svgIcon.style.opacity = "0";
    } else {
      svgIcon.style.opacity = "1";
    }
  }

  #folderInit(group, stateData) {
    // Setup zen-folder icon to the correct position
    this.updateFolderIcon(group, "auto");
    // Init elements order inside the folder
    group.updateTabOrder();
    if (stateData?.userIcon) {
      this.setFolderUserIcon(group, stateData.userIcon);
    }

    if (stateData?.isLiveFolder) {
      group.isLiveFolder = stateData.isLiveFolder;
    }

    // For Old Restore compatibility
    if (stateData?.collapsed) {
      group.collapsed = stateData.collapsed;
    }

    const labelContainer = group.querySelector(".tab-group-label-container");
    // Setup mouseenter/mouseleave events for the folder
    labelContainer.addEventListener("mouseenter", event => {
      if (
        !group.collapsed ||
        !Services.prefs.getBoolPref("zen.folders.search.enabled") ||
        gBrowser.tabContainer.hasAttribute("movingtab") ||
        event.target.classList.contains("tab-reset-button")
      ) {
        return;
      }
      this.#mouseTimer = setTimeout(() => {
        this.openTabsPopup(event);
      }, Services.prefs.getIntPref("zen.folders.search.hover-delay"));
    });
    labelContainer.addEventListener("mouseleave", () => {
      clearTimeout(this.#mouseTimer);
      if (!group.collapsed) {
        return;
      }
      this.#mouseTimer = setTimeout(() => {
        // If popup is focused don't hide it
        if (this.#popup.matches(":hover") || labelContainer.matches(":hover")) {
          return;
        }
        this.#popup.hidePopup(true);
      }, 200);
    });
  }

  storeDataForSessionStore() {
    const folders = Array.from(
      gBrowser.tabContainer.querySelectorAll("zen-folder")
    );

    const storedData = [];

    for (const folder of folders) {
      const userIcon = folder?.icon?.querySelector("svg .icon image");

      const folderData = {
        id: folder.id,
        userIcon: userIcon?.getAttribute("href"),
        isLiveFolder: folder.isLiveFolder,
      };

      if (folder._activeTabs?.length) {
        folderData.activeTabData = folder._activeTabs.map(tab => ({
          id: tab.id,
          originalGroupId: tab.splitView
            ? tab.group?._originalGroup?.id || folder.id
            : tab._originalGroup?.id || folder.id,
          isSplitView:
            tab.splitView || tab.group.hasAttribute("split-view-group"),
        }));
        if (folder._tabOrder?.length) {
          folderData.tabOrder = folder._tabOrder;
        }
      }

      storedData.push(folderData);
    }
    return storedData;
  }

  restoreDataFromSessionStore(data) {
    if (!data) {
      return;
    }

    const tabFolderWorkingData = new Map();

    for (const folderData of data) {
      // For Old Restore compatibility
      if (folderData.pinned) {
        this.#oldFoldersRestoreFromSS(data);
        return;
      }
      const workingData = {
        stateData: folderData,
        node: document.getElementById(folderData.id),
      };
      tabFolderWorkingData.set(folderData.id, workingData);
    }

    const folders = [];
    for (const { stateData, node } of tabFolderWorkingData.values()) {
      if (node && stateData) {
        // Initialize UI state for all folders.
        this.#folderInit(node, stateData);
        if (stateData.tabOrder?.length) {
          node._tabOrder = stateData.tabOrder;
          // Restore original tab order
          this.#reorderChildrenByTabOrder(node);
        }
        if (stateData.activeTabData?.length) {
          this.#restoreFolderActiveTabs(node, stateData.activeTabData);
          folders.push(node);
        }
      }
    }

    // Append active tabs to folder's active tabs container
    requestAnimationFrame(() => {
      for (const folder of folders.reverse()) {
        const alreadyPlaced = new Set();
        for (const tab of folder.activeTabs) {
          const element = tab.splitView ? tab.group : tab;
          if (alreadyPlaced.has(element)) {
            continue;
          }
          alreadyPlaced.add(element);
          const targetContainer = folder.groupActiveTabsContainer;
          const origGroup = element._originalGroup;
          this.#insertInPosition(targetContainer, element, origGroup, true);
        }
      }
    });
    delete this._sessionRestore;
    gBrowser.tabContainer._invalidateCachedTabs();
  }

  #restoreFolderActiveTabs(folder, activeTabData) {
    const activeTabs = [];
    const splitGroupIds = new Set();

    for (const { id, originalGroupId, isSplitView } of activeTabData) {
      const tab = document.getElementById(id);
      if (!tab) {
        continue;
      }
      const originalGroup = document.getElementById(originalGroupId);
      if (isSplitView) {
        const splitGroup = tab?.group;
        if (splitGroupIds.has(splitGroup?.id)) {
          activeTabs.push(tab);
          continue;
        }
        splitGroupIds.add(tab.id);
        if (originalGroup && splitGroup) {
          splitGroup._originalGroup = originalGroup;
        }
      } else if (originalGroup) {
        tab._originalGroup = originalGroup;
      }

      activeTabs.push(tab);
    }

    if (!activeTabs.length) {
      return;
    }

    folder.activeTabs = activeTabs;
  }

  #reorderChildrenByTabOrder(folder) {
    const tabOrder = folder._tabOrder;

    const arrEqual = (a, b) => {
      if (a === b) return true;
      const len = a.length;
      if (len !== b.length) return false;
      for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    const elemsInContainer = Array.from(folder.groupContainer.children).filter(
      item => !item.hasAttribute("zen-empty-tab") && !item.classList.contains("zen-tab-group-start")
    );

    const currentIds = elemsInContainer.map(item => item.id);

    if (arrEqual(currentIds, tabOrder)) {
      return;
    }

    const orderMap = new Map(tabOrder.map((id, index) => [id, index]));

    elemsInContainer.sort((a, b) => {
      const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
      const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
      return indexA - indexB;
    });

    for (const elem of elemsInContainer) {
      folder.groupContainer.appendChild(elem);
    }
  }

  #oldFoldersRestoreFromSS(data) {
    const tabFolderWorkingData = new Map();

    for (const folderData of data) {
      try {
        const workingData = {
          stateData: folderData,
          node: null,
          containingTabsFragment: document.createDocumentFragment(),
        };
        tabFolderWorkingData.set(folderData.id, workingData);

        const oldGroup = document.getElementById(folderData.id);
        folderData.emptyTabIds.forEach(id => {
          oldGroup
            ?.querySelector(`tab[id="${id}"]`)
            ?.setAttribute("zen-empty-tab", true);
        });
        if (gBrowser.isTabGroup(oldGroup)) {
          if (!folderData.splitViewGroup) {
            const folder = this._createFolderNode({
              id: folderData.id,
              label: folderData.name,
              collapsed: folderData.collapsed,
              pinned: folderData.pinned,
              saveOnWindowClose: folderData.saveOnWindowClose,
              workspaceId: folderData.workspaceId,
              isLiveFolder: folderData.isLiveFolder,
            });
            folder.setAttribute("id", folderData.id);
            workingData.node = folder;
            oldGroup.before(folder);
          } else {
            workingData.node = oldGroup;
          }
          while (oldGroup.tabs.length) {
            const tab = oldGroup.tabs[0];
            if (folderData.workspaceId) {
              tab.setAttribute("zen-workspace-id", folderData.workspaceId);
            }
            workingData.containingTabsFragment.appendChild(tab);
          }
          if (!folderData.splitViewGroup) {
            oldGroup.remove();
          }
        }
      } catch (e) {
        console.error("Error restoring Zen Folders session data:", e);
      }
    }

    for (const {
      node,
      containingTabsFragment,
    } of tabFolderWorkingData.values()) {
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
            case "tab":
            case "group": {
              const item = document.getElementById(
                stateData.prevSiblingInfo.id
              );
              if (item) {
                item.after(node);
                break;
              }
              // If we didn't find the group, we should debug it and continue to default case.
              console.error(
                `Zen Folders: Could not find previous sibling with id ${stateData.prevSiblingInfo.id} while restoring session.`
              );
              // @eslint-disable-next-line no-fallthrough
            }
            default: {
              // Should insert after zen-empty-tab
              const start =
                parentWorkingData.node.groupStartElement.nextElementSibling;
              start.after(node);
            }
          }
        }
      }
    }

    // Initialize UI state for all folders.
    for (const { stateData, node } of tabFolderWorkingData.values()) {
      if (node && !stateData.splitViewGroup) {
        requestAnimationFrame(() => {
          this.#folderInit(node, stateData);
        });
      }
    }

    gBrowser.tabContainer._invalidateCachedTabs();
  }

  createGroup(groupId, tabGroupWorkingData, tabsFragment) {
    const tabGroup = tabGroupWorkingData?.get(groupId);
    if (!tabGroup || tabGroup.node) {
      return;
    }

    if (tabGroup.stateData.isZenFolder) {
      tabGroup.node = this._createFolderNode(tabGroup.stateData);
    } else if (tabGroup.stateData.splitView) {
      tabGroup.node = gBrowser._createTabGroup(
        tabGroup.stateData.id,
        tabGroup.stateData.color,
        tabGroup.stateData.collapsed,
        tabGroup.stateData.name,
        tabGroup.stateData.pinned,
        tabGroup.stateData.essential,
        tabGroup.stateData.splitView
      );
    }

    const parentGroupId = tabGroup.stateData.parentGroupId;
    if (parentGroupId && tabGroupWorkingData.has(parentGroupId)) {
      const parentGroup = tabGroupWorkingData.get(parentGroupId);
      parentGroup.containingTabsFragment.appendChild(tabGroup.node);
    } else {
      tabsFragment.appendChild(tabGroup.node);
    }
  }

  /**
   * Highlights the given tab group and removes highlight from any previously highlighted group.
   *
   * @param {MozTabbrowserTabGroup|undefined|null} folder The folder to highlight, or null to clear highlight.
   * @param {Array<MozTabbrowserTab>|null} movingTabs The tabs being moved.
   */
  highlightGroupOnDragOver(folder, movingTabs = null) {
    if (folder === this.#lastHighlightedGroup) {
      return true;
    }
    if (this.#lastHighlightedGroup && this.#lastHighlightedGroup !== folder) {
      if (this.#lastHighlightedGroup.collapsed) {
        this.updateFolderIcon(this.#lastHighlightedGroup, "close");
      }
      this.#lastHighlightedGroup = null;
    }
    if (
      folder?.isZenFolder &&
      (!folder.hasAttribute("split-view-group") ||
        !folder.hasAttribute("selected")) &&
      !(
        folder.level >= this.#ZEN_MAX_SUBFOLDERS &&
        movingTabs?.some(t => gBrowser.isTabGroupLabel(t))
      )
    ) {
      if (folder.collapsed) {
        this.updateFolderIcon(folder, "open");
      }
      this.#lastHighlightedGroup = folder;
      return true;
    }
    return false;
  }

  /**
   * Ungroup a tab from all the active groups it belongs to.
   *
   * @param {MozTabbrowserTab[]} tabs The tab to ungroup.
   */
  ungroupTabsFromActiveGroups(tabs) {
    for (const tab of tabs) {
      gBrowser.ungroupTabsUntilNoActive(tab);
    }
  }

  getBoundsWithoutFlushing(element) {
    return window.windowUtils.getBoundsWithoutFlushing(element);
  }

  #calculateHeightShift(container) {
    return -1 * this.getBoundsWithoutFlushing(container).height;
  }

  #getSelectedTabs(group) {
    return group.tabs.flatMap(tab => {
      if (tab.splitView && (tab.multiselected || tab.selected)) {
        return tab.group.tabs;
      } else if (tab.multiselected || tab.selected) {
        return [tab];
      }
      return [];
    });
  }

  async createAnimation(element, keyframes, options = {}, callback = null) {
    const elements = Array.isArray(element) ? element : [element];

    await Promise.all(
      elements.map(
        el =>
          new Promise(resolve => {
            const animation = el.animate(keyframes, {
              ...options,
            });
            animation.onfinish = () => {
              // Set the final value of the animation to the element style
              try {
                animation.commitStyles();
              } catch {
                // Ignore Uncaught DOMException: Animation.commitStyles: Target is not rendered
              }
              animation.cancel();
              resolve();
            };
          })
      )
    );

    if (callback) {
      callback();
    }
  }

  #insertInPosition(container, element, folder, isAdding = false) {
    const tabOrder = folder?._tabOrder;
    if (!tabOrder || !tabOrder.length) {
      container.appendChild(element);
      return;
    }

    const elementIndex = tabOrder.indexOf(element.id);
    if (elementIndex === -1) {
      container.appendChild(element);
      return;
    }

    let insertBefore = null;
    for (const child of container.children) {
      if (child === element) {
        continue;
      }
      if (isAdding && child._originalGroup !== folder) {
        continue;
      }
      const childIndex = tabOrder.indexOf(child.id);
      if (childIndex > elementIndex) {
        insertBefore = child;
        break;
      }
    }

    if (insertBefore) {
      container.insertBefore(element, insertBefore);
    } else {
      container.appendChild(element);
    }
  }

  #animateActiveTabsAdd(elem, folder) {
    const tabsActiveContainer = folder.groupActiveTabsContainer;
    const firstRect = elem.getBoundingClientRect();
    this.#insertInPosition(
      tabsActiveContainer,
      elem,
      elem._originalGroup,
      true
    );
    const lastRect = elem.getBoundingClientRect();
    const invertY = firstRect.top - lastRect.top;
    return this.createAnimation(
      elem,
      { transform: [`translateY(${invertY}px)`, "translateY(0px)"] },
      {
        duration: this._ANIMATION_DURATION.COLLAPSE_APPEND,
        easing: "ease-in-out",
      },
      () => {
        elem.style.removeProperty("transform");
      }
    );
  }

  #moveToActiveTabsContainer(group, activeTabs, isAdding) {
    if (group.isBeingDragged) {
      return;
    }
    const splitGroupIds = new Set();
    const animations = [];

    for (const tab of activeTabs) {
      let element;
      if (tab.splitView) {
        const splitGroup = tab.group;
        if (splitGroupIds.has(splitGroup.id)) {
          continue;
        }
        splitGroupIds.add(splitGroup.id);
        element = splitGroup;
      } else {
        element = tab;
      }

      if (isAdding) {
        // === COLLAPSE ===
        if (!element._originalGroup) {
          if (tab.splitView) {
            group.groupActiveTabsContainer.style.removeProperty("height");
          }
          element._originalGroup = element.group;
        }

        animations.push(this.#animateActiveTabsAdd(element, group));
      } else {
        // === EXPAND ===
        const originalGroup = element._originalGroup || element.group;

        if (originalGroup === group) {
          const tabsContainer = originalGroup.groupContainer;
          this.#insertInPosition(tabsContainer, element, originalGroup);
          delete element._originalGroup;
        } else {
          const activeFolder = group.childActiveGroups?.find(folder =>
            folder.activeTabs.includes(tab)
          );

          if (activeFolder) {
            animations.push(this.#animateActiveTabsAdd(element, activeFolder));
          } else {
            if (!originalGroup) {
              return;
            }
            const tabsContainer = originalGroup.groupContainer;
            this.#insertInPosition(tabsContainer, element, originalGroup);
            delete element._originalGroup;
          }
        }
      }
    }
    return animations;
  }

  #queueAnimation(group, animationTask) {
    // If the queue is not yet created, create an empty successful resolved Promise
    if (!group._animationQueue) {
      group._animationQueue = Promise.resolve();
    }

    // Connect the new task to the completion of the previous
    group._animationQueue = group._animationQueue
      .then(() => animationTask())
      .catch(console.error);

    return group._animationQueue;
  }

  async animateCollapse(group) {
    return this.#queueAnimation(group, async () => {
      this.cancelPopupTimer();

      const animations = [];
      let selectedTabs = this.#getSelectedTabs(group);
      if (!selectedTabs.length && group.hasActiveTab) {
        selectedTabs = group.activeTabs;
      }

      const tabsContainer = group.groupContainer;
      const tabsContainerWrapper = group.groupContainerWrapper;
      const tabsContainerActive = group.groupActiveTabsContainer;

      // Calculate the height of the tabs container for animation
      const collapsedHeight = this.#calculateHeightShift(tabsContainer);

      if (selectedTabs.length) {
        // Avoid re-setting activeTabs if it's the same array reference.
        // The setter performs a union sorted by _tPos, which is unstable
        // during session restore and can reorder activeTabs between restarts.
        if (selectedTabs !== group.activeTabs) {
          group.activeTabs = selectedTabs;
          animations.push(
            this.#moveToActiveTabsContainer(group, selectedTabs, true)
          );
        }
      }

      const items = group.allItems.filter(
        item =>
          !selectedTabs
            .map(tab => (tab.splitView ? tab.group : tab))
            .includes(item)
      );

      const activeContainerHeight = new Set(
        selectedTabs.map(tab => (tab.splitView ? tab.group : tab))
      );

      animations.push(
        ...this.updateFolderIcon(group),
        this.createAnimation(
          tabsContainer,
          { transform: [`translateY(${collapsedHeight}px)`] },
          {
            duration: gReduceMotion
              ? 0
              : this._ANIMATION_DURATION.COLLAPSE_TRANSFORM,
            easing: "ease-in-out",
          }
        ),
        this.createAnimation(
          tabsContainerWrapper,
          {
            gridTemplateRows: ["1fr", "0fr"],
          },
          {
            duration: gReduceMotion
              ? 0
              : this._ANIMATION_DURATION.COLLAPSE_HEIGHT,
            easing: "ease-in-out",
          }
        ),
        this.createAnimation(
          items,
          {
            opacity: [1, 0],
          },
          {
            duration: gReduceMotion ? 0 : this._ANIMATION_DURATION.OPACITY,
            easing: "ease-in-out",
          }
        ),
        this.createAnimation(
          tabsContainerActive,
          { height: ["0px", `${activeContainerHeight.size * 40}px`] },
          {
            duration: gReduceMotion
              ? 0
              : this._ANIMATION_DURATION.COLLAPSE_ACTIVE_HEIGHT,
            easing: "ease-in-out",
          },
          () => {
            tabsContainerActive.style.removeProperty("height");
          }
        )
      );

      await Promise.all(animations).then(() => {
        items.forEach(item => item.style.removeProperty("opacity"));
        gBrowser.tabContainer._invalidateCachedVisibleTabs();
      });
    });
  }

  async animateExpand(group) {
    return this.#queueAnimation(group, async () => {
      this.cancelPopupTimer();

      const animations = [];

      const tabsContainer = group.groupContainer;
      const tabsContainerWrapper = group.groupContainerWrapper;

      const activeTabs = group.activeTabs;
      if (group.activeTabs.length) {
        group.activeTabs = [];
        tabsContainer.style.transform = "translateY(0px)";
        animations.push(
          this.#moveToActiveTabsContainer(group, activeTabs, false)
        );
      }

      const items = group.allItems
        .reverse()
        .filter(
          item =>
            !activeTabs
              .map(tab => (tab.splitView ? tab.group : tab))
              .includes(item)
        );

      const clearContainerStyle = () => {
        items.forEach(item => item.style.removeProperty("opacity"));
        if (!group.hasActiveTab) {
          tabsContainerWrapper.style.removeProperty("grid-template-rows");
          tabsContainer.style.removeProperty("transform");
        }
      };

      animations.push(
        ...this.updateFolderIcon(group),
        this.createAnimation(
          tabsContainer,
          { transform: ["translateY(0px)"] },
          {
            duration: this._ANIMATION_DURATION.EXPAND_TRANSFORM,
            easing: "ease-in-out",
          }
        ),
        this.createAnimation(
          items,
          {
            opacity: [0, 1],
          },
          {
            duration: gReduceMotion ? 0 : this._ANIMATION_DURATION.OPACITY,
            easing: "ease-in-out",
          }
        ),
        this.createAnimation(
          tabsContainerWrapper,
          {
            gridTemplateRows: ["0fr", "1fr"],
          },
          {
            duration: this._ANIMATION_DURATION.EXPAND_HEIGHT,
            easing: "ease-in-out",
          }
        )
      );

      await Promise.all(animations).then(clearContainerStyle);
      gBrowser.tabContainer._invalidateCachedVisibleTabs();
    });
  }

  async animateUnloadAll(group) {
    return this.#queueAnimation(group, async () => {
      const animations = [];
      const activeFolders = [group, ...group.childActiveGroups];
      let tabsToMove = group.activeTabs;
      const alreadyAnimated = new Set();
      for (const folder of activeFolders) {
        const activeTabs = folder.activeTabs;
        const union = (a, b) => {
          const set = new Set(a);
          for (const item of b) {
            set.add(item);
          }
          return [...set].sort((aTab, bTab) => aTab._tPos > bTab._tPos);
        };
        tabsToMove = union(tabsToMove, activeTabs);
        folder.activeTabs = [];
        const activeContainer = folder.groupActiveTabsContainer;
        activeContainer.style.overflowY = "clip";
        const containerHeight =
          this.getBoundsWithoutFlushing(activeContainer).height;
        animations.push(
          ...this.updateFolderIcon(folder, "close", false),
          this.createAnimation(
            activeContainer,
            { height: [`${containerHeight}px`, "0px"] },
            {
              duration: this._ANIMATION_DURATION.COLLAPSE_ACTIVE_HEIGHT,
              easing: "ease-in-out",
            },
            () => {
              activeContainer.style.removeProperty("height");
              activeContainer.style.removeProperty("overflow-y");
            }
          )
        );
        for (let i = 0; i < activeTabs.length; i++) {
          const tab = activeTabs[i];
          if (alreadyAnimated.has(tab)) {
            continue;
          }
          alreadyAnimated.add(tab);
          animations.push(
            this.createAnimation(
              tab,
              {
                transform: [
                  "translateY(0px)",
                  `translateY(-${containerHeight}px)`,
                ],
              },
              {
                duration: this._ANIMATION_DURATION.COLLAPSE_TRANSFORM,
                easing: "ease-in-out",
              },
              () => {
                tab.style.removeProperty("transform");
              }
            )
          );
        }
      }

      await Promise.all(animations);
      await Promise.all(
        this.#moveToActiveTabsContainer(group, tabsToMove, false)
      );
    });
  }

  async animateUnload(group, tabToUnload, ungroup = false) {
    return this.#queueAnimation(group, async () => {
      const animations = [];
      const isSplitView = tabToUnload.splitView ?? false;
      const activeFolders = group.activeGroups;
      if (!activeFolders.length) {
        return;
      }
      for (const folder of activeFolders) {
        folder.removeActiveTab(tabToUnload);
        if (!folder.activeTabs.length) {
          const activeContainer = folder.groupActiveTabsContainer;
          activeContainer.style.overflowY = "clip";
          const containerHeight =
            this.getBoundsWithoutFlushing(activeContainer).height;
          animations.push(
            ...this.updateFolderIcon(folder, "close", false),
            this.createAnimation(
              activeContainer,
              { height: [`${containerHeight}px`, "0px"] },
              {
                duration: this._ANIMATION_DURATION.COLLAPSE_ACTIVE_HEIGHT,
                easing: "ease-in-out",
              },
              () => {
                activeContainer.style.removeProperty("height");
                activeContainer.style.overflowY = "";
              }
            )
          );
        }
      }

      if (isSplitView) {
        tabToUnload = tabToUnload.group;
      }

      const activeContainer = group.groupActiveTabsContainer;
      activeContainer.style.overflowY = "clip";
      const tabHeight = this.getBoundsWithoutFlushing(tabToUnload).height;
      animations.push(
        this.createAnimation(
          tabToUnload,
          {
            transform: ["translateY(0px)", `translateY(-${tabHeight}px)`],
            height: [`${tabHeight}px`, "0px"],
          },
          {
            duration: this._ANIMATION_DURATION.COLLAPSE_TRANSFORM,
            easing: "ease-in-out",
          },
          () => {
            tabToUnload.style.removeProperty("transform");
            tabToUnload.style.removeProperty("height");
            activeContainer.style.overflowY = "";
          }
        )
      );
      group.removeActiveTab(tabToUnload);
      // TODO: Check that no styles are left on elements
      if (ungroup) {
        return;
      }
      await Promise.all(animations);
      await Promise.all(
        this.#moveToActiveTabsContainer(group, [tabToUnload], false)
      );
    });
  }

  async animateSelect(group) {
    if (!group?.isZenFolder) {
      return;
    }

    return this.#queueAnimation(group, async () => {
      this.cancelPopupTimer();

      const selectedTabs = this.#getSelectedTabs(group);
      const tabsActiveContainer = group.groupActiveTabsContainer;
      if (selectedTabs.every(t => tabsActiveContainer.contains(t))) {
        return;
      }

      for (const tab of selectedTabs) {
        let curGroup = tab.splitView ? tab.group.group : tab.group;
        while (curGroup && curGroup.collapsed) {
          const activeTabs = selectedTabs.filter(t =>
            curGroup.tabs.includes(t)
          );
          if (activeTabs.length) {
            curGroup.activeTabs = activeTabs;
            this.updateFolderIcon(curGroup, "close", false);
          }
          curGroup = curGroup.group;
        }
      }

      tabsActiveContainer.style.overflowY = "clip";
      await Promise.all(
        this.#moveToActiveTabsContainer(group, group.activeTabs, true)
      ).then(() => {
        tabsActiveContainer.style.overflowY = "";
      });
    });
  }

  async animateGroupMove(group, expand = false) {
    if (!group?.isZenFolder || !group.hasActiveTab) {
      return;
    }
    return this.#queueAnimation(group, async () => {
        const activeTabs = group.activeTabs;
        const tabsContainerActive = group.groupActiveTabsContainer;
        const activeElements = [...new Set(activeTabs.map(tab => tab.splitView ? tab.group : tab))];

        tabsContainerActive.style.overflowY = "clip";

        if (expand) {
          const shiftSize = activeElements.length * 40;
          group.activeCollapsed = false;
          await Promise.all([
            this.createAnimation(
              tabsContainerActive,
              { height: ["0px", `${shiftSize}px`], visibility: "visible" },
              {
                duration: gReduceMotion ? 0 : this._ANIMATION_DURATION.EXPAND_HEIGHT,
                easing: "ease-in-out",
              },
              () => {
                tabsContainerActive.style.removeProperty("height");
                tabsContainerActive.style.removeProperty("visibility");
                tabsContainerActive.style.removeProperty("overflow-y");
              }
            ),
            this.createAnimation(
              activeElements,
              {
                transform: [`translateY(-${shiftSize}px)`, "translateY(0px)"],
              },
              {
                duration: gReduceMotion ? 0 : this._ANIMATION_DURATION.COLLAPSE_TRANSFORM,
                easing: "ease-in-out",
              },
              () => {
                activeElements.forEach(el => el.style.removeProperty("transform"));
              }
            ),
          ]);
        } else {
          const heightContainer = this.getBoundsWithoutFlushing(tabsContainerActive).height;
          group.activeCollapsed = true;
          await Promise.all([
            this.createAnimation(
              tabsContainerActive,
              { height: [`${heightContainer}px`, "0px"], visibility: "hidden" },
              {
                duration: gReduceMotion ? 0 : this._ANIMATION_DURATION.COLLAPSE_ACTIVE_HEIGHT,
                easing: "ease-in-out",
              },
              () => {
                tabsContainerActive.style.removeProperty("overflow-y");
              }
            ),
            this.createAnimation(
              activeElements,
              {
                transform: ["translateY(0px)", `translateY(-${heightContainer}px)`],
              },
              {
                duration: gReduceMotion ? 0 : this._ANIMATION_DURATION.COLLAPSE_TRANSFORM,
                easing: "ease-in-out",
              },
              () => {
                activeElements.forEach(el => el.style.removeProperty("transform"));
              }
            ),
          ]);
        }
    });
  }
}

window.gZenFolders = new nsZenFolders();
