// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};

class ZenPinnedTabsObserver {
  static ALL_EVENTS = ["TabPinned", "TabUnpinned"];

  #listeners = [];

  constructor() {
    // eslint-disable-next-line mozilla/valid-lazy
    XPCOMUtils.defineLazyPreferenceGetter(
      lazy,
      "zenPinnedTabRestorePinnedTabsToPinnedUrl",
      "zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url",
      false
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      lazy,
      "zenPinnedTabCloseShortcutBehavior",
      "zen.pinned-tab-manager.close-shortcut-behavior",
      "switch"
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      lazy,
      "zenTabsEssentialsMax",
      "zen.tabs.essentials.max",
      12
    );
    ChromeUtils.defineESModuleGetters(lazy, {
      // eslint-disable-next-line mozilla/valid-lazy
      E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
      TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
    });
    this.#listenPinnedTabEvents();
  }

  #listenPinnedTabEvents() {
    const eventListener = this.#eventListener.bind(this);
    for (const event of ZenPinnedTabsObserver.ALL_EVENTS) {
      window.addEventListener(event, eventListener);
    }
    window.addEventListener("unload", () => {
      for (const event of ZenPinnedTabsObserver.ALL_EVENTS) {
        window.removeEventListener(event, eventListener);
      }
    });
  }

  #eventListener(event) {
    for (const listener of this.#listeners) {
      listener(event.type, event);
    }
  }

  addPinnedTabListener(listener) {
    this.#listeners.push(listener);
  }
}

class nsZenPinnedTabManager extends nsZenDOMOperatedFeature {
  init() {
    if (!this.enabled) {
      return;
    }
    this._canLog = Services.prefs.getBoolPref("zen.pinned-tab-manager.debug", false);
    this.observer = new ZenPinnedTabsObserver();
    this._initClosePinnedTabShortcut();
    this._insertItemsIntoTabContextMenu();
    this.observer.addPinnedTabListener(this._onPinnedTabEvent.bind(this));

    this._zenClickEventListener = this._onTabClick.bind(this);

    gZenWorkspaces._resolvePinnedInitialized();
  }

  log(message) {
    if (this._canLog) {
      /* eslint-disable-next-line no-console */
      console.log(`[ZenPinnedTabManager] ${message}`);
    }
  }

  onTabIconChanged(tab, url = null) {
    tab.dispatchEvent(new CustomEvent("ZenTabIconChanged", { bubbles: true, detail: { tab } }));
    if (tab.hasAttribute("zen-essential")) {
      this.setEssentialTabIcon(tab, url);
    }
  }

  setEssentialTabIcon(tab, url = null) {
    const iconUrl = url ?? tab.getAttribute("image") ?? "";
    tab.style.setProperty("--zen-essential-tab-icon", `url(${iconUrl})`);
  }

  _onTabResetPinButton(event, tab) {
    event.stopPropagation();
    this._resetTabToStoredState(tab);
  }

  get enabled() {
    return !gZenWorkspaces.privateWindowOrDisabled;
  }

  get maxEssentialTabs() {
    return lazy.zenTabsEssentialsMax;
  }

  _onPinnedTabEvent(action, event) {
    if (!this.enabled) {
      return;
    }
    const tab = event.target;
    if (this._ignoreNextTabPinnedEvent) {
      delete this._ignoreNextTabPinnedEvent;
      return;
    }
    switch (action) {
      case "TabPinned":
        tab._zenClickEventListener = this._zenClickEventListener;
        tab.addEventListener("click", tab._zenClickEventListener);
        break;
      // [Fall through]
      case "TabUnpinned":
        if (tab._zenClickEventListener) {
          tab.removeEventListener("click", tab._zenClickEventListener);
          delete tab._zenClickEventListener;
        }
        break;
      default:
        console.warn("ZenPinnedTabManager: Unhandled tab event", action);
        break;
    }
  }

