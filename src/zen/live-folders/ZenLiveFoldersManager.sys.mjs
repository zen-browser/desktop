// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  JSONFile: "resource://gre/modules/JSONFile.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
  ZenWindowSync: "resource:///modules/zen/ZenWindowSync.sys.mjs",
  FeatureCallout: "resource:///modules/asrouter/FeatureCallout.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-live-folders.ftl"])
);

const DEFAULT_FETCH_INTERVAL = 30 * 60 * 1000;
const providers = [
  {
    path: "resource:///modules/zen/RssLiveFolder.sys.mjs",
    module: "nsRssLiveFolderProvider",
  },
  {
    path: "resource:///modules/zen/GithubLiveFolder.sys.mjs",
    module: "nsGithubLiveFolderProvider",
  },
];

class nsZenLiveFoldersManager {
  #isInitialized = false;
  #saveFilename = "zen-live-folders.jsonlz4";
  #file = null;

  constructor() {
    this.liveFolders = new Map();
    this.registry = new Map();
    this.dismissedItems = new Set();
    this.folderRefs = new WeakMap();
  }

  get window() {
    return lazy.ZenWindowSync.firstSyncedWindow;
  }

  async init() {
    if (this.#isInitialized) {
      return;
    }

    for (const provider of providers) {
      const module = ChromeUtils.importESModule(provider.path, { global: "current" });
      const ProviderClass = module[provider.module];
      this.registry.set(ProviderClass.type, ProviderClass);
    }

    await this.#restoreState();
    this.#initEventListeners();
    this.#isInitialized = true;
  }

