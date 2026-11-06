// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { PictureInPicture } from "moz-src:///toolkit/components/pictureinpicture/PictureInPicture.sys.mjs";

const lazy = {};
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "RESPECT_PIP_DISABLED",
  "media.videocontrols.picture-in-picture.respect-disablePictureInPicture",
  true
);

function updateDockingInAllWindows() {
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    win.gZenMediaController?.updateDocking();
  }
}

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "VIDEO_ENABLED",
  "zen.mediacontrols.video.enabled",
  true,
  updateDockingInAllWindows
);
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "PIP_ENABLED",
  "media.videocontrols.picture-in-picture.enabled",
  false,
  updateDockingInAllWindows
);
// When Firefox opens a Picture-in-Picture window on tab switch, that window
// takes over from the sidebar video.
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "PIP_WHEN_SWITCHING_TABS",
  "media.videocontrols.picture-in-picture.enable-when-switching-tabs.enabled",
  false,
  updateDockingInAllWindows
);
// When the window is minimized or covered, the sidebar video moves to a
// Picture-in-Picture window, and back once the window is visible again.
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "PIP_WHEN_OCCLUDED",
  "media.videocontrols.picture-in-picture.enable-when-occluded.enabled",
  false
);

const MAX_STACKED_CARDS = 3;
const MAX_PEEK_LEVELS = 2;

// Keeps very wide or very tall videos from producing an unusable card.
const MIN_VIDEO_ASPECT = 1;
const MAX_VIDEO_ASPECT = 21 / 9;

// How long to wait for the media controller to report a Picture-in-Picture
// mode change caused by docking or undocking a video.
const PIP_MODE_TIMEOUT_MS = 1000;
// How long a Picture-in-Picture window may take to open before the card
// assumes the request was declined (e.g. a paused or muted video) and docks
// the video again. Opening a window and loading its player can take well over
// PIP_MODE_TIMEOUT_MS, and docking while it opens would fight over the clone.
const PIP_WINDOW_TIMEOUT_MS = 5000;
// A docked video keeps its media controller in Picture-in-Picture mode, which
// exempts it from the controller's stop-control timer and keeps it as the
// main controller for media keys. So a paused video is only kept docked for
// short pauses, well below the stop-control timer.
const PAUSED_UNDOCK_DELAY_MS = 5000;

/**
 * A single card in the sidebar media stack.
 */
class ZenMediaCard {
  #updateInterval = null;
  #tabTimeout = null;
  #controllerListeners = null;

  // The docked video player: { browser, wgp, cloning }. The browser is a
  // Picture-in-Picture player embedded in the card instead of in a window.
  #dock = null;
  #docking = false;
  #dockGeneration = 0;
  // Counts hand-offs to a Picture-in-Picture window still in progress.
  #suppressDock = 0;
  #pausedTimeout = null;
  // Set once the media has been paused for PAUSED_UNDOCK_DELAY_MS.
  pausedTooLong = false;
  // Set after undocking until the media controller stops reporting the
  // Picture-in-Picture mode the docked player caused.
  #releasingPip = false;
  #releaseTimeout = null;
  #pipModeWaiters = new Set();

  static supportedKeys = ["playpause", "previoustrack", "nexttrack"];

  constructor(manager, element, browser, controller = null) {
    this.manager = manager;
    this.window = manager.window;
    this.element = element;
    this.browser = browser;
    this.controller = controller;

    this.titleEl = element.querySelector(".zen-media-title");
    this.artistEl = element.querySelector(".zen-media-artist");
    this.progressBar = element.querySelector(".zen-media-progress-bar");
    this.currentTimeEl = element.querySelector(".zen-media-current-time");
    this.durationEl = element.querySelector(".zen-media-duration");
    this.focusButton = element.querySelector(".zen-media-focus-button");
    this.videoContainer = element.querySelector(".zen-media-video-container");
    this.controlsBox = element.querySelector(".zen-media-controls-hbox");

    this.#initListeners();

    if (controller) {
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
      this.#updatePausedState();
      this.updateMetadata();
      this.updatePositionState(positionState);
      this.updateSupportedKeys();
    } else {
      this.element.setAttribute("media-sharing", "");
      this.element.setAttribute("media-position-hidden", "true");
      this.titleEl.textContent =
        this.window.gBrowser.getTabForBrowser(browser)?.label || "";
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
    if (
      this.controller.isBeingUsedInPIPModeOrFullscreen &&
      !this.#ownsPipMode
    ) {
      return false;
    }
    return (
      this.window.gBrowser.selectedBrowser.browserId !== this.browser.browserId
    );
  }

  get isVideoDocked() {
    return !!this.#dock;
  }

  /**
   * The docked player clones the video, which the media controller reports
   * as Picture-in-Picture mode. That mode must not hide the card.
   */
  get #ownsPipMode() {
    return !!this.#dock || this.#releasingPip;
  }

