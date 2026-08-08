/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const ZEN_STANDALONE_WINDOW_TYPE = "zen:external-link-standalone";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

const STANDALONE_WINDOW_HIDDEN_ELEMENT_IDS = [
  "navigator-toolbox",
  "TabsToolbar",
  "tabbrowser-tabs",
  "zen-tabs-wrapper",
  "zen-essentials",
  "zen-workspaces-button",
  "zen-sidebar-foot-buttons",
  "sidebar-container",
  "sidebar-launcher-splitter",
  "sidebar-box",
  "sidebar-splitter",
  "ai-window",
  "ai-window-splitter",
];

class nsZenStandaloneWindowManager {
  /**
   * Entry point for links opened from outside Zen.
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

    this.initializeStandaloneWindow(standaloneWindow, request);
    this.registerStandaloneWindowLifecycle(standaloneWindow, request);
    return true;
  }

  /**
   * Normalizes the external-link request into the data every later lifecycle
   * step will receive.
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

    return {
      uriString,
      options: { ...options },
      openerWindow,
      source: "external",
      targetRoute: this.getDefaultKeepTargetRoute(openerWindow),
    };
  }

  /**
   * Constructs the standalone popup-like browser window.
   *
   * @param {object} request - Normalized standalone window request
   * @returns {Window|null} The created standalone window, or null to fall back
   */
  constructStandaloneWindow(request) {
    const standaloneURL = this.getStandaloneWindowInitialURL(request);
    const features = this.getStandaloneWindowFeatures(request);
    if (!standaloneURL || !features) {
      return null;
    }

    try {
      Services.io.newURI(standaloneURL);

      const openerWindow = request.openerWindow;
      const args = Cc["@mozilla.org/supports-string;1"].createInstance(
        Ci.nsISupportsString
      );
      args.data = standaloneURL;

      const standaloneWindow = lazy.BrowserWindowTracker.openWindow({
        private: lazy.PrivateBrowsingUtils.isWindowPrivate(openerWindow),
        features,
        all: false,
        openerWindow,
        args,
        zenSyncedWindow: false,
      });

      if (standaloneWindow) {
        standaloneWindow._zenStartupSyncFlag = "unsynced";
        standaloneWindow.ZenExternalLinkStandaloneType =
          ZEN_STANDALONE_WINDOW_TYPE;
      }

      return standaloneWindow ?? null;
    } catch (error) {
      console.error("Failed to construct Zen standalone window", error);
      return null;
    }
  }

  /**
   * Resolves the initial URL loaded by the standalone window.
   *
   * @param {object} request - Normalized standalone window request
   * @returns {string} URL to load in the standalone window
   */
  getStandaloneWindowInitialURL(request) {
    return request.uriString;
  }

  /**
   * Builds the native window feature list for the popup-like standalone window.
   *
   * @param {object} request - Normalized standalone window request
   * @returns {string} Comma-separated window feature string
   */
  getStandaloneWindowFeatures(request) {
    void request;
    const width = Services.prefs.getIntPref(
      "zen.standalone-window.default-width",
      1280
    );
    const height = Services.prefs.getIntPref(
      "zen.standalone-window.default-height",
      820
    );
    return [
      "chrome",
      "popup",
      "resizable",
      "centerscreen",
      `width=${width}`,
      `height=${height}`,
    ].join(",");
  }

  /**
   * Applies standalone-window state and UI once the window exists.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @param {object} request - Normalized standalone window request
   */
  initializeStandaloneWindow(standaloneWindow, request) {
    this.markWindowAsStandalone(standaloneWindow, request);
    this.applyStandaloneWindowState(standaloneWindow, request);
    this.initializeStandaloneToolbar(standaloneWindow, request);
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

    standaloneWindow.ZenExternalLinkStandalone = {
      source: request.source,
      uriString: request.uriString,
      targetRoute: request.targetRoute,
    };
  }

