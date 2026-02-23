// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ZenLiveFoldersManager: "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
});

export class nsZenFolder extends MozTabbrowserTabGroup {
  #initialized = false;

  static markup = `
      <hbox class="tab-group-label-container zen-drop-target" pack="center">
        <html:div class="tab-group-folder-icon"/>
        <label class="tab-group-label" role="button"/>
        <image class="tab-reset-button reset-icon" role="button" keyNav="false" data-l10n-id="zen-folders-unload-all-tooltip"/>
      </hbox>
      <html:div class="tab-group-container">
        <html:div class="zen-tab-group-start" />
      </html:div>
      <vbox class="tab-group-overflow-count-container" pack="center">
        <label class="tab-group-overflow-count" role="button" />
      </vbox>
    `;

  static rawIcon = new DOMParser().parseFromString(
    `
      <svg width="28" height="28" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" x1="14" y1="5.625" x2="14" y2="22.375" id="gradient-0">
            <stop offset="0" style="stop-color: rgb(255, 255, 255)"/>
            <stop offset="1" style="stop-color: rgb(0% 0% 0%)"/>
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" x1="14" y1="9.625" x2="14" y2="22.375" id="gradient-1">
            <stop offset="0" style="stop-color: rgb(255, 255, 255)"/>
            <stop offset="1" style="stop-color: rgb(0% 0% 0%)"/>
          </linearGradient>
        </defs>
        <!--Back Folder (path)-->
        <path class="back" d="M8 5.625H11.9473C12.4866 5.625 13.0105 5.80861 13.4316 6.14551L14.2881 6.83105C14.9308 7.34508 15.7298 7.625 16.5527 7.625H20C21.3117 7.625 22.375 8.68832 22.375 10V20C22.375 21.3117 21.3117 22.375 20 22.375H8C6.68832 22.375 5.625 21.3117 5.625 20V8C5.625 6.68832 6.68832 5.625 8 5.625Z" style="fill: var(--zen-folder-behind-bgcolor);">
        </path>
        <path class="back" d="M8 5.625H11.9473C12.4866 5.625 13.0105 5.80861 13.4316 6.14551L14.2881 6.83105C14.9308 7.34508 15.7298 7.625 16.5527 7.625H20C21.3117 7.625 22.375 8.68832 22.375 10V20C22.375 21.3117 21.3117 22.375 20 22.375H8C6.68832 22.375 5.625 21.3117 5.625 20V8C5.625 6.68832 6.68832 5.625 8 5.625Z" style="stroke-width: 1.5px; stroke: var(--zen-folder-stroke); fill: url(#gradient-0); fill-opacity: 0.1;">
        </path>
        <!--Front Folder (rect)-->
        <rect class="front" x="5.625" y="9.625" width="16.75" height="12.75" rx="2.375" style="fill: var(--zen-folder-front-bgcolor);">
        </rect>
        <rect class="front" x="5.625" y="9.625" width="16.75" height="12.75" rx="2.375" style="stroke-width: 1.5px; stroke: var(--zen-folder-stroke); fill: url(#gradient-1); fill-opacity: 0.1;">
        </rect>
        <!--Icon (g)-->
        <g class="icon">
          <image href="" height="11" width="11"/>
        </g>
        <!--End Icon (g)-->
        <g class="dots" style="fill: var(--zen-folder-stroke);">
          <ellipse cx="10" cy="16" rx="1.25" ry="1.25"/>
          <ellipse cx="14" cy="16" rx="1.25" ry="1.25"/>
          <ellipse cx="18" cy="16" rx="1.25" ry="1.25"/>
        </g>
      </svg>`,
    "image/svg+xml"
  ).documentElement;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.labelElement.pinned = true;
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    this._activeTabs = [];
    this.icon.appendChild(nsZenFolder.rawIcon.cloneNode(true));

    this.labelElement.parentElement.setAttribute("context", "zenFolderActions");

    this.labelElement.onRenameFinished = (newLabel) => {
      this.name = newLabel.trim() || "Folder";
      const event = new CustomEvent("ZenFolderRenamed", {
        bubbles: true,
      });
      this.dispatchEvent(event);
    };

