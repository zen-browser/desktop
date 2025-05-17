{
  const { Downloads } = ChromeUtils.importESModule('resource://gre/modules/Downloads.sys.mjs');

  const CONFIG = Object.freeze({
    ANIMATION: {
      ARC_STEPS: 60,
      MAX_ARC_HEIGHT: 1200,
      ARC_HEIGHT_RATIO: 0.8, // Arc height = distance * ratio (capped at MAX_ARC_HEIGHT)
      SCALE_END: 0.45, // Final scale at destination
    },
  });

  class ZenDownloadAnimation extends ZenDOMOperatedFeature {
    #lastClickPosition = null;

    async init() {
      this.#setupClickListener();
      await this.#setupDownloadListeners();
    }

    #setupClickListener() {
      document.addEventListener('mousedown', this.#handleClick.bind(this), true);
    }

    #handleClick(event) {
      this.#lastClickPosition = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }

    async #setupDownloadListeners() {
      try {
        const list = await Downloads.getList(Downloads.ALL);
        list.addView({
          onDownloadAdded: this.#handleNewDownload.bind(this),
        });
      } catch (error) {
        console.error(
          `[${ZenDownloadAnimation.name}] Failed to set up download animation listeners: ${error}`
        );
      }
    }

    #handleNewDownload() {
      if (
        !Services.prefs.getBoolPref('zen.downloads.download-animation') ||
        !ZenMultiWindowFeature.isActiveWindow
      ) {
        return;
      }

      if (!this.#lastClickPosition) {
        console.warn(
          `[${ZenDownloadAnimation.name}] No recent click position available for animation`
        );
        return;
      }

      this.#animateDownload(this.#lastClickPosition);
    }

    #animateDownload(startPosition) {
      let animationElement = document.querySelector('zen-download-animation');

      if (!animationElement) {
        animationElement = document.createElement('zen-download-animation');
        document.body.appendChild(animationElement);
      }

      animationElement.initializeAnimation(startPosition);
    }
  }

  class ZenDownloadAnimationElement extends HTMLElement {
    #boxAnimationElement = null;
    #boxAnimationTimeoutId = null;
    #isBoxAnimationRunning = false;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.#loadArcStyles();
    }

    #loadArcStyles() {
      try {
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute(
          'href',
          'chrome://browser/content/zen-styles/zen-download-arc-animation.css'
        );
        this.shadowRoot.appendChild(link);
      } catch (error) {
        console.error(`[${ZenDownloadAnimationElement.name}] Error loading arc styles: ${error}`);
      }
    }

    async initializeAnimation(startPosition) {
      if (!startPosition) {
        console.warn(
          `[${ZenDownloadAnimationElement.name}] No start position provided, skipping animation`
        );
        return;
      }

      // Determine animation target position
      const { endPosition, isDownloadButtonVisible } = this.#determineEndPosition();
      const areTabsPositionedRight = this.#areTabsOnRightSide();

      // Create and prepare the arc animation element
      const arcAnimationElement = this.#createArcAnimationElement(startPosition);

      // Calculate optimal arc parameters based on available space
      const distance = this.#calculateDistance(startPosition, endPosition);
      const { arcHeight, shouldArcDownward } = this.#calculateOptimalArc(
        startPosition,
        endPosition,
        distance
      );
      const distanceX = endPosition.clientX - startPosition.clientX;
      const distanceY = endPosition.clientY - startPosition.clientY;
      const arcSequence = this.#createArcAnimationSequence(
        distanceX,
        distanceY,
        arcHeight,
        shouldArcDownward
      );

      // Start the download animation
      await this.#startDownloadAnimation(
        areTabsPositionedRight,
        isDownloadButtonVisible,
        arcAnimationElement,
        arcSequence
      );
    }

    #areTabsOnRightSide() {
      return Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
    }

    #determineEndPosition() {
      const downloadsButton = document.getElementById('downloads-button');
      const isDownloadButtonVisible = downloadsButton && this.#isElementVisible(downloadsButton);

      let endPosition = { clientX: 0, clientY: 0 };

      if (isDownloadButtonVisible) {
        // Use download button as target
        const buttonRect = downloadsButton.getBoundingClientRect();
        endPosition = {
          clientX: buttonRect.left + buttonRect.width / 2,
          clientY: buttonRect.top + buttonRect.height / 2,
        };
      } else {
        // Use alternative position at bottom of wrapper
        const areTabsPositionedRight = this.#areTabsOnRightSide();
        const wrapper = document.getElementById('zen-main-app-wrapper');
        const wrapperRect = wrapper.getBoundingClientRect();

        endPosition = {
          clientX: areTabsPositionedRight ? wrapperRect.right - 42 : wrapperRect.left + 42,
          clientY: wrapperRect.bottom - 40,
        };
      }

      return { endPosition, isDownloadButtonVisible };
    }

    #createArcAnimationElement(startPosition) {
      const arcAnimationHTML = `
            <box class="zen-download-arc-animation">
              <box class="zen-download-arc-animation-inner-circle">
                <html:div class="zen-download-arc-animation-icon"></html:div>
              </box>
            </box>
          `;

      const fragment = window.MozXULElement.parseXULToFragment(arcAnimationHTML);
      const animationElement = fragment.querySelector('.zen-download-arc-animation');

      Object.assign(animationElement.style, {
        left: `${startPosition.clientX}px`,
        top: `${startPosition.clientY}px`,
        transform: 'translate(-50%, -50%)',
      });

      this.shadowRoot.appendChild(animationElement);

      return animationElement;
    }

    #calculateOptimalArc(startPosition, endPosition, distance) {
      // Calculate available space for the arc
      const availableTopSpace = Math.min(startPosition.clientY, endPosition.clientY);
      const viewportHeight = window.innerHeight;
      const availableBottomSpace =
        viewportHeight - Math.max(startPosition.clientY, endPosition.clientY);

      // Determine if we should arc downward or upward based on available space
      const shouldArcDownward = availableBottomSpace > availableTopSpace;

      // Use the space in the direction we're arcing
      const availableSpace = shouldArcDownward ? availableBottomSpace : availableTopSpace;

      // Limit arc height to a percentage of the available space
      const arcHeight = Math.min(
        distance * CONFIG.ANIMATION.ARC_HEIGHT_RATIO,
        CONFIG.ANIMATION.MAX_ARC_HEIGHT,
        availableSpace * 0.8
      );

      return { arcHeight, shouldArcDownward };
    }

    #calculateDistance(start, end) {
      const distanceX = end.clientX - start.clientX;
      const distanceY = end.clientY - start.clientY;
      return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    }

    async #startDownloadAnimation(
      areTabsPositionedRight,
      isDownloadButtonVisible,
      arcAnimationElement,
      sequence
    ) {
      try {
        if (!isDownloadButtonVisible) {
          this.#startBoxAnimation(areTabsPositionedRight);
        }

        await gZenUIManager.motion.animate(arcAnimationElement, sequence, {
          duration: Services.prefs.getIntPref('zen.downloads.download-animation-duration') / 1000,
          easing: 'cubic-bezier(0.37, 0, 0.63, 1)',
          fill: 'forwards',
        });

        this.#cleanArcAnimation(arcAnimationElement);
      } catch (error) {
        console.error('[ZenDownloadAnimationElement] Error in animation sequence:', error);
        this.#cleanArcAnimation(arcAnimationElement);
      }
    }

    #createArcAnimationSequence(distanceX, distanceY, arcHeight, shouldArcDownward) {
      const sequence = { offset: [], opacity: [], transform: [] };

      const arcDirection = shouldArcDownward ? 1 : -1;
      const steps = CONFIG.ANIMATION.ARC_STEPS;
      const endScale = CONFIG.ANIMATION.SCALE_END;

      function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      }

      let previousRotation = 0;
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const eased = easeInOutQuad(progress);

        // Calculate opacity changes
        let opacity;
        if (progress < 0.3) {
          // Fade in during first 30%
          opacity = 0.3 + (progress / 0.3) * 0.6;
        } else if (progress < 0.98) {
          // Slight increase to full opacity
          opacity = 0.9 + ((progress - 0.3) / 0.6) * 0.1;
        } else {
          // Decrease opacity in the final steps
          opacity = 1 - ((progress - 0.9) / 0.1) * 1;
        }

        // Calculate scaling changes
        let scale;
        if (progress < 0.5) {
          scale = 0.5 + (progress / 0.5) * 1.3;
        } else {
          scale = 1.8 - ((progress - 0.5) / 0.5) * (1.8 - endScale);
        }

        // Position on arc
        const x = distanceX * eased;
        const y = distanceY * eased + arcDirection * arcHeight * (1 - (2 * eased - 1) ** 2);

        // Calculate rotation to point in the direction of movement
        let rotation = previousRotation;
        if (i > 0) {
          const prevEased = easeInOutQuad((i - 1) / steps);

          const prevX = distanceX * prevEased;
          const prevAdjustedProgress = prevEased * 2 - 1;
          const prevVerticalOffset = arcDirection * arcHeight * (1 - prevAdjustedProgress * 2);
          const prevY = distanceY * prevEased + prevVerticalOffset;

          const targetRotation = Math.atan2(y - prevY, x - prevX) * (180 / Math.PI);

          rotation += (targetRotation - previousRotation) * 0.01;
          previousRotation = rotation;
        }

        sequence.offset.push(progress);
        sequence.opacity.push(opacity);
        sequence.transform.push(
          `translate(calc(${x}px - 50%), calc(${y}px - 50%)) rotate(${rotation}deg) scale(${scale})`
        );
      }

      return sequence;
    }

    #cleanArcAnimation(element) {
      element.remove();
    }

    async #startBoxAnimation(areTabsPositionedRight) {
      // If animation is already in progress, don't start a new one
      if (this.#isBoxAnimationRunning) {
        console.warn(
          `[${ZenDownloadAnimationElement.name}] Box animation already running, skipping new request.`
        );
        return;
      }

      if (this.#boxAnimationElement) {
        clearTimeout(this.#boxAnimationTimeoutId);
        this.#boxAnimationTimeoutId = setTimeout(
          () => this.#finishBoxAnimation(areTabsPositionedRight),
          this.#getBoxAnimationDurationMs()
        );
        return;
      }

      const wrapper = document.getElementById('zen-main-app-wrapper');
      if (!wrapper) {
        console.warn(
          `[${ZenDownloadAnimationElement.name}] Cannot start box animation, Wrapper element not found`
        );
        return;
      }

      this.#isBoxAnimationRunning = true;

      try {
        const boxAnimationHTML = `
            <box class="zen-download-box-animation">
              <html:div class="zen-download-box-animation-icon"></html:div>
            </box>
          `;

        const sideProp = areTabsPositionedRight ? 'right' : 'left';

        const fragment = window.MozXULElement.parseXULToFragment(boxAnimationHTML);
        this.#boxAnimationElement = fragment.querySelector('.zen-download-box-animation');

        Object.assign(this.#boxAnimationElement.style, {
          bottom: '24px',
          transform: 'scale(0.8)',
          [sideProp]: '-50px',
        });

        wrapper.appendChild(this.#boxAnimationElement);

        await gZenUIManager.motion.animate(
          this.#boxAnimationElement,
          {
            [sideProp]: '34px',
            opacity: 1,
            transform: 'scale(1.1)',
          },
          {
            duration: 0.35,
            easing: 'ease-out',
          }
        ).finished;

        await gZenUIManager.motion.animate(
          this.#boxAnimationElement,
          {
            [sideProp]: '24px',
            transform: 'scale(1)',
          },
          {
            duration: 0.2,
            easing: 'ease-in-out',
          }
        ).finished;

        clearTimeout(this.#boxAnimationTimeoutId);
        this.#boxAnimationTimeoutId = setTimeout(
          () => this.#finishBoxAnimation(areTabsPositionedRight),
          this.#getBoxAnimationDurationMs()
        );
      } catch (error) {
        console.error(
          `[${ZenDownloadAnimationElement.name}] Error during box entry animation: ${error}`
        );
        this.#cleanBoxAnimation();
      } finally {
        this.#isBoxAnimationRunning = false;
      }
    }

    #getBoxAnimationDurationMs() {
      return Services.prefs.getIntPref('zen.downloads.download-animation-duration') + 200;
    }

    async #finishBoxAnimation(areTabsPositionedRight) {
      clearTimeout(this.#boxAnimationTimeoutId);
      this.#boxAnimationTimeoutId = null;

      if (!this.#boxAnimationElement || this.#isBoxAnimationRunning) {
        if (!this.#boxAnimationElement) this.#cleanBoxAnimationState();
        return;
      }

      this.#isBoxAnimationRunning = true;

      try {
        const sideProp = areTabsPositionedRight ? 'right' : 'left';

        await gZenUIManager.motion.animate(
          this.#boxAnimationElement,
          {
            transform: 'scale(0.9)',
          },
          {
            duration: 0.15,
            easing: 'ease-in',
          }
        ).finished;

        await gZenUIManager.motion.animate(
          this.#boxAnimationElement,
          {
            [sideProp]: '-50px',
            opacity: 0,
            transform: 'scale(0.8)',
          },
          {
            duration: 0.3,
            easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
          }
        ).finished;
      } catch (error) {
        console.warn(
          `[${ZenDownloadAnimationElement.name}] Error during box exit animation: ${error}`
        );
      } finally {
        this.#cleanBoxAnimation();
      }
    }

    #cleanBoxAnimationState() {
      this.#boxAnimationElement = null;
      if (this.#boxAnimationTimeoutId) {
        clearTimeout(this.#boxAnimationTimeoutId);
        this.#boxAnimationTimeoutId = null;
      }
      this.#isBoxAnimationRunning = false;
    }

    #cleanBoxAnimation() {
      if (this.#boxAnimationElement && this.#boxAnimationElement.isConnected) {
        try {
          this.#boxAnimationElement.remove();
        } catch (error) {
          console.error(
            `[${ZenDownloadAnimationElement.name}] Error removing box animation element: ${error}`,
            error
          );
        }
      }
      this.#cleanBoxAnimationState();
    }

    #isElementVisible(element) {
      if (!element) return false;

      const rect = element.getBoundingClientRect();

      // Element must be in the viewport
      // Is 1 and no 0 because if you pin the download button in the overflow menu
      // the download button is in the viewport but in the position 0,0 so this
      // avoid this case
      if (
        rect.bottom < 1 ||
        rect.right < 1 ||
        rect.top > window.innerHeight ||
        rect.left > window.innerWidth
      ) {
        return false;
      }

      return true;
    }
  }

  customElements.define('zen-download-animation', ZenDownloadAnimationElement);

  new ZenDownloadAnimation();
}
