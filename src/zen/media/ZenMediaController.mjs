// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "RESPECT_PIP_DISABLED",
  "media.videocontrols.picture-in-picture.respect-disablePictureInPicture",
  true
);

// Maximum number of cards shown in the stack; extra cards stay hidden until
// a slot frees up.
const MAX_STACKED_CARDS = 3;
// How many background cards visually peek out at the top of the stack.
// Deeper cards hide perfectly behind the last peeking one, so the stack
// doesn't take more room with every extra card.
const MAX_PEEK_LEVELS = 2;

/**
 * A single card in the sidebar media stack: the full control UI for one
 * media controller, or for a WebRTC sharing session when `controller` is
 * null.
 */
class ZenMediaCard {
  #updateInterval = null;
  #tabTimeout = null;
  #controllerListeners = null;

  static supportedKeys = ["playpause", "previoustrack", "nexttrack"];

  constructor(manager, element, browser, controller = null) {
    this.manager = manager;
    this.element = element;
    this.browser = browser;
    this.controller = controller;

    this.titleEl = element.querySelector(".zen-media-title");
    this.artistEl = element.querySelector(".zen-media-artist");
    this.progressBar = element.querySelector(".zen-media-progress-bar");
    this.currentTimeEl = element.querySelector(".zen-media-current-time");
    this.durationEl = element.querySelector(".zen-media-duration");
    this.focusButton = element.querySelector(".zen-media-focus-button");

    this.#initListeners();

    if (controller) {
      // Queried before anything is wired up: it throws if the controller
      // went away in the meantime, and the caller drops the card.
      const positionState = controller.getPositionState();

      this.#controllerListeners = {
        positionstatechange: this.#onPositionstateChange.bind(this),
        playbackstatechange: this.#onPlaybackstateChange.bind(this),
        supportedkeyschange: this.#onSupportedKeysChange.bind(this),
        metadatachange: this.#onMetadataChange.bind(this),
        deactivated: this.#onDeactivated.bind(this),
        pictureinpicturemodechange: this.#onPipModeChange.bind(this),
      };
      for (const [event, listener] of Object.entries(
        this.#controllerListeners
      )) {
        controller.addEventListener(event, listener);
      }

      this.element.classList.toggle("playing", controller.isPlaying);
      this.updateMetadata();
      this.updatePositionState(positionState);
      this.updateSupportedKeys();
    } else {
      this.element.setAttribute("media-sharing", "");
      this.element.setAttribute("media-position-hidden", "true");
      this.titleEl.textContent =
        window.gBrowser.getTabForBrowser(browser)?.label || "";
      this.artistEl.textContent = "";
      this.updateIcon();
    }

