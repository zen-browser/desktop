/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(
  lazy,
  {
    ZenLibrary: "moz-src:///zen/library/ZenLibrary.mjs",
  },
  { global: "current" }
);

ChromeUtils.defineLazyGetter(lazy, "browserBackgroundElement", () => {
  return document.getElementById("zen-browser-background");
});

ChromeUtils.defineLazyGetter(lazy, "toolbarBackgroundElement", () => {
  return document.getElementById("zen-toolbar-background");
});

// Distance (in swipe-translate units, after the configured multiplier) that
// corresponds to a fully open library. Crossing this on swipe-end commits.
const LIBRARY_SWIPE_FULL_DISTANCE_FACTOR = 0.6;
const LIBRARY_SWIPE_COMMIT_THRESHOLD = 0.3;

export class ZenSpacesSwipe {
  _swipeState = {
    isGestureActive: false,
    lastDelta: 0,
    direction: null,
  };

  constructor() {
    this.#attachWorkspaceSwipeGestures(gNavToolbox);
    this._popupOpenHandler = this._popupOpenHandler.bind(this);
  }

  get #stripWidth() {
    return (
      window.windowUtils.getBoundsWithoutFlushing(
        document.getElementById("navigator-toolbox")
      ).width +
      window.windowUtils.getBoundsWithoutFlushing(
        document.getElementById("zen-sidebar-splitter")
      ).width
    );
  }

  #attachWorkspaceSwipeGestures(element) {
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
    document.addEventListener("popupshown", this._popupOpenHandler, {
      once: true,
    });

    event.preventDefault();
    event.stopPropagation();
    this._swipeState = {
      isGestureActive: true,
      lastDelta: 0,
      direction: null,
      librarySwiping: false,
      libraryStartProgress: 0,
      libraryProgress: 0,
    };
    Services.prefs.setBoolPref("zen.swipe.is-fast-swipe", true);
  }

  /** True when the active workspace is the first one in the cached list. */
  #isAtFirstWorkspace() {
    const workspaces = gZenWorkspaces.getWorkspaces();
    const active = gZenWorkspaces.getActiveWorkspaceFromCache();
    return workspaces.indexOf(active) === 0;
  }

  _handleSwipeUpdate(event) {
    if (
      !gZenWorkspaces.workspaceEnabled ||
      !this._swipeState?.isGestureActive
    ) {
      return;
    }

    const stripWidth = this.#stripWidth;

    event.preventDefault();
    event.stopPropagation();

    const delta =
      event.delta *
      Services.prefs.getIntPref(
        "zen.workspaces.swipe-actions.delta-multiplier"
      );
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

    if (Math.abs(delta) > 0.9) {
      delete gZenWorkspaces._hasAnimatedBackgrounds;
      this._swipeState.direction = delta > 0 ? "left" : "right";
    }

    // The library can hijack the swipe in two cases:
    //   - Already open → swipe leftwards (translateX < 0) closes it.
    //   - Closed and on the first workspace → swipe rightwards (translateX > 0)
    //     opens it from the left edge.
    const libraryOpen = lazy.ZenLibrary.isOpen;
    const wantsClose = libraryOpen && translateX < 0;
    const wantsOpen =
      !libraryOpen && translateX > 0 && this.#isAtFirstWorkspace();
    if (wantsOpen || wantsClose || this._swipeState.librarySwiping) {
      if (!this._swipeState.librarySwiping) {
        this._swipeState.librarySwiping = true;
        this._swipeState.libraryStartProgress = libraryOpen ? 1 : 0;
        // Fire-and-forget; the first update before measurement completes
        // re-applies the current start progress, which is already visible.
        lazy.ZenLibrary.beginSwipe();
      }
      const deltaProgress =
        translateX / (stripWidth * LIBRARY_SWIPE_FULL_DISTANCE_FACTOR);
      const progress = Math.max(
        0,
        Math.min(1, this._swipeState.libraryStartProgress + deltaProgress)
      );
      this._swipeState.libraryProgress = progress;
      lazy.ZenLibrary.updateSwipeProgress(progress);
      // Skip the workspace-strip translate while the library owns the swipe.
      return;
    }

    // Apply a translateX to the tab strip to give the user feedback on the swipe
    const currentWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
    gZenWorkspaces._organizeWorkspaceStripLocations(
      currentWorkspace,
      true,
      translateX
    );
  }

  async _handleSwipeEnd(event) {
    const ws = gZenWorkspaces;

    if (!ws.workspaceEnabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    // If the swipe was driving the library, commit to whichever side of the
    // threshold the progress landed on and don't change workspace.
    if (this._swipeState.librarySwiping) {
      const targetOpen =
        this._swipeState.libraryProgress >= LIBRARY_SWIPE_COMMIT_THRESHOLD;
      delete this._swipeState.librarySwiping;
      await lazy.ZenLibrary.finishSwipe(targetOpen);
      return;
    }

    const isRTL = document.documentElement.matches(":-moz-locale-dir(rtl)");
    const moveForward =
      (event.direction === SimpleGestureEvent.DIRECTION_RIGHT) !== isRTL;

    const rawDirection = moveForward ? 1 : -1;
    const direction = ws.naturalScroll ? -1 : 1;
    await ws.changeWorkspaceShortcut(rawDirection * direction, true);
  }

  onSwipeGestureAnimationEnd() {
    const ws = gZenWorkspaces;

    if (this._swipeState.librarySwiping) {
      lazy.ZenLibrary.finishSwipe(false);
    }

    // Reset swipe state
    this._swipeState = {
      isGestureActive: false,
      lastDelta: 0,
      direction: null,
    };

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
    document.removeEventListener("popupshown", this._popupOpenHandler, {
      once: true,
    });
  }

  _popupOpenHandler() {
    this.onSwipeGestureAnimationEnd();
  }

  get isGestureActive() {
    return this._swipeState?.isGestureActive;
  }
}
