/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(
  lazy,
  { ZenLibrary: "moz-src:///zen/library/ZenLibrary.mjs" },
  { global: "current" }
);

export class ZenSpaceAddSwipe {
  #progressVal = 0;
  #element = null;
  #progressBadge = null;
  #backgroundGradient = null;
  #swipeOngoing = false;
  #hiddenForSwipe = [];

  static SUCCESS_THRESHOLD = 0.8;
  static SUCCESS_VELOCITY_CONTRIBUTION = 0;

  static SPACES_TRANSLATION = -25;

  static ENTRY_TRAVEL = 55;
  static ENTRY_PROGRESS = 0.75;

  #easeInOut(x) {
    x = Math.min(Math.max(x, 0), 1);
    return -(Math.cos(Math.PI * x) - 1) / 2;
  }

  set #progress(value) {
    if (!this.#element) {
      return;
    }

    const isNowReady = this.#progressVal < 1 && value >= 1;
    const isNowUnready = this.#progressVal >= 1 && value < 1;
    this.#progressVal = value;

    // The element and the gradient behind it come in together, and are both
    // settled before the swipe is all the way there.
    const entryProgress = Math.min(value / ZenSpaceAddSwipe.ENTRY_PROGRESS, 1);

    const rightSide = this.#tabsOnRight;
    const rightSideFactor = rightSide ? -1 : 1;
    this.#element.style.translate = `${
      (1 - entryProgress) * rightSideFactor * ZenSpaceAddSwipe.ENTRY_TRAVEL
    }% 0`;

    this.#backgroundGradient.style.scale = `${entryProgress} 3`;
    this.#backgroundGradient.style.opacity = `${entryProgress}`;
    this.#progressBadge.style.setProperty(
      "--value",
      this.#easeInOut(value) * 100
    );

    if (isNowReady || isNowUnready) {
      this.#element.toggleAttribute("readytoadd");
      // eslint-disable-next-line mozilla/valid-services
      Services.zen.playHapticFeedback();
    }

    const currentWorkspace = gZenWorkspaces.getActiveWorkspaceFromCache();
    gZenWorkspaces._organizeWorkspaceStripLocations(
      currentWorkspace,
      true,
      value * ZenSpaceAddSwipe.SPACES_TRANSLATION * rightSideFactor,
      { forEdgeAction: true }
    );
  }

  get #tabsOnRight() {
    return gZenVerticalTabsManager._prefsRightSide;
  }

  get #progress() {
    return this.#progressVal;
  }

  get #libraryOnRight() {
    return lazy.ZenLibrary.libraryOnRight;
  }

  /**
   * Whether the space add element should show for a swipe starting now. The
   * swipe manager asks once per swipe and remembers the answer itself.
   *
   * @returns {boolean} True if it should show
   */
  readySwipeAddSpace() {
    const spaces = gZenWorkspaces.getWorkspaces();
    const current = gZenWorkspaces.getActiveWorkspaceFromCache();
    const libraryEnabled = Services.prefs.getBoolPref("zen.library.enabled");
    const libraryOnRight = lazy.ZenLibrary.libraryOnRight;

    return (
      spaces.indexOf(current) === (libraryOnRight ? 0 : spaces.length - 1) &&
      libraryEnabled &&
      gZenWorkspaces.shouldSwipeEdgeActions &&
      !gZenWorkspaces.creatingWorkspaceId
    );
  }

  /**
   * Reset the swipe to avoid the following swipe
   * to be stuck during the cancel animation
   */
  swipeReset() {
    if (this.#progress != 0) {
      this.#progress = 0;
      this.#afterSwipeAction();
    }
  }

  /**
   * Callback for when a swipe action is started.
   */
  startSwipe() {
    this.#addElement();
    this.#progress = 0;

    this.#swipeOngoing = true;
    this.#hideNextSpaceChild();
  }

  endSwipe() {
    this.#progress = 0;
    gZenWorkspaces.openWorkspaceCreation();
  }

  /**
   * Helper function to create an overshoot /
   * rubber band effect for the swipe interaction.
   *
   * @param {number} offset - The amount that overshot
   * @param {number} dimension - Reference scale
   * @param {number} constant - Rubber constant
   * @returns {number} The damped value
   */
  #rubberBand(offset, dimension, constant = 0.55) {
    if (offset === 0 || dimension === 0) {
      return 0;
    }
    return (
      dimension *
      (1 - Math.exp(-(Math.abs(offset) * constant) / dimension)) *
      Math.sign(offset)
    );
  }

  /**
   * Calculates the correct progress based on the
   * swipe's gesture amount and updates the
   * swipe progress with additional rubber banding.
   *
   * @param {number} gestureAmount - The swipe's gesture amount
   */
  swipeProgress(gestureAmount) {
    const DAMPING_DIMENSION = 0.2;
    const RUBBER_BAND_CONSTANT = 0.08;

    const translation = !this.#libraryOnRight ? -gestureAmount : gestureAmount;
    const deltaProgress = translation / ZenSpaceAddSwipe.SUCCESS_THRESHOLD;

    let progressDamped;
    if (deltaProgress < 0) {
      progressDamped =
        0 +
        this.#rubberBand(
          deltaProgress,
          DAMPING_DIMENSION,
          RUBBER_BAND_CONSTANT
        );
    } else if (deltaProgress > 1) {
      progressDamped =
        1 +
        this.#rubberBand(
          deltaProgress - 1,
          DAMPING_DIMENSION,
          RUBBER_BAND_CONSTANT
        );
    } else {
      progressDamped = deltaProgress;
    }

    this.#progress = progressDamped;
  }

  /**
   * Callback for whenever the cancel
   * swipe animation is completed.
   */
  onSwipeAnimationEnd() {
    this.#progress = 0;
    this.#afterSwipeAction();
  }

  #afterSwipeAction() {
    if (!this.#swipeOngoing) {
      return;
    }
    this.#swipeOngoing = false;

    this.#destroyElement();
    this.#restoreNextSpaceChild();
  }

  #hideNextSpaceChild() {
    const current = gZenWorkspaces.getActiveWorkspaceFromCache();
    const currentElement = gZenWorkspaces.workspaceElement(current.uuid);

    for (const space of document.querySelectorAll("zen-workspace")) {
      if (space !== currentElement) {
        this.#hideDuringSwipe(space);
      }
    }
    for (const essentials of document.querySelectorAll(
      "#zen-essentials .zen-workspace-tabs-section"
    )) {
      if (essentials.getAttribute("container") != current.containerTabId) {
        this.#hideDuringSwipe(essentials);
      }
    }
  }

  #hideDuringSwipe(element) {
    element.style.opacity = "0";
    this.#hiddenForSwipe.push(element);
  }

  #restoreNextSpaceChild() {
    for (const element of this.#hiddenForSwipe) {
      element.style.removeProperty("opacity");
    }
    this.#hiddenForSwipe = [];
  }

  #addElement() {
    if (this.#element) {
      return;
    }

    const container = document.createElement("div");
    container.className = "zen-swipe-add-space-container";

    this.#backgroundGradient = document.createElement("div");
    this.#backgroundGradient.className = "zen-swipe-add-space-background";

    this.#progressBadge = document.createElement("div");
    this.#progressBadge.className =
      "zen-swipe-add-space-progress-badge no-squircles";
    container.append(this.#progressBadge);

    const plusIcon = document.createElement("span");
    plusIcon.className = "zen-swipe-add-space-icon";
    this.#progressBadge.append(plusIcon);

    this.#element = container;

    const navbar = document.getElementById("tabbrowser-tabs");
    navbar.append(this.#element);
    navbar.append(this.#backgroundGradient);
  }

  #destroyElement() {
    this.#element.remove();
    this.#backgroundGradient.remove();
    this.#element = null;
    this.#progressBadge = null;
    this.#backgroundGradient = null;
  }
}
