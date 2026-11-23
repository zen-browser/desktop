// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  ShortcutUtils: "resource://gre/modules/ShortcutUtils.sys.mjs",
  ZenLittleWindow:
    "resource:///modules/zen/littlewindow/ZenLittleWindow.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-workspaces.ftl"], true)
);

ChromeUtils.defineLazyGetter(lazy, "graphemes", () => new Intl.Segmenter());

const DEFAULT_CONTAINER_L10N_ID = "zen-workspace-default-profile";
const INTRO_DISMISSED_PREF = "zen.little-window.intro-dismissed";
const URLBAR_ONLY_ATTRIBUTE = "zen-little-window-urlbar-only";
const URLBAR_NAVIGATION_TOPIC = "urlbar-user-start-navigation";
const URLBAR_ONLY_WIDTH_PROPERTY = "--zen-little-window-urlbar-width";
const URLBAR_ONLY_HEIGHT_PROPERTY = "--zen-little-window-urlbar-height";

const UNSUPPORTED_COMMANDS = [
  "cmd_CustomizeToolbars",
  "cmd_zenCompactModeToggle",
  "cmd_toggleCompactModeIgnoreHover",
  "cmd_zenCompactModeShowSidebar",
  "cmd_zenToggleSidebar",
  "cmd_zenToggleTabsOnRight",
];

class nsZenLittleWindow extends nsZenDOMOperatedFeature {
  #userContextId = 0;
  #openLabel = null;
  #containerPill = null;
  #urlbarOnly = false;
  #urlbarOnlyObserver = null;
  #isWaitingToShow = false;
  #isActive = false;
  #sizeToRemember = null;
  #shownHeight = 0;
  #isWatchingUrlbar = false;
  #isNavigating = false;
  #urlbarOnlyProgressListener = null;
  #urlbarBlurListener = event => this.#onUrlbarBlur(event);

  constructor() {
    super();
    window.windowUtils.loadSheetUsingURIString(
      "chrome://browser/content/zen-styles/zen-little-window.css",
      window.windowUtils.AUTHOR_SHEET
    );
    if (typeof window._zenStartupUnsyncedUserContextId == "number") {
      this.#userContextId = window._zenStartupUnsyncedUserContextId;
    }
    window.addEventListener("unload", () => this.#returnToPreviousApp(), {
      once: true,
    });
    window.addEventListener("activate", () => {
      this.#isActive = true;
    });
    window.addEventListener("deactivate", () =>
      setTimeout(() => this.#onDeactivated(), 0)
    );
    if (document.documentElement.hasAttribute(URLBAR_ONLY_ATTRIBUTE)) {
      this.#urlbarOnly = true;
      this.#baseWindow.visibility = false;
      this.#isWaitingToShow = true;
      window.addEventListener(
        "load",
        () => {
          this.#baseWindow.visibility = false;
          setTimeout(() => this.#showWithUrlbarReady(), 0);
        },
        { once: true }
      );
    }
  }

  get #baseWindow() {
    return window.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
  }

  init() {
    for (const id of UNSUPPORTED_COMMANDS) {
      document.getElementById(id)?.setAttribute("disabled", "true");
    }
    this.#buildOpenInSpace();
    this.#buildContainerPill();
    this.#buildUrlbarCloseButton();
    if (this.#urlbarOnly) {
      this.#initUrlbarOnly();
    }

    this.#watchDownloads();
    this.#rememberSize();
    this.#nameWindow();

    // The space the page would go to can change while this window is in the
    // background.
    window.addEventListener("activate", () => this.#updateOpenLabel());

    gZenWorkspaces.promiseInitialized.then(() => {
      gBrowser.tabContainer.addEventListener("TabSelect", () =>
        this.#updateContainerPill()
      );
      this.#applyContainerToSpace();
      this.#updateOpenLabel();
      this.#updateContainerPill();
      if (!this.#urlbarOnly) {
        this.#maybeShowIntro();
      }
    });
  }

  async #watchDownloads() {
    const list = await window.Downloads.getList(window.Downloads.ALL);
    if (window.closed) {
      return;
    }
    const cards = new Map();
    let isListening = false;
    const view = {
      onDownloadAdded: download => {
        if (isListening && this.#isOwnDownload(download)) {
          cards.set(download, this.#showDownload(download));
        }
      },
      onDownloadChanged: download => {
        const card = cards.get(download);
        if (card) {
          this.#updateDownload(card, download);
        }
      },
      onDownloadRemoved: download => {
        cards.get(download)?.remove();
        cards.delete(download);
      },
    };
    window.addEventListener("unload", () => list.removeView(view), {
      once: true,
    });
    await list.addView(view);
    isListening = true;
  }

  #isOwnDownload(download) {
    const context = BrowsingContext.get(download.source.browsingContextId);
    return context?.topChromeWindow == window;
  }