    this.updatePipButton();
    this.updateMuteState();
  }

  get isSharing() {
    return !this.controller;
  }

  get shouldBeVisible() {
    if (this.isSharing) {
      return true;
    }
    if (this.controller.isBeingUsedInPIPModeOrFullscreen) {
      return false;
    }
    return gBrowser.selectedBrowser.browserId !== this.browser.browserId;
  }

  #initListeners() {
    this.element.addEventListener("mousedown", event => {
      if (event.target.closest(":is(toolbarbutton,.zen-media-progress-hbox)")) {
        return;
      }
      this.onFocus();
    });

    this.element.addEventListener("command", event => {
      const button = event.target.closest("toolbarbutton");
      if (!button) {
        return;
      }
      if (button.matches(".zen-media-pip-button")) {
        this.onPip();
      } else if (button.matches(".zen-media-close-button")) {
        this.onClose();
      } else if (button.matches(".zen-media-focus-button")) {
        this.onFocus();
      } else if (button.matches(".zen-media-mute-button")) {
        this.onMute();
      } else if (button.matches(".zen-media-previoustrack-button")) {
        this.onPlayPrev();
      } else if (button.matches(".zen-media-nexttrack-button")) {
        this.onPlayNext();
      } else if (button.matches(".zen-media-playpause-button")) {
        this.onToggle();
      } else if (button.matches(".zen-media-mute-mic-button")) {
        this.onMicrophoneMuteToggle();
      } else if (button.matches(".zen-media-mute-camera-button")) {
        this.onCameraMuteToggle();
      }
    });

    this.progressBar.addEventListener("input", this.onSeekDrag.bind(this));
    this.progressBar.addEventListener("change", this.onSeekComplete.bind(this));
  }

  #onPositionstateChange(event) {
    this.updatePositionState(event);
  }

  #onPlaybackstateChange() {
    this.element.classList.toggle("playing", this.controller.isPlaying);
    this.updatePosition();
  }

  #onSupportedKeysChange() {
    this.updateSupportedKeys();
  }

  #onMetadataChange() {
    this.updateMetadata();
    this.updatePipButton();
  }

  #onDeactivated() {
    this.destroy();
  }

  #onPipModeChange() {
    this.element.toggleAttribute(
      "pip",
      this.controller.isBeingUsedInPIPModeOrFullscreen
    );
    this.refreshVisibility();
  }

  refreshVisibility() {
    this.setHidden(!this.shouldBeVisible);
  }

  setHidden(hidden) {
    if (!hidden) {
      // Showing cancels a hide that may still be animating.
      this.element.removeAttribute("zen-hiding");
      if (this.element.hidden) {
        this.element.hidden = false;
        this.manager.onCardVisibilityChanged();
      }
      return;
    }

    if (this.element.hidden || this.element.hasAttribute("zen-hiding")) {
      return;
    }
    this.element.setAttribute("zen-hiding", "true");
    Promise.allSettled(
      this.element.getAnimations().map(animation => animation.finished)
    ).then(() => {
      if (!this.element.hasAttribute("zen-hiding")) {
        return;
      }
      this.element.removeAttribute("zen-hiding");
      if (this.shouldBeVisible) {
        return;
      }
      this.element.hidden = true;
      this.manager.onCardVisibilityChanged();
    });
  }

  // Mirrors the original bar behavior: hide instantly when the card's own
  // tab is selected, reappear on a small delay when switching away.
  onTabSelect() {
    if (this.#tabTimeout) {
      clearTimeout(this.#tabTimeout);
      this.#tabTimeout = null;
    }

    if (!this.shouldBeVisible) {
      this.setHidden(true);
    } else if (this.element.hidden) {
      this.#tabTimeout = setTimeout(() => {
        this.#tabTimeout = null;
        this.refreshVisibility();
      }, 500);
    }
  }

  updateMetadata() {
    const metadata = this.controller.getMetadata();
    this.titleEl.textContent = metadata.title || "";
    this.artistEl.textContent = metadata.artist || "";
    this.updateIcon();
    this.updateLabelOverflows();
  }

  updateIcon() {
    const iconURL =
      this.browser.mIconURL || `page-icon:${this.browser.currentURI.spec}`;
    this.focusButton.style.listStyleImage = `url(${iconURL})`;
  }

  updateLabelOverflows() {
    for (const label of [this.titleEl, this.artistEl]) {
      label.removeAttribute("overflow"); // So we can properly recalculate the overflow
      if (label.scrollWidth > label.parentElement.clientWidth) {
        label.setAttribute("overflow", "");
      }
    }
  }

  updateSupportedKeys() {
    for (const key of ZenMediaCard.supportedKeys) {
      const button = this.element.querySelector(`.zen-media-${key}-button`);
      button.disabled = !this.controller.supportedKeys.includes(key);
    }
  }

  updatePositionState(positionState) {
    this.position = positionState.position;
    this.duration = positionState.duration;
    this.playbackRate = positionState.playbackRate;
    this.updatePosition();
  }

  updatePosition() {
    if (this.#updateInterval) {
      clearInterval(this.#updateInterval);
      this.#updateInterval = null;
    }

    if (this.duration >= 900_000) {
      this.element.setAttribute("media-position-hidden", "true");
      return;
    }
    this.element.removeAttribute("media-position-hidden");

    if (!this.duration) {
      return;
    }

    this.currentTimeEl.textContent = this.formatSecondsToTime(this.position);
    this.durationEl.textContent = this.formatSecondsToTime(this.duration);
    this.progressBar.value = (this.position / this.duration) * 100;

    this.#updateInterval = setInterval(() => {
      if (this.controller?.isPlaying) {
        this.position += 1 * this.playbackRate;
        if (this.position > this.duration) {
          this.position = this.duration;
        }
        this.currentTimeEl.textContent = this.formatSecondsToTime(
          this.position
        );
        this.progressBar.value = (this.position / this.duration) * 100;
      } else {
        clearInterval(this.#updateInterval);
        this.#updateInterval = null;
      }
    }, 1000);
  }

  formatSecondsToTime(seconds) {
    if (!seconds || isNaN(seconds)) {
      return "0:00";
    }

    const totalSeconds = Math.max(0, Math.ceil(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString();
    const secs = (totalSeconds % 60).toString();

    if (hours > 0) {
      return `${hours}:${minutes.padStart(2, "0")}:${secs.padStart(2, "0")}`;
    }

    return `${minutes}:${secs.padStart(2, "0")}`;
  }

  updateMuteState() {
    this.element.toggleAttribute("muted", this.browser.audioMuted);
  }

  updatePipButton() {
    if (this.isSharing) {
      this.element.removeAttribute("can-pip");
      return;
    }

    const { totalPipCount, totalPipDisabled } =
      PictureInPicture.getEligiblePipVideoCount(this.browser);
    const canPip =
      totalPipCount === 1 ||
      (totalPipDisabled > 0 && lazy.RESPECT_PIP_DISABLED);

    this.element.toggleAttribute("can-pip", canPip);
  }

  onFocus() {
    if (this.controller) {
      this.controller.focus();
    } else {
      const tab = window.gBrowser.getTabForBrowser(this.browser);
      if (tab) {
        window.gZenWorkspaces.switchTabIfNeeded(tab);
      }
    }
  }

  onMute() {
    const tab = window.gBrowser.getTabForBrowser(this.browser);
    if (tab) {
      tab.toggleMuteAudio();
      this.updateMuteState();
    }
  }

  onToggle() {
    if (this.controller?.isPlaying) {
      this.controller.pause();
    } else {
      this.controller?.play();
    }
  }

  onPlayPrev() {
    if (this.controller?.supportedKeys.includes("previoustrack")) {
      this.controller.prevTrack();
    }
  }

  onPlayNext() {
    if (this.controller?.supportedKeys.includes("nexttrack")) {
      this.controller.nextTrack();
    }
  }

  onSeekDrag(event) {
    this.controller?.pause();
    const newTime = (event.target.value / 100) * this.duration;
    this.currentTimeEl.textContent = this.formatSecondsToTime(newTime);
  }

  onSeekComplete(event) {
    const newPosition = (event.target.value / 100) * this.duration;
    if (this.controller?.supportedKeys.includes("seekto")) {
      this.controller.seekTo(newPosition);
      this.controller.play();
    }
  }

  onPip() {
    this.browser.browsingContext.currentWindowGlobal
      .getActor("PictureInPictureLauncher")
      .sendAsyncMessage("PictureInPicture:KeyToggle");
  }

  onMicrophoneMuteToggle() {
    const shouldMute = this.element.hasAttribute("mic-muted")
      ? "webrtc:UnmuteMicrophone"
      : "webrtc:MuteMicrophone";

    this.browser.browsingContext.currentWindowGlobal
      .getActor("WebRTC")
      .sendAsyncMessage(shouldMute);
    this.element.toggleAttribute("mic-muted");
  }

  onCameraMuteToggle() {
    const shouldMute = this.element.hasAttribute("camera-muted")
      ? "webrtc:UnmuteCamera"
      : "webrtc:MuteCamera";

    this.browser.browsingContext.currentWindowGlobal
      .getActor("WebRTC")
      .sendAsyncMessage(shouldMute);
    this.element.toggleAttribute("camera-muted");
  }

  onClose() {
    if (this.controller) {
      this.controller.pause();
    } else {
      const webRTC =
        this.browser.browsingContext.currentWindowGlobal.getActor("WebRTC");
      webRTC.sendAsyncMessage("webrtc:UnmuteMicrophone");
      webRTC.sendAsyncMessage("webrtc:UnmuteCamera");
    }

    this.destroy();
  }

  destroy() {
    if (this.controller && this.#controllerListeners) {
      for (const [event, listener] of Object.entries(
        this.#controllerListeners
      )) {
        this.controller.removeEventListener(event, listener);
      }
      this.#controllerListeners = null;
    }

    if (this.#updateInterval) {
      clearInterval(this.#updateInterval);
      this.#updateInterval = null;
    }
    if (this.#tabTimeout) {
      clearTimeout(this.#tabTimeout);
      this.#tabTimeout = null;
    }

    const { element } = this;
    if (element.hidden) {
      element.remove();
    } else {
      // Animate the card out instead of popping it away. It leaves the
      // flex flow immediately (so the remaining cards re-slot right away)
      // but stays anchored where it currently is while it sinks and fades.
      const barBottom =
        this.manager.mediaControlBar.getBoundingClientRect().bottom;
      element.style.bottom =
        barBottom - element.getBoundingClientRect().bottom + "px";
      element.setAttribute("zen-removing", "true");
      // Resolves once the exit transitions finish or get cancelled, and
      // immediately if they never start (e.g. reduced motion).
      Promise.allSettled(
        element.getAnimations().map(animation => animation.finished)
      ).then(() => element.remove());
    }

    this.manager.onCardDestroyed(this);
  }
}

/**
 * Zen Media Controller, handles the stack of media control cards located at
 * the bottom of the sidebar. Each active media controller (and WebRTC
 * sharing session) gets its own card; cards stack behind each other and
 * expand upwards when hovering the container.
 */
class nsZenMediaController {
  #cards = new Map();
  #cardTemplate = null;

  mediaControlBar = null;

  init() {
    if (!Services.prefs.getBoolPref("zen.mediacontrols.enabled", true)) {
      return;
    }

    this.mediaControlBar = document.querySelector(
      "#zen-media-controls-toolbar"
    );
    this.#cardTemplate = document.querySelector("#zen-media-card-template");

    window.addEventListener("TabSelect", () => {
      for (const card of this.#cards.values()) {
        card.onTabSelect();
      }
    });

    const onTabDiscardedOrClosed = this.onTabDiscardedOrClosed.bind(this);

    window.addEventListener("TabClose", onTabDiscardedOrClosed);
    window.addEventListener("TabBrowserDiscarded", onTabDiscardedOrClosed);

    window.addEventListener("DOMAudioPlaybackStarted", event => {
      const browser = event.target;
      // The card is created right away (while the controller is fresh)
      // but only shown if the media is still playing a moment later, so
      // short sounds (e.g. notification pings) never reveal it.
      setTimeout(() => {
        const card = this.#cardForBrowser(browser);
        if (!card || card.isSharing) {
          return;
        }
        if (card.controller.isPlaying) {
          card.refreshVisibility();
        } else if (card.element.hidden) {
          // The sound was over before ever being shown (e.g. a
          // notification ping): drop the card instead of keeping a ghost
          // around.
          card.destroy();
        }
      }, 1000);

      this.activateMediaControls(
        browser.browsingContext.mediaController,
        browser
      );
    });

    window.addEventListener("DOMAudioPlaybackStopped", () => {
      for (const card of this.#cards.values()) {
        card.updateMuteState();
      }
    });
  }

  get frontCard() {
    return this.#orderedCards.find(card => !card.element.hidden) ?? null;
  }

  get #orderedCards() {
    // Newest media sits at the front of the stack.
    return Array.from(this.#cards.values()).reverse();
  }

  get #hasVisibleCards() {
    return Array.from(this.#cards.values()).some(card => !card.element.hidden);
  }

  get #sharingCard() {
    return (
      Array.from(this.#cards.values()).find(card => card.isSharing) ?? null
    );
  }

  #cardForBrowser(browser) {
    return (
      Array.from(this.#cards.values()).find(
        card => card.browser.browserId === browser.browserId
      ) ?? null
    );
  }

  activateMediaControls(mediaController, browser) {
    if (
      !mediaController?.isActive ||
      this.#cards.has(mediaController.id) ||
      // Never stack more than one card for the same browser: sites that
      // activate a fresh controller for every sound they play (e.g.
      // notification pings) keep their one card.
      this.#cardForBrowser(browser)
    ) {
      return;
    }

    this.#addCard(mediaController.id, browser, mediaController);
  }

  activateMediaDeviceControls(browser) {
    if (
      !browser?.browsingContext.currentWindowGlobal.hasActivePeerConnections()
    ) {
      return;
    }

    this.#sharingCard?.destroy();
    this.#addCard(`sharing-${browser.browserId}`, browser);
  }

  updateMediaSharing(data) {
    if (!this.mediaControlBar) {
      return;
    }

    const { windowId, showCameraIndicator, showMicrophoneIndicator } = data;
    const shouldShow = showCameraIndicator || showMicrophoneIndicator;

    for (const browser of window.gBrowser.browsers) {
      if (browser.innerWindowID !== windowId) {
        continue;
      }

      const sharingCard = this.#sharingCard;
      const isSharingBrowser =
        sharingCard?.browser.browserId === browser.browserId;

      if (shouldShow && !isSharingBrowser) {
        const webRTC =
          browser.browsingContext.currentWindowGlobal.getActor("WebRTC");
        webRTC.sendAsyncMessage("webrtc:UnmuteMicrophone");
        webRTC.sendAsyncMessage("webrtc:UnmuteCamera");

        this.activateMediaDeviceControls(browser);
      } else if (!shouldShow && isSharingBrowser) {
        sharingCard.destroy();
      }

      break;
    }
  }

  onTabDiscardedOrClosed(event) {
    const { linkedBrowser } = event.target;
    if (!linkedBrowser) {
      return;
    }

    for (const card of Array.from(this.#cards.values())) {
      if (card.browser.browserId === linkedBrowser.browserId) {
        card.destroy();
      }
    }
  }

  closeAllCards() {
    for (const card of Array.from(this.#cards.values())) {
      card.destroy();
    }
  }

  onCardVisibilityChanged() {
    this.#updateStack();
    this.#refreshToolbarVisibility();
  }

  onCardDestroyed(card) {
    for (const [key, existing] of this.#cards) {
      if (existing === card) {
        this.#cards.delete(key);
        break;
      }
    }
    this.onCardVisibilityChanged();
  }

  #addCard(key, browser, controller = null) {
    const element = this.#createCardElement();
    let card;
    try {
      card = new ZenMediaCard(this, element, browser, controller);
    } catch (e) {
      console.error("Failed to create media card", e);
      // The controller went away while the card was being set up.
      element.remove();
      return null;
    }
    this.#cards.set(key, card);
    if (controller) {
      // Media cards start hidden and appear via the delayed check in
      // DOMAudioPlaybackStarted or on tab switch, like the original bar;
      // sharing cards show right away.
      card.element.hidden = true;
    } else {
      card.refreshVisibility();
    }
    this.onCardVisibilityChanged();
    return card;
  }

  #createCardElement() {
    const fragment = this.#cardTemplate.content.cloneNode(true);
    const element = fragment.firstElementChild;
    this.mediaControlBar.appendChild(fragment);
    return element;
  }

  #updateStack() {
    const visibleCards = this.#orderedCards.filter(
      card => !card.element.hidden
    );

    // Re-slot the indices without transitions first: the index transform
    // only compensates the flex-order shift, so a reindexed card keeps
    // its visual position through this step.
    visibleCards.forEach((card, index) => {
      card.element.toggleAttribute(
        "stack-overflow",
        index >= MAX_STACKED_CARDS
      );
      card.element.toggleAttribute("stacked-behind", index > 0);
      card.element.setAttribute("zen-reindexing", "true");
      card.element.style.setProperty("--zen-media-card-index", index);
      card.element.style.zIndex = 100 - index;
    });

    // Flush styles so the re-slotting lands instantly...
    this.mediaControlBar.getBoundingClientRect();

    // ...then animate only the peek level: demoted cards slide up from
    // behind the front card instead of dropping in from above.
    visibleCards.forEach((card, index) => {
      card.element.removeAttribute("zen-reindexing");
      card.element.style.setProperty(
        "--zen-media-card-peek-level",
        Math.min(index, MAX_PEEK_LEVELS)
      );
    });

    const stackedCount = Math.min(visibleCards.length, MAX_STACKED_CARDS);
    this.mediaControlBar.style.setProperty(
      "--zen-media-stack-behind",
      Math.max(Math.min(stackedCount - 1, MAX_PEEK_LEVELS), 0)
    );

    gZenUIManager.updateTabsToolbar();
  }

  #refreshToolbarVisibility() {
    if (this.#hasVisibleCards) {
      this.showMediaControls();
    } else {
      this.hideMediaControls();
    }
  }

  hideMediaControls() {
    if (this.mediaControlBar.hasAttribute("hidden")) {
      return;
    }

    gZenUIManager.motion
      .animate(
        this.mediaControlBar,
        {
          opacity: [1, 0],
          y: [0, 10],
        },
        {
          duration: 0.1,
        }
      )
      .then(() => {
        if (this.#hasVisibleCards) {
          // A card re-appeared while the hide animation was running.
          return;
        }
        this.mediaControlBar.setAttribute("hidden", "true");
        gZenUIManager.updateTabsToolbar();
      });
  }

  showMediaControls() {
    if (!this.mediaControlBar.hasAttribute("hidden")) {
      return;
    }

    this.mediaControlBar.removeAttribute("hidden");
    window.requestAnimationFrame(() => {
      const front = this.frontCard;
      if (!front) {
        this.mediaControlBar.setAttribute("hidden", "true");
        return;
      }

      this.mediaControlBar.style.setProperty(
        "--zen-media-collapsed-height",
        front.element.getBoundingClientRect().height + "px"
      );
      this.mediaControlBar.style.opacity = 0;
      gZenUIManager.updateTabsToolbar();
      gZenUIManager.motion.animate(
        this.mediaControlBar,
        {
          opacity: [0, 1],
          y: [10, 0],
        },
        {}
      );

      for (const card of this.#cards.values()) {
        card.updateLabelOverflows();
      }
    });
  }
}

window.gZenMediaController = new nsZenMediaController();