  #getTabState(tab) {
    return JSON.parse(SessionStore.getTabState(tab));
  }

  async _onTabClick(e) {
    const tab = e.target?.closest("tab");
    if (e.button === 1 && tab) {
      await this.onCloseTabShortcut(e, tab, {
        closeIfPending: Services.prefs.getBoolPref("zen.pinned-tab-manager.wheel-close-if-pending"),
      });
    }
  }

  resetPinnedTab(tab) {
    if (!tab) {
      tab = TabContextMenu.contextTab;
    }

    if (!tab || !tab.pinned) {
      return;
    }

    this._resetTabToStoredState(tab);
  }

  async replacePinnedUrlWithCurrent(tab = undefined) {
    tab ??= TabContextMenu.contextTab;
    if (!tab || !tab.pinned) {
      return;
    }

    window.gZenWindowSync.setPinnedTabState(tab);
    this.resetPinChangedUrl(tab);
    gZenUIManager.showToast("zen-pinned-tab-replaced");
  }

  _initClosePinnedTabShortcut() {
    let cmdClose = document.getElementById("cmd_close");

    if (cmdClose) {
      cmdClose.addEventListener("command", this.onCloseTabShortcut.bind(this));
    }
  }

  // eslint-disable-next-line complexity
  async onCloseTabShortcut(
    event,
    selectedTab = gBrowser.selectedTab,
    {
      behavior = lazy.zenPinnedTabCloseShortcutBehavior,
      noClose = false,
      closeIfPending = false,
      alwaysUnload = false,
      folderToUnload = null,
    } = {}
  ) {
    try {
      const tabs = Array.isArray(selectedTab) ? selectedTab : [selectedTab];
      const pinnedTabs = [
        ...new Set(
          tabs
            .flatMap((tab) => {
              if (tab.group?.hasAttribute("split-view-group")) {
                return tab.group.tabs;
              }
              return tab;
            })
            .filter((tab) => tab?.pinned)
        ),
      ];

      if (!pinnedTabs.length) {
        return;
      }

      const selectedTabs = pinnedTabs.filter((tab) => tab.selected);

      event.stopPropagation();
      event.preventDefault();

      if (noClose && behavior === "close") {
        behavior = "unload-switch";
      }

      if (alwaysUnload && ["close", "reset", "switch", "reset-switch"].includes(behavior)) {
        behavior = behavior.contains("reset") ? "reset-unload-switch" : "unload-switch";
      }

      switch (behavior) {
        case "close": {
          for (const tab of pinnedTabs) {
            gBrowser.removeTab(tab, { animate: true });
          }
          break;
        }
        case "reset-unload-switch":
        case "unload-switch":
        case "reset-switch":
        case "switch":
          if (behavior.includes("unload")) {
            for (const tab of pinnedTabs) {
              if (tab.hasAttribute("glance-id")) {
                // We have a glance tab inside the tab we are trying to unload,
                // before we used to just ignore it but now we need to fully close
                // it as well.
                gZenGlanceManager.manageTabClose(tab.glanceTab);
                await new Promise((resolve) => {
                  let hasRan = false;
                  const onGlanceClose = () => {
                    hasRan = true;
                    resolve();
                  };
                  window.addEventListener("GlanceClose", onGlanceClose, { once: true });
                  // Set a timeout to resolve the promise if the event doesn't fire.
                  // We do this to prevent any future issues where glance woudnt close such as
                  // glance requering to ask for permit unload.
                  setTimeout(() => {
                    if (!hasRan) {
                      console.warn("GlanceClose event did not fire within 3 seconds");
                      resolve();
                    }
                  }, 3000);
                });
                return;
              }
              const isSpltView = tab.group?.hasAttribute("split-view-group");
              const group = isSpltView ? tab.group.group : tab.group;
              if (!folderToUnload && tab.hasAttribute("folder-active")) {
                await gZenFolders.animateUnload(group, tab);
              }
            }
            if (folderToUnload) {
              await gZenFolders.animateUnloadAll(folderToUnload);
            }
            const allAreUnloaded = pinnedTabs.every(
              (tab) => tab.hasAttribute("pending") && !tab.hasAttribute("zen-essential")
            );
            for (const tabItem of pinnedTabs) {
              if (allAreUnloaded && closeIfPending) {
                await this.onCloseTabShortcut(event, tabItem, { behavior: "close" });
                return;
              }
            }
            await gBrowser.explicitUnloadTabs(pinnedTabs);
            for (const tab of pinnedTabs) {
              tab.removeAttribute("discarded");
            }
          }
          if (selectedTabs.length) {
            this._handleTabSwitch(selectedTabs[0]);
          }
          if (behavior.includes("reset")) {
            for (const tab of pinnedTabs) {
              this._resetTabToStoredState(tab);
            }
          }
          break;
        case "reset":
          for (const tab of pinnedTabs) {
            this._resetTabToStoredState(tab);
          }
          break;
        default:
      }
    } catch (ex) {
      console.error("Error handling close tab shortcut for pinned tab:", ex);
    }
  }

  _handleTabSwitch(selectedTab) {
    if (selectedTab !== gBrowser.selectedTab) {
      return;
    }
    const findNextTab = (direction) =>
      gBrowser.tabContainer.findNextTab(selectedTab, {
        direction,
        filter: (tab) => !tab.hidden && !tab.pinned,
      });

    let nextTab = findNextTab(1) || findNextTab(-1);

    if (!nextTab) {
      gZenWorkspaces.selectEmptyTab();
      return;
    }

    if (nextTab) {
      gBrowser.selectedTab = nextTab;
    }
  }

  _resetTabToStoredState(tab) {
    const state = this.#getTabState(tab);

    const initialState = tab._zenPinnedInitialState;
    if (!initialState?.entry) {
      return;
    }

    // Remove everything except the entry we want to keep
    state.entries = [initialState.entry];

    state.image = tab.zenStaticIcon || initialState.image;
    state.index = 0;

    SessionStore.setTabState(tab, state);
    this.resetPinChangedUrl(tab);
  }

  async getFaviconAsBase64(pageUrl) {
    try {
      const faviconData = await PlacesUtils.favicons.getFaviconForPage(pageUrl);
      if (!faviconData) {
        // empty favicon
        return null;
      }
      return faviconData.dataURI;
    } catch (ex) {
      console.error("Failed to get favicon:", ex);
      return null;
    }
  }

  addToEssentials(tab) {
    // eslint-disable-next-line no-nested-ternary
    const tabs = tab
      ? // if it's already an array, dont make it [tab]
        tab?.length
        ? tab
        : [tab]
      : TabContextMenu.contextTab.multiselected
        ? gBrowser.selectedTabs
        : [TabContextMenu.contextTab];
    let movedAll = true;
    for (let i = 0; i < tabs.length; i++) {
      // eslint-disable-next-line no-shadow
      let tab = tabs[i];
      const section = gZenWorkspaces.getEssentialsSection(tab);
      if (!this.canEssentialBeAdded(tab)) {
        movedAll = false;
        continue;
      }
      if (tab.hasAttribute("zen-essential")) {
        continue;
      }
      tab.setAttribute("zen-essential", "true");
      if (tab.hasAttribute("zen-workspace-id")) {
        tab.removeAttribute("zen-workspace-id");
      }
      if (tab.pinned) {
        gBrowser.zenHandleTabMove(tab, () => {
          if (tab.ownerGlobal !== window) {
            tab = gBrowser.adoptTab(tab, {
              selectTab: tab.selected,
            });
            tab.setAttribute("zen-essential", "true");
          }
          section.appendChild(tab);
        });
      } else {
        gBrowser.pinTab(tab);
        this._ignoreNextTabPinnedEvent = true;
      }
      tab.setAttribute("zenDefaultUserContextId", true);
      if (tab.selected) {
        gZenWorkspaces.switchTabIfNeeded(tab);
      }
      this.onTabIconChanged(tab);
      // Dispatch the event to update the UI
      const event = new CustomEvent("TabAddedToEssentials", {
        detail: { tab },
        bubbles: true,
        cancelable: false,
      });
      tab.dispatchEvent(event);
    }
    gZenUIManager.updateTabsToolbar();
    return movedAll;
  }

  removeEssentials(tab, unpin = true) {
    // eslint-disable-next-line no-nested-ternary
    const tabs = tab
      ? [tab]
      : TabContextMenu.contextTab.multiselected
        ? gBrowser.selectedTabs
        : [TabContextMenu.contextTab];
    for (let i = 0; i < tabs.length; i++) {
      // eslint-disable-next-line no-shadow
      const tab = tabs[i];
      tab.removeAttribute("zen-essential");
      if (gZenWorkspaces.workspaceEnabled && gZenWorkspaces.getActiveWorkspaceFromCache().uuid) {
        tab.setAttribute("zen-workspace-id", gZenWorkspaces.getActiveWorkspaceFromCache().uuid);
      }
      if (unpin) {
        gBrowser.unpinTab(tab);
      } else {
        gBrowser.zenHandleTabMove(tab, () => {
          const pinContainer = gZenWorkspaces.pinnedTabsContainer;
          pinContainer.prepend(tab);
        });
      }
      // Dispatch the event to update the UI
      const event = new CustomEvent("TabRemovedFromEssentials", {
        detail: { tab },
        bubbles: true,
        cancelable: false,
      });
      tab.dispatchEvent(event);
    }
    gZenUIManager.updateTabsToolbar();
  }

  _insertItemsIntoTabContextMenu() {
    if (!this.enabled) {
      return;
    }
    const elements = window.MozXULElement.parseXULToFragment(`
            <menuseparator id="context_zen-pinned-tab-separator" hidden="true"/>
            <menuitem id="context_zen-replace-pinned-url-with-current"
                      data-lazy-l10n-id="tab-context-zen-replace-pinned-url-with-current"
                      hidden="true"
                      command="cmd_zenReplacePinnedUrlWithCurrent"/>
            <menuitem id="context_zen-reset-pinned-tab"
                      data-lazy-l10n-id="tab-context-zen-reset-pinned-tab"
                      hidden="true"
                      command="cmd_zenPinnedTabResetNoTab"/>
        `);
    document.getElementById("tabContextMenu").appendChild(elements);

    const element = window.MozXULElement.parseXULToFragment(`
            <menuitem id="context_zen-add-essential"
                      data-l10n-id="tab-context-zen-add-essential"
                      hidden="true"
                      disabled="true"
                      command="cmd_contextZenAddToEssentials"/>
            <menuitem id="context_zen-remove-essential"
                      data-lazy-l10n-id="tab-context-zen-remove-essential"
                      hidden="true"
                      command="cmd_contextZenRemoveFromEssentials"/>
            <menuseparator/>
            <menuitem id="context_zen-edit-tab-title"
                      data-lazy-l10n-id="tab-context-zen-edit-title"
                      hidden="true"/>
            <menuitem id="context_zen-edit-tab-icon"
                      data-lazy-l10n-id="tab-context-zen-edit-icon"/>
            <menuseparator/>
        `);

    document.getElementById("context_pinTab")?.before(element);
    document.getElementById("context_zen-edit-tab-title").addEventListener("command", (event) => {
      gZenVerticalTabsManager.renameTabStart(event);
    });
    document.getElementById("context_zen-edit-tab-icon").addEventListener("command", () => {
      const tab = TabContextMenu.contextTab;
      gZenEmojiPicker
        .open(tab.iconImage, { emojiAsSVG: true })
        .then((icon) => {
          if (icon) {
            tab.zenStaticIcon = icon;
          } else {
            delete tab.zenStaticIcon;
          }
          gBrowser.setIcon(tab, icon);
          lazy.TabStateCache.update(tab.permanentKey, {
            image: null,
          });
        })
        .catch((err) => {
          console.error(err);
        });
    });
  }

  updatePinnedTabContextMenu(contextTab) {
    if (!this.enabled) {
      document.getElementById("context_pinTab").hidden = true;
      return;
    }
    const isVisible = contextTab.pinned && !contextTab.multiselected;
    const isEssential = contextTab.getAttribute("zen-essential");
    const zenAddEssential = document.getElementById("context_zen-add-essential");
    document.getElementById("context_zen-reset-pinned-tab").hidden = !isVisible;
    document.getElementById("context_zen-replace-pinned-url-with-current").hidden = !isVisible;
    zenAddEssential.hidden = isEssential || !!contextTab.group;
    document.l10n
      .formatValue("tab-context-zen-add-essential-badge", {
        num: gBrowser._numZenEssentials,
        max: this.maxEssentialTabs,
      })
      .then((badgeText) => {
        zenAddEssential.setAttribute("badge", badgeText);
      });
    document
      .getElementById("cmd_contextZenAddToEssentials")
      .setAttribute("disabled", !this.canEssentialBeAdded(contextTab));
    document.getElementById("context_closeTab").hidden = contextTab.hasAttribute("zen-essential");
    document.getElementById("context_zen-remove-essential").hidden = !isEssential;
    document.getElementById("context_unpinTab").hidden =
      document.getElementById("context_unpinTab").hidden || isEssential;
    document.getElementById("context_unpinSelectedTabs").hidden =
      document.getElementById("context_unpinSelectedTabs").hidden || isEssential;
    document.getElementById("context_zen-pinned-tab-separator").hidden = !isVisible;
    document.getElementById("context_zen-edit-tab-title").hidden =
      isEssential ||
      !Services.prefs.getBoolPref("zen.tabs.rename-tabs") ||
      !gZenVerticalTabsManager._prefsSidebarExpanded;
  }

  // eslint-disable-next-line complexity
  moveToAnotherTabContainerIfNecessary(event, movingTabs) {
    if (!this.enabled) {
      return false;
    }
    movingTabs = movingTabs.map((tab) => {
      return tab.ownerGlobal !== window ? gBrowser.adoptTab(tab) : tab;
    });
    try {
      const pinnedTabsTarget = event.target.closest(
        ":is(.zen-current-workspace-indicator, .zen-workspace-pinned-tabs-section)"
      );
      const essentialTabsTarget = event.target.closest(".zen-essentials-container");
      const tabsTarget = !pinnedTabsTarget;

      // TODO: Solve the issue of adding a tab between two groups
      // Remove group labels from the moving tabs and replace it
      // with the sub tabs
      for (let i = 0; i < movingTabs.length; i++) {
        const draggedTab = movingTabs[i];
        if (gBrowser.isTabGroupLabel(draggedTab)) {
          const group = draggedTab.group;
          // remove label and add sub tabs to moving tabs
          if (group) {
            movingTabs.splice(i, 1, ...group.tabs);
          }
        }
      }

      let isVertical = this.expandedSidebarMode;
      let moved = false;
      let hasActuallyMoved;
      for (const draggedTab of movingTabs) {
        let isRegularTabs = false;
        // Check for essentials container
        if (essentialTabsTarget) {
          if (!draggedTab.hasAttribute("zen-essential") && !draggedTab?.group) {
            moved = true;
            isVertical = false;
            hasActuallyMoved = this.addToEssentials(draggedTab);
          }
        }
        // Check for pinned tabs container
        else if (pinnedTabsTarget) {
          if (!draggedTab.pinned) {
            gBrowser.pinTab(draggedTab);
          } else if (draggedTab.hasAttribute("zen-essential")) {
            this.removeEssentials(draggedTab, false);
            moved = true;
          }
        }
        // Check for normal tabs container
        else if (tabsTarget || event.target.id === "zen-tabs-wrapper") {
          if (draggedTab.pinned && !draggedTab.hasAttribute("zen-essential")) {
            gBrowser.unpinTab(draggedTab);
            isRegularTabs = true;
          } else if (draggedTab.hasAttribute("zen-essential")) {
            this.removeEssentials(draggedTab);
            moved = true;
            isRegularTabs = true;
          }
        }

        if (typeof hasActuallyMoved === "undefined") {
          hasActuallyMoved = moved;
        }

        // If the tab was moved, adjust its position relative to the target tab
        if (hasActuallyMoved) {
          const targetTab = event.target.closest(".tabbrowser-tab");
          const targetFolder = event.target.closest("zen-folder");
          let targetElem = targetTab || targetFolder?.labelElement;
          if (targetElem?.group?.activeGroups?.length > 0) {
            const activeGroup = targetElem.group.activeGroups.at(-1);
            targetElem = activeGroup.labelElement;
          }
          if (targetElem) {
            const rect = targetElem.getBoundingClientRect();
            let elementIndex = targetElem.elementIndex;

            if (isVertical || !this.expandedSidebarMode) {
              const middleY = targetElem.screenY + rect.height / 2;
              if (!isRegularTabs && event.screenY > middleY) {
                elementIndex++;
              } else if (isRegularTabs && event.screenY < middleY) {
                elementIndex--;
              }
            } else {
              const middleX = targetElem.screenX + rect.width / 2;
              if (event.screenX > middleX) {
                elementIndex++;
              }
            }
            // If it's the last tab, move it to the end
            if (tabsTarget === gBrowser.tabs.at(-1)) {
              elementIndex++;
            }

            gBrowser.moveTabTo(draggedTab, {
              elementIndex,
              forceUngrouped: targetElem?.group?.collapsed !== false,
            });
          }
        }
      }

      return moved;
    } catch (ex) {
      console.error("Error moving tabs:", ex);
      return false;
    }
  }

  onLocationChange(browser) {
    const tab = gBrowser.getTabForBrowser(browser);
    if (
      !tab ||
      !tab.pinned ||
      tab.hasAttribute("zen-essential") ||
      !tab._zenPinnedInitialState?.entry
    ) {
      return;
    }
    // Remove # and ? from the URL
    const pinUrl = tab._zenPinnedInitialState.entry.url.split("#")[0];
    const currentUrl = browser.currentURI.spec.split("#")[0];
    // Add an indicator that the pin has been changed
    if (pinUrl === currentUrl) {
      this.resetPinChangedUrl(tab);
      return;
    }
    this.pinHasChangedUrl(tab);
  }

  resetPinChangedUrl(tab) {
    if (!tab.hasAttribute("zen-pinned-changed")) {
      return;
    }
    tab.removeAttribute("zen-pinned-changed");
    tab.removeAttribute("had-zen-pinned-changed");
    tab.style.removeProperty("--zen-original-tab-icon");
  }

  pinHasChangedUrl(tab) {
    if (tab.hasAttribute("zen-pinned-changed")) {
      return;
    }
    if (tab.group?.hasAttribute("split-view-group")) {
      tab.setAttribute("had-zen-pinned-changed", "true");
    } else {
      tab.setAttribute("zen-pinned-changed", "true");
    }
    tab.style.setProperty("--zen-original-tab-icon", `url(${tab._zenPinnedInitialState.image})`);
  }

  removeTabContainersDragoverClass(hideIndicator = true) {
    this.dragIndicator.remove();
    this._dragIndicator = null;
    if (hideIndicator) {
      gZenWorkspaces.activeWorkspaceIndicator?.removeAttribute("open");
    }
  }

  get dragIndicator() {
    if (!this._dragIndicator) {
      this._dragIndicator = document.createElement("div");
      this._dragIndicator.id = "zen-drag-indicator";
      gNavToolbox.appendChild(this._dragIndicator);
    }
    return this._dragIndicator;
  }

  get expandedSidebarMode() {
    return document.documentElement.getAttribute("zen-sidebar-expanded") === "true";
  }

  canEssentialBeAdded(tab) {
    return (
      !(
        (tab.getAttribute("usercontextid") || 0) !=
          gZenWorkspaces.getActiveWorkspaceFromCache().containerTabId &&
        gZenWorkspaces.containerSpecificEssentials
      ) && gBrowser._numZenEssentials < this.maxEssentialTabs
    );
  }

  // eslint-disable-next-line complexity
  applyDragoverClass(event, draggedTab) {
    if (!this.enabled) {
      return;
    }
    let isVertical = this.expandedSidebarMode;
    if (
      gBrowser.isTabGroupLabel(draggedTab) &&
      !draggedTab?.group?.hasAttribute("split-view-group")
    ) {
      // If the target is a tab group label, we don't want to apply the dragover class
      this.removeTabContainersDragoverClass();
      return;
    }
    const pinnedTabsTarget = event.target.closest(".zen-workspace-pinned-tabs-section");
    const essentialTabsTarget = event.target.closest(".zen-essentials-container");
    const tabsTarget = event.target.closest(".zen-workspace-normal-tabs-section");
    const folderTarget = event.target.closest("zen-folder");
    let targetTab = event.target.closest(".tabbrowser-tab");
    targetTab = targetTab?.group || targetTab;
    draggedTab = draggedTab?.group?.hasAttribute("split-view-group")
      ? draggedTab.group
      : draggedTab;
    const isHoveringIndicator = !!event.target.closest(".zen-current-workspace-indicator");
    if (isHoveringIndicator) {
      this.removeTabContainersDragoverClass(false);
      gZenWorkspaces.activeWorkspaceIndicator?.setAttribute("open", true);
    } else {
      gZenWorkspaces.activeWorkspaceIndicator?.removeAttribute("open");
    }

    if (draggedTab?._dragData?.movingTabs) {
      gZenFolders.ungroupTabsFromActiveGroups(draggedTab._dragData.movingTabs);
    }

    let shouldAddDragOverElement = false;

    // Decide whether we should show a dragover class for the given target
    if (essentialTabsTarget) {
      if (!draggedTab.hasAttribute("zen-essential") && this.canEssentialBeAdded(draggedTab)) {
        shouldAddDragOverElement = true;
        isVertical = false;
      }
    } else if (pinnedTabsTarget) {
      if (draggedTab.hasAttribute("zen-essential")) {
        shouldAddDragOverElement = true;
      }
    } else if (tabsTarget) {
      if (draggedTab.hasAttribute("zen-essential")) {
        shouldAddDragOverElement = true;
      }
    }

    if (!shouldAddDragOverElement || (!targetTab && !folderTarget) || !targetTab) {
      this.removeTabContainersDragoverClass(!isHoveringIndicator);
      return;
    }

    // Calculate middle to decide 'before' or 'after'
    const rect = targetTab.getBoundingClientRect();
    let shouldPlayHapticFeedback = false;
    if (isVertical || !this.expandedSidebarMode) {
      const separation = 8;
      const middleY = targetTab.screenY + rect.height / 2;
      const indicator = this.dragIndicator;
      // eslint-disable-next-line no-shadow
      let top = 0;
      if (event.screenY > middleY) {
        top = Math.round(rect.top + rect.height) + "px";
      } else {
        top = Math.round(rect.top) + "px";
      }
      if (indicator.style.top !== top) {
        shouldPlayHapticFeedback = true;
      }
      indicator.setAttribute("orientation", "horizontal");
      indicator.style.setProperty("--indicator-left", rect.left + separation / 2 + "px");
      indicator.style.setProperty("--indicator-width", rect.width - separation + "px");
      indicator.style.top = top;
      indicator.style.removeProperty("left");
    } else {
      const separation = 8;
      const middleX = targetTab.screenX + rect.width / 2;
      const indicator = this.dragIndicator;
      let left = 0;
      if (event.screenX > middleX) {
        left = Math.round(rect.left + rect.width + 1) + "px";
      } else {
        left = Math.round(rect.left - 2) + "px";
      }
      if (indicator.style.left !== left) {
        shouldPlayHapticFeedback = true;
      }
      indicator.setAttribute("orientation", "vertical");
      indicator.style.setProperty("--indicator-top", rect.top + separation / 2 + "px");
      indicator.style.setProperty("--indicator-height", rect.height - separation + "px");
      indicator.style.left = left;
      indicator.style.removeProperty("top");
    }
    if (shouldPlayHapticFeedback) {
      // eslint-disable-next-line mozilla/valid-services
      Services.zen.playHapticFeedback();
    }
  }

  onTabLabelChanged(tab) {
    tab.dispatchEvent(new CustomEvent("ZenTabLabelChanged", { bubbles: true, detail: { tab } }));
  }
}

window.gZenPinnedTabManager = new nsZenPinnedTabManager();
