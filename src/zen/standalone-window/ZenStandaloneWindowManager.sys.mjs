/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const ZEN_STANDALONE_WINDOW_TYPE = "zen:external-link-standalone";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

const STANDALONE_WINDOW_TOOLBAR_ID = "zen-standalone-window-toolbar";
const STANDALONE_WINDOW_OPEN_IN_SPACE_BUTTON_ID =
  "zen-standalone-window-open-in-space-button";
const STANDALONE_WINDOW_SPACE_PICKER_BUTTON_ID =
  "zen-standalone-window-space-picker-button";
const STANDALONE_WINDOW_SPACE_PICKER_POPUP_ID =
  "zen-standalone-window-space-picker-popup";
const STANDALONE_WINDOW_CLOSE_BUTTON_ID = "zen-standalone-window-close-button";

// Successive standalone windows are offset from each other so that opening
// several external links in a row does not stack them in one spot.
const STANDALONE_WINDOW_CASCADE_STEP = 28;
const STANDALONE_WINDOW_CASCADE_LENGTH = 8;

class nsZenStandaloneWindowManager {
  #cascadeIndex = 0;

  /**
   * Entry point for links opened from outside Zen.
   *
   * The standalone window is created synchronously so the caller can early-exit
   * out of the normal addTab path, but everything that touches the new window's
   * chrome happens once `browser-delayed-startup-finished` has fired for it.
   *
   * @param {object} params - Standalone window launch params
   * @param {string} params.uriString - The external URL to open
   * @param {object} params.options - Original addTab options
   * @param {Window} params.openerWindow - Browser window that received the external open request
   * @returns {boolean} True when the external URL was handled as a standalone window
   */
  openExternalLinkStandaloneWindow({ uriString, options, openerWindow }) {
    const request = this.createExternalLinkStandaloneWindowRequest({
      uriString,
      options,
      openerWindow,
    });
    if (!request) {
      return false;
    }

    const standaloneWindow = this.constructStandaloneWindow(request);
    if (!standaloneWindow) {
      return false;
    }

    this.markWindowAsStandalone(standaloneWindow, request);
    this.#initializeStandaloneWindow(standaloneWindow).catch(console.error);
    return true;
  }

  /**
   * Normalizes the external-link request into the data every later lifecycle
   * step will receive.
   *
   * The security and container context of the original open is captured here so
   * that the keep path can reproduce the load faithfully instead of re-opening
   * the URL with the system principal.
   *
   * @param {object} params - Standalone window launch params
   * @param {string} params.uriString - The external URL to open
   * @param {object} params.options - Original addTab options
   * @param {Window} params.openerWindow - Browser window that received the external open request
   * @returns {object|null} A normalized standalone window request, or null when invalid
   */
  createExternalLinkStandaloneWindowRequest({
    uriString,
    options,
    openerWindow,
  }) {
    if (typeof uriString !== "string" || !uriString || !openerWindow) {
      return null;
    }

    try {
      Services.io.newURI(uriString);
    } catch (error) {
      console.error("Cannot open an invalid URL in a standalone window", error);
      return null;
    }

    return {
      uriString,
      openerWindow,
      source: "external",
      isPrivate: lazy.PrivateBrowsingUtils.isWindowPrivate(openerWindow),
      triggeringPrincipal: options?.triggeringPrincipal ?? null,
      referrerInfo: options?.referrerInfo ?? null,
      policyContainer: options?.policyContainer ?? null,
      userContextId: options?.userContextId ?? 0,
      targetRoute: this.getDefaultKeepTargetRoute(openerWindow),
    };
  }