    if (this.collapsed) {
      this.groupContainer.setAttribute("hidden", true);
    }
  }

  get icon() {
    return this.querySelector(".tab-group-folder-icon");
  }

  /**
   * Returns the group this folder belongs to.
   *
   * @returns {MozTabbrowserTabGroup|null} The group this folder belongs to, or null if it is not part of a group.
   */
  get group() {
    if (gBrowser.isTabGroup(this.parentElement?.parentElement)) {
      return this.parentElement.parentElement;
    }
    return null;
  }

  get isZenFolder() {
    return true;
  }

  get activeGroups() {
    let activeGroups = [];
    let currentGroup = this;
    if (currentGroup?.hasAttribute("has-active")) {
      activeGroups.push(currentGroup);
    }
    while (currentGroup?.group) {
      currentGroup = currentGroup?.group;
      if (currentGroup?.hasAttribute("has-active")) {
        activeGroups.push(currentGroup);
      }
    }
    return activeGroups;
  }

  get childActiveGroups() {
    if (this.tagName === "zen-workspace-collapsible-pins") {
      return Array.from(this.parentElement.querySelectorAll("zen-folder[has-active]"));
    }
    return Array.from(this.querySelectorAll("zen-folder[has-active]"));
  }

  rename() {
    if (!document.documentElement.hasAttribute("zen-sidebar-expanded")) {
      return;
    }
    gZenVerticalTabsManager.renameTabStart({
      target: this.labelElement,
      explicit: true,
    });
  }

  createSubfolder() {
    // We need to expand all parent folders
    let currentFolder = this;
    do {
      currentFolder.collapsed = false;
      currentFolder = currentFolder.group;
    } while (currentFolder);
    gZenFolders.createFolder([], {
      renameFolder: !gZenUIManager.testingEnabled,
      label: "Subfolder",
      insertAfter: this.groupContainer.lastElementChild,
    });
  }

  async unpackTabs() {
    this.collapsed = false;
    for (let tab of this.allItems.reverse()) {
      tab = tab.group.hasAttribute("split-view-group") ? tab.group : tab;
      if (tab.hasAttribute("zen-empty-tab")) {
        gBrowser.removeTab(tab);
      } else {
        gBrowser.ungroupTab(tab);
      }
    }
  }

  async delete() {
    for (const tab of this.allItemsRecursive) {
      if (tab.hasAttribute("zen-empty-tab")) {
        // Manually remove the empty tabs as removeTabs() inside removeTabGroup
        // does ignore them.
        gBrowser.removeTab(tab);
      }
    }
    await gBrowser.removeTabGroup(this, { isUserTriggered: true });
  }

  get allItemsRecursive() {
    const items = [];
    for (const item of this.allItems) {
      if (item.isZenFolder) {
        items.push(item, ...item.allItemsRecursive);
      } else {
        items.push(item);
      }
    }
    return items;
  }

  get allItems() {
    return [...this.groupContainer.children].filter(
      (child) =>
        !(
          child.classList.contains("zen-tab-group-start") ||
          child.classList.contains("pinned-tabs-container-separator")
        )
    );
  }

  get pinned() {
    return this.isZenFolder;
  }

  /**
   * Intentionally ignore attempts to change the pinned state.
   * ZenFolder instances determine their "pinned" status based on their type (isZenFolder)
   * and do not support being pinned or unpinned via this setter.
   * This no-op setter ensures compatibility with interfaces expecting a pinned property,
   * while preserving the invariant that ZenFolders cannot have their pinned state changed externally.
   */
  set pinned(value) {}

  get iconURL() {
    return this.icon.querySelector("image")?.getAttribute("href") || "";
  }

  set activeTabs(tabs) {
    if (tabs.length) {
      this._activeTabs = tabs;
      for (let tab of tabs) {
        tab.setAttribute("folder-active", "true");
      }
    } else {
      const folders = new Map();
      for (let tab of this._activeTabs) {
        const group = tab?.group?.hasAttribute("split-view-group") ? tab?.group?.group : tab?.group;
        if (!folders.has(group?.id)) {
          folders.set(group?.id, group?.activeGroups?.at(-1));
        }
        let activeGroup = folders.get(group?.id);
        if (!activeGroup) {
          tab.removeAttribute("folder-active");
          tab.style.removeProperty("--zen-folder-indent");
        }
      }
      this._activeTabs = [];
      folders.clear();
    }
  }

  get activeTabs() {
    return this._activeTabs;
  }

  get resetButton() {
    return this.labelElement.parentElement?.querySelector(".tab-reset-button") ?? null;
  }

  unloadAllTabs(event) {
    this.#unloadAllActiveTabs(event, /* noClose */ true);
  }

  async #unloadAllActiveTabs(event, noClose = false) {
    await gZenPinnedTabManager.onCloseTabShortcut(event, this.tabs, {
      noClose,
      alwaysUnload: true,
      folderToUnload: this,
    });
    this.activeTabs = [];
    this.collapsed = true;
  }

  on_click(event) {
    if (event.target === this.resetButton) {
      event.stopPropagation();

      if (event.target.hasAttribute("live-folder-action")) {
        lazy.ZenLiveFoldersManager.handleEvent(event);
      } else {
        this.unloadAllTabs(event);
      }
      return;
    }
    super.on_click(event);
  }

  addTabs(tabs) {
    super.addTabs(tabs);
    if (this.collapsed && !gZenFolders._sessionRestoring && this.isLiveFolder && tabs.length) {
      for (let tab of tabs) {
        tab.setAttribute("folder-active", "true");
      }
      gZenFolders.animateCollapse(this);
    }
  }

  /**
   * Get the root most collapsed folder in the tree.
   *
   * @returns {ZenFolder|null} The root most collapsed folder, or null if none are collapsed.
   */
  get rootMostCollapsedFolder() {
    let current = this;
    let rootMost = null;
    do {
      if (current.collapsed) {
        rootMost = current;
      }
      current = current.group;
    } while (current);
    return rootMost;
  }
}

customElements.define("zen-folder", nsZenFolder);
