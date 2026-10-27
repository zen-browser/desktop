/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenFolder } from "chrome://browser/content/zen-components/ZenFolder.mjs";

// Enough clipboard text to fill the preview, which crops what does not fit.
const MAX_CLIPBOARD_PREVIEW = 200;

// A helper class to manage collapsible pinned tabs in a workspace.

class nsZenCollapsiblePins extends nsZenFolder {
  #spaceElement;

  connectedCallback() {
    this.setAttribute("hidden", "true");
    this.#spaceElement = this.parentElement;
    super.connectedCallback();
  }

  get groupContainer() {
    return this.#spaceElement.pinnedTabsContainer;
  }

  get groupStartElement() {
    // Fetch this instead of the tab-group-start since it is not guaranteed this
    // element will be the first child of the pinned tabs container.
    return this.#spaceElement.pinnedTabsContainer.querySelector(
      ".space-fake-collapsible-start"
    );
  }

  get collapsed() {
    return super.collapsed;
  }

  set collapsed(value) {
    if (value) {
      this.#spaceElement.setAttribute("collapsedpinnedtabs", "true");
    } else {
      this.#spaceElement.removeAttribute("collapsedpinnedtabs");
    }
    super.collapsed = value;
    gBrowser.tabContainer._invalidateCachedVisibleTabs();
  }

  toggle() {
    this.collapsed = !this.collapsed;
  }
}

export class nsZenWorkspace extends MozXULElement {
  #initialPinnedElementChildrenCount;
  #hasConnected = false;
  #newTabPasteAbort = null;
  #tabVisibilityObserver = null;
  #scrollToTabListeners = null;
  #watchedTab = null;
  #scrollToTabShown = false;
  #scrollToTabSeq = 0;

  static get markup() {
    return `
        <vbox class="zen-workspace-tabs-section zen-current-workspace-indicator zen-squircle-before zen-drop-target" flex="1" context="zenWorkspaceMoreActions">
          <stack class="zen-current-workspace-indicator-stack">
            <image class="zen-current-workspace-indicator-chevron" />
            <hbox class="zen-current-workspace-indicator-icon" />
          </stack>
          <label class="zen-current-workspace-indicator-name" />
          <toolbarbutton class="toolbarbutton-1 chromeclass-toolbar-additional zen-workspaces-actions" context="zenWorkspaceMoreActions" />
        </vbox>
        <arrowscrollbox orient="vertical" class="workspace-arrowscrollbox">
          <vbox class="zen-workspace-tabs-section zen-workspace-pinned-tabs-section" hide-separator="true">
            <html:div class="zen-tab-group-start space-fake-collapsible-start" style="order: -9999;" />
            <hbox class="pinned-tabs-container-separator">
              <toolbarseparator flex="1" />
              <toolbarbutton command="cmd_zenCloseUnpinnedTabs"
                             tooltip="dynamic-shortcut-tooltip"
                             data-l10n-id="zen-workspaces-close-all-unpinned-tabs-title"
                             class="zen-workspace-close-unpinned-tabs-button" />
            </hbox>
          </vbox>
          <vbox class="zen-workspace-tabs-section zen-workspace-normal-tabs-section">
            <!-- Let it as an ID to mantain compatibility with firefox's tabbrowser -->
            <hbox id="tabbrowser-arrowscrollbox-periphery">
              <toolbartabstop/>
              <toolbarbutton id="tabs-newtab-button"
                             class="toolbarbutton-1"
                             command="cmd_newNavigatorTab"
                             tooltip="dynamic-shortcut-tooltip"
                             data-l10n-id="tabs-toolbar-new-tab">
                <box class="zen-newtab-sublabel-anchor">
                  <label class="zen-tab-sublabel" crop="end" role="presentation"/>
                </box>
              </toolbarbutton>
              <spacer class="closing-tabs-spacer" style="width: 0;"/>
            </hbox>
          </vbox>
        </arrowscrollbox>
        <vbox class="zen-workspace-empty-space" flex="1" />
        <hbox class="zen-workspace-scroll-to-tab no-squircles" hidden="true" role="button"
              data-l10n-id="zen-scroll-to-selected-tab">
          <image class="zen-workspace-scroll-to-tab-icon" />
          <image class="zen-workspace-scroll-to-tab-arrow" />
        </hbox>
      `;
  }