  #showDownload(download) {
    let container = document.getElementById("zen-little-window-downloads");
    if (!container) {
      container = document.createXULElement("hbox");
      container.id = "zen-little-window-downloads";
      document.getElementById("tabbrowser-tabbox").append(container);
    }
    const fileName = PathUtils.filename(download.target.path);
    const card = window.MozXULElement.parseXULToFragment(`
      <hbox class="zen-little-window-download" align="center" role="button" tabindex="0">
        <hbox class="zen-little-window-download-progress" align="center" pack="center">
          <image class="zen-little-window-download-icon" />
        </hbox>
        <vbox flex="1">
          <label class="zen-little-window-download-name" crop="center" />
          <label class="zen-little-window-download-status" crop="end" />
          <label class="zen-little-window-download-source" crop="end" />
        </vbox>
        <toolbarbutton class="zen-little-window-download-close close-icon"
                       data-l10n-id="urlbar-search-mode-indicator-close" />
      </hbox>
    `).firstElementChild;
    card.querySelector("image").src = `moz-icon://${fileName}?size=32`;
    card.querySelector(".zen-little-window-download-name").value = fileName;
    const source = card.querySelector(".zen-little-window-download-source");
    try {
      document.l10n.setAttributes(source, "zen-little-window-download-source", {
        host: Services.io.newURI(download.source.url).displayHost,
      });
    } catch {
      source.hidden = true;
    }
    this.#updateDownload(card, download);
    const closeButton = card.querySelector(".zen-little-window-download-close");
    closeButton.addEventListener("command", () => {
      if (!download.stopped) {
        download
          .cancel()
          .then(() => download.removePartialData())
          .catch(console.error);
      }
      card.remove();
    });
    this.#onActivate(card, event => {
      if (!closeButton.contains(event.target) && download.succeeded) {
        download.showContainingDirectory();
      }
    });
    container.append(card);
    return card;
  }

  #updateDownload(card, download) {
    const isDownloading = !download.stopped;
    card.toggleAttribute("done", download.succeeded);
    card.toggleAttribute("downloading", isDownloading);
    if (!isDownloading) {
      return;
    }
    card.style.setProperty(
      "--zen-little-window-download-progress",
      `${download.hasProgress ? download.progress : 0}%`
    );
    const [statusText, secondsLeft] = lazy.DownloadUtils.getDownloadStatus(
      download.currentBytes,
      download.hasProgress ? download.totalBytes : -1,
      download.speed,
      card._secondsLeft
    );
    card._secondsLeft = secondsLeft;
    card.querySelector(".zen-little-window-download-status").value = statusText;
  }

  async #nameWindow() {
    const windowName = await document.l10n.formatValue(
      "zen-little-window-title"
    );
    if (window.closed) {
      return;
    }
    const getTitle = gBrowser.getWindowTitleForBrowser.bind(gBrowser);
    gBrowser.getWindowTitleForBrowser = browser => {
      const brand = document.getElementById("mainWindowTitle")?.textContent;
      const parts = getTitle(browser)
        .split(" — ")
        .filter(part => part && part != brand);
      return [...parts, windowName].join(" — ");
    };
    gBrowser.updateTitlebar();
  }

  #rememberSize() {
    window.addEventListener("resize", () => {
      if (!this.#urlbarOnly && window.windowState == window.STATE_NORMAL) {
        this.#sizeToRemember = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
      }
    });
    window.addEventListener(
      "unload",
      () => {
        if (this.#sizeToRemember) {
          lazy.ZenLittleWindow.rememberWindowSize(this.#sizeToRemember);
        }
      },
      { once: true }
    );
  }

  #maybeShowIntro() {
    if (Services.prefs.getBoolPref(INTRO_DISMISSED_PREF, false)) {
      return;
    }
    const fragment = window.MozXULElement.parseXULToFragment(`
      <vbox id="zen-little-window-intro">
        <hbox align="start">
          <html:span id="zen-little-window-intro-title"
                     data-l10n-id="zen-little-window-intro-title"><html:i data-l10n-name="name"></html:i></html:span>
          <spacer flex="1" />
          <toolbarbutton id="zen-little-window-intro-close"
                         class="close-icon"
                         data-l10n-id="urlbar-search-mode-indicator-close" />
        </hbox>
        <description id="zen-little-window-intro-description" />
      </vbox>
    `);
    const intro = fragment.querySelector("#zen-little-window-intro");
    const closeKey = document.getElementById("key_close");
    document.l10n.setAttributes(
      fragment.querySelector("#zen-little-window-intro-description"),
      "zen-little-window-intro-description",
      {
        shortcut: closeKey ? lazy.ShortcutUtils.prettifyShortcut(closeKey) : "",
      }
    );
    fragment
      .querySelector("#zen-little-window-intro-close")
      .addEventListener("command", () => {
        Services.prefs.setBoolPref(INTRO_DISMISSED_PREF, true);
        intro.remove();
      });
    document.getElementById("tabbrowser-tabbox").append(fragment);
  }

  /** @returns {boolean} Whether the window is still only its URL bar. */
  get isUrlbarOnly() {
    return this.#urlbarOnly;
  }

  /** @returns {number} The container new tabs of this window open in. */
  get userContextId() {
    return this.#userContextId;
  }

  /**
   * Sends the tabs of this window to a space and closes the window.
   *
   * @param {string} [aSpaceId] The active space if omitted.
   */
  openInSpace(aSpaceId = null) {
    return lazy.ZenLittleWindow.openInSpace(window, aSpaceId).catch(
      console.error
    );
  }

  /**
   * Runs a callback when a control that is not a native button is clicked
   * or, while it has the focus the toolbar keyboard navigation gives it,
   * Enter or Space is pressed.
   *
   * @param {Element} aElement
   * @param {function(Event): void} aCallback
   */
  #onActivate(aElement, aCallback) {
    aElement.addEventListener("click", event => {
      if (event.button == 0) {
        aCallback(event);
      }
    });
    aElement.addEventListener("keypress", event => {
      if (
        event.target == aElement &&
        (event.key == "Enter" || event.key == " ")
      ) {
        event.preventDefault();
        aCallback(event);
      }
    });
  }

  // Mark: URL bar only

  #initUrlbarOnly() {
    document.documentElement.style.setProperty(
      URLBAR_ONLY_WIDTH_PROPERTY,
      `${window.innerWidth}px`
    );
    this.#urlbarOnlyObserver = new ResizeObserver(() => this.#fitToUrlbar());
    this.#urlbarOnlyObserver.observe(document.getElementById("urlbar"));
    Services.obs.addObserver(this, URLBAR_NAVIGATION_TOPIC);
    this.#isWatchingUrlbar = true;
    window.addEventListener("unload", () => this.#stopWatchingUrlbar(), {
      once: true,
    });

    this.#urlbarOnlyProgressListener = {
      onStateChange: (browser, webProgress, request, stateFlags) => {
        if (
          webProgress.isTopLevel &&
          stateFlags & Ci.nsIWebProgressListener.STATE_START &&
          stateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK &&
          request instanceof Ci.nsIChannel
        ) {
          this.#maybeLeaveUrlbarOnly(request.URI);
        }
      },
      onLocationChange: (browser, webProgress, request, uri) => {
        if (webProgress.isTopLevel) {
          this.#maybeLeaveUrlbarOnly(uri);
        }
      },
    };
    delayedStartupPromise.then(() => {
      if (!this.#urlbarOnly) {
        return;
      }
      gBrowser.addTabsProgressListener(this.#urlbarOnlyProgressListener);
      gURLBar.controller.addListener(this);
      gURLBar.inputField.addEventListener("blur", this.#urlbarBlurListener);
    });
  }

  observe(aSubject, aTopic) {
    if (
      aTopic == URLBAR_NAVIGATION_TOPIC &&
      Services.focus.activeWindow == window
    ) {
      this.#isNavigating = true;
    }
  }

  onViewClose() {
    this.#closeUnlessNavigating();
  }

  #onUrlbarBlur(aEvent) {
    if (
      !gURLBar.contains(aEvent.relatedTarget) &&
      !Services.prefs.getBoolPref("ui.popup.disable_autohide", false)
    ) {
      this.#closeUnlessNavigating();
    }
  }

  #returnToPreviousApp() {
    if (
      window._zenReturnsToPreviousApplication &&
      (this.#isActive || Services.focus.activeWindow == window)
    ) {
      delete window._zenReturnsToPreviousApplication;
      // eslint-disable-next-line mozilla/valid-services
      Services.zen.returnToPreviousApplication();
    }
  }

  #onDeactivated() {
    this.#isActive = false;
    const active = Services.focus.activeWindow;
    if (active && active != window) {
      delete window._zenReturnsToPreviousApplication;
    }
  }

  #closeUnlessNavigating() {
    if (!this.#urlbarOnly || this.#isNavigating || this.#isWaitingToShow) {
      return;
    }
    this.#returnToPreviousApp();
    this.#baseWindow.visibility = false;
    setTimeout(() => {
      if (window.closed) {
        return;
      }
      if (this.#isNavigating) {
        this.#baseWindow.visibility = true;
      } else {
        window.close();
      }
    }, 0);
  }

  #stopWatchingUrlbar() {
    if (!this.#isWatchingUrlbar) {
      return;
    }
    this.#isWatchingUrlbar = false;
    Services.obs.removeObserver(this, URLBAR_NAVIGATION_TOPIC);
    window.gURLBar?.controller.removeListener(this);
    window.gURLBar?.inputField.removeEventListener(
      "blur",
      this.#urlbarBlurListener
    );
  }

  async #showWithUrlbarReady() {
    try {
      const ready = Promise.all([
        this.#urlbarQuerySettled(),
        this.#urlbarPlaceholderSettled(),
      ]);
      gURLBar.search("");
      await ready;
    } catch (e) {
      console.error(e);
    }
    if (window.closed) {
      return;
    }
    const height = this.#fitToUrlbar() ?? window.outerHeight;
    this.#shownHeight = height;
    const { availLeft, availTop, availWidth, availHeight } = window.screen;
    window.moveTo(
      Math.round(availLeft + (availWidth - window.outerWidth) / 2),
      Math.round(availTop + (availHeight - height) / 2)
    );
    this.#isWaitingToShow = false;
    this.#baseWindow.visibility = true;
    window.focus();
  }

  async #urlbarPlaceholderSettled() {
    try {
      await gURLBar.controller.engineStore.init();
    } catch {
      // Without the search service the placeholder never gets a name.
    }
    gURLBar._setPlaceholder(null);
    await document.l10n.translateElements([gURLBar.inputField]);
  }

  #urlbarQuerySettled() {
    return new Promise(resolve => {
      let cancelled = false;
      const listener = {
        onQueryStarted: () => {
          cancelled = false;
        },
        onQueryCancelled: () => {
          cancelled = true;
        },
        onQueryFinished: () => {
          if (!cancelled) {
            gURLBar.controller.removeListener(listener);
            resolve();
          }
        },
      };
      gURLBar.controller.addListener(listener);
    });
  }

  #limitsApplied() {
    return new Promise(resolve =>
      requestAnimationFrame(() => setTimeout(resolve, 0))
    );
  }

  /** @returns {number|null} The height the window is given, if any. */
  #fitToUrlbar() {
    if (!this.#urlbarOnly) {
      return null;
    }
    const height = Math.ceil(
      document.getElementById("urlbar").getBoundingClientRect().height
    );
    if (height <= 0) {
      return null;
    }
    const root = document.documentElement;
    root.style.setProperty(URLBAR_ONLY_HEIGHT_PROPERTY, `${height}px`);
    if (this.#isWaitingToShow) {
      window.resizeBy(0, height - window.innerHeight);
      return height;
    }
    this.#limitsApplied().then(() => {
      if (this.#urlbarOnly && height != window.innerHeight) {
        window.resizeBy(0, height - window.innerHeight);
      }
    });
    return height;
  }

  #maybeLeaveUrlbarOnly(aURI) {
    if (!this.#urlbarOnly || !aURI || window.isBlankPageURL(aURI.spec)) {
      return;
    }
    this.#urlbarOnly = false;
    this.#urlbarOnlyObserver.disconnect();
    this.#urlbarOnlyObserver = null;
    this.#stopWatchingUrlbar();
    gBrowser.removeTabsProgressListener(this.#urlbarOnlyProgressListener);
    this.#urlbarOnlyProgressListener = null;
    const root = document.documentElement;
    root.removeAttribute(URLBAR_ONLY_ATTRIBUTE);
    root.style.removeProperty(URLBAR_ONLY_WIDTH_PROPERTY);
    root.style.removeProperty(URLBAR_ONLY_HEIGHT_PROPERTY);

    this.#limitsApplied().then(() => {
      const { width, height } = lazy.ZenLittleWindow.windowSize;
      const { availLeft, availTop, availWidth, availHeight } = window.screen;
      const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
      const x = clamp(
        window.screenX - Math.round((width - window.outerWidth) / 2),
        availLeft,
        availLeft + availWidth - width
      );
      const y = clamp(
        window.screenY - Math.round((height - this.#shownHeight) / 2),
        availTop,
        availTop + availHeight - height
      );
      window.resizeTo(width, height);
      window.moveTo(x, y);
      this.#maybeShowIntro();
    });
  }

  // Mark: open in space

  // Closes the open URL bar, which for a window that is only its URL bar is
  // the window.
  #buildUrlbarCloseButton() {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <hbox id="zen-little-window-urlbar-close"
            class="urlbar-page-action"
            role="button"
            data-l10n-id="urlbar-search-mode-indicator-close">
        <image class="urlbar-icon" />
      </hbox>
    `);
    this.#onActivate(
      fragment.querySelector("#zen-little-window-urlbar-close"),
      () => {
        if (this.#urlbarOnly) {
          window.close();
          return;
        }
        gURLBar.view.close();
        gURLBar.handleRevert();
        gBrowser.selectedBrowser.focus();
      }
    );
    document.querySelector("#urlbar .urlbar-input-container").append(fragment);
  }

  #buildOpenInSpace() {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <hbox id="zen-little-window-open-in-space" align="center">
        <hbox id="zen-little-window-open-button" role="button" align="center">
          <html:span id="zen-little-window-open-label"><html:b data-l10n-name="space"></html:b></html:span>
          <label id="zen-little-window-open-shortcut" />
        </hbox>
        <toolbarbutton id="zen-little-window-spaces-button"
                       type="menu"
                       data-l10n-id="zen-little-window-choose-space">
          <menupopup id="zen-little-window-spaces-popup"
                     position="bottomright topright" />
        </toolbarbutton>
      </hbox>
    `);
    this.#openLabel = fragment.querySelector("#zen-little-window-open-label");

    const shortcut = fragment.querySelector("#zen-little-window-open-shortcut");
    const key = document.getElementById("zen-glance-expand");
    shortcut.value = key ? lazy.ShortcutUtils.prettifyShortcut(key) : "";
    shortcut.hidden = !shortcut.value;

    const button = fragment.querySelector("#zen-little-window-open-button");
    this.#onActivate(button, () => this.openInSpace());

    const popup = fragment.querySelector("#zen-little-window-spaces-popup");
    popup.addEventListener("popupshowing", () => this.#fillSpacesPopup(popup));
    popup.addEventListener("command", event => {
      this.openInSpace(event.target.getAttribute("zen-workspace-id"));
    });

    // Away from the window buttons, which are on the right unless the
    // platform puts them on the left.
    const target = document.getElementById("nav-bar-customization-target");
    if (gZenVerticalTabsManager.isWindowsStyledButtons) {
      const spaces = fragment.querySelector("#zen-little-window-spaces-button");
      popup.setAttribute("position", "bottomleft topleft");
      spaces.parentElement.prepend(spaces);
      target.before(fragment);
    } else {
      target.after(fragment);
    }
  }

  #fillSpacesPopup(aPopup) {
    const { active, spaces } = lazy.ZenLittleWindow.getSpaces();
    aPopup.replaceChildren();
    for (const space of spaces) {
      const item = document.createXULElement("menuitem");
      item.setAttribute("zen-workspace-id", space.uuid);
      const isSvg = space.icon?.endsWith(".svg");
      item.setAttribute(
        "label",
        space.icon && !isSvg ? `${space.icon}  ${space.name}` : space.name
      );
      if (isSvg) {
        item.classList.add("menuitem-iconic");
        item.setAttribute("image", space.icon);
      }
      if (space.uuid === active?.uuid) {
        item.setAttribute("type", "radio");
        item.setAttribute("checked", "true");
      }
      aPopup.appendChild(item);
    }
  }

  /**
   * Shortens a space's name to fit the button, dropping its middle so both
   * ends stay readable. Segmented by grapheme so an emoji is never cut apart.
   *
   * @param {string} aName The space's full name.
   * @returns {string} The name, at most 16 long.
   */
  #shortenSpaceName(aName) {
    let units;
    try {
      units = [...lazy.graphemes.segment(aName)].map(part => part.segment);
    } catch {
      units = Array.from(aName);
    }
    if (units.length <= 16) {
      return aName;
    }
    const kept = 16 - 1;
    const head = Math.ceil(kept / 2);
    return (
      units.slice(0, head).join("") +
      "\u2026" +
      units.slice(units.length - (kept - head)).join("")
    );
  }

  #updateOpenLabel() {
    const { active } = lazy.ZenLittleWindow.getSpaces();
    this.#openLabel.title = active?.name ?? "";
    if (active) {
      document.l10n.setAttributes(
        this.#openLabel,
        "zen-little-window-open-in-space",
        { space: this.#shortenSpaceName(active.name) }
      );
    } else {
      document.l10n.setAttributes(
        this.#openLabel,
        "zen-little-window-open-in-new-window"
      );
    }
  }

  // Mark: container

  #buildContainerPill() {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <hbox id="zen-little-window-container" class="no-squircles" role="button" aria-haspopup="menu" align="center">
        <image id="zen-little-window-container-icon" />
        <label id="zen-little-window-container-label" />
        <menupopup id="zen-little-window-container-popup" />
      </hbox>
    `);
    this.#containerPill = fragment.querySelector(
      "#zen-little-window-container"
    );
    const popup = fragment.querySelector("#zen-little-window-container-popup");
    this.#onActivate(this.#containerPill, event => {
      if (event.target.closest("menupopup") != popup) {
        popup.openPopup(this.#containerPill, "after_start");
      }
    });
    popup.addEventListener("popupshowing", event =>
      this.#fillContainerPopup(event)
    );
    popup.addEventListener("command", event => this.#setContainer(event));
    document.querySelector("#urlbar .urlbar-input-container").prepend(fragment);
  }

  get #currentUserContextId() {
    const tab = window.gBrowser?.selectedTab;
    if (!tab || tab.hasAttribute("zen-empty-tab")) {
      return this.#userContextId;
    }
    return tab.userContextId ?? 0;
  }

  #fillContainerPopup(aEvent) {
    window.createUserContextMenu(aEvent, {
      isContextMenu: true,
      excludeUserContextId: this.#currentUserContextId,
      showDefaultTab: true,
      showAddContainer: false,
    });
    const defaultItem = aEvent.target.querySelector('[data-usercontextid="0"]');
    if (defaultItem) {
      defaultItem.removeAttribute("data-l10n-id");
      defaultItem.label = lazy.l10n.formatValueSync(DEFAULT_CONTAINER_L10N_ID);
    }
  }

  #updateContainerPill() {
    const userContextId = this.#currentUserContextId;
    const identity = userContextId
      ? ContextualIdentityService.getPublicIdentityFromId(userContextId)
      : null;
    const icon = this.#containerPill.querySelector("image");
    const label = this.#containerPill.querySelector("label");
    if (identity) {
      label.value =
        ContextualIdentityService.getUserContextLabel(userContextId);
      icon.setAttribute(
        "src",
        ContextualIdentityService.getContainerIconURL(identity.icon)
      );
      icon.hidden = false;
      this.#containerPill.style.setProperty(
        "--zen-little-window-container-color",
        ContextualIdentityService.getContainerColorCode(identity.color)
      );
    } else {
      label.value = lazy.l10n.formatValueSync(DEFAULT_CONTAINER_L10N_ID);
      icon.removeAttribute("src");
      icon.hidden = true;
      this.#containerPill.style.removeProperty(
        "--zen-little-window-container-color"
      );
    }
  }

  #applyContainerToSpace() {
    const space = gZenWorkspaces.getActiveWorkspaceFromCache();
    if (space) {
      space.containerTabId = this.#userContextId;
    }
  }

  #setContainer(aEvent) {
    const userContextId = parseInt(
      aEvent.target.getAttribute("data-usercontextid"),
      10
    );
    if (Number.isNaN(userContextId)) {
      return;
    }
    this.#userContextId = userContextId;
    this.#applyContainerToSpace();

    const tab = gBrowser.selectedTab;
    if (tab.userContextId != userContextId) {
      TabContextMenu.contextTabs = [tab];
      TabContextMenu.reopenInContainer(aEvent);
      TabContextMenu.contextTabs = null;
      gBrowser.removeTab(tab, { animate: false });
    }
    this.#updateContainerPill();
  }
}

window.gZenLittleWindow = new nsZenLittleWindow();
