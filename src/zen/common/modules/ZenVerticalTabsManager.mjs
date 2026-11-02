// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenMultiWindowFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

/**
 * Lays out the sidebar, toolbars and window controls for the current
 * combination of preferences.
 */
window.gZenVerticalTabsManager = {
  init() {
    this._multiWindowFeature = new nsZenMultiWindowFeature();
    this._initWaitPromise();

    ChromeUtils.defineLazyGetter(this, "isWindowsStyledButtons", () => {
      return !(
        window.AppConstants.platform === "macosx" ||
        window.matchMedia("(-moz-gtk-csd-reversed-placement)").matches ||
        Services.prefs.getBoolPref(
          "zen.view.experimental-force-window-controls-left"
        )
      );
    });

    ChromeUtils.defineLazyGetter(this, "hidesTabsToolbar", () => {
      return document.documentElement.hasAttribute("popup-window");
    });

    this.initializePreferences(this._onPrefChange.bind(this));
    this._toolbarOriginalParent =
      document.getElementById("nav-bar").parentElement;

    window.addEventListener("ZenCompactMode:LayoutUpdate", () =>
      this._updateEvent()
    );
    this.initRightSideOrderContextMenu();
    this.initSetProfileContextMenu();

    window.addEventListener(
      "customizationstarting",
      this._preCustomize.bind(this)
    );
    window.addEventListener(
      "aftercustomization",
      this._postCustomize.bind(this)
    );

    this._updateEvent();

    if (!this.isWindowsStyledButtons) {
      document.documentElement.setAttribute(
        "zen-window-buttons-reversed",
        true
      );
    }
  },

  toggleExpand() {
    const newVal = !Services.prefs.getBoolPref("zen.view.sidebar-expanded");
    Services.prefs.setBoolPref("zen.view.sidebar-expanded", newVal);
    Services.prefs.setBoolPref("zen.view.use-single-toolbar", false);
  },

  get navigatorToolbox() {
    return gNavToolbox;
  },

  initRightSideOrderContextMenu() {
    const kConfigKey = "zen.tabs.vertical.right-side";
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuitem id="zen-toolbar-context-tabs-right"
                type="checkbox"
                ${Services.prefs.getBoolPref(kConfigKey) ? 'checked="true"' : ""}
                data-lazy-l10n-id="zen-toolbar-context-tabs-right"
                command="cmd_zenToggleTabsOnRight"
        />
    `);
    document.getElementById("toolbar-context-customize").before(fragment);
  },

  initSetProfileContextMenu() {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menu id="zen-toolbar-context-set-profile"
            data-lazy-l10n-id="zen-workspaces-panel-context-default-profile">
        <menupopup />
      </menu>
      <menuseparator/>
    `);
    const menu = fragment.firstElementChild;
    const separator = menu.nextElementSibling;
    menu.addEventListener("popupshowing", event =>
      gZenWorkspaces.updateWorkspaceActionsMenuContainer(event)
    );
    menu.addEventListener("command", event =>
      gZenWorkspaces.contextChangeContainerTab(event)
    );

    const contextMenu = document.getElementById("toolbar-context-menu");
    contextMenu.addEventListener("popupshowing", event => {
      if (event.target === contextMenu) {
        const hidden = !gZenWorkspaces.shouldShowContainers;
        menu.hidden = hidden;
        separator.hidden = hidden;
      }
    });
    document
      .getElementById("toolbar-context-reloadSelectedTab")
      .before(fragment);
  },

  get _topButtonsSeparatorElement() {
    if (this.__topButtonsSeparatorElement) {
      return this.__topButtonsSeparatorElement;
    }
    this.__topButtonsSeparatorElement = document.getElementById(
      "zen-sidebar-top-buttons-separator"
    );
    return this.__topButtonsSeparatorElement;
  },

  /**
   * Whether aItem is a strip item that should animate in. Checked again a
   * frame after the item opens, because glance and split view only claim a
   * tab once it has been created.
   *
   * @param {Element} aItem
   * @returns {boolean}
   */
  _canAnimateItemOpen(aItem) {
    return !(
      gReduceMotion ||
      !gZenUIManager.motion ||
      !aItem ||
      !gZenUIManager._hasLoadedDOM ||
      !aItem.isConnected ||
      // We do want to do some animations during testing with profiling enabled
      // so we can capture and improve them.
      (gZenUIManager.testingEnabled && !gZenUIManager.profilingEnabled) ||
      !gZenStartup.isReady ||
      aItem.group?.hasAttribute("split-view-group") ||
      aItem.hasAttribute("zen-glance-tab") ||
      window.gZenViewSplitter?.waitingForSplitTab ||
      document.hidden
    );
  },

  animateItemOpen(aItem) {
    if (!this._canAnimateItemOpen(aItem)) {
      return;
    }

    const isLastItem = () => {
      const visibleItems = gBrowser.tabContainer.ariaFocusableItems;
      return visibleItems[visibleItems.length - 1] === aItem;
    };

    try {
      const itemSize = aItem.getBoundingClientRect().height;
      const transform = `-${itemSize}px`;
      const marginBottom = isLastItem() ? ["0px", "0px"] : [transform, "0px"];
      // Hold the collapsed start state now so the item doesn't take its space
      // for a frame, then start once its destination is settled.
      aItem.style.marginBottom = marginBottom[0];
      aItem.style.opacity = "0";
      window.requestAnimationFrame(() => {
        if (!this._canAnimateItemOpen(aItem)) {
          aItem.style.removeProperty("margin-bottom");
          aItem.style.removeProperty("opacity");
          return;
        }
        this._startItemOpenAnimation(aItem, marginBottom);
      });
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * @param {Element} aItem
   * @param {string[]} marginBottom Keyframes collapsing the item's space.
   */
  _startItemOpenAnimation(aItem, marginBottom) {
    try {
      gZenUIManager.motion
        .animate(
          aItem,
          {
            opacity: [0, 1],
            transform: ["scale(0.95)", "scale(1)"],
            marginBottom,
          },
          {
            duration: 0.12,
            easing: "easeOut",
          }
        )
        .then(() => {})
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          aItem.style.removeProperty("margin-bottom");
          aItem.style.removeProperty("transform");
          aItem.style.removeProperty("opacity");
        });
    } catch (e) {
      console.error(e);
    }
  },

  animateItemClose(aItem) {
    if (
      aItem.hasAttribute("zen-essential") ||
      aItem.group?.hasAttribute("split-view-group") ||
      !gZenUIManager.motion ||
      gReduceMotion ||
      document.hidden
    ) {
      return Promise.resolve();
    }
    const height = window.windowUtils.getBoundsWithoutFlushing(aItem).height;
    const visibleItems = gBrowser.tabContainer.ariaFocusableItems;
    const isLastItem = visibleItems[visibleItems.length - 1] === aItem;
    return gZenUIManager.motion.animate(
      aItem,
      {
        opacity: [1, 0],
        transform: ["scale(1)", "scale(0.95)"],
        ...(isLastItem
          ? {}
          : {
              marginBottom: [`0px`, `-${height}px`],
            }),
      },
      {
        duration: 0.1,
        easing: "easeOut",
      }
    );
  },

  get actualWindowButtons() {
    // we have multiple ".titlebar-buttonbox-container" in the DOM, because of the titlebar
    if (!this.__actualWindowButtons) {
      this.__actualWindowButtons = !this.isWindowsStyledButtons
        ? document.querySelector(".titlebar-buttonbox-container") // TODO: test if it works 100% of the time
        : document.querySelector("#nav-bar .titlebar-buttonbox-container");
      this.__actualWindowButtons.setAttribute("overflows", "false");
    }
    return this.__actualWindowButtons;
  },

  async _preCustomize() {
    await this._multiWindowFeature.foreachWindowAsActive(async browser => {
      browser.gZenVerticalTabsManager._updateEvent({
        forCustomizableMode: true,
        dontRebuildAreas: true,
      });
    });
    this.rebuildAreas();
    this.navigatorToolbox.setAttribute("zen-sidebar-expanded", "true");
    document.documentElement.setAttribute("zen-sidebar-expanded", "true"); // force expanded sidebar
  },

  _postCustomize() {
    // No need to use `await` here, because the customization is already done
    this._multiWindowFeature.foreachWindowAsActive(async browser => {
      browser.gZenVerticalTabsManager._updateEvent({ dontRebuildAreas: true });
    });
  },

  initializePreferences(updateEvent) {
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsVerticalTabs",
      "zen.tabs.vertical",
      true,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsRightSide",
      "zen.tabs.vertical.right-side",
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsUseSingleToolbar",
      "zen.view.use-single-toolbar",
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsSidebarExpanded",
      "zen.view.sidebar-expanded",
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsSidebarExpandedMaxWidth",
      "zen.view.sidebar-expanded.max-width",
      300,
      updateEvent
    );
  },

  _initWaitPromise() {
    this._waitPromise = new Promise(resolve => {
      this._resolveWaitPromise = resolve;
    });
  },

  async _onPrefChange() {
    this._resolveWaitPromise();

    // only run if we are in the active window
    await this._multiWindowFeature.foreachWindowAsActive(async browser => {
      if (
        browser.gZenVerticalTabsManager._multiWindowFeature.windowIsActive(
          browser
        )
      ) {
        return;
      }
      await browser.gZenVerticalTabsManager._waitPromise;
      browser.gZenVerticalTabsManager._updateEvent({ dontRebuildAreas: true });
      browser.gZenVerticalTabsManager._initWaitPromise();
    });

    if (nsZenMultiWindowFeature.isActiveWindow) {
      this._updateEvent();
      this._initWaitPromise();
    }
  },

  recalculateURLBarHeight(updateFormat = false) {
    if (gZenWorkspaces._processingResize) {
      return;
    }
    this._pendingUrlbarFormatUpdate ||= updateFormat;
    if (this._urlbarHeightRecalcScheduled) {
      return;
    }
    this._urlbarHeightRecalcScheduled = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        delete this._urlbarHeightRecalcScheduled;
        const shouldUpdateFormat = this._pendingUrlbarFormatUpdate;
        delete this._pendingUrlbarFormatUpdate;
        gURLBar.removeAttribute("--urlbar-height");
        let height;
        if (!this._hasSetSingleToolbar) {
          height = AppConstants.platform == "macosx" ? 34 : 32;
        } else if (!gURLBar.hasAttribute("breakout-extend")) {
          height = 38;
        }
        if (typeof height !== "undefined") {
          gURLBar.style.setProperty("--urlbar-height", `${height}px`);
        }
        gURLBar.style.setProperty(
          "--urlbar-width",
          `${window.windowUtils.getBoundsWithoutFlushing(document.getElementById("urlbar-container")).width}px`
        );
        if (shouldUpdateFormat) {
          gURLBar.zenFormatURLValue();
        }
      });
    });
  },

  getSidebarMinWidth() {
    if (AppConstants.platform === "macosx") {
      return 169;
    }

    let useCaptionButtons = this._prefsUseSingleToolbar;
    if (this._prefsRightSide) {
      useCaptionButtons &&= this.isWindowsStyledButtons;
    } else {
      useCaptionButtons &&= !this.isWindowsStyledButtons;
    }
    if (useCaptionButtons) {
      let captionButtons = this.actualWindowButtons;
      let captionButtonsWidth =
        window.windowUtils.getBoundsWithoutFlushing(captionButtons).width;
      return 117 + captionButtonsWidth;
    }

    return 152;
  },

  // eslint-disable-next-line complexity
  _updateEvent({ forCustomizableMode = false, dontRebuildAreas = false } = {}) {
    if (this._isUpdating) {
      return;
    }
    this._isUpdating = true;
    try {
      this._updateMaxWidth();

      if (window.docShell) {
        window.docShell.treeOwner
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIAppWindow)
          .rollupAllPopups();
      }

      const topButtons = document.getElementById("zen-sidebar-top-buttons");
      const isCompactMode =
        gZenCompactModeManager.preference && !forCustomizableMode;
      const isVerticalTabs = this._prefsVerticalTabs || forCustomizableMode;
      const isSidebarExpanded = this._prefsSidebarExpanded || !isVerticalTabs;
      const isRightSide = this._prefsRightSide && isVerticalTabs;
      const isSingleToolbar =
        ((this._prefsUseSingleToolbar && isVerticalTabs && isSidebarExpanded) ||
          !isVerticalTabs) &&
        !forCustomizableMode &&
        !this.hidesTabsToolbar;
      const titlebar = document.getElementById("titlebar");

      gBrowser.tabContainer.setAttribute(
        "orient",
        isVerticalTabs ? "vertical" : "horizontal"
      );
      gBrowser.tabContainer.arrowScrollbox.setAttribute(
        "orient",
        isVerticalTabs ? "vertical" : "horizontal"
      );
      // on purpose, we set the orient to horizontal, because the arrowScrollbox is vertical
      gBrowser.tabContainer.arrowScrollbox.scrollbox.setAttribute(
        "orient",
        isVerticalTabs ? "vertical" : "horizontal"
      );

      const buttonsTarget = document.getElementById(
        "zen-sidebar-top-buttons-customization-target"
      );
      if (isRightSide) {
        this.navigatorToolbox.setAttribute("zen-right-side", "true");
        document.documentElement.setAttribute("zen-right-side", "true");
      } else {
        this.navigatorToolbox.removeAttribute("zen-right-side");
        document.documentElement.removeAttribute("zen-right-side");
      }

      const wasSidebarExpanded = document.documentElement.hasAttribute(
        "zen-sidebar-expanded"
      );
      if (isSidebarExpanded !== wasSidebarExpanded) {
        delete this._hadSidebarCollapse;
        if (isSidebarExpanded) {
          this._hadSidebarCollapse = true;
          this.navigatorToolbox.setAttribute("zen-sidebar-expanded", "true");
          document.documentElement.setAttribute("zen-sidebar-expanded", "true");
          gBrowser.tabContainer.setAttribute("expanded", "true");
        } else {
          this.navigatorToolbox.removeAttribute("zen-sidebar-expanded");
          document.documentElement.removeAttribute("zen-sidebar-expanded");
          gBrowser.tabContainer.removeAttribute("expanded");
        }
      }

      const appContentNavbarContaienr = document.getElementById(
        "zen-appcontent-navbar-container"
      );
      const appContentNavbarWrapper = document.getElementById(
        "zen-appcontent-navbar-wrapper"
      );
      appContentNavbarWrapper.style.transition = "none";
      let shouldHide = false;
      if (
        ((!isRightSide && this.isWindowsStyledButtons) ||
          (isRightSide && !this.isWindowsStyledButtons) ||
          (isCompactMode && isSingleToolbar && this.isWindowsStyledButtons)) &&
        isSingleToolbar
      ) {
        appContentNavbarWrapper.setAttribute("should-hide", true);
        shouldHide = true;
      } else {
        appContentNavbarWrapper.removeAttribute("should-hide");
      }

      // Check if the sidebar is in hover mode
      if (
        !this.navigatorToolbox.hasAttribute("zen-right-side") &&
        !isCompactMode
      ) {
        this.navigatorToolbox.prepend(topButtons);
      }

      let windowButtons = this.actualWindowButtons;
      let doNotChangeWindowButtons =
        !isCompactMode && isRightSide && this.isWindowsStyledButtons;
      const navBar = document.getElementById("nav-bar");

      if (isSingleToolbar) {
        this._navbarParent = navBar.parentElement;
        let elements = Array.from(
          document.querySelectorAll(
            '#nav-bar-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional):not(#urlbar-container):not(toolbarspring)'
          )
        );
        let normalButtons = [];
        let extensionButtons = [];
        for (const element of elements) {
          if (
            element.hasAttribute("data-extensionid") &&
            Services.prefs.getBoolPref("zen.view.overflow-webext-toolbar", true)
          ) {
            extensionButtons.push(element);
          } else {
            normalButtons.push(element);
          }
        }
        // Add separator if it doesn't exist
        if (!this._hasSetSingleToolbar) {
          buttonsTarget.append(this._topButtonsSeparatorElement);
        }
        this._hasSetSingleToolbar = true;
        for (const button of normalButtons.reverse()) {
          this.appendCustomizableItem(this._topButtonsSeparatorElement, button);
        }
        for (const extension of extensionButtons) {
          this.appendCustomizableItem(
            this._topButtonsSeparatorElement,
            extension
          );
        }
        buttonsTarget.prepend(
          document.getElementById("unified-extensions-button")
        );
        const panelUIButton = document.getElementById("PanelUI-button");
        buttonsTarget.prepend(panelUIButton);
        panelUIButton.setAttribute("overflows", "false");
        buttonsTarget.parentElement.append(
          document.getElementById("nav-bar-overflow-button")
        );
        if (this.isWindowsStyledButtons && !doNotChangeWindowButtons) {
          appContentNavbarContaienr.append(windowButtons);
        }
        if (isCompactMode) {
          titlebar.moveBefore(navBar, titlebar.firstChild);
          titlebar.moveBefore(topButtons, titlebar.firstChild);
        } else {
          titlebar.parentNode.moveBefore(topButtons, titlebar);
          titlebar.parentNode.moveBefore(navBar, titlebar);
        }
        document.documentElement.setAttribute("zen-single-toolbar", true);
      } else if (this._hasSetSingleToolbar) {
        this._hasSetSingleToolbar = false;
        // Do the opposite
        this._navbarParent.prepend(navBar);
        const elements = document.querySelectorAll(
          '#zen-sidebar-top-buttons-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional)'
        );
        for (const button of elements) {
          document
            .getElementById("nav-bar-customization-target")
            .append(button);
        }
        this._topButtonsSeparatorElement.remove();
        document.documentElement.removeAttribute("zen-single-toolbar");
        const panelUIButton = document.getElementById("PanelUI-button");
        navBar.appendChild(panelUIButton);
        panelUIButton.removeAttribute("overflows");
        navBar.appendChild(document.getElementById("nav-bar-overflow-button"));
        this._toolbarOriginalParent.prepend(navBar);
        if (!dontRebuildAreas) {
          this.rebuildAreas();
        }
      }

      if (isCompactMode) {
        titlebar.prepend(topButtons);
      } else if (isSidebarExpanded) {
        titlebar.before(topButtons);
      } else {
        titlebar.prepend(topButtons);
      }

      // Case: single toolbar, not compact mode, not right side and macos styled buttons
      if (
        !doNotChangeWindowButtons &&
        isSingleToolbar &&
        !isCompactMode &&
        !isRightSide &&
        !this.isWindowsStyledButtons
      ) {
        topButtons.prepend(windowButtons);
      }

      const canHideTabBarPref = Services.prefs.getBoolPref(
        "zen.view.compact.hide-tabbar"
      );
      const captionsShouldStayOnSidebar =
        !canHideTabBarPref &&
        ((!this.isWindowsStyledButtons && !isRightSide) ||
          (this.isWindowsStyledButtons && isRightSide));
      if (
        (!isSingleToolbar && isCompactMode && !captionsShouldStayOnSidebar) ||
        !isSidebarExpanded
      ) {
        navBar.prepend(topButtons);
      }

      // Case: single toolbar, compact mode, right side and windows styled buttons
      if (
        isSingleToolbar &&
        isCompactMode &&
        isRightSide &&
        this.isWindowsStyledButtons
      ) {
        topButtons.prepend(windowButtons);
      }

      if (doNotChangeWindowButtons) {
        if (isRightSide && !isSidebarExpanded) {
          navBar.appendChild(windowButtons);
        } else {
          topButtons.appendChild(windowButtons);
        }
      } else if (!isSingleToolbar && !isCompactMode) {
        if (this.isWindowsStyledButtons) {
          if (isRightSide) {
            appContentNavbarContaienr.append(windowButtons);
          } else {
            navBar.append(windowButtons);
          }
        } else {
          // not windows styled buttons
          // eslint-disable-next-line no-lonely-if
          if (isRightSide || !isSidebarExpanded) {
            navBar.prepend(windowButtons);
          } else {
            topButtons.prepend(windowButtons);
          }
        }
      } else if (!isSingleToolbar && isCompactMode) {
        if (captionsShouldStayOnSidebar) {
          topButtons.prepend(windowButtons);
        } else {
          navBar.appendChild(windowButtons);
        }
      } else if (isSingleToolbar && isCompactMode) {
        if (!isRightSide && !this.isWindowsStyledButtons) {
          topButtons.prepend(windowButtons);
        }
      }

      if (shouldHide) {
        appContentNavbarContaienr.append(windowButtons);
      }

      if (
        this._hasSetSingleToolbar &&
        Services.prefs.getBoolPref("zen.view.overflow-webext-toolbar", true)
      ) {
        topButtons.setAttribute(
          "addon-webext-overflowtarget",
          "zen-overflow-extensions-list"
        );
      } else {
        topButtons.setAttribute(
          "addon-webext-overflowtarget",
          "overflowed-extensions-list"
        );
      }

      gZenCompactModeManager.updateCompactModeContext(isSingleToolbar);
      window.dispatchEvent(new Event("resize"));
      gZenUIManager.updateTabsToolbar();
      this.rebuildURLBarMenus();
      appContentNavbarWrapper.style.transition = "";
    } catch (e) {
      console.error(e);
    }
    this._isUpdating = false;
  },

  rebuildURLBarMenus() {
    gURLBar.updatePlaceholder();
  },

  rebuildAreas() {
    CustomizableUI.zenInternalCU._rebuildRegisteredAreas(
      /* zenDontRebuildCollapsed */ true
    );
  },

  _updateMaxWidth() {
    const maxWidth = Services.prefs.getIntPref(
      "zen.view.sidebar-expanded.max-width"
    );
    const toolbox = gNavToolbox;
    toolbox.style.setProperty(
      "--zen-toolbox-min-width",
      `${this.getSidebarMinWidth()}px`
    );
    if (!this._prefsCompactMode) {
      toolbox.style.maxWidth = `${maxWidth}px`;
    } else {
      toolbox.style.removeProperty("maxWidth");
    }
  },

  get expandButton() {
    if (this._expandButton) {
      return this._expandButton;
    }
    this._expandButton = document.getElementById("zen-expand-sidebar-button");
    return this._expandButton;
  },

  toggleTabsOnRight() {
    const newVal = !Services.prefs.getBoolPref("zen.tabs.vertical.right-side");
    Services.prefs.setBoolPref("zen.tabs.vertical.right-side", newVal);
  },

  appendCustomizableItem(target, child, placements = []) {
    if (
      this._hasSetSingleToolbar &&
      (target.id === "zen-sidebar-top-buttons-customization-target" ||
        target === this._topButtonsSeparatorElement)
    ) {
      if (placements.includes(child.id)) {
        this._topButtonsSeparatorElement.before(child);
        return;
      } else if (
        child.hasAttribute("data-extensionid") &&
        Services.prefs.getBoolPref("zen.view.overflow-webext-toolbar", true)
      ) {
        if (gURLBar._isOverflowingItems) {
          const overflowElements = document.getElementById(
            "zen-overflow-extensions-list"
          );
          overflowElements.appendChild(child);
        } else {
          const element = document.getElementById("page-action-buttons");
          child.setAttribute("context", "toolbar-context-menu");
          element.before(child);
        }
        return;
      }
    }
    if (target === this._topButtonsSeparatorElement) {
      this._topButtonsSeparatorElement.after(child);
    } else {
      target.appendChild(child);
    }
  },
};

XPCOMUtils.defineLazyPreferenceGetter(
  gZenVerticalTabsManager,
  "_canReplaceNewTab",
  "zen.urlbar.replace-newtab",
  true
);