  /**
   * Constructs the standalone browser window.
   *
   * @param {object} request - Normalized standalone window request
   * @returns {Window|null} The created standalone window, or null to fall back
   */
  constructStandaloneWindow(request) {
    try {
      const args = Cc["@mozilla.org/supports-string;1"].createInstance(
        Ci.nsISupportsString
      );
      args.data = request.uriString;

      const standaloneWindow = lazy.BrowserWindowTracker.openWindow({
        private: request.isPrivate,
        features: this.getStandaloneWindowFeatures(request),
        all: true,
        openerWindow: request.openerWindow,
        args,
        zenSyncedWindow: false,
        zenStandaloneWindow: true,
      });
      if (!standaloneWindow) {
        return null;
      }

      standaloneWindow._zenStartupSyncFlag = "unsynced";
      standaloneWindow.ZenExternalLinkStandaloneType =
        ZEN_STANDALONE_WINDOW_TYPE;
      if (request.userContextId) {
        // Honoured by the Zen tabbrowser patch when the window opens its first
        // tab, so an external link into a container keeps that container.
        standaloneWindow._zenStartupUnsyncedUserContextId =
          request.userContextId;
      }

      return standaloneWindow;
    } catch (error) {
      console.error("Failed to construct Zen standalone window", error);
      return null;
    }
  }

  /**
   * Builds the native window feature list for the standalone window.
   *
   * @param {object} request - Normalized standalone window request
   * @returns {string} Comma-separated window feature string
   */
  getStandaloneWindowFeatures(request) {
    const width = Services.prefs.getIntPref(
      "zen.standalone-window.default-width",
      1280
    );
    const height = Services.prefs.getIntPref(
      "zen.standalone-window.default-height",
      820
    );
    const { left, top } = this.#getCascadedPosition(
      request.openerWindow,
      width,
      height
    );