  /**
   * The height the card takes in the sidebar's layout. A docked video
   * overlaps the tabs above it, so only the controls are reserved, as for a
   * card without video.
   */
  get reservedHeight() {
    const height = this.element.getBoundingClientRect().height;
    if (!this.element.hasAttribute("zen-video")) {
      return height;
    }
    return (
      height -
      this.videoContainer.getBoundingClientRect().height +
      this.controlsBox.getBoundingClientRect().height
    );
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
    this.#updatePausedState();
    // A page may only create its <video> once playback starts.
    this.manager.updateDocking();
  }

  #updatePausedState() {
    if (this.controller.isPlaying) {
      if (this.#pausedTimeout) {
        this.window.clearTimeout(this.#pausedTimeout);
        this.#pausedTimeout = null;
      }
      this.pausedTooLong = false;
    } else if (!this.#pausedTimeout && !this.pausedTooLong) {
      this.#pausedTimeout = this.window.setTimeout(() => {
        this.#pausedTimeout = null;
        this.pausedTooLong = true;
        this.manager.updateDocking();
      }, PAUSED_UNDOCK_DELAY_MS);
    }
  }

  #onSupportedKeysChange() {
    this.updateSupportedKeys();
  }

  #onMetadataChange() {
    this.updateMetadata();
    this.updatePipButton();
    this.manager.updateDocking();
  }

  #onDeactivated() {
    this.destroy();
  }

  #onPipModeChange() {
    const inPipMode = this.controller.isBeingUsedInPIPModeOrFullscreen;
    if (!inPipMode) {
      this.#endPipRelease();
    }
    let lostClone = false;
    if (this.#dock) {
      if (inPipMode) {
        this.#dock.cloning = true;
      } else if (this.#dock.cloning) {
        // The page stopped the clone, e.g. by removing the <video>.
        lostClone = true;
        this.#undock();
      }
    }
    this.element.toggleAttribute("pip", inPipMode && !this.#ownsPipMode);
    this.refreshVisibility();
    for (const check of Array.from(this.#pipModeWaiters)) {
      check();
    }
    if (lostClone) {
      // Dock again if the page has another video to show.
      this.manager.updateDocking();
    }
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
      } else {
        this.manager.updateDocking();
      }
      return;
    }

    if (this.element.hidden || this.element.hasAttribute("zen-hiding")) {
      return;
    }
    this.element.setAttribute("zen-hiding", "true");
    // The tab itself is being shown (or the media went elsewhere), so stop
    // cloning right away instead of after the hide animation.
    this.setVideoDocked(false);
    Promise.allSettled(
      this.element.getAnimations().map(animation => animation.finished)
    ).then(() => {
      if (!this.element.hasAttribute("zen-hiding")) {
        return;
      }
      this.element.removeAttribute("zen-hiding");
      if (this.shouldBeVisible) {
        // Shown again while hiding (e.g. a quick switch back and forth).
        this.manager.updateDocking();
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
      this.window.clearTimeout(this.#tabTimeout);
      this.#tabTimeout = null;
    }

    if (!this.shouldBeVisible) {
      this.setHidden(true);
    } else if (this.element.hidden) {
      this.#tabTimeout = this.window.setTimeout(() => {
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
      this.window.clearInterval(this.#updateInterval);
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

    this.#updateInterval = this.window.setInterval(() => {
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
        this.window.clearInterval(this.#updateInterval);
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
      const tab = this.window.gBrowser.getTabForBrowser(this.browser);
      if (tab) {
        this.window.gZenWorkspaces.switchTabIfNeeded(tab);
      }
    }
  }

  onMute() {
    const tab = this.window.gBrowser.getTabForBrowser(this.browser);
    if (tab) {
      tab.toggleMuteAudio();
      this.updateMuteState();
    }
  }

  onToggle() {
    if (this.controller?.isPlaying) {
      this.controller.pause("user");
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
    this.controller?.pause("user");
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
    this.handOffToPipWindow(() =>
      this.browser.browsingContext.currentWindowGlobal
        .getActor("PictureInPictureLauncher")
        .sendAsyncMessage("PictureInPicture:KeyToggle")
    );
  }

  /**
   * Requests a Picture-in-Picture window for this card's media. A video can
   * only be cloned to one player at a time, and a toggle request for a video
   * that is already being cloned closes the player instead of opening one,
   * so the docked player has to be gone first.
   *
   * @param {Function} requestPip - Sends the Picture-in-Picture request. It
   *   receives the window global of the docked video's frame, or null.
   */
  async handOffToPipWindow(requestPip) {
    const wgp = this.#dock?.wgp ?? null;
    const wasDocked = !!this.#dock;
    this.#suppressDock++;
    try {
      // Also cancels a dock still being set up.
      this.#undock();
      if (wasDocked) {
        await this.#waitForPipMode(false);
      }
      requestPip(wgp);
      await this.#waitForPipMode(true, PIP_WINDOW_TIMEOUT_MS);
    } catch (e) {
      console.error("Failed to open Picture-in-Picture for media card", e);
    } finally {
      this.#suppressDock--;
      // Docks again if no window opened (e.g. the page declined).
      this.manager.updateDocking();
    }
  }

  /**
   * @param {boolean} docked - Whether the card should show its video.
   */
  setVideoDocked(docked) {
    if (
      docked &&
      !this.#suppressDock &&
      this.controller &&
      !this.pausedTooLong
    ) {
      this.#tryDock();
    } else {
      this.#undock();
    }
  }

  async #tryDock() {
    if (this.#dock || this.#docking) {
      return;
    }
    this.#docking = true;
    const generation = ++this.#dockGeneration;
    try {
      const found = await this.manager.findDockableVideo(this.browser);
      if (found && generation === this.#dockGeneration) {
        await this.#attachPlayer(found);
      }
    } catch (e) {
      console.error("Failed to show video in media card", e);
    } finally {
      if (generation === this.#dockGeneration) {
        this.#docking = false;
      }
    }
  }

  /**
   * Embeds a Picture-in-Picture player browser in the card. Like the player
   * window (see toolkit's pictureinpicture/content/player.js), it loads in
   * the same content process as the video, which the clone requires.
   *
   * @param {object} found - Result of findDockableVideo().
   */
  async #attachPlayer({ wgp, videoRef, videoWidth, videoHeight }) {
    const aspect = Math.min(
      Math.max(videoWidth / videoHeight, MIN_VIDEO_ASPECT),
      MAX_VIDEO_ASPECT
    );
    // Throws if the frame went away since the video was found.
    const { remoteType } = wgp.domProcess;
    const groupId = wgp.browsingContext.group.id;

    const browser = this.window.document.createXULElement("browser");
    for (const [name, value] of Object.entries({
      type: "content",
      remote: "true",
      remoteType,
      initialBrowsingContextGroupId: groupId,
      // Gives it the Picture-in-Picture actors but none of the tab ones.
      messagemanagergroup: "pip-player",
      nodefaultsrc: "true",
      tabindex: "-1",
    })) {
      browser.setAttribute(name, value);
    }
    browser.classList.add("zen-media-video-browser");
    this.element.style.setProperty("--zen-media-video-aspect", aspect);
    // Shown before the browser is inserted so it gets laid out.
    this.element.setAttribute("zen-video", "true");
    this.videoContainer.appendChild(browser);
    this.#dock = { browser, wgp, cloning: false };
    this.manager.onCardLayoutChanged();

    try {
      const actor =
        browser.browsingContext.currentWindowGlobal.getActor(
          "PictureInPicture"
        );
      await actor.sendQuery("PictureInPicture:SetupPlayer", {
        videoRef,
        isPipApiRequest: false,
        // Zen patch: docking is automatic, not a user gesture on the page.
        zenSkipActivation: true,
        initDimension: {
          width: this.videoContainer.clientWidth,
          height: this.videoContainer.clientHeight,
        },
      });
      if (this.#dock?.browser !== browser) {
        return;
      }
      // Setup resolves without cloning when the video went away meanwhile.
      if (!(await this.#waitForPipMode(true))) {
        if (this.#dock?.browser === browser) {
          this.#undock();
        }
      }
    } catch (e) {
      if (this.#dock?.browser === browser) {
        this.#undock();
      }
      throw e;
    }
  }

  #undock() {
    this.#dockGeneration++;
    this.#docking = false;
    if (!this.#dock) {
      return;
    }
    const { browser } = this.#dock;
    this.#dock = null;
    if (this.controller?.isBeingUsedInPIPModeOrFullscreen) {
      this.#beginPipRelease();
    }
    // Unloading the player stops the clone (PictureInPictureChild).
    browser.remove();
    this.element.removeAttribute("zen-video");
    this.manager.onCardLayoutChanged();
  }

  #beginPipRelease() {
    this.#endPipRelease();
    this.#releasingPip = true;
    this.#releaseTimeout = this.window.setTimeout(() => {
      this.#releaseTimeout = null;
      this.#releasingPip = false;
      this.refreshVisibility();
    }, PIP_MODE_TIMEOUT_MS);
  }

  #endPipRelease() {
    if (this.#releaseTimeout) {
      this.window.clearTimeout(this.#releaseTimeout);
      this.#releaseTimeout = null;
    }
    this.#releasingPip = false;
  }

  /**
   * @param {boolean} inPipMode - The Picture-in-Picture mode to wait for.
   * @param {number} timeoutMs - How long to wait.
   * @returns {Promise<boolean>} Whether the controller reached that mode
   *   before the timeout.
   */
  #waitForPipMode(inPipMode, timeoutMs = PIP_MODE_TIMEOUT_MS) {
    return new Promise(resolve => {
      const reached = () => {
        try {
          return this.controller.isBeingUsedInPIPModeOrFullscreen === inPipMode;
        } catch {
          return false;
        }
      };
      if (!this.controller || reached()) {
        resolve(!!this.controller);
        return;
      }
      const finish = result => {
        this.window.clearTimeout(timer);
        this.#pipModeWaiters.delete(check);
        resolve(result);
      };
      const check = () => {
        if (reached()) {
          finish(true);
        }
      };
      const timer = this.window.setTimeout(() => finish(false), timeoutMs);
      this.#pipModeWaiters.add(check);
    });
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
      this.controller.pause("user");
    } else {
      const webRTC =
        this.browser.browsingContext.currentWindowGlobal.getActor("WebRTC");
      webRTC.sendAsyncMessage("webrtc:UnmuteMicrophone");
      webRTC.sendAsyncMessage("webrtc:UnmuteCamera");
    }

    this.destroy();
  }

  /**
   * Drops what the card holds outside its own element.
   */
  teardown() {
    this.#undock();
    this.#endPipRelease();
    if (this.#pausedTimeout) {
      this.window.clearTimeout(this.#pausedTimeout);
      this.#pausedTimeout = null;
    }

    if (this.controller && this.#controllerListeners) {
      for (const [event, listener] of Object.entries(
        this.#controllerListeners
      )) {
        this.controller.removeEventListener(event, listener);
      }
      this.#controllerListeners = null;
    }

    if (this.#updateInterval) {
      this.window.clearInterval(this.#updateInterval);
      this.#updateInterval = null;
    }
    if (this.#tabTimeout) {
      this.window.clearTimeout(this.#tabTimeout);
      this.#tabTimeout = null;
    }
  }

  destroy() {
    this.teardown();

    const { element } = this;
    if (element.hidden) {
      element.remove();
      this.manager.onCardDestroyed(this);
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
      ).then(() => {
        element.remove();
        this.manager.onCardDestroyed(this);
      });
    }
  }
}

/**
 * Zen Media Controller, handles the stack of media control cards located at
 * the bottom of the sidebar. Each active media controller (and WebRTC
 * sharing session) gets its own card.
 */
export class ZenMediaController extends ZenUIComponent {
  #cards = new Map();
  #cardTemplate = null;
  #uninitialized = false;
  #windowOutOfSight = false;
  // Browsers whose docked video was handed to a Picture-in-Picture window
  // because this window went out of sight, until that window is closed.
  #poppedOutBrowsers = new Set();
  // Browsers whose hand-off is still waiting for the player to open.
  #pendingPopOuts = new Set();

  mediaControlBar = null;

  init() {
    this.window.gZenMediaController = this;

    if (!Services.prefs.getBoolPref("zen.mediacontrols.enabled", true)) {
      return;
    }

    this.mediaControlBar = this.document.querySelector(
      "#zen-media-controls-toolbar"
    );
    this.#cardTemplate = this.document.querySelector(
      "#zen-media-card-template"
    );

    this.window.addEventListener("TabSelect", () => {
      for (const card of this.#cards.values()) {
        card.onTabSelect();
      }
    });

    this.#windowOutOfSight = this.#isWindowOutOfSight;
    this.addEventListener("sizemodechange");
    this.addEventListener("occlusionstatechange");

    const onTabDiscardedOrClosed = this.onTabDiscardedOrClosed.bind(this);

    this.window.addEventListener("TabClose", onTabDiscardedOrClosed);
    this.window.addEventListener("TabBrowserDiscarded", onTabDiscardedOrClosed);

    this.window.addEventListener("TabAttrModified", event => {
      if (!event.detail.changed.includes("soundplaying")) {
        return;
      }
      const tab = event.target;
      if (!tab.hasAttribute("soundplaying")) {
        this.onAudioPlaybackStopped();
        return;
      }
      this.onAudioPlaybackStarted(tab.linkedBrowser);
    });
  }

  onAudioPlaybackStarted(browser) {
    // The card is created right away (while the controller is fresh) but
    // only shown if the media is still playing a moment later, so short
    // sounds (e.g. notification pings) never reveal it.
    this.window.setTimeout(() => {
      const card = this.#cardForBrowser(browser);
      if (!card || card.isSharing) {
        return;
      }
      if (card.controller.isPlaying) {
        card.refreshVisibility();
      } else if (card.element.hidden) {
        card.destroy();
      }
    }, 1000);

    this.activateMediaControls(
      browser.browsingContext?.mediaController,
      browser
    );
  }

  onAudioPlaybackStopped() {
    for (const card of this.#cards.values()) {
      card.updateMuteState();
    }
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

  #sharingCardForBrowser(browser) {
    return (
      Array.from(this.#cards.values()).find(
        card => card.isSharing && card.browser.browserId === browser.browserId
      ) ?? null
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

    this.#sharingCardForBrowser(browser)?.destroy();
    this.#addCard(`sharing-${browser.browserId}`, browser);
  }

  updateMediaSharing(data) {
    if (!this.mediaControlBar) {
      return;
    }

    const { windowId, showCameraIndicator, showMicrophoneIndicator } = data;
    const shouldShow = showCameraIndicator || showMicrophoneIndicator;

    for (const browser of this.window.gBrowser.browsers) {
      if (browser.innerWindowID !== windowId) {
        continue;
      }

      const sharingCard = this.#sharingCardForBrowser(browser);

      if (shouldShow && !sharingCard) {
        const webRTC =
          browser.browsingContext.currentWindowGlobal.getActor("WebRTC");
        webRTC.sendAsyncMessage("webrtc:UnmuteMicrophone");
        webRTC.sendAsyncMessage("webrtc:UnmuteCamera");

        this.activateMediaDeviceControls(browser);
      } else if (!shouldShow && sharingCard) {
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

  uninit() {
    this.#uninitialized = true;
    for (const card of this.#cards.values()) {
      card.teardown();
      card.element.remove();
    }
    this.#cards.clear();
  }

  /**
   * Shows the video of the front card when video is enabled, and drops the
   * docked players of every other card.
   */
  updateDocking() {
    if (!this.mediaControlBar || this.#uninitialized) {
      return;
    }
    const front = this.frontCard;
    const canDock =
      lazy.VIDEO_ENABLED &&
      // The card uses the Picture-in-Picture player, so it follows the same
      // switch (which policies can turn off).
      lazy.PIP_ENABLED &&
      // Firefox's own tab-switch Picture-in-Picture window takes over.
      !lazy.PIP_WHEN_SWITCHING_TABS;
    for (const card of this.#cards.values()) {
      card.setVideoDocked(
        canDock &&
          card === front &&
          !card.isSharing &&
          !card.pausedTooLong &&
          !card.element.hasAttribute("zen-hiding")
      );
    }
  }

  /**
   * Finds the video to show for a browser, preferring a playing one, in the
   * top frame first and then in subframes.
   *
   * @param {Browser} browser - The media tab's browser.
   * @returns {Promise<object|null>} The video found by ZenMediaDockChild,
   *   with the window global of its frame as `wgp`.
   */
  async findDockableVideo(browser) {
    const contexts =
      browser.browsingContext?.getAllBrowsingContextsInSubtree() ?? [];
    const results = await Promise.all(
      contexts.map(async context => {
        const wgp = context.currentWindowGlobal;
        if (!wgp) {
          return null;
        }
        try {
          const result = await wgp
            .getActor("ZenMediaDock")
            .sendQuery("ZenMediaDock:FindVideo");
          return result ? { ...result, wgp } : null;
        } catch {
          // No actor for this frame (e.g. a privileged page), or it went away.
          return null;
        }
      })
    );
    const found = results.filter(Boolean);
    return found.find(result => result.playing) ?? found[0] ?? null;
  }

  on_sizemodechange() {
    this.#onWindowVisibilityChange();
  }

  on_occlusionstatechange() {
    this.#onWindowVisibilityChange();
  }

  get #isWindowOutOfSight() {
    return (
      this.window.windowState === this.window.STATE_MINIMIZED ||
      this.window.isFullyOccluded
    );
  }

  /**
   * Firefox's enable-when-occluded only covers a video in the selected tab.
   * This covers the docked one, which always belongs to a background tab.
   */
  async #onWindowVisibilityChange() {
    const outOfSight = this.#isWindowOutOfSight;
    if (outOfSight === this.#windowOutOfSight) {
      return;
    }
    this.#windowOutOfSight = outOfSight;

    if (!outOfSight) {
      for (const browser of Array.from(this.#poppedOutBrowsers)) {
        this.#closePoppedOutPlayer(browser);
        if (!this.#pendingPopOuts.has(browser)) {
          // Closed by the user meanwhile; a player they open later is theirs.
          this.#poppedOutBrowsers.delete(browser);
        }
      }
      return;
    }

    const card = this.frontCard;
    if (!card?.isVideoDocked || !lazy.PIP_ENABLED || !lazy.PIP_WHEN_OCCLUDED) {
      return;
    }
    const { browser } = card;
    this.#poppedOutBrowsers.add(browser);
    this.#pendingPopOuts.add(browser);
    // Like Firefox's tab-switch auto-open, this skips paused or muted video.
    await card.handOffToPipWindow(wgp => {
      if (this.#windowOutOfSight) {
        wgp
          .getActor("PictureInPictureLauncher")
          .sendAsyncMessage("PictureInPicture:AutoToggle");
      }
    });
    this.#pendingPopOuts.delete(browser);
    if (!PictureInPicture.weakAutoPipBrowserToParent.has(browser)) {
      // No player opened.
      this.#poppedOutBrowsers.delete(browser);
    } else if (!this.#windowOutOfSight) {
      // The window came back while the player was opening.
      this.#closePoppedOutPlayer(browser);
    } else {
      this.#keepPlayerOnScreen(browser);
    }
  }

  /**
   * Firefox positions a new player from the window that requested it
   * (PictureInPicture.fitToScreen). This window is minimized by now, and its
   * CSS-to-desktop scale and position no longer describe a real screen, so
   * the player can land off-screen. Re-fit it from the player's own window.
   *
   * @param {Browser} browser - The browser whose player to check.
   */
  #keepPlayerOnScreen(browser) {
    const actorRef = PictureInPicture.weakAutoPipBrowserToParent.get(browser);
    const player = actorRef && PictureInPicture.getWeakPipPlayer(actorRef);
    if (!player) {
      return;
    }
    const scale = player.devicePixelRatio / player.desktopToDeviceScale;
    const left = player.screenX * scale;
    const top = player.screenY * scale;
    const width = player.outerWidth * scale;
    const height = player.outerHeight * scale;
    const [screenLeft, screenTop, screenWidth, screenHeight] =
      PictureInPicture.getAvailScreenSize(
        PictureInPicture.getWorkingScreen(left, top, width, height)
      );
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    if (
      centerX >= screenLeft &&
      centerX <= screenLeft + screenWidth &&
      centerY >= screenTop &&
      centerY <= screenTop + screenHeight
    ) {
      return;
    }
    // With the player as the requesting window, an off-screen player gets
    // the default size and corner of the nearest screen.
    player.resizeToVideo(
      PictureInPicture.fitToScreen(player, {
        videoWidth: player.innerWidth,
        videoHeight: player.innerHeight,
      })
    );
  }

  /**
   * Closing the player stops its clone, which shows the card again, and the
   * card then docks the video again.
   *
   * @param {Browser|null} browser - The browser whose player to close.
   */
  #closePoppedOutPlayer(browser) {
    if (!browser) {
      return;
    }
    // Firefox records the player here (handlePictureInPictureRequest) once
    // it starts opening. Until then, keep the browser so the player is
    // closed when the hand-off finishes.
    const actorRef = PictureInPicture.weakAutoPipBrowserToParent.get(browser);
    if (actorRef) {
      this.#poppedOutBrowsers.delete(browser);
      PictureInPicture.closeSinglePipWindow({
        reason: "Foregrounded",
        actorRef,
      });
    }
  }

  onCardLayoutChanged() {
    if (this.#uninitialized || this.mediaControlBar.hasAttribute("hidden")) {
      return;
    }
    this.#updateCollapsedHeight();
    this.window.gZenUIManager.updateTabsToolbar();
  }

  #updateCollapsedHeight() {
    const front = this.frontCard;
    if (!front) {
      return;
    }
    this.mediaControlBar.style.setProperty(
      "--zen-media-collapsed-height",
      front.reservedHeight + "px"
    );
  }

  closeAllCards() {
    for (const card of Array.from(this.#cards.values())) {
      card.destroy();
    }
  }

  onCardVisibilityChanged() {
    this.#updateStack();
    this.#refreshToolbarVisibility();
    this.updateDocking();
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
      // onAudioPlaybackStarted or on tab switch, like the original bar;
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

    this.window.gZenUIManager.updateTabsToolbar();
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

    this.window.gZenUIManager.motion
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
          // A card re-appeared while the hide animation was running. The
          // animation has left the bar transparent and shifted, and
          // showMediaControls() will not touch a bar that is not hidden, so
          // undo it here or the bar stays invisible for good.
          this.#revealBar();
          return;
        }
        this.mediaControlBar.setAttribute("hidden", "true");
        this.window.gZenUIManager.updateTabsToolbar();
      });
  }

  showMediaControls() {
    if (!this.mediaControlBar.hasAttribute("hidden")) {
      return;
    }

    this.mediaControlBar.removeAttribute("hidden");
    this.window.requestAnimationFrame(() => {
      const front = this.frontCard;
      if (!front) {
        this.mediaControlBar.setAttribute("hidden", "true");
        return;
      }

      this.#updateCollapsedHeight();
      this.mediaControlBar.style.opacity = 0;
      this.window.gZenUIManager.updateTabsToolbar();
      this.#revealBar(0, 10);

      for (const card of this.#cards.values()) {
        card.updateLabelOverflows();
      }
    });
  }

  /**
   * Animates the bar to its resting state. Used both when it first appears,
   * sliding in from `opacityFrom`/`yFrom`, and to undo a hide that a card
   * interrupted, where null starts from wherever the hide got to.
   *
   * @param {number|null} opacityFrom - Opacity to start from.
   * @param {number|null} yFrom - Vertical offset to start from.
   */
  #revealBar(opacityFrom = null, yFrom = null) {
    this.window.gZenUIManager.motion.animate(
      this.mediaControlBar,
      {
        opacity: [opacityFrom, 1],
        y: [yFrom, 0],
      },
      {}
    );
  }
}