  static get moveTabToButtonMarkup() {
    return `
      <toolbarbutton class="toolbarbutton-1 chromeclass-toolbar-additional zen-workspaces-actions"
                     tooltip="dynamic-shortcut-tooltip"
                     data-l10n-id="zen-move-tab-to-workspace-button" />
    `;
  }

  static get inheritedAttributes() {
    return {
      ".zen-workspace-tabs-section": "zen-workspace-id=id",
    };
  }

  constructor() {
    super();

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_showNewTabButtonTop",
      "zen.view.show-newtab-button-top",
      false
    );

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_showScrollToSelectedTab",
      "zen.view.show-scroll-to-selected-tab",
      true
    );
  }

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }
    if (this.#hasConnected) {
      if (!this.#scrollToTabListeners) {
        this.#setupScrollToSelectedTab();
      }
      return;
    }

    this.#hasConnected = true;
    this.appendChild(this.constructor.fragment);

    this.tabsContainer = this.querySelector(
      ".zen-workspace-normal-tabs-section"
    );
    this.indicator = this.querySelector(".zen-current-workspace-indicator");
    this.pinnedTabsContainer = this.querySelector(
      ".zen-workspace-pinned-tabs-section"
    );
    this.pinnedTabsContainer.separatorElement =
      this.pinnedTabsContainer.querySelector(
        ".pinned-tabs-container-separator"
      );
    this.initializeAttributeInheritance();

    this.scrollbox = this.querySelector("arrowscrollbox");
    this.scrollbox.smoothScroll = Services.prefs.getBoolPref(
      "zen.startup.smooth-scroll-in-tabs",
      false
    );

    this.scrollbox.addEventListener("wheel", this, true);
    this.scrollbox.addEventListener("underflow", this);
    this.scrollbox.addEventListener("overflow", this);

    const indicatorName = this.indicator.querySelector(
      ".zen-current-workspace-indicator-name"
    );
    indicatorName.onRenameFinished = this.onIndicatorRenameFinished.bind(this);
    indicatorName.addEventListener("dblclick", event => {
      if (this.hasPinnedTabs) {
        // Prevent renaming when there are pinned tabs
        event.stopPropagation();
      }
    });

    this.pinnedTabsContainer.scrollbox = this.scrollbox;
    this.#initialPinnedElementChildrenCount =
      this.pinnedTabsContainer.children.length;

    if (document.documentElement.hasAttribute("zen-unsynced-window")) {
      this.indicator.removeAttribute("context");
    }

    this.indicator
      .querySelector(".zen-workspaces-actions")
      .addEventListener("click", this.onActionsCommand.bind(this));

    this.indicator
      .querySelector(".zen-current-workspace-indicator-icon")
      .addEventListener("dblclick", event => {
        if (this.hasPinnedTabs) {
          return;
        }
        event.stopPropagation();
        gZenWorkspaces.changeWorkspaceIcon();
      });

    this.indicator.addEventListener("click", event => {
      if (this.hasPinnedTabs && event.button === 0) {
        event.stopPropagation();
        this.collapsiblePins.toggle();
      }
    });

    if (!gZenWorkspaces.currentWindowIsSyncing) {
      let actionsButton = this.indicator.querySelector(
        ".zen-workspaces-actions"
      );
      const moveTabToFragment = window.MozXULElement.parseXULToFragment(
        nsZenWorkspace.moveTabToButtonMarkup
      );
      actionsButton.after(moveTabToFragment);
      actionsButton.setAttribute("hidden", "true");
      actionsButton = actionsButton.nextElementSibling;
      actionsButton.addEventListener("command", event => {
        event.stopPropagation();
        this.#openMoveTabsToWorkspacePanel(event.target);
      });
    }

    this.scrollbox._getScrollableElements = () => {
      const children = [
        ...this.pinnedTabsContainer.children,
        ...this.tabsContainer.children,
      ];
      if (this._showNewTabButtonTop) {
        // Move the perifery to the first non-pinned tab
        const periphery = this.tabsContainer.querySelector(
          "#tabbrowser-arrowscrollbox-periphery"
        );
        if (periphery) {
          const firstNonPinnedTabIndex = children.findIndex(
            child => gBrowser.isTab(child) && !child.pinned
          );
          if (firstNonPinnedTabIndex > -1) {
            // Change to new location and remove from the old one on the list
            const peripheryIndex = children.indexOf(periphery);
            if (peripheryIndex > -1) {
              children.splice(peripheryIndex, 1);
            }
            children.splice(firstNonPinnedTabIndex, 0, periphery);
          }
        }
      }
      return Array.prototype.filter.call(
        children,
        this.scrollbox._canScrollToElement,
        this.scrollbox
      );
    };

    this.scrollbox._canScrollToElement = element => {
      if (gBrowser.isTab(element)) {
        return (
          !element.hasAttribute("zen-essential") &&
          !this.hasAttribute("positionpinnedtabs") &&
          !element.hasAttribute("zen-empty-tab")
        );
      }
      return true;
    };

    // Override for performance reasons. This is the size of a single element
    // that can be scrolled when using mouse wheel scrolling. If we don't do
    // this then arrowscrollbox computes this value by calling
    // _getScrollableElements and dividing the box size by that number.
    // However in the tabstrip case we already know the answer to this as,
    // when we're overflowing, it is always the same as the tab min width or
    // height. For tab group labels, the number won't exactly match, but
    // that shouldn't be a problem in practice since the arrowscrollbox
    // stops at element bounds when finishing scrolling.
    try {
      Object.defineProperty(this.scrollbox, "lineScrollAmount", {
        get: () => 36,
      });
    } catch (e) {
      console.warn("Failed to set lineScrollAmount", e);
    }

    // Add them manually since attribute inheritance doesn't work
    // for multiple layers of shadow DOM.
    this.tabsContainer.setAttribute("zen-workspace-id", this.id);
    this.pinnedTabsContainer.setAttribute("zen-workspace-id", this.id);

    this.collapsiblePins = document.createXULElement(
      "zen-workspace-collapsible-pins"
    );
    this.prepend(this.collapsiblePins);

    this.#updateOverflow();
    this.#setupNewTabPasteAndSearch();
    this.#setupScrollToSelectedTab();

    this.pinnedTabsContainer.addEventListener("TabPinned", () => {
      // If a tab is pinned and the pinned tabs section is collapsed, uncollapse it.
      if (this.collapsiblePins.collapsed) {
        this.collapsiblePins.collapsed = false;
      }
    });

    const tabPinCallback = () => {
      this.checkPinsExistence();
    };

    this.addEventListener("TabPinned", tabPinCallback);
    this.addEventListener("TabUnpinned", tabPinCallback);
    this.addEventListener("TabGroupRemovedFromDOM", () => {
      // Wait for the group to be removed from the DOM.
      setTimeout(() => {
        tabPinCallback();
      });
    });
    this.addEventListener("TabClose", event => {
      if (event.target.pinned) {
        tabPinCallback();
      }
    });
  }

  get active() {
    return this.hasAttribute("active");
  }

  set active(value) {
    if (value) {
      this.setAttribute("active", "true");
    } else {
      this.removeAttribute("active");
    }
    this.#updateOverflow();
  }

  get hasPinnedTabs() {
    return this.hasAttribute("haspinnedtabs");
  }

  get hasCollapsedPinnedTabs() {
    return this.hasAttribute("collapsedpinnedtabs");
  }

  #updateOverflow() {
    if (!this.scrollbox) {
      return;
    }
    if (this.overflows) {
      this.#dispatchEventFromScrollbox("overflow");
    } else {
      this.#dispatchEventFromScrollbox("underflow");
    }
  }

  #dispatchEventFromScrollbox(type) {
    this.scrollbox.dispatchEvent(new CustomEvent(type, {}));
  }

  get overflows() {
    return this.scrollbox.overflowing;
  }

  handleEvent(event) {
    if (this.active) {
      gBrowser.tabContainer.handleEvent(event);
    }
  }

  get workspaceUuid() {
    return this.id;
  }

  async onIndicatorRenameFinished(newName) {
    if (newName === "") {
      return;
    }
    let workspaces = gZenWorkspaces.getWorkspaces();
    let workspaceData = workspaces.find(
      workspace => workspace.uuid === this.workspaceUuid
    );
    workspaceData.name = newName;
    await gZenWorkspaces.saveWorkspace(workspaceData);
    this.indicator.querySelector(
      ".zen-current-workspace-indicator-name"
    ).textContent = newName;
    gZenUIManager.showToast("zen-workspace-renamed-toast");
  }

  onActionsCommand(event) {
    event.stopPropagation();
    const popup = document.getElementById("zenWorkspaceMoreActions");
    const target = event.target;
    target.setAttribute("open", "true");
    this.indicator.setAttribute("open", "true");
    const handlePopupHidden = event => {
      if (event.target !== popup) {
        return;
      }
      target.removeAttribute("open");
      this.indicator.removeAttribute("open");
      popup.removeEventListener("popuphidden", handlePopupHidden);
    };
    popup.addEventListener("popuphidden", handlePopupHidden);
    popup.openPopup(event.target, "after_start");
  }

  get newTabButton() {
    return this.querySelector("#tabs-newtab-button");
  }

  get #scrollToTabButton() {
    return this.querySelector(".zen-workspace-scroll-to-tab");
  }

  #setupScrollToSelectedTab() {
    this.#scrollToTabListeners = new AbortController();
    const { signal } = this.#scrollToTabListeners;

    this.#scrollToTabButton.addEventListener(
      "click",
      () => {
        if (!this.#canOfferScrollToTab(gBrowser.selectedTab)) {
          return;
        }
        gBrowser.tabContainer._handleTabSelect();
      },
      { signal }
    );

    this.#tabVisibilityObserver = new IntersectionObserver(
      entries => this.#onSelectedTabVisibility(entries.at(-1)),
      { root: this.scrollbox, threshold: 0 }
    );

    const follow = () => this.#watchSelectedTab();
    gBrowser.tabContainer.addEventListener("TabSelect", follow, { signal });
    this.scrollbox.addEventListener("overflow", follow, { signal });
    this.scrollbox.addEventListener("underflow", follow, { signal });

    follow();
  }

  disconnectedCallback() {
    this.#scrollToTabListeners?.abort();
    this.#scrollToTabListeners = null;
    this.#tabVisibilityObserver?.disconnect();
    this.#tabVisibilityObserver = null;
    this.#watchedTab = null;
  }

  /** Points the observer at whichever tab this space currently has selected. */
  #watchSelectedTab() {
    if (!this.#tabVisibilityObserver) {
      return;
    }
    const selected = gBrowser.selectedTab;
    const tab = this.#canOfferScrollToTab(selected) ? selected : null;

    if (this.#watchedTab && this.#watchedTab !== tab) {
      this.#tabVisibilityObserver.unobserve(this.#watchedTab);
    }
    this.#watchedTab = tab;

    if (tab) {
      this.#tabVisibilityObserver.observe(tab);
    } else {
      this.#hideScrollToTab();
    }
  }

  #canOfferScrollToTab(tab) {
    return (
      this._showScrollToSelectedTab &&
      this.active &&
      !!tab &&
      !tab.hidden &&
      tab.getAttribute("zen-workspace-id") === this.id &&
      this.scrollbox._canScrollToElement(tab)
    );
  }

  #onSelectedTabVisibility(entry) {
    if (
      !entry ||
      entry.isIntersecting ||
      !this.overflows ||
      !this.#canOfferScrollToTab(this.#watchedTab)
    ) {
      this.#hideScrollToTab();
      return;
    }

    const button = this.#scrollToTabButton;
    const direction =
      entry.boundingClientRect.bottom <= entry.rootBounds.top ? "up" : "down";
    button.querySelector(".zen-workspace-scroll-to-tab-icon").src =
      gBrowser.getIcon(this.#watchedTab) ?? "";
    button.setAttribute("direction", direction);
    this.#showScrollToTab(direction);
  }

  /**
   * Springs the pill out of the edge it is anchored to.
   *
   * @param {string} direction - Which edge that is
   */
  #showScrollToTab(direction) {
    const button = this.#scrollToTabButton;
    this.#anchorScrollToTab(button);
    const wasShown = this.#scrollToTabShown;
    // Anything still on its way out belongs to an older state.
    this.#scrollToTabSeq++;
    this.#scrollToTabShown = true;
    button.hidden = false;

    if (wasShown) {
      return;
    }
    if (gReduceMotion) {
      button.style.removeProperty("transform");
      button.style.removeProperty("opacity");
      return;
    }

    const from = direction === "up" ? -10 : 10;
    gZenUIManager.motion.animate(
      button,
      {
        transform: [
          `translateY(${from}px) scale(0.5)`,
          "translateY(0px) scale(1)",
        ],
        opacity: [0, 1],
      },
      { type: "spring", bounce: 0.42, visualDuration: 0.2 }
    );
  }

  #anchorScrollToTab(button) {
    const space = window.windowUtils.getBoundsWithoutFlushing(this);
    const port = this.scrollbox.scrollClientRect;
    button.style.setProperty(
      "--zen-scroll-to-tab-top",
      `${Math.round(port.top - space.top)}px`
    );
    button.style.setProperty(
      "--zen-scroll-to-tab-bottom",
      `${Math.round(space.bottom - port.bottom)}px`
    );
  }

  /** Takes the pill back into the edge it came from. */
  #hideScrollToTab() {
    const button = this.#scrollToTabButton;
    if (!this.#scrollToTabShown) {
      return;
    }
    this.#scrollToTabShown = false;
    const seq = ++this.#scrollToTabSeq;

    if (gReduceMotion) {
      button.hidden = true;
      return;
    }

    const to = button.getAttribute("direction") === "up" ? -10 : 10;
    gZenUIManager.motion
      .animate(
        button,
        {
          transform: [
            "translateY(0px) scale(1)",
            `translateY(${to}px) scale(0.6)`,
          ],
          opacity: [1, 0],
        },
        { duration: 0.12, ease: "easeIn" }
      )
      .then(() => {
        // It may have been asked back while this was running.
        if (seq === this.#scrollToTabSeq) {
          button.hidden = true;
        }
      });
  }

  /**
   * Holding the accel key over the new tab button turns it into a shortcut for
   * pasting the clipboard and searching it. Only the look belongs here, the
   * click itself is read by gZenUIManager.newTabButtonWantsClipboard.
   */
  #setupNewTabPasteAndSearch() {
    const button = this.newTabButton;
    button.addEventListener("mouseenter", event => {
      this.#watchNewTabPasteModifier(event);
    });
    button.addEventListener("mouseleave", () => {
      this.#unwatchNewTabPasteModifier();
    });
  }

  #watchNewTabPasteModifier(enterEvent) {
    // The key may already be down by the time the pointer arrives.
    this.#offerNewTabPasteAndSearch(enterEvent.getModifierState("Accel"));
    if (this.#newTabPasteAbort) {
      return;
    }
    this.#newTabPasteAbort = new AbortController();
    const options = { signal: this.#newTabPasteAbort.signal };
    const onKey = event => {
      this.#offerNewTabPasteAndSearch(event.getModifierState("Accel"));
    };
    window.addEventListener("keydown", onKey, options);
    window.addEventListener("keyup", onKey, options);
    // No key release arrives when the window loses focus while still hovered.
    window.addEventListener(
      "blur",
      () => {
        this.#offerNewTabPasteAndSearch(false);
      },
      options
    );
  }

  #unwatchNewTabPasteModifier() {
    this.#newTabPasteAbort?.abort();
    this.#newTabPasteAbort = null;
    this.#offerNewTabPasteAndSearch(false);
  }

  #offerNewTabPasteAndSearch(shouldOffer) {
    const button = this.newTabButton;
    // Nothing to paste means nothing to offer, which also keeps the button
    // honest about what the click is going to do.
    const clipboard = shouldOffer ? gZenUIManager.clipboardForNewTab() : "";
    shouldOffer = !!clipboard;
    if (shouldOffer === button.hasAttribute("zen-paste-and-search")) {
      return;
    }
    if (shouldOffer) {
      button.querySelector(".zen-tab-sublabel").value =
        this.#previewClipboard(clipboard);
      button.setAttribute("zen-paste-and-search", "true");
      document.l10n.setAttributes(button, "zen-tabs-newtab-paste-and-search");
    } else {
      button.removeAttribute("zen-paste-and-search");
      document.l10n.setAttributes(button, "tabs-toolbar-new-tab");
    }
  }

  /**
   * Flattens clipboard text onto the single line the preview has room for.
   *
   * @param {string} clipboard - The text a new tab would be opened with.
   * @returns {string}
   */
  #previewClipboard(clipboard) {
    return clipboard.replace(/\s+/g, " ").substring(0, MAX_CLIPBOARD_PREVIEW);
  }

  onGradientCacheChanged() {
    const { isDarkMode, isExplicitMode, toolbarColor, primaryColor } =
      gZenThemePicker.getGradientForWorkspace(
        gZenWorkspaces.getWorkspaceFromId(this.workspaceUuid),
        { getGradient: false }
      );
    if (isExplicitMode) {
      this.style.colorScheme = isDarkMode ? "dark" : "light";
    } else {
      this.style.colorScheme = "";
    }
    this.style.setProperty(
      "--toolbox-textcolor",
      `rgb(${toolbarColor.join(",")})`
    );
    this.style.setProperty("--zen-primary-color", primaryColor);
  }

  checkPinsExistence() {
    if (
      this.pinnedTabsContainer.children.length >
      this.#initialPinnedElementChildrenCount
    ) {
      this.setAttribute("haspinnedtabs", "true");
    } else {
      this.removeAttribute("haspinnedtabs");
      this.collapsiblePins.collapsed = false;
    }
  }

  clearThemeStyles() {
    this.style.colorScheme = "";
    this.style.removeProperty("--toolbox-textcolor");
    this.style.removeProperty("--zen-primary-color");
  }

  #openMoveTabsToWorkspacePanel(button) {
    button = button.closest("toolbarbutton");
    if (!button) {
      return;
    }

    const popup = document.getElementById("zenMoveTabsToSyncedWorkspacePopup");
    popup.innerHTML = "";

    const workspaces = gZenWorkspaces.getWorkspaces(true);
    for (const workspace of workspaces) {
      const item = gZenWorkspaces.generateMenuItemForWorkspace(workspace);
      item.addEventListener("command", async () => {
        const { ZenWindowSync } = ChromeUtils.importESModule(
          "resource:///modules/zen/ZenWindowSync.sys.mjs"
        );
        ZenWindowSync.moveTabsToSyncedWorkspace(window, workspace.uuid);
      });
      popup.appendChild(item);
    }

    button.setAttribute("open", "true");
    popup.addEventListener(
      "popuphidden",
      () => {
        button.removeAttribute("open");
      },
      { once: true }
    );
    popup.openPopup(button, "after_start", 0, 0, true /* isContextMenu */);
  }
}

customElements.define("zen-workspace", nsZenWorkspace);
customElements.define("zen-workspace-collapsible-pins", nsZenCollapsiblePins);