    return [
      "chrome",
      "resizable",
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
    ].join(",");
  }

  /**
   * Places each standalone window slightly below and right of the previous one,
   * starting from the centre of the opener's screen.
   *
   * @param {Window} openerWindow - Browser window that received the external open request
   * @param {number} width - Standalone window width
   * @param {number} height - Standalone window height
   * @returns {{left: number, top: number}} Screen coordinates for the new window
   */
  #getCascadedPosition(openerWindow, width, height) {
    const offset =
      STANDALONE_WINDOW_CASCADE_STEP *
      (this.#cascadeIndex % STANDALONE_WINDOW_CASCADE_LENGTH);
    this.#cascadeIndex++;

    const screen = openerWindow?.screen;
    const availLeft = screen?.availLeft ?? 0;
    const availTop = screen?.availTop ?? 0;
    const availWidth = screen?.availWidth ?? width;
    const availHeight = screen?.availHeight ?? height;

    const maxLeft = availLeft + Math.max(0, availWidth - width);
    const maxTop = availTop + Math.max(0, availHeight - height);
    const baseLeft =
      availLeft + Math.max(0, Math.round((availWidth - width) / 2));
    const baseTop =
      availTop + Math.max(0, Math.round((availHeight - height) / 2));

    return {
      left: Math.round(Math.min(baseLeft + offset, maxLeft)),
      top: Math.round(Math.min(baseTop + offset, maxTop)),
    };
  }

  /**
   * Applies standalone-window state and UI once the window's chrome exists.
   *
   * @param {Window} standaloneWindow - The created standalone window
   */
  async #initializeStandaloneWindow(standaloneWindow) {
    await this.#promiseDelayedStartup(standaloneWindow);
    if (standaloneWindow.closed || !this.isStandaloneWindow(standaloneWindow)) {
      return;
    }

    this.markStandaloneDocument(standaloneWindow);
    this.initializeStandaloneToolbar(standaloneWindow);
    this.registerStandaloneWindowLifecycle(standaloneWindow);
  }

  /**
   * Resolves once the given window has finished delayed startup, or once it has
   * been closed. Registers exactly one observer for the window's lifetime.
   *
   * @param {Window} win - The window to wait for
   * @returns {Promise<void>} Resolves when the window's chrome is usable or gone
   */
  #promiseDelayedStartup(win) {
    if (win.gBrowserInit?.delayedStartupFinished) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const cleanup = () => {
        Services.obs.removeObserver(
          onDelayedStartup,
          "browser-delayed-startup-finished"
        );
        Services.ww.unregisterNotification(onWindowClosed);
      };

      const onDelayedStartup = subject => {
        if (subject !== win) {
          return;
        }
        cleanup();
        resolve();
      };

      const onWindowClosed = (subject, topic) => {
        if (topic !== "domwindowclosed" || subject !== win) {
          return;
        }
        cleanup();
        resolve();
      };

      Services.obs.addObserver(
        onDelayedStartup,
        "browser-delayed-startup-finished"
      );
      Services.ww.registerNotification(onWindowClosed);
    });
  }

  /**
   * Marks a browser window as an external-link standalone window.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @param {object} request - Normalized standalone window request
   */
  markWindowAsStandalone(standaloneWindow, request) {
    if (!standaloneWindow) {
      return;
    }

    standaloneWindow.ZenExternalLinkStandaloneType = ZEN_STANDALONE_WINDOW_TYPE;
    standaloneWindow.ZenExternalLinkStandalone = {
      source: request.source,
      uriString: request.uriString,
      openerWindow: request.openerWindow,
      targetRoute: request.targetRoute,
      triggeringPrincipal: request.triggeringPrincipal,
      referrerInfo: request.referrerInfo,
      policyContainer: request.policyContainer,
      userContextId: request.userContextId,
      toolbar: null,
      isKeeping: false,
      isClosing: false,
    };
  }

  /**
   * Marks the chrome document as a standalone external-link window.
   *
   * The `zen-standalone-window` attribute is normally set by ZenStartup before
   * first paint; this is the late safety net for windows whose startup ran
   * before the attribute could be applied. All standalone-only chrome hiding is
   * driven from that attribute in CSS.
   *
   * @param {Window} standaloneWindow - The created standalone window
   */
  markStandaloneDocument(standaloneWindow) {
    standaloneWindow.document?.documentElement?.setAttribute(
      "zen-standalone-window",
      "true"
    );
  }

  /**
   * Adds the Arc-style standalone-window actions to the top-right of the
   * navigation bar.
   *
   * @param {Window} standaloneWindow - The created standalone window
   */
  initializeStandaloneToolbar(standaloneWindow) {
    const document = standaloneWindow.document;
    if (
      !this.isStandaloneWindow(standaloneWindow) ||
      document.getElementById(STANDALONE_WINDOW_TOOLBAR_ID)
    ) {
      return;
    }

    const anchor = document.getElementById("zen-appcontent-navbar-wrapper");
    if (!anchor) {
      console.error(
        "Zen standalone window has no navbar wrapper to anchor its toolbar to"
      );
      return;
    }

    try {
      const toolbar = document.createXULElement("hbox");
      toolbar.id = STANDALONE_WINDOW_TOOLBAR_ID;
      toolbar.setAttribute("align", "center");

      const listeners = [];
      const addButton = (id, l10nId, handler) => {
        const button = document.createXULElement("toolbarbutton");
        button.id = id;
        button.setAttribute(
          "class",
          "toolbarbutton-1 chromeclass-toolbar-additional"
        );
        document.l10n.setAttributes(button, l10nId);
        button.addEventListener("command", handler);
        listeners.push([button, "command", handler]);
        toolbar.appendChild(button);
        return button;
      };

      const actions = this.getStandaloneToolbarActions(standaloneWindow);

      addButton(
        STANDALONE_WINDOW_OPEN_IN_SPACE_BUTTON_ID,
        "zen-standalone-window-open-in-space",
        () => this.#runToolbarCommand(toolbar, actions.openInDefaultSpace)
      );

      const spacePickerButton = addButton(
        STANDALONE_WINDOW_SPACE_PICKER_BUTTON_ID,
        "zen-standalone-window-choose-space",
        () => actions.openSpacePicker()
      );

      addButton(
        STANDALONE_WINDOW_CLOSE_BUTTON_ID,
        "zen-standalone-window-close",
        () => actions.close()
      );

      const spacePickerPopup = document.createXULElement("menupopup");
      spacePickerPopup.id = STANDALONE_WINDOW_SPACE_PICKER_POPUP_ID;
      const onSpacePickerCommand = event => {
        const workspaceId = event.target
          ?.closest?.("menuitem[zen-workspace-id]")
          ?.getAttribute("zen-workspace-id");
        if (!workspaceId) {
          return;
        }
        this.#runToolbarCommand(toolbar, () =>
          this.onOpenInSelectedSpaceCommand(standaloneWindow, workspaceId)
        );
      };
      spacePickerPopup.addEventListener("command", onSpacePickerCommand);
      listeners.push([spacePickerPopup, "command", onSpacePickerCommand]);
      toolbar.appendChild(spacePickerPopup);

      anchor.appendChild(toolbar);

      standaloneWindow.ZenExternalLinkStandalone.toolbar = {
        root: toolbar,
        spacePickerButton,
        spacePickerPopup,
        listeners,
      };
    } catch (error) {
      console.error("Failed to initialize Zen standalone toolbar", error);
    }
  }

  /**
   * Runs a toolbar command, keeping the buttons disabled while it is in flight
   * so a double click cannot keep the same window twice.
   *
   * @param {Element} toolbar - The standalone toolbar element
   * @param {Function} command - Command returning true when it was handled
   * @returns {boolean} True when the command was handled
   */
  #runToolbarCommand(toolbar, command) {
    for (const button of toolbar.querySelectorAll("toolbarbutton")) {
      button.setAttribute("disabled", "true");
    }

    let handled = false;
    try {
      handled = !!command();
    } finally {
      if (!handled) {
        for (const button of toolbar.querySelectorAll("toolbarbutton")) {
          button.removeAttribute("disabled");
        }
      }
    }
    return handled;
  }

  /**
   * Defines the actions the standalone-window toolbar exposes.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @returns {object} Toolbar action callbacks
   */
  getStandaloneToolbarActions(standaloneWindow) {
    return {
      openInDefaultSpace: () =>
        this.onOpenInDefaultSpaceCommand(standaloneWindow),
      openSpacePicker: () => this.openStandaloneSpacePicker(standaloneWindow),
      close: () => this.closeStandaloneWindow(standaloneWindow),
    };
  }

  /**
   * Removes standalone toolbar controls and listeners.
   *
   * @param {Window} standaloneWindow - The standalone window
   */
  cleanupStandaloneToolbar(standaloneWindow) {
    const toolbar = standaloneWindow?.ZenExternalLinkStandalone?.toolbar;
    if (!toolbar) {
      return;
    }

    for (const [target, type, handler] of toolbar.listeners) {
      target.removeEventListener(type, handler);
    }
    toolbar.root?.remove();
    standaloneWindow.ZenExternalLinkStandalone.toolbar = null;
  }

  /**
   * Registers close/unload handling for the standalone window.
   *
   * @param {Window} standaloneWindow - The created standalone window
   */
  registerStandaloneWindowLifecycle(standaloneWindow) {
    standaloneWindow.addEventListener(
      "unload",
      () => this.onStandaloneWindowClosed(standaloneWindow),
      { once: true }
    );
  }

  /**
   * Handles standalone-window close without keeping it.
   *
   * @param {Window} standaloneWindow - The standalone window being closed
   * @returns {boolean} True when the close was started
   */
  closeStandaloneWindow(standaloneWindow) {
    if (!this.isStandaloneWindow(standaloneWindow) || standaloneWindow.closed) {
      return false;
    }

    const state = standaloneWindow.ZenExternalLinkStandalone;
    if (state.isClosing) {
      return false;
    }

    if (!this.canCloseStandaloneWindow(standaloneWindow)) {
      return false;
    }

    state.isClosing = true;
    // The beforeunload check above stands in for the one window close would
    // otherwise run, so tell the window not to prompt a second time.
    standaloneWindow.skipNextCanClose = true;
    try {
      standaloneWindow.close();
      return true;
    } catch (error) {
      state.isClosing = false;
      standaloneWindow.skipNextCanClose = false;
      console.error("Failed to close Zen standalone window", error);
      return false;
    }
  }

  /**
   * Checks whether a window belongs to this standalone-window feature.
   *
   * @param {Window} standaloneWindow - The window to inspect
   * @returns {boolean} True when this is a standalone external-link window
   */
  isStandaloneWindow(standaloneWindow) {
    return (
      !!standaloneWindow?.ZenExternalLinkStandalone &&
      standaloneWindow.ZenExternalLinkStandaloneType ===
        ZEN_STANDALONE_WINDOW_TYPE
    );
  }

  /**
   * Runs close preflight checks that can be canceled by page beforeunload.
   *
   * @param {Window} standaloneWindow - The standalone window being closed
   * @returns {boolean} True when the window may close
   */
  canCloseStandaloneWindow(standaloneWindow) {
    const browsers = standaloneWindow.gBrowser?.browsers;
    if (!browsers?.length) {
      return true;
    }

    try {
      return browsers.every(browser => {
        if (!browser?.isConnected || !browser.permitUnload) {
          return true;
        }
        return !!browser.permitUnload().permitUnload;
      });
    } catch (error) {
      console.error("Failed to check standalone window unload state", error);
      return false;
    }
  }

  /**
   * Clears transient state after a standalone window closes.
   *
   * @param {Window} standaloneWindow - The closed standalone window
   */
  onStandaloneWindowClosed(standaloneWindow) {
    if (!standaloneWindow?.ZenExternalLinkStandalone) {
      return;
    }

    this.cleanupStandaloneToolbar(standaloneWindow);
    standaloneWindow.ZenExternalLinkStandalone = null;
  }

  /**
   * Keeps a standalone window by moving its tab into a normal Zen space.
   *
   * The tab is adopted rather than re-opened, so session history, scroll offset
   * and form state survive the move and the standalone window closes as part of
   * the same operation instead of afterwards.
   *
   * @param {Window} standaloneWindow - The standalone window to keep
   * @param {string} [targetRoute] - Workspace uuid, or null for the target window's current space
   * @returns {boolean} True when the keep action was handled
   */
  keepStandaloneWindowInSpace(standaloneWindow, targetRoute) {
    if (!this.isStandaloneWindow(standaloneWindow) || standaloneWindow.closed) {
      return false;
    }

    const state = standaloneWindow.ZenExternalLinkStandalone;
    if (state.isKeeping) {
      return false;
    }

    const targetWindow = this.getStandaloneKeepTargetWindow(standaloneWindow);
    if (!targetWindow) {
      console.error("No Zen window is available to keep the standalone URL in");
      return false;
    }

    const route = this.resolveKeepTargetRoute(standaloneWindow, targetRoute);
    let targetWorkspace = null;
    if (route) {
      targetWorkspace = targetWindow.gZenWorkspaces.getWorkspaceFromId(route);
      if (!targetWorkspace) {
        return false;
      }
    }

    state.isKeeping = true;
    try {
      const tab =
        this.adoptStandaloneTab(
          standaloneWindow,
          targetWindow,
          targetWorkspace
        ) ??
        this.reopenStandaloneUrlInSpace(
          standaloneWindow,
          targetWindow,
          targetWorkspace
        );
      if (!tab) {
        state.isKeeping = false;
        return false;
      }

      this.#revealKeptTab(targetWindow, tab, targetWorkspace).catch(
        console.error
      );
      // Adoption closes the standalone window with its last tab; this only has
      // an effect on the re-open fallback path.
      this.closeStandaloneWindow(standaloneWindow);
      return true;
    } catch (error) {
      console.error("Failed to keep Zen standalone window in space", error);
      state.isKeeping = false;
      return false;
    }
  }

  /**
   * Moves the standalone window's live tab into the target window.
   *
   * @param {Window} standaloneWindow - The standalone window being kept
   * @param {Window} targetWindow - The window that should receive the tab
   * @param {object|null} targetWorkspace - Workspace the tab should land in
   * @returns {MozTabbrowserTab|null} The adopted tab, or null when adoption is not possible
   */
  adoptStandaloneTab(standaloneWindow, targetWindow, targetWorkspace) {
    const sourceBrowser = standaloneWindow.gBrowser;
    if (sourceBrowser?.tabs.length !== 1) {
      return null;
    }

    return (
      targetWindow.gBrowser.adoptTab(sourceBrowser.tabs[0], {
        tabIndex: targetWindow.gBrowser.tabs.length,
        selectTab: true,
        spaceId: targetWorkspace?.uuid ?? null,
      }) ?? null
    );
  }

  /**
   * Fallback for when the live tab cannot be adopted, for example across a
   * private/non-private boundary. Re-opens the URL with the principal the
   * external open originally carried rather than escalating to the system
   * principal.
   *
   * @param {Window} standaloneWindow - The standalone window being kept
   * @param {Window} targetWindow - The window that should receive the tab
   * @param {object|null} targetWorkspace - Workspace the tab should land in
   * @returns {MozTabbrowserTab|null} The new tab, or null on failure
   */
  reopenStandaloneUrlInSpace(standaloneWindow, targetWindow, targetWorkspace) {
    const state = standaloneWindow.ZenExternalLinkStandalone;
    const uriString =
      standaloneWindow.gBrowser?.selectedBrowser?.currentURI?.spec ??
      state?.uriString;
    if (!uriString) {
      return null;
    }

    return (
      targetWindow.gBrowser.addTab(uriString, {
        inBackground: false,
        skipRoute: true,
        triggeringPrincipal:
          state.triggeringPrincipal ??
          Services.scriptSecurityManager.createNullPrincipal({}),
        referrerInfo: state.referrerInfo ?? undefined,
        policyContainer: state.policyContainer ?? undefined,
        userContextId: targetWorkspace?.containerTabId ?? state.userContextId,
        zenWorkspaceId: targetWorkspace?.uuid,
      }) ?? null
    );
  }

  /**
   * Files the kept tab in its space and brings it to the front.
   *
   * @param {Window} targetWindow - The window that received the tab
   * @param {MozTabbrowserTab} tab - The kept tab
   * @param {object|null} targetWorkspace - Workspace the tab should land in
   */
  async #revealKeptTab(targetWindow, tab, targetWorkspace) {
    const workspaces = targetWindow.gZenWorkspaces;

    if (targetWorkspace) {
      workspaces.moveTabToWorkspace(tab, targetWorkspace.uuid);
      if (workspaces.activeWorkspace !== targetWorkspace.uuid) {
        await workspaces.changeWorkspace(targetWorkspace);
      }
    }

    if (!targetWindow.closed && !tab.closing) {
      targetWindow.gBrowser.selectedTab = tab;
      targetWindow.focus();
    }
  }

  /**
   * Handles the primary "Open in Space" command.
   *
   * @param {Window} standaloneWindow - The standalone window to keep
   * @returns {boolean} True when the command was handled
   */
  onOpenInDefaultSpaceCommand(standaloneWindow) {
    return this.keepStandaloneWindowInSpace(standaloneWindow);
  }

  /**
   * Handles keeping the standalone window in a user-selected space.
   *
   * @param {Window} standaloneWindow - The standalone window to keep
   * @param {string} targetRoute - Selected workspace uuid
   * @returns {boolean} True when the command was handled
   */
  onOpenInSelectedSpaceCommand(standaloneWindow, targetRoute) {
    return this.keepStandaloneWindowInSpace(standaloneWindow, targetRoute);
  }

  /**
   * Opens the standalone-window space picker.
   *
   * @param {Window} standaloneWindow - The standalone window whose picker should open
   * @returns {boolean} True when the picker was opened
   */
  openStandaloneSpacePicker(standaloneWindow) {
    if (!this.isStandaloneWindow(standaloneWindow)) {
      return false;
    }

    const toolbar = standaloneWindow.ZenExternalLinkStandalone?.toolbar;
    const popup = toolbar?.spacePickerPopup;
    const anchor = toolbar?.spacePickerButton;
    const targetWindow = this.getStandaloneKeepTargetWindow(standaloneWindow);
    const workspaces = targetWindow?.gZenWorkspaces?.getWorkspaces?.() ?? [];
    if (!popup || !anchor || !workspaces.length) {
      return false;
    }

    this.populateStandaloneSpacePicker(popup, workspaces);
    popup.openPopup(anchor, "after_end", 0, 0, false, false);
    return true;
  }

  /**
   * Rebuilds the standalone space picker menu.
   *
   * @param {Element} popup - Standalone space picker popup
   * @param {Array<object>} workspaces - Workspaces available in the target window
   */
  populateStandaloneSpacePicker(popup, workspaces) {
    while (popup.firstChild) {
      popup.firstChild.remove();
    }

    for (const workspace of workspaces) {
      const item = popup.ownerDocument.createXULElement("menuitem");
      item.setAttribute("zen-workspace-id", workspace.uuid);
      item.setAttribute(
        "label",
        this.getStandaloneWorkspacePickerLabel(workspace)
      );

      if (workspace.icon?.endsWith?.(".svg")) {
        item.setAttribute("image", workspace.icon);
        item.classList.add("menuitem-iconic");
      }

      popup.appendChild(item);
    }
  }

  /**
   * Builds the display label for a workspace picker item.
   *
   * @param {object} workspace - Workspace data
   * @returns {string} Menu item label
   */
  getStandaloneWorkspacePickerLabel(workspace) {
    if (workspace.icon && !workspace.icon.endsWith?.(".svg")) {
      return `${workspace.icon}  ${workspace.name}`;
    }

    return workspace.name;
  }

  /**
   * Resolves which space should receive the kept standalone window.
   *
   * @param {Window} standaloneWindow - The standalone window to keep
   * @param {string} [targetRoute] - Optional workspace uuid selected by the user
   * @returns {string|null} Workspace uuid, or null for the target window's current space
   */
  resolveKeepTargetRoute(standaloneWindow, targetRoute) {
    return (
      targetRoute ??
      standaloneWindow?.ZenExternalLinkStandalone?.targetRoute ??
      null
    );
  }

  /**
   * Finds the normal browser window that should receive a kept standalone URL.
   *
   * @param {Window} standaloneWindow - The standalone window being kept
   * @returns {Window|null} Target browser window, or null when none is available
   */
  getStandaloneKeepTargetWindow(standaloneWindow) {
    const openerWindow =
      standaloneWindow?.ZenExternalLinkStandalone?.openerWindow;
    if (this.canKeepStandaloneUrlInWindow(openerWindow)) {
      return openerWindow;
    }

    for (const win of lazy.BrowserWindowTracker.orderedWindows) {
      if (this.canKeepStandaloneUrlInWindow(win)) {
        return win;
      }
    }

    return null;
  }

  /**
   * Checks whether a browser window can receive a kept standalone URL.
   *
   * @param {Window} win - Candidate target window
   * @returns {boolean} True when the window can receive the URL
   */
  canKeepStandaloneUrlInWindow(win) {
    return (
      !!win &&
      !win.closed &&
      !this.isStandaloneWindow(win) &&
      !!win.gBrowser &&
      !!win.gZenWorkspaces?.workspaceEnabled
    );
  }

  /**
   * Space used by the primary "Open in Space" action, captured when the
   * external link arrives so that later space switches do not move the target.
   *
   * @param {Window} openerWindow - Browser window that received the external open request
   * @returns {string|null} Workspace uuid, or null when the opener has no spaces
   */
  getDefaultKeepTargetRoute(openerWindow) {
    const workspaces = openerWindow?.gZenWorkspaces;
    if (!workspaces?.workspaceEnabled) {
      return null;
    }

    return workspaces.activeWorkspace || null;
  }
}

export const gZenStandaloneWindowManager = new nsZenStandaloneWindowManager();
