/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const ZEN_STANDALONE_WINDOW_TYPE = "zen:external-link-standalone";

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "MacDockSupport", () => {
  if (AppConstants.platform !== "macosx") {
    return null;
  }
  try {
    return Cc["@mozilla.org/widget/macdocksupport;1"].getService(
      Ci.nsIMacDockSupport
    );
  } catch (error) {
    console.error(
      "Zen standalone windows cannot reach macOS dock support",
      error
    );
    return null;
  }
});

const STANDALONE_WINDOW_TOOLBAR_ID = "zen-standalone-window-toolbar";
const STANDALONE_WINDOW_KEEP_CONTROL_ID = "zen-standalone-window-keep";
const STANDALONE_WINDOW_OPEN_IN_SPACE_BUTTON_ID =
  "zen-standalone-window-open-in-space-button";
const STANDALONE_WINDOW_SPACE_PICKER_BUTTON_ID =
  "zen-standalone-window-space-picker-button";
const STANDALONE_WINDOW_SPACE_PICKER_PANEL_ID =
  "PanelUI-zen-standalone-window-spaces";
const STANDALONE_WINDOW_SPACE_PICKER_SEARCH_ID =
  "PanelUI-zen-standalone-window-spaces-search";
const STANDALONE_WINDOW_SPACE_PICKER_LIST_ID =
  "PanelUI-zen-standalone-window-spaces-list";
const STANDALONE_WINDOW_SPACE_PICKER_EMPTY_ID =
  "PanelUI-zen-standalone-window-spaces-empty";
const STANDALONE_WINDOW_SPACE_PICKER_COLLAPSE_ID =
  "PanelUI-zen-standalone-window-spaces-collapse";

// Only a floor against a control that has not been laid out yet. The picker is
// otherwise exactly as wide as the control it opens over: any overhang reads as
// a separate surface appearing rather than as the control expanding.
const STANDALONE_WINDOW_SPACE_PICKER_MIN_WIDTH = 120;

// Commands that act on the sidebar, spaces or the tab strip. A standalone
// window has none of those, so leaving them live lets a stray shortcut drag
// workspace chrome back into the window.
const STANDALONE_WINDOW_DISABLED_COMMANDS = [
  "cmd_zenCompactModeToggle",
  "cmd_toggleCompactModeIgnoreHover",
  "cmd_zenCompactModeShowSidebar",
  "cmd_zenToggleSidebar",
  "cmd_zenToggleTabsOnRight",
  "cmd_zenWorkspaceForward",
  "cmd_zenWorkspaceBackward",
  "cmd_zenChangeWorkspaceTab",
  "cmd_zenSplitViewGrid",
  "cmd_zenSplitViewVertical",
  "cmd_zenSplitViewHorizontal",
  "cmd_zenSplitViewUnsplit",
  "cmd_zenNewEmptySplit",
];

// Successive standalone windows are offset from each other so that opening
// several external links in a row does not stack them in one spot.
const STANDALONE_WINDOW_CASCADE_STEP = 28;
const STANDALONE_WINDOW_CASCADE_LENGTH = 8;

// How recently the application must have been brought to the front for the
// standalone window to count as the reason it was. Anything slower than this
// was the user switching to Zen on their own, and closing a standalone window
// should then leave them in Zen rather than sending them back.
const STANDALONE_WINDOW_ACTIVATION_WINDOW_MS = 2000;

// macOS activates Zen, which can raise an existing normal window, before the
// standalone window exists to take focus back over. That handoff can bounce
// focus through the normal window a moment after the standalone window's own
// listeners attach. A deactivate this soon after the window is ready is that
// bounce settling, not the user deliberately switching windows, so it must not
// count as a visit to a normal window.
const STANDALONE_WINDOW_FOCUS_SETTLE_MS = 1500;

// Firefox can process the plain launch and the URL-carrying command line as
// two separate command lines, in either order, when a link launches Zen from
// closed. Whichever one runs first can leave a plain, empty window open
// alongside the standalone window this module creates for the link. This is
// how long to keep watching for that window if it has not appeared yet by
// the time the standalone window is created.
const STANDALONE_WINDOW_STRAY_WINDOW_WATCH_MS = 4000;

class nsZenStandaloneWindowManager {
  #cascadeIndex = 0;

  /**
   * Runs before the first browser window exists.
   *
   * Only instantiates the macOS dock service, which starts recording when the
   * application is brought to the front. That has to be in place before the
   * first external link arrives, because the activation it carries happens
   * before the browser is told about the link.
   */
  init() {
    void lazy.MacDockSupport;
  }

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
   * @returns {Window|null} The created standalone window, or null when it could not be created
   */
  openExternalLinkStandaloneWindow({ uriString, options, openerWindow }) {
    const request = this.createExternalLinkStandaloneWindowRequest({
      uriString,
      options,
      openerWindow,
    });
    if (!request) {
      return null;
    }

    const standaloneWindow = this.constructStandaloneWindow(request);
    if (!standaloneWindow) {
      return null;
    }

    this.markWindowAsStandalone(standaloneWindow, request);
    this.#initializeStandaloneWindow(standaloneWindow).catch(console.error);
    return standaloneWindow;
  }