  // Event Handling
  // --------------
  #initEventListeners() {
    lazy.ZenWindowSync.addSyncHandler(this.handleEvent.bind(this));
  }

  handleEvent(aEvent) {
    switch (aEvent.type) {
      case "TabUngrouped":
      case "TabClose": {
        this.#onTabDismiss(aEvent);
        break;
      }
      case "TabGroupRemoved": {
        this.#onTabGroupRemoved(aEvent);
        break;
      }
      case "command": {
        this.#onCommand(aEvent);
        break;
      }
      case "click": {
        this.#onActionButtonClick(aEvent);
        break;
      }
    }
  }

  #onCommand(event) {
    switch (event.target.id) {
      case "cmd_zenNewLiveFolder": {
        const target = event.sourceEvent.target;
        switch (target.getAttribute("data-l10n-id")) {
          case "zen-live-folder-github-pull-requests": {
            this.createFolder("github:pull-requests");
            break;
          }
          case "zen-live-folder-github-issues": {
            this.createFolder("github:issues");
            break;
          }
          case "zen-live-folder-type-rss": {
            this.createFolder("rss");
            break;
          }
        }
      }
    }
  }

  #onTabDismiss(event) {
    const itemIdAttr = "zen-live-folder-item-id";
    const itemId =
      event.target.getAttribute(itemIdAttr) || event.detail?.getAttribute?.(itemIdAttr);

    if (itemId) {
      if (event.type === "TabUngrouped") {
        const target = event.detail;
        target.removeAttribute("zen-live-folder-item-id");

        const showSublabel = target.hasAttribute("zen-show-sublabel");
        if (showSublabel) {
          target.removeAttribute("zen-show-sublabel");

          const label = target.querySelector(".zen-tab-sublabel");
          this.window.document.l10n.setArgs(label, {
            tabSubtitle: "zen-default-pinned",
          });
        }
      }

      this.dismissedItems.add(itemId);
      this.saveState();
    }
  }

  #onActionButtonClick(event) {
    const liveFolderId = event.target.getAttribute("live-folder-action");
    this.getFolder(liveFolderId)?.onActionButtonClick(event.target.getAttribute("data-l10n-id"));
  }

  #onTabGroupRemoved(event) {
    const tabGroup = event.target;
    if (tabGroup.isLiveFolder) {
      this.deleteFolder(tabGroup.id, false);
    }
  }

  // Public API
  // ----------
  getFolder(id) {
    return this.liveFolders.get(id);
  }

  async createFolder(type) {
    const [provider, providerType] = type.split(":");
    let ProviderClass = this.registry.get(provider);
    if (!ProviderClass) {
      return -1;
    }

    let url;
    let label;
    let icon;

    switch (provider) {
      case "rss": {
        url = await ProviderClass.promptForFeedUrl(this.window);
        if (!url) {
          return -1;
        }

        const metadata = await ProviderClass.getMetadata(url, this.window);
        label = metadata.label;
        icon = metadata.icon;

        break;
      }
      case "github": {
        const [message] = await lazy.l10n.formatMessages([
          { id: `zen-live-folder-github-${providerType}` },
        ]);

        label = message.attributes[0].value;
        icon = "chrome://browser/skin/zen-icons/selectable/logo-github.svg";
        break;
      }
    }

    const folder = this.window.gZenFolders.createFolder([], {
      label,
      isLiveFolder: true,
      collapsed: true,
    });

    this.#maybeShowPromotion(folder, icon);

    if (icon) {
      this.window.gZenFolders.setFolderUserIcon(folder, icon);
    }

    const config = {
      state: this.#applyDefaultStateValues({
        url,
        type: providerType,
      }),
    };

    let liveFolder = new ProviderClass({
      state: config.state,
      manager: this,
      id: folder.id,
    });

    this.liveFolders.set(folder.id, liveFolder);
    this.folderRefs.set(liveFolder, folder);

    liveFolder.start();
    this.saveState();

    return folder.id;
  }

  #maybeShowPromotion(folder, icon) {
    let labelElement = folder.labelElement;
    labelElement.setAttribute("live-folder-animation", "true");
    labelElement.style.backgroundPositionX = "0%";
    folder.ownerGlobal.gZenUIManager.motion
      .animate(
        labelElement,
        {
          backgroundPositionX: ["0%", "-50%"],
        },
        {
          duration: 1,
        }
      )
      .then(() => {
        labelElement.style.backgroundPositionX = "";
        labelElement.removeAttribute("live-folder-animation");
      });

    if (Services.prefs.getBoolPref("zen.live-folders.promotion.shown", false)) {
      return;
    }
    Services.prefs.setBoolPref("zen.live-folders.promotion.shown", true);
    let window = this.window;
    let gBrowser = window.gBrowser;
    const callout = new lazy.FeatureCallout({
      win: this.window,
      location: "chrome",
      context: "chrome",
      browser: gBrowser.selectedBrowser,
      theme: { preset: "chrome" },
    });
    callout.showFeatureCallout({
      id: "ZEN_LIVE_FOLDERS_CALLOUT",
      template: "feature_callout",
      groups: ["cfr"],
      content: {
        id: "ZEN_LIVE_FOLDERS_CALLOUT",
        template: "spotlight",
        backdrop: "transparent",
        transitions: true,
        autohide: true,
        screens: [
          {
            id: "ZEN_LIVE_FOLDERS_CALLOUT",
            anchors: [
              {
                selector: `[id="${folder.id}"]`,
                panel_position: {
                  anchor_attachment: "rightcenter",
                  callout_attachment: "topleft",
                },
              },
            ],
            content: {
              width: "310px",
              position: "callout",
              title_logo: {
                imageURL: icon,
                width: "18px",
                height: "18px",
                marginInline: "0 8px",
              },
              title: {
                string_id: "zen-live-folders-promotion-title",
              },
              subtitle: {
                string_id: "zen-live-folders-promotion-description",
              },
            },
          },
        ],
      },
    });

    lazy.setTimeout(() => {
      callout.endTour();
    }, 10000);
  }

  deleteFolder(id, deleteFolder = true) {
    const liveFolder = this.liveFolders.get(id);
    if (!liveFolder) {
      return false;
    }

    liveFolder.stop();
    this.liveFolders.delete(id);

    const prefix = `${id}:`;

    // Remove the dismissed items associated with the folder from the set
    this.dismissedItems = new Set(
      Array.from(this.dismissedItems).filter((itemId) => !itemId.startsWith(prefix))
    );

    if (deleteFolder) {
      const folder = this.getFolderForLiveFolder(liveFolder);
      if (folder) {
        folder.delete();
      }
    }

    this.saveState();
    return true;
  }

  // Live Folder Updates
  // -------------------
  onLiveFolderFetch(liveFolder, items) {
    const folder = this.getFolderForLiveFolder(liveFolder);
    if (!folder) {
      return;
    }

    const errorId = typeof items === "string" ? items : null;
    liveFolder.state.lastErrorId = errorId;

    // Display on error on the folder, null reset the error status.
    this.#applyLiveFolderError(liveFolder, errorId);

    if (errorId) {
      liveFolder.requestSave();
      return;
    }

    // itemid -> id:itemid
    const itemIds = new Set(items.map((item) => this.#makeCompositeId(liveFolder.id, item.id)));

    const outdatedTabs = [];
    const existingItemIds = new Set();

    for (const tab of folder.tabs) {
      const itemId = tab.getAttribute("zen-live-folder-item-id");
      if (!itemId) {
        continue;
      }

      if (!itemIds.has(itemId)) {
        outdatedTabs.push(tab);
        continue;
      }

      existingItemIds.add(itemId);
    }

    this.window.gBrowser.removeTabs(outdatedTabs, {
      skipSessionStore: true,
      animate: !folder.collapsed,
    });

    // Remove the dismissed items that are no longer in the given list
    for (const dismissedItemId of this.dismissedItems) {
      if (dismissedItemId.startsWith(`${liveFolder.id}:`) && !itemIds.has(dismissedItemId)) {
        this.dismissedItems.delete(dismissedItemId);
      }
    }

    // Only add the items that are not already in the folder and was not dismissed by the user
    const newItems = items
      .filter((item) => {
        const compositeId = this.#makeCompositeId(liveFolder.id, item.id);
        return !existingItemIds.has(compositeId) && !this.dismissedItems.has(compositeId);
      })
      .map((item) => {
        const tab = this.window.gBrowser.addTrustedTab(item.url, {
          createLazyBrowser: true,
          inBackground: true,
          skipAnimation: true,
          noInitialLabel: true,
          lazyTabTitle: item.title,
        });
        // createLazyBrowser can't be pinned by default
        this.window.gBrowser.pinTab(tab);
        if (item.icon) {
          this.window.gBrowser.setIcon(tab, item.icon);
          if (tab.linkedBrowser) {
            lazy.TabStateCache.update(tab.linkedBrowser.permanentKey, {
              image: null,
            });
          }
        }
        tab.setAttribute("zen-live-folder-item-id", this.#makeCompositeId(liveFolder.id, item.id));
        if (item.subtitle) {
          tab.setAttribute("zen-show-sublabel", item.subtitle);
          const tabLabel = tab.querySelector(".zen-tab-sublabel");
          this.window.document.l10n.setArgs(tabLabel, {
            tabSubtitle: item.subtitle,
          });
        }

        return tab;
      });

    // Wait for tabs to (hopefully) be initialized on all windows
    lazy.setTimeout(() => {
      folder.addTabs(newItems);
      this.saveState();
    }, 0);
  }

  // Helpers
  // -------
  #applyDefaultStateValues(state) {
    state.interval ||= DEFAULT_FETCH_INTERVAL;
    state.lastFetched ||= 0;
    state.options ||= {};

    return state;
  }

  #applyLiveFolderError(liveFolder, errorId = null) {
    const folder = this.getFolderForLiveFolder(liveFolder);
    if (!folder?.isLiveFolder) {
      return;
    }

    const btn = folder.resetButton;
    if (!btn) {
      return;
    }

    if (errorId) {
      btn.setAttribute("data-l10n-id", errorId);
      btn.setAttribute("live-folder-action", liveFolder.id);
    } else {
      btn.setAttribute("data-l10n-id", "zen-folders-unload-all-tooltip");
      btn.removeAttribute("live-folder-action");
    }
  }

  getFolderForLiveFolder(liveFolder) {
    if (this.folderRefs.has(liveFolder)) {
      return this.folderRefs.get(liveFolder);
    }

    if (!this.window) {
      return null;
    }

    const folder = lazy.ZenWindowSync.getItemFromWindow(this.window, liveFolder.id);
    if (folder?.isZenFolder) {
      this.folderRefs.set(liveFolder, folder);
    }

    return folder;
  }

  #makeCompositeId(folderId, itemId) {
    return `${folderId}:${itemId}`;
  }

  // Persistence
  // -----------
  get #storePath() {
    const profilePath = this.window.PathUtils.profileDir;
    return this.window.PathUtils.join(profilePath, this.#saveFilename);
  }

  async #readStateFromDisk() {
    this.#file = new lazy.JSONFile({
      path: this.#storePath,
      compression: "lz4",
    });

    await this.#file.load();
    return this.#file.data;
  }

  #writeStateToDisk(data, soon = true) {
    this.#file.data = data;
    if (soon) {
      this.#file.saveSoon();
    } else {
      this.#file._save();
    }
  }

  saveState(soon = true) {
    if (!this.#isInitialized) {
      return;
    }

    let data = [];
    for (let [id, liveFolder] of this.liveFolders) {
      const prefix = `${id}:`;
      const dismissedItems = Array.from(this.dismissedItems).filter((itemId) =>
        itemId.startsWith(prefix)
      );

      const folder = this.getFolderForLiveFolder(liveFolder);
      if (!folder) {
        // Assume browser is quitting.
        return;
      }

      const tabsState = [];
      for (const tab of folder.tabs) {
        const itemId = tab.getAttribute("zen-live-folder-item-id");
        if (!itemId) {
          continue;
        }

        tabsState.push({
          itemId,
          label: tab.getAttribute("zen-show-sublabel"),
          icon: tab.iconImage.src,
        });
      }

      // For UI manager to restore tabs state
      liveFolder.tabsState = tabsState;

      data.push({
        id,
        type: liveFolder.constructor.type,
        data: liveFolder.serialize(),
        dismissedItems,
        tabsState,
      });
    }

    this.#writeStateToDisk(data, soon);
  }

  async #restoreState() {
    let data = await this.#readStateFromDisk();
    if (!Array.isArray(data)) {
      return;
    }

    await this.window.gZenWorkspaces.promiseInitialized;
    const folders = this.window.gZenWorkspaces.allTabGroups;
    for (let entry of data) {
      let ProviderClass = this.registry.get(entry.type);
      if (!ProviderClass) {
        continue;
      }

      const folder = folders.find((x) => x.id === entry.id);
      if (!folder) {
        // No point restore if the live folder can't find its folder
        continue;
      }

      entry.data.state = this.#applyDefaultStateValues(entry.data.state);
      let liveFolder = new ProviderClass({
        id: entry.id,
        state: entry.data.state,
        manager: this,
      });

      this.liveFolders.set(entry.id, liveFolder);
      this.folderRefs.set(liveFolder, folder);

      liveFolder.tabsState = entry.tabsState;
      liveFolder.state.lastErrorId = entry.data.state.lastErrorId;
      if (entry.dismissedItems && Array.isArray(entry.dismissedItems)) {
        entry.dismissedItems.forEach((id) => this.dismissedItems.add(id));
      }

      liveFolder.start();
    }
  }
}

export const ZenLiveFoldersManager = new nsZenLiveFoldersManager();