  /**
   * Applies standalone-only window and DOM state.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @param {object} request - Normalized standalone window request
   */
  applyStandaloneWindowState(standaloneWindow, request) {
    if (!standaloneWindow) {
      return;
    }

    standaloneWindow._zenStartupSyncFlag = "unsynced";
    standaloneWindow.ZenExternalLinkStandaloneType =
      ZEN_STANDALONE_WINDOW_TYPE;

    const applyState = () => {
      this.markStandaloneDocument(standaloneWindow, request);
      this.hideStandaloneWorkspaceChrome(standaloneWindow);
      standaloneWindow.gZenUIManager?.updateTabsToolbar?.();
    };

    applyState();

    if (standaloneWindow.gBrowserInit?.delayedStartupFinished) {
      return;
    }

    const observer = subject => {
      if (subject !== standaloneWindow) {
        return;
      }
      Services.obs.removeObserver(
        observer,
        "browser-delayed-startup-finished"
      );
      applyState();
    };

    Services.obs.addObserver(observer, "browser-delayed-startup-finished");
    standaloneWindow.addEventListener(
      "unload",
      () => {
        try {
          Services.obs.removeObserver(
            observer,
            "browser-delayed-startup-finished"
          );
        } catch {
          // The observer may already have run.
        }
      },
      { once: true }
    );
  }

  /**
   * Marks the chrome document as a standalone external-link window.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @param {object} request - Normalized standalone window request
   */
  markStandaloneDocument(standaloneWindow, request) {
    const root = standaloneWindow.document?.documentElement;
    if (!root) {
      return;
    }

    root.setAttribute("zen-standalone-window", "true");
    root.setAttribute("zen-standalone-window-type", ZEN_STANDALONE_WINDOW_TYPE);
    root.setAttribute("zen-standalone-window-source", request.source);
    root.setAttribute("zen-unsynced-window", "true");
  }

  /**
   * Hides workspace/sidebar chrome that standalone windows should not expose.
   *
   * @param {Window} standaloneWindow - The created standalone window
   */
  hideStandaloneWorkspaceChrome(standaloneWindow) {
    const document = standaloneWindow.document;
    if (!document) {
      return;
    }

    for (const id of STANDALONE_WINDOW_HIDDEN_ELEMENT_IDS) {
      const element = document.getElementById(id);
      if (element) {
        element.setAttribute("hidden", "true");
      }
    }

    const mainWrapper = document.getElementById("zen-main-app-wrapper");
    mainWrapper?.setAttribute("zen-standalone-window", "true");

    const appContentWrapper = document.getElementById(
      "zen-appcontent-wrapper"
    );
    appContentWrapper?.setAttribute("zen-standalone-window", "true");

    const selectedBrowser = standaloneWindow.gBrowser?.selectedBrowser;
    selectedBrowser?.setAttribute(
      "zen-standalone-window",
      ZEN_STANDALONE_WINDOW_TYPE
    );
  }

  /**
   * Future hook for adding Arc-style top-right standalone-window actions.
   *
   * Expected actions:
   * - Open in the default/most recent space.
   * - Open the space picker and keep in the selected space.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @param {object} request - Normalized standalone window request
   */
  initializeStandaloneToolbar(standaloneWindow, request) {
    const actions = this.getStandaloneToolbarActions(standaloneWindow, request);
    void actions;
  }

  /**
   * Defines the actions the standalone-window toolbar should expose.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @param {object} request - Normalized standalone window request
   * @returns {object} Toolbar action descriptors
   */
  getStandaloneToolbarActions(standaloneWindow, request) {
    void standaloneWindow;
    return {
      openInDefaultSpace: {
        label: "Open in Space",
        targetRoute: request.targetRoute,
      },
      openSpacePicker: {
        label: "Choose Space",
      },
    };
  }