  /**
   * Entry point for external links: used both when there is no browser window
   * to open them in (the application is starting up, or every window has been
   * closed) and, from `handURIToExistingBrowser`, for every standalone-eligible
   * external link before any existing window is chosen for it.
   *
   * A standalone window is a full browser window, so it can be the first one
   * Zen ever opens. Session store treats it the way it treats a lone private
   * window and holds the session back until the user opens Zen itself, which
   * is what keeps the user's spaces out of a window that is meant to hold one
   * page.
   *
   * @param {Array<string>} uriStrings - External URLs to open
   * @param {Window} [openerWindow] - The window to use as positioning/space
   *   context for the new window(s), if one exists. It is only ever read from
   *   here - never focused, shown, or otherwise changed.
   * @returns {boolean} True when every URL was handled as a standalone window
   */
  openExternalLinksInStandaloneWindows(uriStrings, openerWindow = null) {
    if (
      !Array.isArray(uriStrings) ||
      !uriStrings.length ||
      !Services.prefs.getBoolPref("zen.standalone-window.enabled", false) ||
      lazy.PrivateBrowsingUtils.permanentPrivateBrowsing
    ) {
      return false;
    }

    // Validate the whole batch before constructing any native window. The
    // caller can only fall back for the batch as a whole, so discovering an
    // invalid URL after earlier windows were created would duplicate those
    // earlier pages when normal handling resumes.
    if (
      !uriStrings.every(uriString =>
        this.createExternalLinkStandaloneWindowRequest({
          uriString,
          options: { fromExternal: true },
          openerWindow,
        })
      )
    ) {
      return false;
    }

    const createdWindows = [];
    for (const uriString of uriStrings) {
      const standaloneWindow = this.openExternalLinkStandaloneWindow({
        uriString,
        options: { fromExternal: true },
        openerWindow,
      });
      if (!standaloneWindow) {
        // Construction can still fail after validation. Roll back the partial
        // batch before returning false, so the caller's normal fallback opens
        // every URL exactly once.
        for (const createdWindow of createdWindows) {
          const state = createdWindow.ZenExternalLinkStandalone;
          if (state) {
            state.isKeeping = true;
            state.isClosing = true;
          }
          createdWindow.skipNextCanClose = true;
          try {
            createdWindow.close();
          } catch (error) {
            console.error(
              "Failed to roll back a partial Zen standalone window batch",
              error
            );
          }
        }
        return false;
      }
      createdWindows.push(standaloneWindow);
    }

    if (createdWindows.length) {
      this.#closeStrayEmptyStartupWindows(createdWindows);
    }

    return true;
  }

  /**
   * Closes any other currently-open browser window that is unmistakably just
   * the empty window Zen's own startup opens by default, once a standalone
   * window has taken an external link instead of it. Firefox can process the
   * plain launch and the URL-carrying command line as two separate command
   * lines, in either order, so without this the empty window is either left
   * open next to the standalone window, or appears a moment later - either
   * way reading to the user as an extra space having opened alongside it.
   *
   * Only ever closes a window that: is not one of the windows this call just
   * created, has not finished starting up, and holds nothing but the single
   * synthetic empty tab every fresh window starts with (`zen-empty-tab`). A
   * window that has finished starting, or that holds any real tab, is never
   * touched - this is deliberately narrow rather than "looks empty".
   *
   * @param {Array<Window>} excludeWindows - Windows this call just created
   */
  #closeStrayEmptyStartupWindows(excludeWindows) {
    const exclude = new Set(excludeWindows);

