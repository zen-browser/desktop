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
      TabStateCache:
        "moz-src:///browser/components/sessionstore/TabStateCache.sys.mjs",
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
    this._canLog = Services.prefs.getBoolPref(
      "zen.pinned-tab-manager.debug",
      false
    );
    this.observer = new ZenPinnedTabsObserver();
    this._initClosePinnedTabShortcut();
    this._insertItemsIntoTabContextMenu();
    this._initTabProtection();
    this.observer.addPinnedTabListener(this._onPinnedTabEvent.bind(this));

    this._zenClickEventListener = this._onTabClick.bind(this);

    gZenWorkspaces._resolvePinnedInitialized();
    gZenWorkspaces.promiseInitialized.then(() => {
      gBrowser.addTabsProgressListener(this);
      if (lazy.zenPinnedTabRestorePinnedTabsToPinnedUrl) {
        for (const tab of gZenWorkspaces.allStoredTabs) {
          try {
            this.resetPinnedTab(tab);
          } catch (ex) {
            console.error("Error restoring pinned tab:", ex);
          }
        }
      }
    });
  }

  get tabProtectionEnabled() {
    return Services.prefs.getBoolPref(
      "zen.pinned-tab-manager.protect-pinned-essentials",
      false
    );
  }

  get tabProtectionLocked() {
    return (
      this.tabProtectionEnabled &&
      Services.prefs.getBoolPref(
        "zen.pinned-tab-manager.protected-tabs-locked",
        true
      )
    );
  }

  isProtectedTab(tab) {
    return Boolean(tab?.pinned || tab?.hasAttribute?.("zen-essential"));
  }

  _protectionTabs(items) {
    const tabs = [];
    const seen = new Set();
    const visit = item => {
      if (!item || seen.has(item)) {
        return;
      }
      seen.add(item);
      if (gBrowser.isTab(item)) {
        tabs.push(item);
        return;
      }
      if (item.tabs && typeof item.tabs[Symbol.iterator] === "function") {
        for (const tab of item.tabs) {
          visit(tab);
        }
        return;
      }
      if (
        item.group?.tabs &&
        typeof item.group.tabs[Symbol.iterator] === "function"
      ) {
        for (const tab of item.group.tabs) {
          visit(tab);
        }
        return;
      }
      if (item.splitview) {
        visit(item.splitview);
      }
    };
    for (const item of items ?? []) {
      visit(item);
    }
    return tabs;
  }

  _isProtectionTeardown(tab) {
    if (Services.startup?.shuttingDown) {
      return true;
    }
    const ownerWindow = tab?.documentGlobal ?? window;
    if (ownerWindow?.closed) {
      return true;
    }
    if (ownerWindow?.skipNextCanClose) {
      return true;
    }
    if (ownerWindow?.gZenWorkspaces?._isClosingWindow) {
      return true;
    }
    if (tab?.closing) {
      return true;
    }
    return false;
  }

  canPerformProtectedAction(item, action) {
    if (!this.tabProtectionLocked) {
      return true;
    }
    const tabs = this._protectionTabs([item]);
    const protectedTabs = tabs.filter(tab => this.isProtectedTab(tab));
    if (!protectedTabs.length) {
      return true;
    }
    const authorization = this._protectionAuthorization;
    return protectedTabs.every(
      tab =>
        this._isProtectionTeardown(tab) ||
        (authorization?.tabs.has(tab) && authorization.actions.has(action))
    );
  }

  withAuthorizedTabs(items, actions, callback) {
    const previous = this._protectionAuthorization;
    this._protectionAuthorization = {
      tabs: new Set(this._protectionTabs(items)),
      actions: new Set(actions),
    };
    try {
      return callback();
    } finally {
      this._protectionAuthorization = previous;
    }
  }

  _syncTabProtectionUI() {
    if (window.closed) {
      return true;
    }
    try {
      if (!this.tabProtectionEnabled) {
        document.documentElement.removeAttribute("zen-protected-tabs");
      } else {
        document.documentElement.setAttribute(
          "zen-protected-tabs",
          this.tabProtectionLocked ? "locked" : "unlocked"
        );
      }
      const checkbox = document.getElementById(
        "context_zen-protect-pinned-essentials"
      );
      if (checkbox) {
        const locked = this.tabProtectionLocked;
        checkbox.checked = locked;
        checkbox.setAttribute("checked", String(locked));
        const l10nId = locked
          ? "tab-context-zen-protect-pinned-essentials"
          : "tab-context-zen-protect-pinned-essentials-unlocked";
        if (typeof document.l10n?.setAttributes === "function") {
          document.l10n.setAttributes(checkbox, l10nId);
        } else {
          checkbox.setAttribute("data-l10n-id", l10nId);
        }
        if (!this.tabProtectionEnabled) {
          checkbox.hidden = true;
        }
      }
      if (window.TabContextMenu?.contextTab) {
        this.updatePinnedTabContextMenu(window.TabContextMenu.contextTab);
      }
      return true;
    } catch (error) {
      console.error("Failed to update protected-tab UI:", error);
      return false;
    }
  }

  _syncAllTabProtectionWindows() {
    let ok = true;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      try {
        const manager = win.gZenPinnedTabManager;
        if (!manager) {
          continue;
        }
        if (!manager._syncTabProtectionUI()) {
          ok = false;
        }
      } catch (error) {
        console.error("Failed to sync protected-tab UI:", error);
        ok = false;
      }
    }
    return ok;
  }

  setTabProtectionLocked(next) {
    if (!this.tabProtectionEnabled) {
      return false;
    }
    const pref = "zen.pinned-tab-manager.protected-tabs-locked";
    const previous = Services.prefs.getBoolPref(pref, true);
    const value = Boolean(next);
    if (previous === value) {
      return this._syncAllTabProtectionWindows();
    }
    try {
      Services.prefs.setBoolPref(pref, value);
    } catch (error) {
      console.error("Failed to write protected-tab state:", error);
      this._syncAllTabProtectionWindows();
      return false;
    }
    if (this._syncAllTabProtectionWindows()) {
      return true;
    }
    try {
      Services.prefs.setBoolPref(pref, previous);
    } catch (error) {
      console.error("Failed to revert protected-tab state:", error);
    }
    this._syncAllTabProtectionWindows();
    return false;
  }

  _initTabProtection() {
    const prefs = [
      "zen.pinned-tab-manager.protect-pinned-essentials",
      "zen.pinned-tab-manager.protected-tabs-locked",
    ];
    const observer = {
      observe: () => {
        if (!this._syncTabProtectionUI()) {
          console.error(
            "Protected-tab state could not be applied to this window"
          );
        }
      },
    };
    for (const pref of prefs) {
      Services.prefs.addObserver(pref, observer);
    }
    const item = document.getElementById(
      "context_zen-protect-pinned-essentials"
    );
    const onCommand = event => {
      this.setTabProtectionLocked(Boolean(event.currentTarget.checked));
    };
    item?.addEventListener("command", onCommand);
    window.addEventListener(
      "unload",
      () => {
        for (const pref of prefs) {
          Services.prefs.removeObserver(pref, observer);
        }
        item?.removeEventListener("command", onCommand);
      },
      { once: true }
    );
    this._syncTabProtectionUI();
  }

  // Reject unsafe category, workspace, container and cross-window drops
  // before Zen adopts or mutates any source tab.
  shouldBlockProtectedDrop(
    event,
    draggedTab,
    movingTabs = [],
    { splitDropReady = false } = {}
  ) {
    if (!this.tabProtectionLocked) {
      return false;
    }
    const tabs = this._protectionTabs([draggedTab, ...(movingTabs || [])]);
    const targetTab = event.target?.closest?.(".tabbrowser-tab");
    const targetProtected = this._protectionTabs([targetTab]).some(tab =>
      this.isProtectedTab(tab)
    );
    const sourceProtected = tabs.some(tab => this.isProtectedTab(tab));
    if (!sourceProtected && !targetProtected) {
      return false;
    }
    if (splitDropReady && (sourceProtected || targetProtected)) {
      return true;
    }
    if (!sourceProtected) {
      return false;
    }
    if (tabs.some(tab => tab?.documentGlobal !== window)) {
      return true;
    }
    const targetWorkspace = event.target
      ?.closest?.("[zen-workspace-id]")
      ?.getAttribute?.("zen-workspace-id");
    if (targetWorkspace && targetWorkspace !== gZenWorkspaces.activeWorkspace) {
      return true;
    }
    const essentialZone = event.target?.closest?.(".zen-essentials-container");
    const pinnedZone = event.target?.closest?.(
      ":is(.zen-current-workspace-indicator, .zen-workspace-pinned-tabs-section)"
    );
    if (essentialZone) {
      const contextId =
        gZenWorkspaces.getActiveWorkspaceFromCache().containerTabId || 0;
      return tabs.some(
        tab =>
          !tab?.hasAttribute?.("zen-essential") ||
          (gZenWorkspaces.containerSpecificEssentials &&
            (tab.getAttribute("usercontextid") || 0) != contextId)
      );
    }
    if (pinnedZone) {
      return tabs.some(
        tab =>
          !tab?.pinned ||
          tab.hasAttribute("zen-essential") ||
          tab.getAttribute("zen-workspace-id") != gZenWorkspaces.activeWorkspace
      );
    }
    // Unknown targets are not assumed to be safe for protected tabs.
    return true;
  }

  shouldBlockProtectedSplitComposition(sourceTabs = [], targetTab = null) {
    if (!this.tabProtectionLocked) {
      return false;
    }
    const items = Array.isArray(sourceTabs) ? [...sourceTabs] : [sourceTabs];
    items.push(targetTab);
    return this._protectionTabs(items).some(tab => this.isProtectedTab(tab));
  }

  shouldBlockProtectedDetach(contextTab, movingTabs = []) {
    if (!this.tabProtectionLocked) {
      return false;
    }
    const items = contextTab?.multiselected
      ? [...(gBrowser.selectedElements ?? gBrowser.selectedTabs ?? [])]
      : [contextTab, ...(movingTabs || [])];
    return this._protectionTabs(items).some(tab => this.isProtectedTab(tab));
  }

  log(message) {
    if (this._canLog) {
      /* eslint-disable-next-line no-console */
      console.log(`[ZenPinnedTabManager] ${message}`);
    }
  }

  onTabIconChanged(tab, url = null) {
    tab.dispatchEvent(
      new CustomEvent("ZenTabIconChanged", { bubbles: true, detail: { tab } })
    );
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
    if (event.getModifierState("Accel")) {
      let newTab = gBrowser.duplicateTab(tab, true);
      newTab.addEventListener(
        "SSTabRestored",
        () => {
          this.#resetTabToStoredState(tab);
        },
        { once: true }
      );
    } else {
      this.#resetTabToStoredState(tab);
    }
    gBrowser.selectedTab = tab;
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
        this.resetPinChangedUrl(tab);
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
        closeIfPending: Services.prefs.getBoolPref(
          "zen.pinned-tab-manager.wheel-close-if-pending"
        ),
      });
    }
  }

  _onAccelKeyChange(e) {
    let tab = this._tabWithResetPinButtonHovered;
    if (!tab) {
      return;
    }
    let accelHeld =
      e.getModifierState("Accel") || (e.metaKey && e.type == "keydown");
    this._setResetPinSublabel(tab, accelHeld);
    // Up <-> down events until the mouse leaves the button.
    // When hovered with accelHeld, we should listen to the next keyup event
    let nextEvent = accelHeld ? "keyup" : "keydown";
    let handler = nextE => this._onAccelKeyChange(nextE);
    window.addEventListener(nextEvent, handler, { once: true });
  }

  _setResetPinSublabel(tab, accelHeld) {
    let label = tab.querySelector(".zen-tab-sublabel");
    const getLabel = b => (b ? "zen-default-pinned-cmd" : "zen-default-pinned");
    // We might not want to change the sublabel if it was already customized by,
    // for example, live folders, so only change it if it's currently the default one.
    if (
      document.l10n.getAttributes(label).args.tabSubtitle !=
      getLabel(!accelHeld)
    ) {
      return;
    }
    document.l10n.setArgs(label, {
      tabSubtitle: getLabel(accelHeld),
    });
  }

  onResetPinButtonMouseOver(tab, event) {
    this._tabWithResetPinButtonHovered = tab;
    this._onAccelKeyChange(event);
  }

  onResetPinButtonMouseOut(tab) {
    this._setResetPinSublabel(tab, false);
    delete this._tabWithResetPinButtonHovered;
  }

  resetPinnedTab(tab) {
    if (!tab) {
      tab = TabContextMenu.contextTab;
    }

    if (!tab || !tab.pinned) {
      return;
    }

    this.#resetTabToStoredState(tab);
  }

  replacePinnedUrlWithCurrent(tab = undefined) {
    tab ??= TabContextMenu.contextTab;
    if (!tab || !tab.pinned) {
      return;
    }

    window.gZenWindowSync.setPinnedTabState(tab);
    this.resetPinChangedUrl(tab);
    gZenUIManager.showToast("zen-pinned-tab-replaced");
  }

  async editPinnedUrl(tab = undefined) {
    tab ??= TabContextMenu.contextTab;
    if (!tab || !tab.pinned) {
      return;
    }

    const initialUrl =
      tab._zenPinnedInitialState?.entry?.url ||
      tab.linkedBrowser?.currentURI?.spec;
    const [title, label] = await document.l10n.formatValues([
      { id: "zen-pinned-tab-edit-url-title" },
      { id: "zen-pinned-tab-edit-url-label" },
    ]);
    const result = { value: initialUrl ?? "" };
    const confirmed = Services.prompt.prompt(
      window,
      title,
      label,
      result,
      null,
      { value: false }
    );
    if (!confirmed) {
      return;
    }

    let uri;
    try {
      uri = Services.uriFixup.getFixupURIInfo(
        result.value.trim(),
        Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS
      ).preferredURI;
    } catch (_) {}
    if (!uri) {
      gZenUIManager.showToast("zen-pinned-tab-url-invalid");
      return;
    }
    const url = uri.spec;

    // Skip when the value wasn't actually changed from what was prefilled.
    if (!url || url === initialUrl) {
      return;
    }

    const image = tab.zenStaticIcon || (await this.#getCachedFavicon(uri));
    window.gZenWindowSync.setPinnedUrl(tab, url, image);
    this.#resetTabToStoredState(tab);
    gZenUIManager.showToast("zen-pinned-tab-url-edited");
  }

  async #getCachedFavicon(uri) {
    try {
      const favicon = await PlacesUtils.favicons.getFaviconForPage(uri);
      return favicon?.dataURI?.spec;
    } catch (ex) {
      console.error("Failed to get favicon for edited pinned url:", ex);
      return null;
    }
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
            .flatMap(tab => {
              if (tab.group?.hasAttribute("split-view-group")) {
                return tab.group.tabs;
              }
              return tab;
            })
            .filter(tab => tab?.pinned)
        ),
      ];

      if (!pinnedTabs.length) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      if (
        behavior === "close" &&
        pinnedTabs.some(tab => !this.canPerformProtectedAction(tab, "close"))
      ) {
        return;
      }

      if (noClose && behavior === "close") {
        behavior = "unload-switch";
      }

      if (
        alwaysUnload &&
        ["close", "reset", "switch", "reset-switch"].includes(behavior)
      ) {
        behavior = behavior.includes("reset")
          ? "reset-unload-switch"
          : "unload-switch";
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
            if (pinnedTabs.some(tab => tab.selected)) {
              const selectedTabs = pinnedTabs.filter(tab => tab.selected);
              const tabToBlurTo = gBrowser._findTabToBlurTo(
                selectedTabs[0],
                pinnedTabs
              );
              gBrowser.selectedTab = tabToBlurTo;
            }
            for (const tab of pinnedTabs) {
              if (tab.hasAttribute("glance-id")) {
                // We have a glance tab inside the tab we are trying to unload,
                // before we used to just ignore it but now we need to fully close
                // it as well.
                gZenGlanceManager.manageTabClose(tab.glanceTab);
                await new Promise(resolve => {
                  let hasRan = false;
                  const onGlanceClose = () => {
                    hasRan = true;
                    resolve();
                  };
                  window.addEventListener("GlanceClose", onGlanceClose, {
                    once: true,
                  });
                  // Set a timeout to resolve the promise if the event doesn't fire.
                  // We do this to prevent any future issues where glance woudnt close such as
                  // glance requering to ask for permit unload.
                  setTimeout(() => {
                    if (!hasRan) {
                      console.warn(
                        "GlanceClose event did not fire within 3 seconds"
                      );
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
              tab =>
                tab.hasAttribute("pending") &&
                !tab.hasAttribute("zen-essential")
            );
            for (const tabItem of pinnedTabs) {
              if (allAreUnloaded && closeIfPending) {
                await this.onCloseTabShortcut(event, tabItem, {
                  behavior: "close",
                });
                return;
              }
            }
            let successful = await gBrowser.explicitUnloadTabs(pinnedTabs);
            if (!successful) {
              return;
            }
            for (const tab of pinnedTabs) {
              tab.removeAttribute("discarded");
            }
          } else if (pinnedTabs.some(tab => tab.selected)) {
            const selectedTabs = pinnedTabs.filter(tab => tab.selected);
            gBrowser.selectedTab = gBrowser._findTabToBlurTo(
              selectedTabs[0],
              selectedTabs
            );
          }
          if (behavior.includes("reset")) {
            for (const tab of pinnedTabs) {
              this.#resetTabToStoredState(tab);
            }
          }
          break;
        case "reset":
          for (const tab of pinnedTabs) {
            this.#resetTabToStoredState(tab);
          }
          break;
        default:
      }
    } catch (ex) {
      console.error("Error handling close tab shortcut for pinned tab:", ex);
    }
  }

  #resetTabToStoredState(tab) {
    const state = this.#getTabState(tab);

    const initialState = tab._zenPinnedInitialState;
    if (!initialState?.entry) {
      return;
    }

    // Remove everything except the entry we want to keep
    let url;
    try {
      url = Services.io.newURI(initialState.entry.url);
    } catch {}
    state.entries = [
      {
        ...initialState.entry,
        triggeringPrincipal_base64: E10SUtils.serializePrincipal(
          url
            ? Services.scriptSecurityManager.createContentPrincipal(url, {})
            : Services.scriptSecurityManager.createNullPrincipal()
        ),
      },
    ];

    state.image = tab.zenStaticIcon || initialState.image;
    state.index = 0;

    // See gh-13024, we need to remove the scroll position from the state,
    // otherwise when we reset the pinned tab, it will scroll to the previous position
    // which can be confusing for the user, especially if they have a long page.
    delete state.scroll;

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

  addToEssentials(tab, { replicating = false } = {}) {
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
      // canEssentialBeAdded gates user-initiated adds on the *active* space's
      // container. A replicated add mirrors a decision already made in another
      // window or on another device, always into the tab's own container
      // section.
      if (!replicating && !this.canEssentialBeAdded(tab)) {
        this.log(`addToEssentials rejected for ${tab.id}`);
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
          if (tab.documentGlobal !== window) {
            tab = gBrowser.adoptTab(tab, {
              selectTab: tab.selected,
            });
            tab.setAttribute("zen-essential", "true");
          }
          section.appendChild(tab);
        });
      } else {
        gBrowser.pinTab(tab);
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
    if (
      tabs.some(
        candidate =>
          !this.canPerformProtectedAction(candidate, "remove-essential")
      )
    ) {
      return false;
    }
    for (const targetTab of tabs) {
      if (this._canLog) {
        // eslint-disable-next-line no-console
        console.trace(
          `ZenPinnedTabManager: removing tab ${targetTab.id} from essentials ` +
            `(unpin=${unpin})`
        );
      }
      targetTab.removeAttribute("zen-essential");
      if (
        gZenWorkspaces.workspaceEnabled &&
        gZenWorkspaces.getActiveWorkspaceFromCache().uuid
      ) {
        targetTab.setAttribute(
          "zen-workspace-id",
          gZenWorkspaces.getActiveWorkspaceFromCache().uuid
        );
      }
      if (unpin) {
        gBrowser.unpinTab(targetTab);
      } else {
        gBrowser.zenHandleTabMove(targetTab, () => {
          const pinContainer = gZenWorkspaces.pinnedTabsContainer;
          pinContainer.prepend(targetTab);
        });
      }
      // Dispatch the event to update the UI
      const event = new CustomEvent("TabRemovedFromEssentials", {
        detail: { tab: targetTab },
        bubbles: true,
        cancelable: false,
      });
      targetTab.dispatchEvent(event);
    }
    gZenUIManager.updateTabsToolbar();
    return true;
  }

  static PROTECTED_BLOCKED_ATTR = "zen-protected-blocked";

  _insertItemsIntoTabContextMenu() {
    if (!this.enabled) {
      return;
    }
    const elements = window.MozXULElement.parseXULToFragment(`
            <menuseparator id="context_zen-pinned-tab-separator" hidden="true"/>
            <menu id="context_zen-edit-pinned-page"
                  data-lazy-l10n-id="tab-context-zen-edit-pinned-page"
                  data-l10n-args="{&quot;isEssential&quot;:&quot;&quot;}"
                  hidden="true">
              <menupopup>
                <menuitem id="context_zen-replace-pinned-url-with-current"
                          data-lazy-l10n-id="tab-context-zen-replace-pinned-url-with-current"
                          data-l10n-args="{&quot;isEssential&quot;:&quot;&quot;}"
                          command="cmd_zenReplacePinnedUrlWithCurrent"/>
                <menuitem id="context_zen-edit-pinned-url"
                          data-lazy-l10n-id="tab-context-zen-edit-pinned-url"
                          command="cmd_zenEditPinnedUrl"/>
              </menupopup>
            </menu>
            <menuitem id="context_zen-reset-pinned-tab"
                      data-lazy-l10n-id="tab-context-zen-reset-pinned-tab"
                      data-l10n-args="{&quot;isEssential&quot;:&quot;&quot;}"
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
            <menuseparator id="context_zen-protection-separator" hidden="true"/>
            <menuitem id="context_zen-protect-pinned-essentials"
                      type="checkbox"
                      data-l10n-id="tab-context-zen-protect-pinned-essentials"
                      hidden="true"/>
            <menuseparator/>
            <menuitem id="context_zen-edit-tab-title"
                      data-lazy-l10n-id="tab-context-zen-edit-title"
                      hidden="true"/>
            <menuitem id="context_zen-edit-tab-icon"
                      data-lazy-l10n-id="tab-context-zen-edit-icon"/>
            <menuseparator/>
        `);

    document.getElementById("context_pinTab")?.before(element);
    document
      .getElementById("context_zen-edit-tab-title")
      .addEventListener("command", event => {
        gZenTabRenamer.start(event);
      });
    document
      .getElementById("context_zen-edit-tab-icon")
      .addEventListener("command", () => {
        const tab = TabContextMenu.contextTab;
        gZenEmojiPicker.open(tab.iconImage, {
          emojiAsSVG: true,
          closeOnSelect: false,
          allowNone: Boolean(tab.zenStaticIcon),
          onSelect: icon => {
            if (icon) {
              tab.zenStaticIcon = icon;
            } else {
              delete tab.zenStaticIcon;
            }
            gBrowser.setIcon(tab, icon);
            lazy.TabStateCache.update(tab.permanentKey, {
              image: icon || null,
            });
          },
        });
      });
  }

  updatePinnedTabContextMenu(contextTab) {
    if (!this.enabled) {
      document.getElementById("context_pinTab").hidden = true;
      return;
    }
    const isVisible = contextTab.pinned && !contextTab.multiselected;
    const protectedSelection = contextTab.multiselected
      ? gBrowser.selectedTabs.some(tab => this.isProtectedTab(tab))
      : this.isProtectedTab(contextTab);
    const isLocked = this.tabProtectionLocked && protectedSelection;
    const showProtection = this.tabProtectionEnabled && protectedSelection;
    const protectionItem = document.getElementById(
      "context_zen-protect-pinned-essentials"
    );
    protectionItem.hidden = !showProtection;
    protectionItem.checked = this.tabProtectionLocked;
    protectionItem.setAttribute("checked", String(this.tabProtectionLocked));
    const protectionL10nId = this.tabProtectionLocked
      ? "tab-context-zen-protect-pinned-essentials"
      : "tab-context-zen-protect-pinned-essentials-unlocked";
    if (typeof document.l10n?.setAttributes === "function") {
      document.l10n.setAttributes(protectionItem, protectionL10nId);
    } else {
      protectionItem.setAttribute("data-l10n-id", protectionL10nId);
    }
    document.getElementById("context_zen-protection-separator").hidden =
      !showProtection;
    const isEssential = contextTab.getAttribute("zen-essential");
    const zenAddEssential = document.getElementById(
      "context_zen-add-essential"
    );
    const zenResetPinnedTab = document.getElementById(
      "context_zen-reset-pinned-tab"
    );
    const zenEditPinnedPage = document.getElementById(
      "context_zen-edit-pinned-page"
    );
    const zenReplacePinnedUrl = document.getElementById(
      "context_zen-replace-pinned-url-with-current"
    );
    [zenResetPinnedTab, zenEditPinnedPage].forEach(element => {
      if (element) {
        element.hidden = !isVisible;
      }
    });
    [zenResetPinnedTab, zenEditPinnedPage, zenReplacePinnedUrl].forEach(
      element => {
        if (element) {
          document.l10n.setArgs(element, { isEssential });
        }
      }
    );
    zenAddEssential.hidden = isEssential || !!contextTab.group;
    document.l10n
      .formatValue("tab-context-zen-add-essential-badge", {
        num: gBrowser._numZenEssentials,
        max: this.maxEssentialTabs,
      })
      .then(badgeText => {
        zenAddEssential.setAttribute("badge", badgeText);
      });
    document
      .getElementById("cmd_contextZenAddToEssentials")
      .toggleAttribute("disabled", !this.canEssentialBeAdded(contextTab));
    // Keep Zen's original visibility decisions as the baseline. Protection
    // adds a scoped CSS block on top; it must not overwrite these native
    // hidden states.
    document.getElementById("context_closeTab").hidden =
      contextTab.hasAttribute("zen-essential");
    document.getElementById("context_zen-remove-essential").hidden =
      !isEssential;
    document.getElementById("context_unpinTab").hidden =
      document.getElementById("context_unpinTab").hidden || isEssential;
    document.getElementById("context_unpinSelectedTabs").hidden =
      document.getElementById("context_unpinSelectedTabs").hidden ||
      isEssential;
    for (const id of [
      "context_closeTab",
      "context_unpinTab",
      "context_unpinSelectedTabs",
      "context_zen-remove-essential",
    ]) {
      document
        .getElementById(id)
        ?.removeAttribute(nsZenPinnedTabManager.PROTECTED_BLOCKED_ATTR);
    }
    if (isLocked) {
      for (const id of [
        "context_closeTab",
        "context_unpinTab",
        "context_unpinSelectedTabs",
        "context_zen-remove-essential",
      ]) {
        document
          .getElementById(id)
          ?.setAttribute(nsZenPinnedTabManager.PROTECTED_BLOCKED_ATTR, "true");
      }
    }
    document.getElementById("context_zen-pinned-tab-separator").hidden =
      !isVisible;
    document.getElementById("context_zen-edit-tab-title").hidden =
      isEssential ||
      !Services.prefs.getBoolPref("zen.tabs.rename-tabs") ||
      !gZenVerticalTabsManager._prefsSidebarExpanded;
  }

  // eslint-disable-next-line complexity
  moveToAnotherTabContainerIfNecessary(
    event,
    draggedTab,
    movingTabs,
    dropIndex
  ) {
    if (this.shouldBlockProtectedDrop(event, draggedTab, movingTabs)) {
      return null;
    }
    let newIndex = dropIndex;
    let fromDifferentWindow = false;
    let ownedTabs = Array.from(movingTabs || draggedTab)
      .reverse()
      .map(tab => {
        if (!gBrowser.isTab(tab)) {
          return tab;
        }
        let workspaceId;
        if (
          !tab.hasAttribute("zen-essential") &&
          tab.getAttribute("zen-workspace-id") != gZenWorkspaces.activeWorkspace
        ) {
          workspaceId = gZenWorkspaces.activeWorkspace;
        }
        if (tab.documentGlobal !== window) {
          fromDifferentWindow = true;
          if (workspaceId) {
            tab.documentGlobal.gBrowser.selectedTab =
              tab.documentGlobal.gBrowser._findTabToBlurTo(tab, movingTabs);
            tab.documentGlobal.gZenWorkspaces.moveTabToWorkspace(
              tab,
              workspaceId
            );
          }
          // Move the tabs into this window. To avoid multiple tab-switches in
          // the original window, the selected tab should be adopted last.
          tab = gBrowser.adoptTab(tab, {
            elementIndex: newIndex,
            selectTab: tab == draggedTab,
            spaceId: workspaceId,
          });
          if (tab) {
            ++newIndex;
          }
        }
        if (workspaceId) {
          tab.setAttribute("zen-workspace-id", workspaceId);
        }
        return tab;
      });
    if (!fromDifferentWindow) {
      // See gh-13796 and gh-12156
      ownedTabs = ownedTabs.reverse();
    }
    movingTabs = [...ownedTabs];
    if (fromDifferentWindow) {
      gBrowser.addRangeToMultiSelectedTabs(
        gBrowser.tabContainer.dragAndDropElements[dropIndex],
        gBrowser.tabContainer.dragAndDropElements[newIndex - 1]
      );
    }
    try {
      const pinnedTabsTarget = event.target.closest(
        ":is(.zen-current-workspace-indicator, .zen-workspace-pinned-tabs-section)"
      );
      const essentialTabsTarget = event.target.closest(
        ".zen-essentials-container"
      );
      const tabsTarget = !pinnedTabsTarget;
      let currentEssenialContainer =
        gZenWorkspaces.getCurrentEssentialsContainer();
      if (currentEssenialContainer?.essentialsPromo) {
        currentEssenialContainer.essentialsPromo.remove();
      }

      movingTabs = movingTabs.filter(tab =>
        gBrowser.isTabGroupLabel(tab) && tab.group?.isZenFolder
          ? !tabsTarget && !essentialTabsTarget
          : true
      );

      // TODO: Solve the issue of adding a tab between two groups
      // Remove group labels from the moving tabs and replace it
      // with the sub tabs
      for (let i = 0; i < movingTabs.length; i++) {
        const tab = movingTabs[i];
        if (gBrowser.isTabGroupLabel(tab)) {
          const group = tab.group;
          // remove label and add sub tabs to moving tabs
          if (group) {
            movingTabs.splice(i, 1, ...group.tabs);
          }
        }
      }

      let isVertical = this.expandedSidebarMode;
      let moved = false;
      let hasActuallyMoved;
      for (const tab of movingTabs) {
        let isRegularTabs = false;
        // Check for essentials container
        if (essentialTabsTarget) {
          if (gZenWorkspaces.containerSpecificEssentials) {
            const targetContainerId =
              gZenWorkspaces.getActiveWorkspaceFromCache().containerTabId || 0;
            const sameContextId =
              (tab.getAttribute("usercontextid") || 0) == targetContainerId;
            if (!sameContextId && tab.hasAttribute("zen-essential")) {
              this.removeEssentials(tab, false);
              moved = true;
            }
          }
          if (
            !tab.hasAttribute("zen-essential") &&
            !tab?.group?.hasAttribute("split-view-group")
          ) {
            moved = true;
            isVertical = false;
            hasActuallyMoved = this.addToEssentials(tab);
          }
        }
        // Check for pinned tabs container
        else if (pinnedTabsTarget) {
          if (!tab.pinned) {
            gBrowser.pinTab(tab);
          } else if (tab.hasAttribute("zen-essential")) {
            this.removeEssentials(tab, false);
            moved = true;
          }
        }
        // Check for normal tabs container
        else if (tabsTarget || event.target.id === "zen-tabs-wrapper") {
          if (tab.pinned && !tab.hasAttribute("zen-essential")) {
            gBrowser.unpinTab(tab);
            isRegularTabs = true;
          } else if (tab.hasAttribute("zen-essential")) {
            this.removeEssentials(tab);
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

            gBrowser.moveTabTo(tab, {
              elementIndex,
              forceUngrouped: targetElem?.group?.collapsed !== false,
            });
          }
        }
      }
    } catch (ex) {
      console.error("Error moving tabs:", ex);
    }
    return [draggedTab, ownedTabs];
  }

  onLocationChange(aBrowser, aWebProgress, aRequest, aLocationURI) {
    if (!aWebProgress.isTopLevel) {
      return;
    }
    // eslint-disable-next-line no-shadow
    let location = aLocationURI ? aLocationURI.spec : "";
    if (
      (location == "about:blank" &&
        BrowserUIUtils.checkEmptyPageOrigin(aBrowser)) ||
      location == ""
    ) {
      return;
    }
    const tab = gBrowser.getTabForBrowser(aBrowser);
    if (
      !tab ||
      !tab.pinned ||
      tab.hasAttribute("zen-essential") ||
      !tab._zenPinnedInitialState?.entry
    ) {
      return;
    }
    // Remove # from the URL
    const pinUrl = tab._zenPinnedInitialState.entry.url.split("#")[0];
    const currentUrl = location.split("#")[0];
    // Add an indicator that the pin has been changed
    if (
      Services.io.newURI(currentUrl).spec === Services.io.newURI(pinUrl).spec
    ) {
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
      const showSublabel = tab.hasAttribute("zen-show-sublabel");
      if (showSublabel) {
        tab.removeAttribute("zen-show-sublabel");

        const label = tab.querySelector(".zen-tab-sublabel");
        document.l10n.setArgs(label, {
          tabSubtitle: "zen-default-pinned",
        });
      }
      return;
    }
    if (tab.group?.hasAttribute("split-view-group")) {
      tab.setAttribute("had-zen-pinned-changed", "true");
    } else {
      tab.setAttribute("zen-pinned-changed", "true");
    }
    if (tab._zenPinnedInitialState.image) {
      tab.style.setProperty(
        "--zen-original-tab-icon",
        `url(${tab._zenPinnedInitialState.image})`
      );
    } else {
      tab.style.removeProperty("--zen-original-tab-icon");
    }
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
    return (
      document.documentElement.getAttribute("zen-sidebar-expanded") === "true"
    );
  }

  canEssentialBeAdded(tab) {
    const isExistingEssentialTab = tab.hasAttribute("zen-essential");
    return (
      !(
        (tab.getAttribute("usercontextid") || 0) !=
          (gZenWorkspaces.getActiveWorkspaceFromCache().containerTabId || 0) &&
        gZenWorkspaces.containerSpecificEssentials
      ) &&
      (isExistingEssentialTab ||
        gBrowser._numZenEssentials < this.maxEssentialTabs)
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
    const pinnedTabsTarget = event.target.closest(
      ".zen-workspace-pinned-tabs-section"
    );
    const essentialTabsTarget = event.target.closest(
      ".zen-essentials-container"
    );
    const tabsTarget = event.target.closest(
      ".zen-workspace-normal-tabs-section"
    );
    const folderTarget = event.target.closest("zen-folder");
    let targetTab = event.target.closest(".tabbrowser-tab");
    targetTab = targetTab?.group || targetTab;
    draggedTab = draggedTab?.group?.hasAttribute("split-view-group")
      ? draggedTab.group
      : draggedTab;
    const isHoveringIndicator = !!event.target.closest(
      ".zen-current-workspace-indicator"
    );
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
      if (
        !draggedTab.hasAttribute("zen-essential") &&
        this.canEssentialBeAdded(draggedTab)
      ) {
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

    if (
      !shouldAddDragOverElement ||
      (!targetTab && !folderTarget) ||
      !targetTab
    ) {
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
      indicator.style.setProperty(
        "--indicator-left",
        rect.left + separation / 2 + "px"
      );
      indicator.style.setProperty(
        "--indicator-width",
        rect.width - separation + "px"
      );
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
      indicator.style.setProperty(
        "--indicator-top",
        rect.top + separation / 2 + "px"
      );
      indicator.style.setProperty(
        "--indicator-height",
        rect.height - separation + "px"
      );
      indicator.style.left = left;
      indicator.style.removeProperty("top");
    }
    if (shouldPlayHapticFeedback) {
      // eslint-disable-next-line mozilla/valid-services
      Services.zen.playHapticFeedback();
    }
  }

  onTabLabelChanged(tab) {
    tab.dispatchEvent(
      new CustomEvent("ZenTabLabelChanged", { bubbles: true, detail: { tab } })
    );
  }
}

window.gZenPinnedTabManager = new nsZenPinnedTabManager();