  /**
   * Registers close/unload handling for the standalone window.
   *
   * @param {Window} standaloneWindow - The created standalone window
   * @param {object} request - Normalized standalone window request
   */
  registerStandaloneWindowLifecycle(standaloneWindow, request) {
    void request;
    standaloneWindow?.addEventListener?.(
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
    if (
      !this.isStandaloneWindow(standaloneWindow) ||
      standaloneWindow.closed ||
      standaloneWindow.ZenExternalLinkStandalone?.isClosing
    ) {
      return false;
    }

    if (!this.canCloseStandaloneWindow(standaloneWindow)) {
      return false;
    }

    standaloneWindow.ZenExternalLinkStandalone.isClosing = true;
    standaloneWindow.skipNextCanClose = true;
    try {
      standaloneWindow.close();
      return true;
    } catch (error) {
      standaloneWindow.ZenExternalLinkStandalone.isClosing = false;
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
        if (!browser?.permitUnload) {
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
    if (standaloneWindow?.ZenExternalLinkStandalone) {
      standaloneWindow.ZenExternalLinkStandalone = null;
    }
  }

  /**
   * Keeps a standalone window by opening its URL as a normal Zen tab in a workspace.
   *
   * @param {Window} standaloneWindow - The standalone window to keep
   * @param {string} [targetRoute] - Workspace route or "most-recent-space"
   * @returns {boolean} True when the keep action was handled
   */
  keepStandaloneWindowInSpace(standaloneWindow, targetRoute) {
    const standaloneState = standaloneWindow?.ZenExternalLinkStandalone;
    if (!standaloneState?.uriString) {
      return false;
    }

    const route = this.resolveKeepTargetRoute(standaloneWindow, targetRoute);
    const opened = this.openStandaloneUrlInSpace(
      standaloneState.uriString,
      route,
      standaloneWindow
    );
    if (!opened) {
      return false;
    }

    this.closeStandaloneWindow(standaloneWindow);
    return true;
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
   * @param {string} targetRoute - Selected workspace route
   * @returns {boolean} True when the command was handled
   */
  onOpenInSelectedSpaceCommand(standaloneWindow, targetRoute) {
    return this.keepStandaloneWindowInSpace(standaloneWindow, targetRoute);
  }

  /**
   * Future hook for opening the standalone-window space picker.
   *
   * @param {Window} standaloneWindow - The standalone window whose picker should open
   * @returns {boolean} True when the picker was opened
   */
  openStandaloneSpacePicker(standaloneWindow) {
    void standaloneWindow;
    return false;
  }

  /**
   * Resolves which route should receive the kept standalone window.
   *
   * @param {Window} standaloneWindow - The standalone window to keep
   * @param {string} [targetRoute] - Optional route selected by the user
   * @returns {string} Workspace route or "most-recent-space"
   */
  resolveKeepTargetRoute(standaloneWindow, targetRoute) {
    return (
      targetRoute ??
      standaloneWindow?.ZenExternalLinkStandalone?.targetRoute ??
      "most-recent-space"
    );
  }

  /**
   * Future hook for opening a kept standalone-window URL into the requested Zen space.
   *
   * @param {string} uriString - Standalone window URL to keep
   * @param {string} targetRoute - Workspace route or "most-recent-space"
   * @param {Window} standaloneWindow - The standalone window being kept
   * @returns {boolean} True when the normal tab was opened
   */
  openStandaloneUrlInSpace(uriString, targetRoute, standaloneWindow) {
    void uriString;
    void targetRoute;
    void standaloneWindow;
    return false;
  }

  /**
   * Default workspace route used by the primary "Open in Space" action.
   *
   * @param {Window} openerWindow - Browser window that received the external open request
   * @returns {string} Default target route
   */
  getDefaultKeepTargetRoute(openerWindow) {
    void openerWindow;
    return "most-recent-space";
  }
}

export const gZenStandaloneWindowManager = new nsZenStandaloneWindowManager();