    const closeIfStray = win => {
      if (
        !win ||
        win.closed ||
        exclude.has(win) ||
        win._zenStandaloneWindow ||
        win.gZenStartup?.isReady ||
        lazy.PrivateBrowsingUtils.isWindowPrivate(win)
      ) {
        return;
      }
      const tabs = win.gBrowser?.tabs;
      if (tabs?.length === 1 && tabs[0].hasAttribute("zen-empty-tab")) {
        try {
          win.close();
        } catch (error) {
          console.error(
            "Failed to close a stray empty Zen startup window",
            error
          );
        }
      }
    };

    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      closeIfStray(win);
    }

    // The stray window can still be a moment away from existing at this
    // point if the plain launch's command line is processed after the
    // URL-carrying one. Catch it if it shows up shortly after.
    const onWindowOpened = (subject, topic) => {
      if (topic !== "domwindowopened") {
        return;
      }
      subject.addEventListener(
        "load",
        () => {
          Services.tm.dispatchToMainThread(() => closeIfStray(subject));
        },
        { once: true }
      );
    };
    Services.ww.registerNotification(onWindowOpened);
    lazy.setTimeout(() => {
      Services.ww.unregisterNotification(onWindowOpened);
    }, STANDALONE_WINDOW_STRAY_WINDOW_WATCH_MS);
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
    if (typeof uriString !== "string" || !uriString) {
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
      openerWindow: openerWindow ?? null,
      source: "external",
      isPrivate: openerWindow
        ? lazy.PrivateBrowsingUtils.isWindowPrivate(openerWindow)
        : false,
      triggeringPrincipal: options?.triggeringPrincipal ?? null,
      referrerInfo: options?.referrerInfo ?? null,
      policyContainer: options?.policyContainer ?? null,
      userContextId: options?.userContextId ?? 0,
      targetRoute: this.getDefaultKeepTargetRoute(openerWindow),
      broughtApplicationForward: this.wasApplicationJustActivated(),
    };
  }

  /**
   * Whether the application became frontmost just now, which is what happens
   * when another application hands Zen a link to open while the user is in it.
   *
   * @returns {boolean} True when this activation is the one that carried the link
   */
  wasApplicationJustActivated() {
    const elapsed = lazy.MacDockSupport?.millisecondsSinceApplicationActivated;
    if (typeof elapsed !== "number" || elapsed < 0) {
      return false;
    }
    return elapsed <= STANDALONE_WINDOW_ACTIVATION_WINDOW_MS;
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
      this.makeWindowFollowTheUser(standaloneWindow);
      // macOS activates Zen (and can raise an existing normal window) before
      // this window exists. Asserting focus here, as early as possible, keeps
      // that window on screen for the shortest time this code can control.
      try {
        standaloneWindow.focus();
      } catch (error) {
        console.error("Failed to focus a new Zen standalone window", error);
      }
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
   * Asks the window to join whichever macOS Space is active when Zen is
   * brought forward, instead of the system switching Spaces to reach it.
   *
   * Called before the window is shown, because the collection behaviour has to
   * be in place by the time macOS decides where to put it.
   *
   * @param {Window} standaloneWindow - The created standalone window
   */
  makeWindowFollowTheUser(standaloneWindow) {
    const dockSupport = lazy.MacDockSupport;
    if (!dockSupport) {
      return;
    }

    try {
      const baseWindow = standaloneWindow.docShell.treeOwner.QueryInterface(
        Ci.nsIBaseWindow
      );
      dockSupport.makeWindowJoinActiveSpace(baseWindow);
    } catch (error) {
      console.error(
        "Failed to make a Zen standalone window join the active Space",
        error
      );
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

    // An ordinary window, deliberately. What makes a standalone window
    // particular is all above this layer: it carries no workspace chrome, it
    // follows the user between Spaces, it hands focus back to the application
    // the link came from when it closes, and it is never part of a session.
    // Nothing about how macOS stacks it is special, because everything that
    // raised it above ordinary windows - a floating window level, whether set
    // through the dock service or through a native window class - also took it
    // out of Mission Control and the window list, and stopped the user putting
    // any other window in front of it. A window the user is expected to read
    // and type in has to be orderable like every other window.
    // BrowserWindowTracker owns chrome, dialog=no and all; this helper only
    // contributes standalone sizing and placement.
    return [
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

    const area = this.#getAvailableScreenArea(openerWindow);
    const availLeft = area.left;
    const availTop = area.top;
    const availWidth = area.width > 0 ? area.width : width;
    const availHeight = area.height > 0 ? area.height : height;

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
   * The usable area of the screen the window should be placed on: the opener's
   * screen, or the primary one when the link arrived with no window open.
   *
   * @param {Window} [openerWindow] - Browser window that received the external open request
   * @returns {{left: number, top: number, width: number, height: number}} Available area
   */
  #getAvailableScreenArea(openerWindow) {
    const screen = openerWindow?.screen;
    if (screen) {
      return {
        left: screen.availLeft ?? 0,
        top: screen.availTop ?? 0,
        width: screen.availWidth ?? 0,
        height: screen.availHeight ?? 0,
      };
    }

    try {
      const left = {};
      const top = {};
      const width = {};
      const height = {};
      Cc["@mozilla.org/gfx/screenmanager;1"]
        .getService(Ci.nsIScreenManager)
        .primaryScreen.GetAvailRectDisplayPix(left, top, width, height);
      return {
        left: left.value,
        top: top.value,
        width: width.value,
        height: height.value,
      };
    } catch (error) {
      console.error("Cannot read the available screen area", error);
      return { left: 0, top: 0, width: 0, height: 0 };
    }
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
    // Applied a second time: the chrome document carries macnativefullscreen,
    // which the app window turns into a fullscreen collection behaviour of its
    // own once it has loaded, after the first call.
    this.makeWindowFollowTheUser(standaloneWindow);
    // Close ownership is a lifecycle rule, not a toolbar implementation
    // detail, so install it even if standalone chrome construction fails.
    this.registerStandaloneCommands(standaloneWindow);
    this.initializeStandaloneToolbar(standaloneWindow);
    this.registerStandaloneWindowLifecycle(standaloneWindow);
    this.watchForNormalWindowVisits(standaloneWindow);
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
      broughtApplicationForward: !!request.broughtApplicationForward,
      triggeringPrincipal: request.triggeringPrincipal,
      referrerInfo: request.referrerInfo,
      policyContainer: request.policyContainer,
      userContextId: request.userContextId,
      toolbar: null,
      isKeeping: false,
      isClosing: false,
      closedTabRecorded: false,
      visitedNormalWindow: false,
      deactivateListener: null,
      commandListener: null,
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
   * Adds the standalone-window keep actions to the trailing edge of the top
   * bar, alongside the window controls, the back arrow and the address bar.
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

    // The window controls have to be in place first, so the toolbar can be
    // inserted relative to them rather than ending up outside the close button.
    this.relocateStandaloneWindowButtons(standaloneWindow);

    try {
      const listeners = [];
      const addListener = (target, type, handler) => {
        target.addEventListener(type, handler);
        listeners.push([target, type, handler]);
      };

      const toolbar = document.createXULElement("hbox");
      toolbar.id = STANDALONE_WINDOW_TOOLBAR_ID;
      toolbar.setAttribute("align", "center");

      const keepControl = document.createXULElement("hbox");
      keepControl.id = STANDALONE_WINDOW_KEEP_CONTROL_ID;
      keepControl.setAttribute("align", "center");

      // Built from plain boxes and labels rather than <toolbarbutton>, because
      // the label has to mix weights ("Open in" plain, the space name bold)
      // and MozToolbarbutton owns its own single-label content.
      const makeButton = (id, onActivate) => {
        const button = document.createXULElement("hbox");
        button.id = id;
        button.setAttribute("align", "center");
        button.setAttribute("role", "button");
        button.setAttribute("tabindex", "0");
        // These are boxes, so `disabled` is inert unless it is checked here.
        const activate = () => {
          if (button.hasAttribute("disabled")) {
            return;
          }
          onActivate();
        };
        addListener(button, "click", activate);
        addListener(button, "keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          activate();
        });
        keepControl.appendChild(button);
        return button;
      };

      const openInSpaceButton = makeButton(
        STANDALONE_WINDOW_OPEN_IN_SPACE_BUTTON_ID,
        () =>
          this.#runToolbarCommand(toolbar, () =>
            this.onOpenInDefaultSpaceCommand(standaloneWindow)
          )
      );

      const prefixLabel = document.createXULElement("label");
      prefixLabel.className = "zen-standalone-window-keep-prefix";
      document.l10n.setAttributes(prefixLabel, "zen-standalone-window-open-in");
      openInSpaceButton.appendChild(prefixLabel);

      const spaceLabel = document.createXULElement("label");
      spaceLabel.className = "zen-standalone-window-keep-space";
      openInSpaceButton.appendChild(spaceLabel);

      const shortcutHint = document.createXULElement("label");
      shortcutHint.className = "zen-standalone-window-shortcut";
      shortcutHint.setAttribute("value", this.getKeepShortcutLabel());
      openInSpaceButton.appendChild(shortcutHint);

      this.#applyKeepButtonLabel(
        standaloneWindow,
        openInSpaceButton,
        spaceLabel
      );

      const spacePickerButton = makeButton(
        STANDALONE_WINDOW_SPACE_PICKER_BUTTON_ID,
        () => this.openStandaloneSpacePicker(standaloneWindow)
      );
      document.l10n.setAttributes(
        spacePickerButton,
        "zen-standalone-window-choose-space"
      );
      const chevron = document.createXULElement("image");
      chevron.className = "zen-standalone-window-chevron";
      spacePickerButton.appendChild(chevron);

      toolbar.appendChild(keepControl);
      if (!this.insertStandaloneToolbar(standaloneWindow, toolbar)) {
        return;
      }

      standaloneWindow.ZenExternalLinkStandalone.toolbar = {
        root: toolbar,
        keepControl,
        openInSpaceButton,
        spacePickerButton,
        listeners,
      };

      this.registerStandaloneShortcuts(standaloneWindow);
      this.disableStandaloneWorkspaceCommands(standaloneWindow);
    } catch (error) {
      console.error("Failed to initialize Zen standalone toolbar", error);
    }
  }

  /**
   * Places the keep control on the trailing edge of the top bar.
   *
   * The toolbar is a flex item rather than an overlay, so it can no longer land
   * on top of the address bar. On platforms where the window controls stay in
   * the navigation bar it goes in ahead of them, so the close button keeps the
   * corner it owns everywhere else in the OS.
   *
   * @param {Window} standaloneWindow - The standalone window
   * @param {Element} toolbar - The toolbar to insert
   * @returns {boolean} True when the toolbar was inserted
   */
  insertStandaloneToolbar(standaloneWindow, toolbar) {
    const document = standaloneWindow.document;
    const navBar = document.getElementById("nav-bar");
    const inlineWindowButtons = navBar?.querySelector(
      ":scope > .titlebar-buttonbox-container"
    );

    if (inlineWindowButtons) {
      navBar.insertBefore(toolbar, inlineWindowButtons);
      return true;
    }

    const container = document.getElementById(
      "zen-appcontent-navbar-container"
    );
    if (!container) {
      console.error(
        "Zen standalone window has no navbar container to anchor its toolbar to"
      );
      return false;
    }

    container.appendChild(toolbar);
    return true;
  }

  /**
   * Turns off the commands that act on chrome a standalone window does not
   * have. Without this, accel+S still toggles compact mode and brings the
   * separation margin and sidebar controls back into a window that has neither.
   *
   * Zen builds its shortcuts as `<key command="...">`, so disabling the command
   * disables the key and the matching context-menu items in one step.
   *
   * @param {Window} standaloneWindow - The standalone window
   */
  disableStandaloneWorkspaceCommands(standaloneWindow) {
    for (const id of STANDALONE_WINDOW_DISABLED_COMMANDS) {
      standaloneWindow.document
        .getElementById(id)
        ?.setAttribute("disabled", "true");
    }
  }

  /**
   * Labels the primary action with the space the page would be kept in, so the
   * button reads "Open in Personal" rather than a generic "Open in Space".
   *
   * @param {Window} standaloneWindow - The standalone window
   * @param {Element} button - The primary keep button
   * @param {Element} spaceLabel - The label showing the selected destination
   */
  #applyKeepButtonLabel(standaloneWindow, button, spaceLabel) {
    const document = standaloneWindow.document;
    const space = this.resolveKeepTargetSpace(standaloneWindow);

    if (space?.name) {
      spaceLabel.removeAttribute("data-l10n-id");
      spaceLabel.setAttribute("value", space.name);
      document.l10n.setAttributes(
        button,
        "zen-standalone-window-keep-tooltip",
        { space: space.name }
      );
      return;
    }

    // No resolvable space yet; the generic wording still reads correctly.
    document.l10n.setAttributes(
      spaceLabel,
      "zen-standalone-window-generic-space"
    );
    document.l10n.setAttributes(
      button,
      "zen-standalone-window-keep-tooltip-generic"
    );
  }

  /**
   * Moves the window controls into the standalone top bar.
   *
   * On macOS, Zen relocates the traffic lights into the sidebar's top button
   * area, which a standalone window hides. Without this they would be gone
   * entirely, leaving no way to close the window with the mouse.
   *
   * @param {Window} standaloneWindow - The standalone window
   */
  relocateStandaloneWindowButtons(standaloneWindow) {
    const document = standaloneWindow.document;
    const container = document.getElementById(
      "zen-appcontent-navbar-container"
    );
    const buttons =
      standaloneWindow.gZenUIManager?.actualWindowButtons ??
      document.querySelector(".titlebar-buttonbox-container");

    // On platforms that keep the controls in #nav-bar they are already inside
    // the top bar and must be left where they are.
    if (!container || !buttons || !buttons.closest("#navigator-toolbox")) {
      return;
    }

    container.prepend(buttons);
    container.setAttribute("zen-standalone-window-has-buttons", "true");
  }

  /**
   * Resolves the space the primary action would keep the page in.
   *
   * Falls back through the target window and then the opener, because the
   * external link can arrive before the opener's workspaces have finished
   * initialising, in which case the captured route is empty.
   *
   * @param {Window} standaloneWindow - The standalone window
   * @returns {object|null} Workspace data, or null when none can be resolved
   */
  resolveKeepTargetSpace(standaloneWindow) {
    const route = this.resolveKeepTargetRoute(standaloneWindow);
    const candidates = [
      this.getStandaloneKeepTargetWindow(standaloneWindow),
      standaloneWindow.ZenExternalLinkStandalone?.openerWindow,
    ];

    for (const win of candidates) {
      const workspaces = win?.gZenWorkspaces;
      if (!workspaces) {
        continue;
      }

      const space =
        (route ? workspaces.getWorkspaceFromId?.(route) : null) ??
        workspaces.getActiveWorkspaceFromCache?.();
      if (space?.name) {
        return space;
      }
    }

    return null;
  }

  /**
   * Platform-appropriate rendering of the keep shortcut.
   *
   * @returns {string} Shortcut hint shown on the primary button
   */
  getKeepShortcutLabel() {
    return AppConstants.platform === "macosx" ? "⌘O" : "Ctrl+O";
  }

  /**
   * Binds accel+O to the primary keep action for this window only.
   *
   * Uses a capturing keydown listener so it wins over the built-in Open File
   * command, which is meaningless in a standalone window.
   *
   * @param {Window} standaloneWindow - The standalone window
   */
  registerStandaloneShortcuts(standaloneWindow) {
    const state = standaloneWindow.ZenExternalLinkStandalone;
    if (!state || state.keydownListener) {
      return;
    }

    const onKeyDown = event => {
      const accel =
        AppConstants.platform === "macosx" ? event.metaKey : event.ctrlKey;
      if (
        !accel ||
        event.altKey ||
        event.shiftKey ||
        event.key?.toLowerCase() !== "o"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.onOpenInDefaultSpaceCommand(standaloneWindow);
    };

    standaloneWindow.addEventListener("keydown", onKeyDown, true);
    state.keydownListener = onKeyDown;
  }

  /**
   * Makes Close mean close this transient native window, never close its
   * internal browser tab. Capturing the XUL command covers Command+W, menu
   * items and callers of doCommand() before normal tab/workspace handlers run.
   *
   * The tabbrowser last-tab rule is still the lower-level invariant for tab
   * removal paths that do not originate from a XUL command.
   *
   * @param {Window} standaloneWindow - The standalone window
   */
  registerStandaloneCommands(standaloneWindow) {
    const state = standaloneWindow.ZenExternalLinkStandalone;
    if (!state || state.commandListener) {
      return;
    }

    const onCommand = event => {
      const commandIds = [
        event.target?.id,
        event.target?.getAttribute?.("command"),
      ];
      if (
        !commandIds.includes("cmd_close") &&
        !commandIds.includes("cmd_closeWindow")
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      this.closeStandaloneWindow(standaloneWindow);
    };

    standaloneWindow.document.addEventListener("command", onCommand, true);
    state.commandListener = onCommand;
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
    // The controls are boxes with role="button", not <toolbarbutton>, so the
    // in-flight guard has to select on the role.
    const buttons = toolbar.querySelectorAll('[role="button"]');
    for (const button of buttons) {
      button.setAttribute("disabled", "true");
    }

    let handled = false;
    try {
      handled = !!command();
    } finally {
      if (!handled) {
        for (const button of buttons) {
          button.removeAttribute("disabled");
        }
      }
    }
    return handled;
  }

  /**
   * Removes standalone toolbar controls and listeners.
   *
   * @param {Window} standaloneWindow - The standalone window
   */
  cleanupStandaloneToolbar(standaloneWindow) {
    const state = standaloneWindow?.ZenExternalLinkStandalone;
    if (state?.deactivateListener) {
      standaloneWindow.removeEventListener(
        "deactivate",
        state.deactivateListener,
        true
      );
      state.deactivateListener = null;
    }
    if (state?.keydownListener) {
      standaloneWindow.removeEventListener(
        "keydown",
        state.keydownListener,
        true
      );
      state.keydownListener = null;
    }
    if (state?.commandListener) {
      standaloneWindow.document.removeEventListener(
        "command",
        state.commandListener,
        true
      );
      state.commandListener = null;
    }

    const toolbar = state?.toolbar;
    if (!toolbar) {
      return;
    }

    for (const [target, type, handler] of toolbar.listeners) {
      target.removeEventListener(type, handler);
    }
    toolbar.root?.remove();
    state.toolbar = null;
  }

  /**
   * Registers close/unload handling for the standalone window.
   *
   * @param {Window} standaloneWindow - The created standalone window
   */
  registerStandaloneWindowLifecycle(standaloneWindow) {
    // Session store dispatches SSWindowClosing while the window's tab is still
    // alive, which is the only moment the page can be handed to another window.
    standaloneWindow.addEventListener(
      "SSWindowClosing",
      () => this.onStandaloneWindowClosing(standaloneWindow),
      { once: true }
    );
    standaloneWindow.addEventListener(
      "unload",
      () => this.onStandaloneWindowClosed(standaloneWindow),
      { once: true }
    );
  }

  /**
   * Handles a standalone window that is about to close.
   *
   * A standalone window is not part of the session, so nothing of it would
   * survive its own close. The page is instead recorded as a closed tab of the
   * window that would have received it, so that undo-close-tab reopens it as
   * an ordinary tab in the current space rather than as a standalone window.
   *
   * @param {Window} standaloneWindow - The standalone window being closed
   */
  onStandaloneWindowClosing(standaloneWindow) {
    const state = standaloneWindow?.ZenExternalLinkStandalone;
    if (!state || state.isKeeping || state.closedTabRecorded) {
      // The tab is moving to a real window; it is not being closed.
      return;
    }

    const tab = standaloneWindow.gBrowser?.selectedTab;
    const targetWindow = this.getStandaloneKeepTargetWindow(standaloneWindow);
    if (!tab || !targetWindow) {
      return;
    }

    // SSWindowClosing is registered once, but keep an explicit guard because
    // native, command and tab-removal close paths all converge here.
    state.closedTabRecorded = true;
    try {
      lazy.SessionStore.recordClosedTabForOtherWindow(targetWindow, tab);
    } catch (error) {
      console.error(
        "Failed to remember a closed Zen standalone window page",
        error
      );
    }
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

    const state = standaloneWindow.ZenExternalLinkStandalone;
    this.cleanupStandaloneToolbar(standaloneWindow);
    standaloneWindow.ZenExternalLinkStandalone = null;

    if (!state.isKeeping) {
      this.maybeReturnFocusToPreviousApplication(standaloneWindow, state);
    }
  }

  /**
   * Sends the user back to the application the link came from.
   *
   * Zen is only hidden when it was brought to the front to show this window in
   * the first place. If the user was already in Zen, or has been working in
   * another Zen window since, closing the standalone window leaves them where
   * they are, exactly as closing any other window does.
   *
   * @param {Window} standaloneWindow - The standalone window that just closed
   * @param {object} state - Its transient standalone state
   */
  maybeReturnFocusToPreviousApplication(standaloneWindow, state) {
    const dockSupport = lazy.MacDockSupport;
    if (
      !dockSupport ||
      !state.broughtApplicationForward ||
      !Services.prefs.getBoolPref(
        "zen.standalone-window.return-focus-on-close",
        true
      )
    ) {
      return;
    }

    // Another standalone window would be hidden along with everything else.
    for (const win of lazy.BrowserWindowTracker.orderedWindows) {
      if (win !== standaloneWindow && this.isStandaloneWindow(win)) {
        return;
      }
    }

    // The user went to a normal Zen window at some point, so Zen is where they
    // are working now and hiding it would take away the page they moved on to.
    if (state.visitedNormalWindow) {
      return;
    }

    try {
      dockSupport.hideApplication();
    } catch (error) {
      console.error(
        "Failed to return focus to the previous application",
        error
      );
    }
  }

  /**
   * Notices the user moving from the standalone window into a normal Zen
   * window, which is what tells the close handler that Zen is now where the
   * user is working rather than a window that was put in front of them.
   *
   * The active window is read on the next turn of the event loop, because at
   * the time the standalone window is told it lost activation the focus
   * manager has not yet been given the window that gained it.
   *
   * A deactivate within `STANDALONE_WINDOW_FOCUS_SETTLE_MS` of this listener
   * attaching is ignored: macOS activation can still be settling focus between
   * the normal window it raised and the standalone window at that point, and
   * that settling is not the user choosing to work in the normal window.
   *
   * @param {Window} standaloneWindow - The standalone window
   */
  watchForNormalWindowVisits(standaloneWindow) {
    const state = standaloneWindow.ZenExternalLinkStandalone;
    if (!state || state.deactivateListener) {
      return;
    }

    const readyAt = Date.now();

    const onDeactivate = () => {
      Services.tm.dispatchToMainThread(() => {
        if (
          standaloneWindow.closed ||
          !standaloneWindow.ZenExternalLinkStandalone
        ) {
          return;
        }
        if (Date.now() - readyAt < STANDALONE_WINDOW_FOCUS_SETTLE_MS) {
          return;
        }
        const activeWindow = Services.focus.activeWindow;
        if (
          activeWindow &&
          activeWindow !== standaloneWindow &&
          !this.isStandaloneWindow(activeWindow)
        ) {
          standaloneWindow.ZenExternalLinkStandalone.visitedNormalWindow = true;
        }
      });
    };

    standaloneWindow.addEventListener("deactivate", onDeactivate, true);
    state.deactivateListener = onDeactivate;
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
      // The link arrived while Zen was not running, so the standalone window is
      // the only window there is. Opening a normal one also releases the
      // session session store held back at startup, and the page is kept in it
      // once it has spaces to be kept in.
      return this.keepStandaloneWindowInNewWindow(
        standaloneWindow,
        targetRoute
      );
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
   * Keeps a standalone window in a window that does not exist yet.
   *
   * @param {Window} standaloneWindow - The standalone window to keep
   * @param {string} [targetRoute] - Workspace uuid, or null for the new window's current space
   * @returns {boolean} True when opening the window was started
   */
  keepStandaloneWindowInNewWindow(standaloneWindow, targetRoute) {
    const state = standaloneWindow.ZenExternalLinkStandalone;
    const targetWindow = lazy.BrowserWindowTracker.openWindow({});
    if (!targetWindow) {
      console.error("No Zen window is available to keep the standalone URL in");
      return false;
    }

    // Held across the wait so that closing the standalone window in the
    // meantime is not mistaken for the user throwing the page away.
    state.isKeeping = true;

    this.#promiseDelayedStartup(targetWindow)
      .then(async () => {
        if (
          targetWindow.closed ||
          standaloneWindow.closed ||
          !standaloneWindow.ZenExternalLinkStandalone
        ) {
          return;
        }
        await targetWindow.gZenWorkspaces?.promiseInitialized;
        standaloneWindow.ZenExternalLinkStandalone.isKeeping = false;
        this.keepStandaloneWindowInSpace(standaloneWindow, targetRoute);
      })
      .catch(console.error);

    return true;
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

    const document = standaloneWindow.document;
    const panel = document.getElementById(
      STANDALONE_WINDOW_SPACE_PICKER_PANEL_ID
    );
    const list = document.getElementById(
      STANDALONE_WINDOW_SPACE_PICKER_LIST_ID
    );
    const search = document.getElementById(
      STANDALONE_WINDOW_SPACE_PICKER_SEARCH_ID
    );
    // Anchored on the whole keep control rather than on the chevron alone: the
    // panel is meant to read as that control expanding in place, so it has to
    // know the pill's box, not the box of the arrow that opened it.
    const anchor =
      standaloneWindow.ZenExternalLinkStandalone?.toolbar?.keepControl ??
      standaloneWindow.ZenExternalLinkStandalone?.toolbar?.spacePickerButton;
    const targetWindow = this.getStandaloneKeepTargetWindow(standaloneWindow);
    const workspaces = targetWindow?.gZenWorkspaces?.getWorkspaces?.() ?? [];
    if (!panel || !list || !anchor || !workspaces.length) {
      return false;
    }

    this.populateStandaloneSpacePicker(list, workspaces, targetWindow);

    if (search) {
      search.value = "";
    }
    this.filterStandaloneSpacePicker(list, "");

    // The panel is shared chrome, so its handlers are bound per open and torn
    // down on popuphidden rather than living for the window's lifetime.
    const onCommand = event => {
      if (event.target?.id === STANDALONE_WINDOW_SPACE_PICKER_COLLAPSE_ID) {
        panel.hidePopup();
        return;
      }

      const workspaceId = event.target
        ?.closest?.("[zen-workspace-id]")
        ?.getAttribute("zen-workspace-id");
      if (!workspaceId) {
        return;
      }
      panel.hidePopup();
      this.onOpenInSelectedSpaceCommand(standaloneWindow, workspaceId);
    };

    const onInput = () => this.filterStandaloneSpacePicker(list, search?.value);

    const onKeyDown = event => {
      if (event.key !== "Enter") {
        return;
      }
      const first = [...list.children].find(row => !row.hidden);
      first?.doCommand();
    };

    const onShown = () => search?.focus({ preventScroll: true });

    const onHidden = () => {
      panel.removeEventListener("command", onCommand);
      panel.removeEventListener("popupshown", onShown);
      panel.removeEventListener("popuphidden", onHidden);
      search?.removeEventListener("input", onInput);
      search?.removeEventListener("keydown", onKeyDown);
    };

    panel.addEventListener("command", onCommand);
    panel.addEventListener("popupshown", onShown);
    panel.addEventListener("popuphidden", onHidden, { once: true });
    search?.addEventListener("input", onInput);
    search?.addEventListener("keydown", onKeyDown);

    // Sized and placed onto the control instead of floating below it: the panel
    // takes the pill's width and is pulled up by the pill's height, so its
    // search row lands exactly on top of the button and the collapse chevron
    // ends up where the opening chevron was. Anything narrower than the minimum
    // would make the space rows unreadable, and "after_end" keeps the trailing
    // edges aligned either way, so the chevrons still line up.
    const anchorRect = anchor.getBoundingClientRect();
    const width = Math.max(
      Math.round(anchorRect.width),
      STANDALONE_WINDOW_SPACE_PICKER_MIN_WIDTH
    );
    panel.style.setProperty("--panel-width", `${width}px`);
    panel.style.setProperty(
      "--zen-standalone-window-picker-anchor-height",
      `${Math.round(anchorRect.height)}px`
    );

    panel.openPopup(
      anchor,
      "after_end",
      0,
      -Math.round(anchorRect.height),
      false,
      false
    );
    return true;
  }

  /**
   * Rebuilds the standalone space picker list.
   *
   * Each row is a real <toolbarbutton>, so the panel keeps its command and
   * keyboard behaviour, but it carries its own children. MozToolbarbutton skips
   * building its icon and text nodes as soon as a button has children of its
   * own, which is what lets a row pair a coloured icon tile with the name.
   *
   * @param {Element} list - Container for the space rows
   * @param {Array<object>} workspaces - Workspaces available in the target window
   * @param {Window} [targetWindow] - Window the spaces belong to
   */
  populateStandaloneSpacePicker(list, workspaces, targetWindow) {
    const document = list.ownerDocument;
    while (list.firstChild) {
      list.firstChild.remove();
    }

    const activeWorkspace = targetWindow?.gZenWorkspaces?.activeWorkspace;

    for (const workspace of workspaces) {
      const row = document.createXULElement("toolbarbutton");
      row.className = "subviewbutton zen-standalone-window-space-row";
      row.setAttribute("zen-workspace-id", workspace.uuid);
      row.setAttribute("zen-workspace-name", workspace.name ?? "");
      if (workspace.uuid === activeWorkspace) {
        row.setAttribute("active", "true");
      }

      const iconTile = document.createXULElement("hbox");
      iconTile.className = "zen-standalone-window-space-icon";
      iconTile.setAttribute("align", "center");
      iconTile.setAttribute("pack", "center");

      const accent = this.getStandaloneWorkspaceAccent(targetWindow, workspace);
      if (accent) {
        iconTile.style.setProperty(
          "--zen-standalone-window-space-accent",
          accent
        );
      }

      if (workspace.icon?.endsWith?.(".svg")) {
        const image = document.createXULElement("image");
        image.className = "zen-standalone-window-space-icon-image";
        image.setAttribute("src", workspace.icon);
        iconTile.appendChild(image);
      } else if (workspace.icon) {
        const glyph = document.createXULElement("label");
        glyph.className = "zen-standalone-window-space-icon-glyph";
        glyph.setAttribute("value", workspace.icon);
        iconTile.appendChild(glyph);
      } else {
        // Initial of the name, so a space without an icon still reads as a tile
        // rather than as an empty square.
        const glyph = document.createXULElement("label");
        glyph.className = "zen-standalone-window-space-icon-glyph";
        glyph.setAttribute("value", (workspace.name ?? "?").trim().charAt(0));
        iconTile.appendChild(glyph);
      }

      const name = document.createXULElement("label");
      name.className = "zen-standalone-window-space-name";
      name.setAttribute("value", workspace.name ?? "");
      name.setAttribute("crop", "end");
      name.setAttribute("flex", "1");

      row.appendChild(iconTile);
      row.appendChild(name);
      list.appendChild(row);
    }
  }

  /**
   * Reads the accent colour a space paints its window with, so its row in the
   * picker is recognisable at a glance.
   *
   * The gradient data lives on the target window's theme picker, and a space
   * can predate it or carry no theme at all, so a failure here just falls back
   * to the neutral tile the stylesheet paints.
   *
   * @param {Window} [targetWindow] - Window the spaces belong to
   * @param {object} workspace - Workspace data
   * @returns {string|null} A CSS colour, or null when the space has no accent
   */
  getStandaloneWorkspaceAccent(targetWindow, workspace) {
    try {
      return (
        targetWindow?.gZenThemePicker?.getGradientForWorkspace?.(workspace, {
          getGradient: false,
        })?.primaryColor ?? null
      );
    } catch (error) {
      console.error("Failed to read the accent colour of a Zen space", error);
      return null;
    }
  }

  /**
   * Narrows the space list to rows matching the search query.
   *
   * @param {Element} list - Container for the space rows
   * @param {string} [query] - Current search text
   */
  filterStandaloneSpacePicker(list, query) {
    const needle = (query ?? "").trim().toLowerCase();
    let matches = 0;

    for (const row of list.children) {
      const name = row.getAttribute("zen-workspace-name")?.toLowerCase() ?? "";
      row.hidden = !!needle && !name.includes(needle);
      if (!row.hidden) {
        matches++;
      }
    }

    const empty = list.ownerDocument.getElementById(
      STANDALONE_WINDOW_SPACE_PICKER_EMPTY_ID
    );
    if (empty) {
      empty.hidden = matches > 0;
    }
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
