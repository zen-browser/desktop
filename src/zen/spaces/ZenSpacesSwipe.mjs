/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "browserBackgroundElement", () => {
  return document.getElementById("zen-browser-background");
});

ChromeUtils.defineLazyGetter(lazy, "toolbarBackgroundElement", () => {
  return document.getElementById("zen-toolbar-background");
});

export class ZenSpacesSwipe {
  _swipeState = {
    isGestureActive: false,
    lastDelta: 0,
    direction: null,
  };

  constructor() {
    const elements = [
      gNavToolbox,
      // Event handlers do not work on elements inside shadow DOM
      // so we need to attach them directly.
      document
        .getElementById("tabbrowser-arrowscrollbox")
        ?.shadowRoot?.querySelector("scrollbox"),
    ];

    for (const element of elements) {
      if (!element) {
        continue;
      }
      this._attachWorkspaceSwipeGestures(element);
    }
  }

  _attachWorkspaceSwipeGestures(element) {
    element.addEventListener(
      "MozSwipeGestureMayStart",
      this._handleSwipeMayStart.bind(this),
      true
    );
    element.addEventListener(
      "MozSwipeGestureStart",
      this._handleSwipeStart.bind(this),
      true
    );
    element.addEventListener(
      "MozSwipeGestureUpdate",
      this._handleSwipeUpdate.bind(this),
      true
    );

    // Use MozSwipeGesture instead of MozSwipeGestureEnd because MozSwipeGestureEnd is fired after animation ends,
    // while MozSwipeGesture is fired immediately after swipe ends.
    element.addEventListener(
      "MozSwipeGesture",
      this._handleSwipeEnd.bind(this),
      true
    );

    element.addEventListener(
      "MozSwipeGestureEnd",
      () => {
        this.onSwipeGestureAnimationEnd();
      },
      true
    );
  }

  _handleSwipeMayStart(event) {
    const ws = gZenWorkspaces;

    if (ws.privateWindowOrDisabled || ws.isChangingWorkspace) {
      return;
    }
    if (
      event.target.closest("#zen-sidebar-foot-buttons") ||
      event.target.closest('#urlbar[zen-floating-urlbar="true"]')
    ) {
      return;
    }

    // Only handle horizontal swipes
    if (
      event.direction === event.DIRECTION_LEFT ||
      event.direction === event.DIRECTION_RIGHT
    ) {
      event.preventDefault();
      event.stopPropagation();

      // Set allowed directions based on available workspaces
      event.allowedDirections |= event.DIRECTION_LEFT | event.DIRECTION_RIGHT;
    }
  }

  _handleSwipeStart(event) {
    const ws = gZenWorkspaces;

    if (!ws.workspaceEnabled) {
      return;
    }

    gZenFolders.cancelPopupTimer();

    document.documentElement.setAttribute("swipe-gesture", "true");
    document.addEventListener("popupshown", ws.popupOpenHandler, {
      once: true,
    });

    event.preventDefault();
    event.stopPropagation();
    this._swipeState = {
      isGestureActive: true,
      lastDelta: 0,
      direction: null,
    };
    Services.prefs.setBoolPref("zen.swipe.is-fast-swipe", true);
  }

  _handleSwipeUpdate(event) {
    const ws = gZenWorkspaces;

    if (!ws.workspaceEnabled || !this._swipeState?.isGestureActive) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const delta = event.delta * 300;
    const stripWidth =
      window.windowUtils.getBoundsWithoutFlushing(
        document.getElementById("navigator-toolbox")
      ).width +
      window.windowUtils.getBoundsWithoutFlushing(
        document.getElementById("zen-sidebar-splitter")
      ).width *
        2;
    let translateX = this._swipeState.lastDelta + delta;
    // Add a force multiplier as we are translating the strip depending on how close to the edge we are
    let forceMultiplier = Math.min(
      1,
      1 - Math.abs(translateX) / (stripWidth * 4.5)
    ); // 4.5 instead of 4 to add a bit of a buffer
    if (forceMultiplier > 0.5) {
      translateX *= forceMultiplier;
      this._swipeState.lastDelta = delta + (translateX - delta) * 0.5;
    } else {
      translateX = this._swipeState.lastDelta;
    }

    if (Math.abs(delta) > 0.8) {
      this._swipeState.direction = delta > 0 ? "left" : "right";
    }

    // Apply a translateX to the tab strip to give the user feedback on the swipe
    const currentWorkspace = ws.getActiveWorkspaceFromCache();
    ws._organizeWorkspaceStripLocations(currentWorkspace, true, translateX);
  }

  async _handleSwipeEnd(event) {
    const ws = gZenWorkspaces;

    if (!ws.workspaceEnabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const isRTL = document.documentElement.matches(":-moz-locale-dir(rtl)");
    const moveForward =
      (event.direction === SimpleGestureEvent.DIRECTION_RIGHT) !== isRTL;

    const rawDirection = moveForward ? 1 : -1;
    const direction = ws.naturalScroll ? -1 : 1;
    await ws.changeWorkspaceShortcut(rawDirection * direction, true);

    // Reset swipe state
    this._swipeState = {
      isGestureActive: false,
      lastDelta: 0,
      direction: null,
    };
  }

  onSwipeGestureAnimationEnd() {
    const ws = gZenWorkspaces;

    Services.prefs.setBoolPref("zen.swipe.is-fast-swipe", false);
    document.documentElement.removeAttribute("swipe-gesture");
    gZenUIManager.tabsWrapper.style.removeProperty("scrollbar-width");
    [lazy.browserBackgroundElement, lazy.toolbarBackgroundElement].forEach(
      element => {
        element.style.setProperty("--zen-background-opacity", "1");
      }
    );
    delete ws._hasAnimatedBackgrounds;
    ws.updateTabsContainers();
    document.removeEventListener("popupshown", ws.popupOpenHandler, {
      once: true,
    });
  }

  get isGestureActive() {
    return this._swipeState?.isGestureActive;
  }
}
