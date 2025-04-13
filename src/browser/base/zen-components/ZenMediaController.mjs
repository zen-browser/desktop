{
  const lazy = {};
  XPCOMUtils.defineLazyPreferenceGetter(
    lazy,
    'RESPECT_PIP_DISABLED',
    'media.videocontrols.picture-in-picture.respect-disablePictureInPicture',
    true
  );

  class ZenMediaController {
    _currentMediaController = null;
    _currentBrowser = null;
    _mediaUpdateInterval = null;

    mediaTitle = null;
    mediaArtist = null;
    mediaControlBar = null;
    mediaProgressBar = null;
    mediaCurrentTime = null;
    mediaDuration = null;
    mediaFocusButton = null;
    mediaProgressBarContainer = null;

    supportedKeys = ['playpause', 'previoustrack', 'nexttrack'];
    mediaControllersMap = new Map();

    _tabTimeout = null;
    _controllerSwitchTimeout = null;

    #isSeeking = false;

    init() {
      if (!Services.prefs.getBoolPref('zen.mediacontrols.enabled', true)) return;

      this.mediaTitle = document.querySelector('#zen-media-title');
      this.mediaArtist = document.querySelector('#zen-media-artist');
      this.mediaControlBar = document.querySelector('#zen-media-controls-toolbar');
      this.mediaProgressBar = document.querySelector('#zen-media-progress-bar');
      this.mediaCurrentTime = document.querySelector('#zen-media-current-time');
      this.mediaDuration = document.querySelector('#zen-media-duration');
      this.mediaFocusButton = document.querySelector('#zen-media-focus-button');
      this.mediaProgressBarContainer = document.querySelector('#zen-media-progress-hbox');

      this.onPositionstateChange = this._onPositionstateChange.bind(this);
      this.onPlaybackstateChange = this._onPlaybackstateChange.bind(this);
      this.onSupportedKeysChange = this._onSupportedKeysChange.bind(this);
      this.onMetadataChange = this._onMetadataChange.bind(this);
      this.onDeactivated = this._onDeactivated.bind(this);
      this.onPipModeChange = this._onPictureInPictureModeChange.bind(this);

      this.#initEventListeners();
    }

    #initEventListeners() {
      this.mediaControlBar.addEventListener('mousedown', (event) => {
        if (event.target.closest(':is(toolbarbutton,#zen-media-progress-hbox)')) return;
        else this.onMediaFocus();
      });

      this.mediaControlBar.addEventListener('command', (event) => {
        const button = event.target.closest('toolbarbutton');
        if (!button) return;
        switch (button.id) {
          case 'zen-media-pip-button':
            this.onMediaPip();
            break;
          case 'zen-media-close-button':
            this.onControllerClose();
            break;
          case 'zen-media-focus-button':
            this.onMediaFocus();
            break;
          case 'zen-media-mute-button':
            this.onMediaMute();
            break;
          case 'zen-media-previoustrack-button':
            this.onMediaPlayPrev();
            break;
          case 'zen-media-nexttrack-button':
            this.onMediaPlayNext();
            break;
          case 'zen-media-playpause-button':
            this.onMediaToggle();
            break;
          case 'zen-media-mute-mic-button':
            this.onMicrophoneMuteToggle();
            break;
          case 'zen-media-mute-camera-button':
            this.onCameraMuteToggle();
            break;
        }
      });

      this.mediaProgressBar.addEventListener('input', this.onMediaSeekDrag.bind(this));
      this.mediaProgressBar.addEventListener('change', this.onMediaSeekComplete.bind(this));

      window.addEventListener('TabSelect', (event) => {
        if (this.isSharing) return;

        const linkedBrowser = event.target.linkedBrowser;
        this.switchController();

        if (this._currentBrowser) {
          if (linkedBrowser.browserId === this._currentBrowser.browserId) {
            if (this._tabTimeout) {
              clearTimeout(this._tabTimeout);
              this._tabTimeout = null;
            }

            this.hideMediaControls();
          } else {
            this._tabTimeout = setTimeout(() => {
              if (!this.mediaControlBar.hasAttribute('pip')) this.showMediaControls();
              else this._tabTimeout = null;
            }, 500);
          }
        }
      });

      const onTabDiscardedOrClosed = this.onTabDiscardedOrClosed.bind(this);

      window.addEventListener('TabClose', onTabDiscardedOrClosed);
      window.addEventListener('TabBrowserDiscarded', onTabDiscardedOrClosed);

      window.addEventListener('DOMAudioPlaybackStarted', (event) => {
        setTimeout(() => {
          if (
            this._currentMediaController?.isPlaying &&
            this.mediaControlBar.hasAttribute('hidden') &&
            !this.mediaControlBar.hasAttribute('pip')
          ) {
            const { selectedBrowser } = gBrowser;
            if (selectedBrowser.browserId !== this._currentBrowser.browserId) {
              this.showMediaControls();
            }
          }
        }, 1000);

        this.activateMediaControls(event.target.browsingContext.mediaController, event.target);
      });

      window.addEventListener('DOMAudioPlaybackStopped', () => this.updateMuteState());
    }

    onTabDiscardedOrClosed(event) {
      const { linkedBrowser } = event.target;
      const isCurrentBrowser = linkedBrowser?.browserId === this._currentBrowser?.browserId;

      if (isCurrentBrowser) {
        this.isSharing = false;
        this.hideMediaControls();
      }

      if (linkedBrowser?.browsingContext.mediaController) {
        this.deinitMediaController(linkedBrowser.browsingContext.mediaController, true, isCurrentBrowser, true);
      }
    }

    async deinitMediaController(mediaController, shouldForget = true, shouldOverride = true, shouldHide = true) {
      if (shouldForget && mediaController) {
        mediaController.removeEventListener('pictureinpicturemodechange', this.onPipModeChange);
        mediaController.removeEventListener('positionstatechange', this.onPositionstateChange);
        mediaController.removeEventListener('playbackstatechange', this.onPlaybackstateChange);
        mediaController.removeEventListener('supportedkeyschange', this.onSupportedKeysChange);
        mediaController.removeEventListener('metadatachange', this.onMetadataChange);
        mediaController.removeEventListener('deactivated', this.onDeactivated);

        this.mediaControllersMap.delete(mediaController.id);
      }

      if (shouldOverride) {
        this._currentMediaController = null;
        this._currentBrowser = null;

        if (this._mediaUpdateInterval) {
          clearInterval(this._mediaUpdateInterval);
          this._mediaUpdateInterval = null;
        }

        if (shouldHide) await this.hideMediaControls();
        this.mediaControlBar.removeAttribute('muted');
        this.mediaControlBar.classList.remove('playing');
      }
    }

    get isSharing() {
      return this.mediaControlBar.hasAttribute('media-sharing');
    }

    set isSharing(value) {
      if (this._currentBrowser?.browsingContext && !value) {
        const webRTC = this._currentBrowser.browsingContext.currentWindowGlobal.getActor('WebRTC');
        webRTC.sendAsyncMessage('webrtc:UnmuteMicrophone');
        webRTC.sendAsyncMessage('webrtc:UnmuteCamera');
      }

      if (!value) {
        this.mediaControlBar.removeAttribute('mic-muted');
        this.mediaControlBar.removeAttribute('camera-muted');
      } else {
        this.mediaControlBar.setAttribute('media-position-hidden', '');
        this.mediaControlBar.setAttribute('media-sharing', '');
      }
    }

    hideMediaControls() {
      if (this.mediaControlBar.hasAttribute('hidden')) return;

      return gZenUIManager.motion
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
          this.mediaControlBar.setAttribute('hidden', 'true');
          this.mediaControlBar.removeAttribute('media-sharing');
          gZenUIManager.updateTabsToolbar();
          gZenUIManager.restoreScrollbarState();
        });
    }

    showMediaControls() {
      if (!this.mediaControlBar.hasAttribute('hidden')) return;

      if (!this.isSharing) {
        if (!this._currentMediaController) return;
        if (this._currentMediaController.isBeingUsedInPIPModeOrFullscreen) return this.hideMediaControls();

        this.updatePipButton();
      }

      const mediaInfoElements = [this.mediaTitle, this.mediaArtist];
      for (const element of mediaInfoElements) {
        element.removeAttribute('overflow'); // So we can properly recalculate the overflow
      }

      this.mediaControlBar.removeAttribute('hidden');
      window.requestAnimationFrame(() => {
        this.mediaControlBar.style.height =
          this.mediaControlBar.querySelector('toolbaritem').getBoundingClientRect().height + 'px';
        this.mediaControlBar.style.opacity = 0;
        gZenUIManager.updateTabsToolbar();
        gZenUIManager.restoreScrollbarState();
        gZenUIManager.motion.animate(
          this.mediaControlBar,
          {
            opacity: [0, 1],
            y: [10, 0],
          },
          {}
        );
        this.addLabelOverflows(mediaInfoElements);
      });
    }

    addLabelOverflows(elements) {
      for (const element of elements) {
        const parent = element.parentElement;
        if (element.scrollWidth > parent.clientWidth) {
          element.setAttribute('overflow', '');
        } else {
          element.removeAttribute('overflow');
        }
      }
    }

    setupMediaController(mediaController, browser) {
      this._currentMediaController = mediaController;
      this._currentBrowser = browser;

      this.updatePipButton();
    }

    setupMediaControlUI(metadata, positionState) {
      this.updatePipButton();

      if (!this.mediaControlBar.classList.contains('playing') && this._currentMediaController.isPlaying) {
        this.mediaControlBar.classList.add('playing');
      }

      const iconURL = this._currentBrowser.mIconURL || `page-icon:${this._currentBrowser.currentURI.spec}`;
      this.mediaFocusButton.style.listStyleImage = `url(${iconURL})`;

      this.mediaTitle.textContent = metadata.title || '';
      this.mediaArtist.textContent = metadata.artist || '';

      gZenUIManager.updateTabsToolbar();
      gZenUIManager.restoreScrollbarState();

      this._currentPosition = positionState.position;
      this._currentDuration = positionState.duration;
      this._currentPlaybackRate = positionState.playbackRate;

      this.updateMediaPosition();

      for (const key of this.supportedKeys) {
        const button = this.mediaControlBar.querySelector(`#zen-media-${key}-button`);
        button.disabled = !this._currentMediaController.supportedKeys.includes(key);
      }
    }

    activateMediaControls(mediaController, browser) {
      this.updateMuteState();
      this.switchController();

      if (!mediaController.isActive || this._currentBrowser?.browserId === browser.browserId) return;

      const metadata = mediaController.getMetadata();
      const positionState = mediaController.getPositionState();
      this.mediaControllersMap.set(mediaController.id, {
        controller: mediaController,
        browser,
        position: positionState.position,
        duration: positionState.duration,
        playbackRate: positionState.playbackRate,
        lastUpdated: Date.now(),
      });

      if (!this._currentBrowser && !this.isSharing) {
        this.setupMediaController(mediaController, browser);
        this.setupMediaControlUI(metadata, positionState);
      }

      mediaController.addEventListener('pictureinpicturemodechange', this.onPipModeChange);
      mediaController.addEventListener('positionstatechange', this.onPositionstateChange);
      mediaController.addEventListener('playbackstatechange', this.onPlaybackstateChange);
      mediaController.addEventListener('supportedkeyschange', this.onSupportedKeysChange);
      mediaController.addEventListener('metadatachange', this.onMetadataChange);
      mediaController.addEventListener('deactivated', this.onDeactivated);
    }

    activateMediaDeviceControls(browser) {
      if (browser?.browsingContext.currentWindowGlobal.hasActivePeerConnections()) {
        this.mediaControlBar.removeAttribute('can-pip');
        this._currentBrowser = browser;

        const tab = window.gBrowser.getTabForBrowser(browser);
        const iconURL = browser.mIconURL || `page-icon:${browser.currentURI.spec}`;

        this.isSharing = true;

        this.mediaFocusButton.style.listStyleImage = `url(${iconURL})`;
        this.mediaTitle.textContent = tab.label;
        this.mediaArtist.textContent = '';

        this.showMediaControls();
      }
    }

    updateMediaSharing(data) {
      const { windowId, showCameraIndicator, showMicrophoneIndicator } = data;

      for (const browser of window.gBrowser.browsers) {
        const isMatch = browser.innerWindowID === windowId;
        const isCurrentBrowser = this._currentBrowser?.browserId === browser.browserId;

        if (!isMatch) continue;
        if (!isCurrentBrowser && (showCameraIndicator || showMicrophoneIndicator)) {
          const webRTC = browser.browsingContext.currentWindowGlobal.getActor('WebRTC');
          webRTC.sendAsyncMessage('webrtc:UnmuteMicrophone');
          webRTC.sendAsyncMessage('webrtc:UnmuteCamera');

          if (this._currentBrowser) this.isSharing = false;
          if (this._currentMediaController) {
            this._currentMediaController.pause();
            this.deinitMediaController(this._currentMediaController, true, true).then(() =>
              this.activateMediaDeviceControls(browser)
            );
          } else this.activateMediaDeviceControls(browser);
        } else if (isCurrentBrowser && this.isSharing && !(showCameraIndicator || showMicrophoneIndicator)) {
          this.isSharing = false;
          this._currentBrowser = null;
          this.hideMediaControls();
        }

        break;
      }
    }

    _onDeactivated(event) {
      this.deinitMediaController(event.target, true, event.target.id === this._currentMediaController.id, true);
      this.switchController();
    }

    _onPlaybackstateChange() {
      if (this._currentMediaController?.isPlaying) {
        this.mediaControlBar.classList.add('playing');
      } else {
        this.switchController();
        this.mediaControlBar.classList.remove('playing');
      }
    }

    _onSupportedKeysChange(event) {
      if (event.target.id !== this._currentMediaController?.id) return;
      for (const key of this.supportedKeys) {
        const button = this.mediaControlBar.querySelector(`#zen-media-${key}-button`);
        button.disabled = !event.target.supportedKeys.includes(key);
      }
    }

    _onPositionstateChange(event) {
      const mediaController = this.mediaControllersMap.get(event.target.id);
      this.mediaControllersMap.set(event.target.id, {
        ...mediaController,
        position: event.position,
        duration: event.duration,
        playbackRate: event.playbackRate,
        lastUpdated: Date.now(),
      });

      if (event.target.id !== this._currentMediaController?.id) return;

      this._currentPosition = event.position;
      this._currentDuration = event.duration;
      this._currentPlaybackRate = event.playbackRate;

      this.updateMediaPosition();
    }

    switchController(force = false) {
      let timeout = 3000;

      if (this.isSharing) return;
      if (this.#isSeeking) return;

      if (this._controllerSwitchTimeout) {
        clearTimeout(this._controllerSwitchTimeout);
        this._controllerSwitchTimeout = null;
      }

      if (this.mediaControllersMap.size === 1) timeout = 0;
      this._controllerSwitchTimeout = setTimeout(() => {
        if (!this._currentMediaController?.isPlaying || force) {
          const nextController = Array.from(this.mediaControllersMap.values())
            .filter(
              (ctrl) =>
                ctrl.controller.isPlaying &&
                gBrowser.selectedBrowser.browserId !== ctrl.browser.browserId &&
                ctrl.controller.id !== this._currentMediaController?.id
            )
            .sort((a, b) => b.lastUpdated - a.lastUpdated)
            .shift();

          if (nextController) {
            this.deinitMediaController(this._currentMediaController, false, true).then(() => {
              this.setupMediaController(nextController.controller, nextController.browser);
              const elapsedTime = Math.floor((Date.now() - nextController.lastUpdated) / 1000);

              this.setupMediaControlUI(nextController.controller.getMetadata(), {
                position: nextController.position + (nextController.controller.isPlaying ? elapsedTime : 0),
                duration: nextController.duration,
                playbackRate: nextController.playbackRate,
              });

              this.showMediaControls();
            });
          }
        }

        this._controllerSwitchTimeout = null;
      }, timeout);
    }

    updateMediaPosition() {
      if (this._mediaUpdateInterval) {
        clearInterval(this._mediaUpdateInterval);
        this._mediaUpdateInterval = null;
      }

      if (this._currentDuration >= 900_000) return this.mediaControlBar.setAttribute('media-position-hidden', 'true');
      else this.mediaControlBar.removeAttribute('media-position-hidden');

      if (!this._currentDuration) return;

      this.mediaCurrentTime.textContent = this.formatSecondsToTime(this._currentPosition);
      this.mediaDuration.textContent = this.formatSecondsToTime(this._currentDuration);
      this.mediaProgressBar.value = (this._currentPosition / this._currentDuration) * 100;

      this._mediaUpdateInterval = setInterval(() => {
        if (this._currentMediaController?.isPlaying) {
          this._currentPosition += 1 * this._currentPlaybackRate;
          if (this._currentPosition > this._currentDuration) {
            this._currentPosition = this._currentDuration;
          }
          this.mediaCurrentTime.textContent = this.formatSecondsToTime(this._currentPosition);
          this.mediaProgressBar.value = (this._currentPosition / this._currentDuration) * 100;
        } else {
          clearInterval(this._mediaUpdateInterval);
          this._mediaUpdateInterval = null;
        }
      }, 1000);
    }

    formatSecondsToTime(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00';

      const totalSeconds = Math.max(0, Math.ceil(seconds));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60).toString();
      const secs = (totalSeconds % 60).toString();

      if (hours > 0) {
        return `${hours}:${minutes.padStart(2, '0')}:${secs.padStart(2, '0')}`;
      }

      return `${minutes}:${secs.padStart(2, '0')}`;
    }

    _onMetadataChange(event) {
      if (event.target.id !== this._currentMediaController?.id) return;
      this.updatePipButton();

      const metadata = event.target.getMetadata();
      this.mediaTitle.textContent = metadata.title || '';
      this.mediaArtist.textContent = metadata.artist || '';

      const mediaInfoElements = [this.mediaTitle, this.mediaArtist];
      for (const element of mediaInfoElements) {
        element.removeAttribute('overflow');
      }

      this.addLabelOverflows(mediaInfoElements);
    }

    _onPictureInPictureModeChange(event) {
      if (event.target.id !== this._currentMediaController?.id) return;
      if (event.target.isBeingUsedInPIPModeOrFullscreen) {
        this.hideMediaControls();
        this.mediaControlBar.setAttribute('pip', '');
      } else {
        const { selectedBrowser } = gBrowser;
        if (selectedBrowser.browserId !== this._currentBrowser.browserId) {
          this.showMediaControls();
        }

        this.mediaControlBar.removeAttribute('pip');
      }
    }

    onMediaPlayPrev() {
      if (this._currentMediaController?.supportedKeys.includes('previoustrack')) {
        this._currentMediaController.prevTrack();
      }
    }

    onMediaPlayNext() {
      if (this._currentMediaController?.supportedKeys.includes('nexttrack')) {
        this._currentMediaController.nextTrack();
      }
    }

    onMediaSeekDrag(event) {
      this.#isSeeking = true;

      this._currentMediaController?.pause();
      const newTime = (event.target.value / 100) * this._currentDuration;
      this.mediaCurrentTime.textContent = this.formatSecondsToTime(newTime);
    }

    onMediaSeekComplete(event) {
      const newPosition = (event.target.value / 100) * this._currentDuration;
      if (this._currentMediaController?.supportedKeys.includes('seekto')) {
        this._currentMediaController.seekTo(newPosition);
        this._currentMediaController.play();
      }

      this.#isSeeking = false;
    }

    onMediaFocus() {
      if (!this._currentBrowser) return;

      if (this._currentMediaController) this._currentMediaController.focus();
      else if (this._currentBrowser) {
        const tab = window.gBrowser.getTabForBrowser(this._currentBrowser);
        if (tab) window.ZenWorkspaces.switchTabIfNeeded(tab);
      }
    }

    onMediaMute() {
      if (!this.mediaControlBar.hasAttribute('muted')) {
        this._currentBrowser.mute();
        this.mediaControlBar.setAttribute('muted', '');
      } else {
        this._currentBrowser.unmute();
        this.mediaControlBar.removeAttribute('muted');
      }
    }

    onMediaToggle() {
      if (this.mediaControlBar.classList.contains('playing')) {
        this._currentMediaController?.pause();
      } else {
        this._currentMediaController?.play();
      }
    }

    onControllerClose() {
      if (this._currentMediaController) {
        this._currentMediaController.pause();
        this.deinitMediaController(this._currentMediaController);
      } else if (this.isSharing) this.isSharing = false;

      this.hideMediaControls();
      this.switchController(true);
    }

    onMediaPip() {
      this._currentBrowser.browsingContext.currentWindowGlobal
        .getActor('PictureInPictureLauncher')
        .sendAsyncMessage('PictureInPicture:KeyToggle');
    }

    onMicrophoneMuteToggle() {
      if (this._currentBrowser) {
        const shouldMute = this.mediaControlBar.hasAttribute('mic-muted') ? 'webrtc:UnmuteMicrophone' : 'webrtc:MuteMicrophone';

        this._currentBrowser.browsingContext.currentWindowGlobal.getActor('WebRTC').sendAsyncMessage(shouldMute);
        this.mediaControlBar.toggleAttribute('mic-muted');
      }
    }

    onCameraMuteToggle() {
      if (this._currentBrowser) {
        const shouldMute = this.mediaControlBar.hasAttribute('camera-muted') ? 'webrtc:UnmuteCamera' : 'webrtc:MuteCamera';

        this._currentBrowser.browsingContext.currentWindowGlobal.getActor('WebRTC').sendAsyncMessage(shouldMute);
        this.mediaControlBar.toggleAttribute('camera-muted');
      }
    }

    updateMuteState() {
      if (!this._currentBrowser) return;
      this.mediaControlBar.toggleAttribute('muted', this._currentBrowser._audioMuted);
    }

    updatePipButton() {
      if (!this._currentBrowser) return;
      if (this.isSharing) return;

      const { totalPipCount, totalPipDisabled } = PictureInPicture.getEligiblePipVideoCount(this._currentBrowser);
      const canPip = totalPipCount === 1 || (totalPipDisabled > 0 && lazy.RESPECT_PIP_DISABLED);

      this.mediaControlBar.toggleAttribute('can-pip', canPip);
    }
  }

  window.gZenMediaController = new ZenMediaController();
}
