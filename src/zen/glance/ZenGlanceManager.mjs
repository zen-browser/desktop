// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  /**
   * Manages the Zen Glance feature - a preview overlay system for tabs
   * Allows users to preview content without fully opening new tabs
   */
  class nsZenGlanceManager extends nsZenDOMOperatedFeature {
    // Animation state
    _animating = false;
    _lazyPref = {};

    // Glance management
    #glances = new Map();
    #currentGlanceID = null;
    #confirmationTimeout = null;

    // Animation flags
    animatingOpen = false;
    animatingFullOpen = false;
    closingGlance = false;
    #duringOpening = false;
    #ignoreClose = false;

    // Click handling
    #lastLinkClickData = { clientX: 0, clientY: 0, height: 0, width: 0 };

    // Arc animation configuration
    #ARC_CONFIG = Object.freeze({
      ARC_STEPS: 70, // Increased for smoother bounce
      MAX_ARC_HEIGHT: 25,
      ARC_HEIGHT_RATIO: 0.2, // Arc height = distance * ratio (capped at MAX_ARC_HEIGHT)
    });

    #GLANCE_ANIMATION_DURATION = Services.prefs.getIntPref('zen.glance.animation-duration') / 1000;

    init() {
      this.#setupEventListeners();
      this.#setupPreferences();
      this.#setupObservers();
      this.#insertIntoContextMenu();
    }

    #setupEventListeners() {
      window.addEventListener('TabClose', this.onTabClose.bind(this));
      window.addEventListener('TabSelect', this.onLocationChange.bind(this));

      document
        .getElementById('tabbrowser-tabpanels')
        .addEventListener('click', this.onOverlayClick.bind(this));
    }

    #setupPreferences() {
      XPCOMUtils.defineLazyPreferenceGetter(
        this._lazyPref,
        'SHOULD_OPEN_EXTERNAL_TABS_IN_GLANCE',
        'zen.glance.open-essential-external-links',
        false
      );
    }

    #setupObservers() {
      Services.obs.addObserver(this, 'quit-application-requested');
    }

    #insertIntoContextMenu() {
      const menuitem = document.createXULElement('menuitem');
      menuitem.setAttribute('id', 'context-zenOpenLinkInGlance');
      menuitem.setAttribute('hidden', 'true');
      menuitem.setAttribute('data-l10n-id', 'zen-open-link-in-glance');

      menuitem.addEventListener('command', () => this.openGlance({ url: gContextMenu.linkURL }));

      document.getElementById('context-sep-open').insertAdjacentElement('beforebegin', menuitem);
    }

    /**
     * Handle main command set events for glance operations
     * @param {Event} event - The command event
     */
    handleMainCommandSet(event) {
      const command = event.target;
      const commandHandlers = {
        cmd_zenGlanceClose: () => this.closeGlance({ onTabClose: true }),
        cmd_zenGlanceExpand: () => this.fullyOpenGlance(),
        cmd_zenGlanceSplit: () => this.splitGlance(),
      };

      const handler = commandHandlers[command.id];
      if (handler) {
        handler();
      }
    }

    /**
     * Get the current glance browser element
     * @returns {Browser} The current browser or null
     */
    get #currentBrowser() {
      return this.#glances.get(this.#currentGlanceID)?.browser;
    }

    /**
     * Get the current glance tab element
     * @returns {Tab} The current tab or null
     */
    get #currentTab() {
      return this.#glances.get(this.#currentGlanceID)?.tab;
    }

    /**
     * Get the current glance parent tab element
     * @returns {Tab} The parent tab or null
     */
    get #currentParentTab() {
      return this.#glances.get(this.#currentGlanceID)?.parentTab;
    }

    /**
     * Handle clicks on the glance overlay
     * @param {Event} event - The click event
     */
    onOverlayClick(event) {
      const isOverlayClick = event.target === this.overlay;
      const isNotContentClick = event.originalTarget !== this.contentWrapper;

      if (isOverlayClick && isNotContentClick) {
        this.closeGlance({ onTabClose: true });
      }
    }

    /**
     * Handle application observer notifications
     * @param {Object} subject - The subject of the notification
     * @param {string} topic - The topic of the notification
     */
    observe(subject, topic) {
      if (topic === 'quit-application-requested') {
        this.onUnload();
      }
    }

    /**
     * Clean up all glances when the application is unloading
     */
    onUnload() {
      for (const [, glance] of this.#glances) {
        gBrowser.removeTab(glance.tab, { animate: false });
      }
      this.#glances.clear();
    }

    /**
     * Create a new browser element for a glance
     * @param {string} url - The URL to load
     * @param {Tab} currentTab - The current tab
     * @param {Tab} existingTab - Optional existing tab to reuse
     * @returns {Browser} The created browser element
     */
    #createBrowserElement(url, currentTab, existingTab = null) {
      const newTabOptions = this.#createTabOptions(currentTab);
      const newUUID = gZenUIManager.generateUuidv4();

      currentTab._selected = true;
      const newTab =
        existingTab ?? gBrowser.addTrustedTab(Services.io.newURI(url).spec, newTabOptions);

      this.#configureNewTab(newTab, currentTab, newUUID);
      this.#registerGlance(newTab, currentTab, newUUID);

      gBrowser.selectedTab = newTab;
      return this.#currentBrowser;
    }

    /**
     * Create tab options for a new glance tab
     * @param {Tab} currentTab - The current tab
     * @returns {Object} Tab options
     */
    #createTabOptions(currentTab) {
      return {
        userContextId: currentTab.getAttribute('usercontextid') || '',
        skipBackgroundNotify: true,
        insertTab: true,
        skipLoad: false,
      };
    }

    /**
     * Configure a new tab for glance usage
     * @param {Tab} newTab - The new tab to configure
     * @param {Tab} currentTab - The current tab
     * @param {string} glanceId - The glance ID
     */
    #configureNewTab(newTab, currentTab, glanceId) {
      if (currentTab.hasAttribute('zenDefaultUserContextId')) {
        newTab.setAttribute('zenDefaultUserContextId', true);
      }

      currentTab.querySelector('.tab-content').appendChild(newTab);
      newTab.setAttribute('zen-glance-tab', true);
      newTab.setAttribute('glance-id', glanceId);
      currentTab.setAttribute('glance-id', glanceId);
    }

    /**
     * Register a new glance in the glances map
     * @param {Tab} newTab - The new tab
     * @param {Tab} currentTab - The current tab
     * @param {string} glanceId - The glance ID
     */
    #registerGlance(newTab, currentTab, glanceId) {
      this.#glances.set(glanceId, {
        tab: newTab,
        parentTab: currentTab,
        browser: newTab.linkedBrowser,
      });
      this.#currentGlanceID = glanceId;
    }

    /**
     * Fill overlay references from a browser element
     * @param {Browser} browser - The browser element
     */
    fillOverlay(browser) {
      this.overlay = browser.closest('.browserSidebarContainer');
      this.browserWrapper = browser.closest('.browserContainer');
      this.contentWrapper = browser.closest('.browserStack');
    }

    /**
     * Create new overlay buttons with animation
     * @returns {DocumentFragment} The cloned button template
     */
    #createNewOverlayButtons() {
      const template = document.getElementById('zen-glance-sidebar-template');
      const newButtons = template.content.cloneNode(true);
      const container = newButtons.querySelector('.zen-glance-sidebar-container');

      this.#animateOverlayButtons(container);
      return newButtons;
    }

    /**
     * Animate the overlay buttons entrance
     * @param {Element} container - The button container
     */
    #animateOverlayButtons(container) {
      container.style.opacity = 0;

      const xOffset = gZenVerticalTabsManager._prefsRightSide ? 20 : -20;

      gZenUIManager.motion.animate(
        container,
        {
          opacity: [0, 1],
          x: [xOffset, 0],
        },
        {
          duration: 0.2,
          type: 'spring',
          delay: this.#GLANCE_ANIMATION_DURATION - 0.2,
          bounce: 0,
        }
      );
    }

    /**
     * Get element preview data as a data URL
     * @param {Object} data - Glance data
     * @returns {Promise<string|null>} Promise resolving to data URL or null
     * if not available
     */
    async #getElementPreviewData(data) {
      // Make the rect relative to the tabpanels. We dont do it directly on the
      // content process since it does not take into account scroll. This way, we can
      // be sure that the coordinates are correct.
      const tabPanelsRect = gBrowser.tabpanels.getBoundingClientRect();
      const rect = new DOMRect(
        data.clientX + tabPanelsRect.left,
        data.clientY + tabPanelsRect.top,
        data.width,
        data.height
      );
      return await this.#imageBitmapToBase64(
        await window.browsingContext.currentWindowGlobal.drawSnapshot(
          rect,
          1,
          'transparent',
          undefined
        )
      );
    }

    /**
     * Set the last link click data
     * @param {Object} data - The link click data
     */
    set lastLinkClickData(data) {
      this.#lastLinkClickData = data;
    }

    /**
     * Get the last link click data
     * @returns {Object} The last link click data
     */
    get lastLinkClickData() {
      return this.#lastLinkClickData;
    }

    /**
     * Open a glance overlay with the specified data
     * @param {Object} data - Glance data including URL, position, and dimensions
     * @param {Tab} existingTab - Optional existing tab to reuse
     * @param {Tab} ownerTab - The tab that owns this glance
     * @returns {Promise<Tab>} Promise that resolves to the glance tab
     */
    openGlance(data, existingTab = null, ownerTab = null) {
      if (this.#currentBrowser) {
        return;
      }

      if (gBrowser.selectedTab === this.#currentParentTab) {
        gBrowser.selectedTab = this.#currentTab;
        return;
      }

      if (!data.height || !data.width) {
        data = {
          ...data,
          ...this.lastLinkClickData,
        };
      }

      this.#setAnimationState(true);
      const currentTab = ownerTab ?? gBrowser.selectedTab;
      const browserElement = this.#createBrowserElement(data.url, currentTab, existingTab);

      this.fillOverlay(browserElement);
      this.overlay.classList.add('zen-glance-overlay');

      return this.#animateGlanceOpening(data, browserElement);
    }

    /**
     * Set animation state flags
     * @param {boolean} isAnimating - Whether animations are active
     */
    #setAnimationState(isAnimating) {
      this.animatingOpen = isAnimating;
      this._animating = isAnimating;
    }

    /**
     * Animate the glance opening process
     * @param {Object} data - Glance data
     * @param {Browser} browserElement - The browser element
     * @returns {Promise<Tab>} Promise that resolves to the glance tab
     */
    #animateGlanceOpening(data, browserElement) {
      this.#prepareGlanceAnimation(data, browserElement);
      // FIXME(cheffy): We *must* have the call back async (at least,
      // until a better solution is found). If we do it inside the requestAnimationFrame,
      // we see flashing and if we do it directly, the animation does not play at all.
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve) => {
        // Recalculate location. When opening from pinned tabs,
        // view splitter doesn't catch if the tab is a glance tab or not.
        gZenViewSplitter.onLocationChange(browserElement);
        if (data.width && data.height) {
          // It is guaranteed that we will animate this opacity later on
          // when we start animating the glance.
          this.contentWrapper.style.opacity = 0;
          data.elementData = await this.#getElementPreviewData(data);
        }
        this.#glances.get(this.#currentGlanceID).elementData = data.elementData;
        this.#executeGlanceAnimation(data, browserElement, resolve);
      });
    }

    /**
     * Prepare the glance for animation
     * @param {Object} data - Glance data
     * @param {Browser} browserElement - The browser element
     */
    #prepareGlanceAnimation(data, browserElement) {
      this.quickOpenGlance();
      const newButtons = this.#createNewOverlayButtons();
      this.browserWrapper.appendChild(newButtons);

      this.#setupGlancePositioning(data);
      this.#configureBrowserElement(browserElement);
    }

    /**
     * Animate the parent background
     */
    #animateParentBackground() {
      const parentSidebarContainer = this.#currentParentTab.linkedBrowser.closest(
        '.browserSidebarContainer'
      );

      gZenUIManager.motion.animate(
        parentSidebarContainer,
        {
          scale: [1, 0.98],
          opacity: [1, 0.4],
        },
        {
          duration: this.#GLANCE_ANIMATION_DURATION,
          type: 'spring',
          bounce: 0.2,
        }
      );
    }

    /**
     * Set up glance positioning
     * @param {Object} data - Glance data with position and dimensions
     */
    #setupGlancePositioning(data) {
      const { clientX, clientY, width, height } = data;
      const top = clientY + height / 2;
      const left = clientX + width / 2;

      this.overlay.removeAttribute('fade-out');
      this.browserWrapper.setAttribute('animate', true);
      this.browserWrapper.style.top = `${top}px`;
      this.browserWrapper.style.left = `${left}px`;
      this.browserWrapper.style.width = `${width}px`;
      this.browserWrapper.style.height = `${height}px`;

      this.#storeOriginalPosition();
      this.overlay.style.overflow = 'visible';
    }

    /**
     * Store the original position for later restoration
     */
    #storeOriginalPosition() {
      this.#glances.get(this.#currentGlanceID).originalPosition = {
        top: this.browserWrapper.style.top,
        left: this.browserWrapper.style.left,
        width: this.browserWrapper.style.width,
        height: this.browserWrapper.style.height,
      };
    }

    #createGlancePreviewElement(src) {
      const imageDataElement = document.createXULElement('image');
      imageDataElement.setAttribute('src', src);

      const parent = document.createElement('div');
      parent.classList.add('zen-glance-element-preview');
      parent.appendChild(imageDataElement);
      return parent;
    }

    /**
     * Handle element preview if provided
     * @param {Object} data - Glance data
     * @returns {Element|null} The preview element or null
     */
    #handleElementPreview(data) {
      if (!data.elementData) {
        return null;
      }

      const imageDataElement = this.#createGlancePreviewElement(data.elementData);
      this.browserWrapper.prepend(imageDataElement);
      this.#glances.get(this.#currentGlanceID).elementImageData = data.elementData;

      gZenUIManager.motion.animate(
        imageDataElement,
        {
          opacity: [1, 0],
        },
        {
          duration: this.#GLANCE_ANIMATION_DURATION / 2,
          easing: 'easeInOut',
        }
      );

      return imageDataElement;
    }

    /**
     * Configure browser element for animation
     * @param {Browser} browserElement - The browser element
     */
    #configureBrowserElement(browserElement) {
      const rect = window.windowUtils.getBoundsWithoutFlushing(this.browserWrapper.parentElement);
      const minWidth = rect.width * 0.85;
      const minHeight = rect.height * 0.85;

      browserElement.style.minWidth = `${minWidth}px`;
      browserElement.style.minHeight = `${minHeight}px`;
    }

    /**
     * Get the transform origin for the animation
     * @param {Object} data - Glance data with position and dimensions
     * @returns {string} The transform origin CSS value
     */
    #getTransformOrigin(data) {
      const { clientX, clientY } = data;
      return `${clientX}px ${clientY}px`;
    }

    /**
     * Execute the main glance animation
     * @param {Object} data - Glance data
     * @param {Browser} browserElement - The browser element
     * @param {Function} resolve - Promise resolve function
     */
    #executeGlanceAnimation(data, browserElement, resolve) {
      const imageDataElement = this.#handleElementPreview(data);

      // Create curved animation sequence
      const arcSequence = this.#createGlanceArcSequence(data, 'opening');
      const transformOrigin = this.#getTransformOrigin(data);

      this.browserWrapper.style.transformOrigin = transformOrigin;

      // Only animate if there is element data, so we can apply a
      // nice fade-in effect to the content. But if it doesn't exist,
      // we just fall back to always showing the browser directly.
      if (data.elementData) {
        gZenUIManager.motion
          .animate(
            this.contentWrapper,
            { opacity: [0, 1] },
            {
              duration: this.#GLANCE_ANIMATION_DURATION / 2,
              easing: 'easeInOut',
            }
          )
          .then(() => {
            this.contentWrapper.style.opacity = '';
          });
      }

      this.#animateParentBackground();
      gZenUIManager.motion
        .animate(this.browserWrapper, arcSequence, {
          duration: gZenUIManager.testingEnabled ? 0 : this.#GLANCE_ANIMATION_DURATION,
          ease: 'easeInOut',
        })
        .then(() => {
          this.#finalizeGlanceOpening(imageDataElement, browserElement, resolve);
        });
    }

    /**
     * Create arc animation sequence for glance animations
     * @param {Object} data - Glance data with position and dimensions
     * @param {string} direction - 'opening' or 'closing'
     * @returns {Object} Animation sequence object
     */
    #createGlanceArcSequence(data, direction) {
      const { clientX, clientY, width, height } = data;

      // Calculate start and end positions based on direction
      let startPosition, endPosition;

      const tabPanelsRect = window.windowUtils.getBoundsWithoutFlushing(gBrowser.tabpanels);

      const widthPercent = 0.85;
      if (direction === 'opening') {
        startPosition = {
          x: clientX + width / 2,
          y: clientY + height / 2,
          width: width,
          height: height,
        };
        endPosition = {
          x: tabPanelsRect.width / 2,
          y: tabPanelsRect.height / 2,
          width: tabPanelsRect.width * widthPercent,
          height: tabPanelsRect.height,
        };
      } else {
        // closing
        startPosition = {
          x: tabPanelsRect.width / 2,
          y: tabPanelsRect.height / 2,
          width: tabPanelsRect.width * widthPercent,
          height: tabPanelsRect.height,
        };
        endPosition = {
          x: Math.floor(clientX + width / 2),
          y: Math.floor(clientY + height / 2),
          width: width,
          height: height,
        };
      }

      // Calculate distance and arc parameters
      const distance = this.#calculateDistance(startPosition, endPosition);
      const { arcHeight, shouldArcDownward } = this.#calculateOptimalArc(
        startPosition,
        endPosition,
        distance
      );

      const sequence = {
        top: [],
        left: [],
        width: [],
        height: [],
        transform: [],
      };

      const steps = this.#ARC_CONFIG.ARC_STEPS;
      const arcDirection = shouldArcDownward ? 1 : -1;

      function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      }

      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 6);
      }

      // First, create the main animation steps
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const eased = direction === 'opening' ? easeInOutQuad(progress) : easeOutCubic(progress);

        // Calculate size interpolation
        const currentWidth =
          startPosition.width + (endPosition.width - startPosition.width) * eased;
        const currentHeight =
          startPosition.height + (endPosition.height - startPosition.height) * eased;

        // Calculate position on arc
        const distanceX = endPosition.x - startPosition.x;
        const distanceY = endPosition.y - startPosition.y;

        const x = startPosition.x + distanceX * eased;
        const y =
          startPosition.y +
          distanceY * eased +
          arcDirection * arcHeight * (1 - (2 * eased - 1) ** 2);

        sequence.transform.push(`translate(-50%, -50%) scale(1)`);
        sequence.top.push(`${y}px`);
        sequence.left.push(`${x}px`);
        sequence.width.push(`${currentWidth}px`);
        sequence.height.push(`${currentHeight}px`);
      }

      let scale = 1;
      const bounceSteps = 60;
      if (direction === 'opening') {
        for (let i = 0; i < bounceSteps; i++) {
          const progress = i / bounceSteps;
          // Scale up slightly then back to normal
          scale = 1 + 0.003 * Math.sin(progress * Math.PI);
          // If we are at the last step, ensure scale is exactly 1
          if (i === bounceSteps - 1) {
            scale = 1;
          }
          sequence.transform.push(`translate(-50%, -50%) scale(${scale})`);
          sequence.top.push(sequence.top[sequence.top.length - 1]);
          sequence.left.push(sequence.left[sequence.left.length - 1]);
          sequence.width.push(sequence.width[sequence.width.length - 1]);
          sequence.height.push(sequence.height[sequence.height.length - 1]);
        }
      }

      return sequence;
    }

    /**
     * Calculate distance between two positions
     * @param {Object} start - Start position
     * @param {Object} end - End position
     * @returns {number} Distance
     */
    #calculateDistance(start, end) {
      const distanceX = end.x - start.x;
      const distanceY = end.y - start.y;
      return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    }

    /**
     * Calculate optimal arc parameters
     * @param {Object} startPosition - Start position
     * @param {Object} endPosition - End position
     * @param {number} distance - Distance between positions
     * @returns {Object} Arc parameters
     */
    #calculateOptimalArc(startPosition, endPosition, distance) {
      // Calculate available space for the arc
      const availableTopSpace = Math.min(startPosition.y, endPosition.y);
      const viewportHeight = window.innerHeight;
      const availableBottomSpace = viewportHeight - Math.max(startPosition.y, endPosition.y);

      // Determine if we should arc downward or upward based on available space
      const shouldArcDownward = availableBottomSpace > availableTopSpace;

      // Use the space in the direction we're arcing
      const availableSpace = shouldArcDownward ? availableBottomSpace : availableTopSpace;

      // Limit arc height to a percentage of the available space
      const arcHeight = Math.min(
        distance * this.#ARC_CONFIG.ARC_HEIGHT_RATIO,
        this.#ARC_CONFIG.MAX_ARC_HEIGHT,
        availableSpace * 0.6
      );

      return { arcHeight, shouldArcDownward };
    }

    /**
     * Finalize the glance opening process
     * @param {Element|null} imageDataElement - The preview element
     * @param {Browser} browserElement - The browser element
     * @param {Function} resolve - Promise resolve function
     */
    #finalizeGlanceOpening(imageDataElement, browserElement, resolve) {
      if (imageDataElement) {
        imageDataElement.remove();
      }

      this.browserWrapper.style.transformOrigin = '';

      browserElement.style.minWidth = '';
      browserElement.style.minHeight = '';

      this.browserWrapper.style.height = '100%';
      this.browserWrapper.style.width = '85%';

      gBrowser.tabContainer._invalidateCachedTabs();
      this.overlay.style.removeProperty('overflow');
      this.browserWrapper.removeAttribute('animate');
      this.browserWrapper.setAttribute('has-finished-animation', true);

      this.#setAnimationState(false);
      this.#currentTab.dispatchEvent(new Event('GlanceOpen', { bubbles: true }));
      resolve(this.#currentTab);
    }

    /**
     * Clear container styles while preserving inset
     * @param {Element} container - The container element
     */
    #clearContainerStyles(container) {
      const inset = container.style.inset;
      container.removeAttribute('style');
      container.style.inset = inset;
    }

    /**
     * Close the current glance
     * @param {Object} options - Close options
     * @param {boolean} options.noAnimation - Skip animation
     * @param {boolean} options.onTabClose - Called during tab close
     * @param {string} options.setNewID - Set new glance ID
     * @param {boolean} options.hasFocused - Has focus confirmation
     * @param {boolean} options.skipPermitUnload - Skip unload permission check
     * @returns {Promise|undefined} Promise if animated, undefined if immediate
     */
    closeGlance({
      noAnimation = false,
      onTabClose = false,
      setNewID = null,
      hasFocused = false,
      skipPermitUnload = false,
    } = {}) {
      if (!this.#canCloseGlance(onTabClose)) {
        return;
      }

      if (!skipPermitUnload && !this.#checkPermitUnload()) {
        return;
      }

      const browserSidebarContainer = this.#currentParentTab?.linkedBrowser?.closest(
        '.browserSidebarContainer'
      );
      const sidebarButtons = this.browserWrapper.querySelector('.zen-glance-sidebar-container');

      if (this.#handleConfirmationTimeout(onTabClose, hasFocused, sidebarButtons)) {
        return;
      }

      this.browserWrapper.removeAttribute('has-finished-animation');

      if (noAnimation) {
        this.#clearContainerStyles(browserSidebarContainer);
        this.quickCloseGlance({ closeCurrentTab: false });
        return;
      }

      return this.#animateGlanceClosing(
        onTabClose,
        browserSidebarContainer,
        sidebarButtons,
        setNewID
      );
    }

    /**
     * Check if glance can be closed
     * @param {boolean} onTabClose - Whether this is called during tab close
     * @returns {boolean} True if can close
     */
    #canCloseGlance(onTabClose) {
      return !(
        (this._animating && !onTabClose) ||
        !this.#currentBrowser ||
        (this.animatingOpen && !onTabClose) ||
        this.#duringOpening
      );
    }

    /**
     * Check if unload is permitted
     * @returns {boolean} True if unload is permitted
     */
    #checkPermitUnload() {
      const { permitUnload } = this.#currentBrowser.permitUnload();
      return permitUnload;
    }

    /**
     * Handle confirmation timeout for focused close
     * @param {boolean} onTabClose - Whether this is called during tab close
     * @param {boolean} hasFocused - Has focus confirmation
     * @param {Element} sidebarButtons - The sidebar buttons element
     * @returns {boolean} True if should return early
     */
    #handleConfirmationTimeout(onTabClose, hasFocused, sidebarButtons) {
      if (onTabClose && hasFocused && !this.#confirmationTimeout && sidebarButtons) {
        const cancelButton = sidebarButtons.querySelector('.zen-glance-sidebar-close');
        cancelButton.setAttribute('waitconfirmation', true);
        this.#confirmationTimeout = setTimeout(() => {
          cancelButton.removeAttribute('waitconfirmation');
          this.#confirmationTimeout = null;
        }, 3000);
        return true;
      }
      return false;
    }

    /**
     * Animate the glance closing process
     * @param {boolean} onTabClose - Whether this is called during tab close
     * @param {Element} browserSidebarContainer - The sidebar container
     * @param {Element} sidebarButtons - The sidebar buttons
     * @param {string} setNewID - New glance ID to set
     * @returns {Promise} Promise that resolves when closing is complete
     */
    #animateGlanceClosing(onTabClose, browserSidebarContainer, sidebarButtons, setNewID) {
      if (this.closingGlance) {
        return;
      }

      this.closingGlance = true;
      this._animating = true;

      gBrowser.moveTabAfter(this.#currentTab, this.#currentParentTab);

      if (onTabClose && gBrowser.tabs.length === 1) {
        BrowserCommands.openTab();
        return;
      }

      this.#prepareGlanceForClosing();
      this.#animateSidebarButtons(sidebarButtons);
      this.#animateParentBackgroundClose(browserSidebarContainer);

      return this.#executeClosingAnimation(setNewID, onTabClose);
    }

    /**
     * Prepare glance for closing
     */
    #prepareGlanceForClosing() {
      // Critical: This line must not be touched - it works for unknown reasons
      this.#currentTab.style.display = 'none';
      this.overlay.setAttribute('fade-out', true);
      this.overlay.style.pointerEvents = 'none';
      this.quickCloseGlance({ justAnimateParent: true, clearID: false });
    }

    /**
     * Animate sidebar buttons out
     * @param {Element} sidebarButtons - The sidebar buttons element
     */
    #animateSidebarButtons(sidebarButtons) {
      if (sidebarButtons) {
        gZenUIManager.motion
          .animate(
            sidebarButtons,
            { opacity: [1, 0] },
            {
              duration: 0.2,
              type: 'spring',
              bounce: this.#GLANCE_ANIMATION_DURATION - 0.1,
            }
          )
          .then(() => {
            sidebarButtons.remove();
          });
      }
    }

    #imageBitmapToBase64(imageBitmap) {
      // 1. Create a canvas with the same size as the ImageBitmap
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;

      // 2. Draw the ImageBitmap onto the canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0);

      // 3. Convert the canvas content to a Base64 string (PNG by default)
      const base64String = canvas.toDataURL('image/png');
      return base64String;
    }

    /**
     * Animate parent background restoration
     * @param {Element} browserSidebarContainer - The sidebar container
     */
    #animateParentBackgroundClose(browserSidebarContainer) {
      gZenUIManager.motion
        .animate(
          browserSidebarContainer,
          {
            scale: [0.98, 1],
            opacity: [0.4, 1],
          },
          {
            duration: this.#GLANCE_ANIMATION_DURATION / 1.5,
            type: 'spring',
            bounce: 0,
          }
        )
        .then(() => {
          this.#clearContainerStyles(browserSidebarContainer);
        });

      this.browserWrapper.style.opacity = 1;
    }

    /**
     * Execute the main closing animation
     * @param {string} setNewID - New glance ID to set
     * @param {boolean} onTabClose - Whether this is called during tab close
     * @returns {Promise} Promise that resolves when complete
     */
    #executeClosingAnimation(setNewID, onTabClose) {
      return new Promise((resolve) => {
        const originalPosition = this.#glances.get(this.#currentGlanceID).originalPosition;
        const elementImageData = this.#glances.get(this.#currentGlanceID).elementImageData;

        this.#addElementPreview(elementImageData);

        // Create curved closing animation sequence
        const closingData = this.#createClosingDataFromOriginalPosition(originalPosition);
        const arcSequence = this.#createGlanceArcSequence(closingData, 'closing');

        gZenUIManager.motion
          .animate(this.browserWrapper, arcSequence, {
            duration: this.#GLANCE_ANIMATION_DURATION,
            ease: 'easeOut',
          })
          .then(() => {
            // Remove element preview after closing animation
            const elementPreview = this.browserWrapper.querySelector('.zen-glance-element-preview');
            if (elementPreview) {
              elementPreview.remove();
            }
            this.#finalizeGlanceClosing(setNewID, resolve, onTabClose);
          });
      });
    }

    /**
     * Create closing data from original position for arc animation
     * @param {Object} originalPosition - Original position object
     * @returns {Object} Closing data object
     */
    #createClosingDataFromOriginalPosition(originalPosition) {
      // Parse the original position values
      const top = parseFloat(originalPosition.top) || 0;
      const left = parseFloat(originalPosition.left) || 0;
      const width = parseFloat(originalPosition.width) || 0;
      const height = parseFloat(originalPosition.height) || 0;

      return {
        clientX: left - width / 2,
        clientY: top - height / 2,
        width: width,
        height: height,
      };
    }

    /**
     * Add element preview if available, used for the closing animation
     * @param {string} elementImageData - The element image data
     */
    #addElementPreview(elementImageData) {
      if (elementImageData) {
        const imageDataElement = this.#createGlancePreviewElement(elementImageData);
        this.browserWrapper.prepend(imageDataElement);
      }
    }

    /**
     * Finalize the glance closing process
     * @param {string} setNewID - New glance ID to set
     * @param {Function} resolve - Promise resolve function
     * @param {boolean} onTabClose - Whether this is called during tab close
     */
    #finalizeGlanceClosing(setNewID, resolve, onTabClose) {
      this.browserWrapper.removeAttribute('animate');

      if (!this.#currentParentTab) {
        this.closingGlance = false;
        return;
      }

      if (!onTabClose) {
        this.quickCloseGlance({ clearID: false });
      }
      this.overlay.style.display = 'none';
      this.overlay.removeAttribute('fade-out');
      this.browserWrapper.removeAttribute('animate');

      const lastCurrentTab = this.#currentTab;
      this.#cleanupGlanceElements(lastCurrentTab);
      this.#resetGlanceState(setNewID);

      this.#setAnimationState(false);
      this.closingGlance = false;

      if (this.#currentGlanceID) {
        this.quickOpenGlance();
      }

      resolve();
    }

    /**
     * Clean up glance DOM elements
     * @param {Tab} lastCurrentTab - The tab being closed
     */
    #cleanupGlanceElements(lastCurrentTab) {
      this.overlay.classList.remove('zen-glance-overlay');
      gBrowser
        ._getSwitcher()
        .setTabStateNoAction(lastCurrentTab, gBrowser.AsyncTabSwitcher.STATE_UNLOADED);

      if (!this.#currentParentTab.selected) {
        this.#currentParentTab._visuallySelected = false;
      }

      if (gBrowser.selectedTab === lastCurrentTab) {
        gBrowser.selectedTab = this.#currentParentTab;
      }

      if (
        this.#currentParentTab.linkedBrowser &&
        !this.#currentParentTab.hasAttribute('split-view')
      ) {
        this.#currentParentTab.linkedBrowser.zenModeActive = false;
      }

      // Reset overlay references
      this.browserWrapper = null;
      this.overlay = null;
      this.contentWrapper = null;

      lastCurrentTab.removeAttribute('zen-glance-tab');

      this.#ignoreClose = true;
      lastCurrentTab.dispatchEvent(new Event('GlanceClose', { bubbles: true }));
      gBrowser.removeTab(lastCurrentTab, { animate: true, skipPermitUnload: true });
      gBrowser.tabContainer._invalidateCachedTabs();
    }

    /**
     * Reset glance state
     * @param {string} setNewID - New glance ID to set
     */
    #resetGlanceState(setNewID) {
      this.#currentParentTab.removeAttribute('glance-id');
      this.#glances.delete(this.#currentGlanceID);
      this.#currentGlanceID = setNewID;
      this.#duringOpening = false;
    }

    /**
     * Quickly open glance without animation
     */
    quickOpenGlance() {
      if (!this.#currentBrowser || this.#duringOpening) {
        return;
      }

      this.#duringOpening = true;
      // IMPORTANT: #setGlanceStates() must be called before #configureGlanceElements()
      // to ensure that the glance state is fully set up before configuring the DOM elements.
      // This order is required to avoid timing/state issues. Do not reorder without understanding the dependencies.
      this.#setGlanceStates();
      this.#configureGlanceElements();
      this.#duringOpening = false;
    }

    /**
     * Configure glance DOM elements
     */
    #configureGlanceElements() {
      const parentBrowserContainer = this.#currentParentTab.linkedBrowser.closest(
        '.browserSidebarContainer'
      );

      parentBrowserContainer.classList.add('zen-glance-background');
      parentBrowserContainer.classList.remove('zen-glance-overlay');
      parentBrowserContainer.classList.add('deck-selected');

      this.overlay.classList.add('deck-selected');
      this.overlay.classList.add('zen-glance-overlay');
    }

    /**
     * Set glance browser and tab states
     */
    #setGlanceStates() {
      this.#currentParentTab.linkedBrowser.zenModeActive = true;
      this.#currentParentTab.linkedBrowser.docShellIsActive = true;
      this.#currentBrowser.zenModeActive = true;
      this.#currentBrowser.docShellIsActive = true;
      this.#currentBrowser.setAttribute('zen-glance-selected', true);
      this.fillOverlay(this.#currentBrowser);
      this.#currentParentTab._visuallySelected = true;
    }

    /**
     * Quickly close glance without animation
     * @param {Object} options - Close options
     * @param {boolean} options.closeCurrentTab - Close current tab
     * @param {boolean} options.closeParentTab - Close parent tab
     * @param {boolean} options.justAnimateParent - Only animate parent
     * @param {boolean} options.clearID - Clear current glance ID
     */
    quickCloseGlance({
      closeCurrentTab = true,
      closeParentTab = true,
      justAnimateParent = false,
      clearID = true,
    } = {}) {
      const parentHasBrowser = !!this.#currentParentTab.linkedBrowser;
      const browserContainer = this.#currentParentTab.linkedBrowser.closest(
        '.browserSidebarContainer'
      );

      this.#removeParentBackground(parentHasBrowser, browserContainer);

      if (!justAnimateParent && this.overlay) {
        this.#resetGlanceStates(
          closeCurrentTab,
          closeParentTab,
          parentHasBrowser,
          browserContainer
        );
      }

      if (clearID) {
        this.#currentGlanceID = null;
      }
    }

    /**
     * Remove parent background styling
     * @param {boolean} parentHasBrowser - Whether parent has browser
     * @param {Element} browserContainer - The browser container
     */
    #removeParentBackground(parentHasBrowser, browserContainer) {
      if (parentHasBrowser) {
        browserContainer.classList.remove('zen-glance-background');
      }
    }

    /**
     * Reset glance states
     * @param {boolean} closeCurrentTab - Whether to close current tab
     * @param {boolean} closeParentTab - Whether to close parent tab
     * @param {boolean} parentHasBrowser - Whether parent has browser
     * @param {Element} browserContainer - The browser container
     */
    #resetGlanceStates(closeCurrentTab, closeParentTab, parentHasBrowser, browserContainer) {
      if (parentHasBrowser && !this.#currentParentTab.hasAttribute('split-view')) {
        if (closeParentTab) {
          browserContainer.classList.remove('deck-selected');
        }
        this.#currentParentTab.linkedBrowser.zenModeActive = false;
      }

      this.#currentBrowser.zenModeActive = false;

      if (closeParentTab && parentHasBrowser) {
        this.#currentParentTab.linkedBrowser.docShellIsActive = false;
      }

      if (closeCurrentTab) {
        this.#currentBrowser.docShellIsActive = false;
        this.overlay.classList.remove('deck-selected');
        this.#currentTab._selected = false;
      }

      if (!this.#currentParentTab._visuallySelected && closeParentTab) {
        this.#currentParentTab._visuallySelected = false;
      }

      this.#currentBrowser.removeAttribute('zen-glance-selected');
      this.overlay.classList.remove('zen-glance-overlay');
    }

    /**
     * Open glance on location change if not animating
     * @param {Tab} prevTab - The previous tab
     */
    #onLocationChangeOpenGlance(prevTab) {
      if (!this.animatingOpen) {
        this.quickOpenGlance();
        if (prevTab && prevTab.linkedBrowser) {
          prevTab.linkedBrowser.docShellIsActive = false;
          prevTab.linkedBrowser
            .closest('.browserSidebarContainer')
            .classList.remove('deck-selected');
        }
      }
    }

    /**
     * Handle location change events
     * Note: Must be sync to avoid timing issues
     * @param {Event} event - The location change event
     */
    onLocationChange(event) {
      const tab = event.target;
      const prevTab = event.detail.previousTab;

      if (this.animatingFullOpen || this.closingGlance) {
        return;
      }

      if (this.#duringOpening || !tab.hasAttribute('glance-id')) {
        if (this.#currentGlanceID && !this.#duringOpening) {
          this.quickCloseGlance();
        }
        return;
      }

      if (this.#currentGlanceID && this.#currentGlanceID !== tab.getAttribute('glance-id')) {
        this.quickCloseGlance();
      }

      this.#currentGlanceID = tab.getAttribute('glance-id');
      if (gBrowser.selectedTab === this.#currentTab) {
        this.#onLocationChangeOpenGlance(prevTab);
        return;
      }
      this.#currentGlanceID = null;
    }

    /**
     * Handle tab close events
     * @param {Event} event - The tab close event
     */
    onTabClose(event) {
      if (event.target === this.#currentParentTab) {
        this.closeGlance({ onTabClose: true });
      }
    }

    /**
     * Manage tab close for glance tabs
     * @param {Tab} tab - The tab being closed
     * @returns {boolean} Whether to continue with tab close
     */
    manageTabClose(tab) {
      if (!tab.hasAttribute('glance-id')) {
        return false;
      }

      const oldGlanceID = this.#currentGlanceID;
      const newGlanceID = tab.getAttribute('glance-id');
      this.#currentGlanceID = newGlanceID;
      const isDifferent = newGlanceID !== oldGlanceID;

      if (this.#ignoreClose) {
        this.#ignoreClose = false;
        return false;
      }

      this.closeGlance({
        onTabClose: true,
        setNewID: isDifferent ? oldGlanceID : null,
      });

      // Only continue tab close if we are not on the currently selected tab
      return !isDifferent;
    }

    /**
     * Check if two tabs have different domains
     * @param {Tab} tab1 - First tab
     * @param {nsIURI} url2 - Second URL
     * @returns {boolean} True if domains differ
     */
    tabDomainsDiffer(tab1, url2) {
      try {
        if (!tab1) {
          return true;
        }

        const url1 = tab1.linkedBrowser.currentURI.spec;
        if (url1.startsWith('about:')) {
          return true;
        }

        // Only glance up links that are http(s) or file
        // https://github.com/zen-browser/desktop/issues/7173
        const url2Spec = url2.spec;
        if (!this.#isValidGlanceUrl(url2Spec)) {
          return false;
        }

        return Services.io.newURI(url1).host !== url2.host;
      } catch {
        return true;
      }
    }

    /**
     * Check if URL is valid for glance
     * @param {string} urlSpec - The URL spec
     * @returns {boolean} True if valid
     */
    #isValidGlanceUrl(urlSpec) {
      return (
        urlSpec.startsWith('http') || urlSpec.startsWith('https') || urlSpec.startsWith('file')
      );
    }

    /**
     * Check if a tab should be opened in glance
     * @param {Tab} tab - The tab to check
     * @param {nsIURI} uri - The URI to check
     * @returns {boolean} True if should open in glance
     */
    shouldOpenTabInGlance(tab, uri) {
      const owner = tab.owner;

      return (
        owner &&
        owner.pinned &&
        this._lazyPref.SHOULD_OPEN_EXTERNAL_TABS_IN_GLANCE &&
        owner.linkedBrowser?.browsingContext?.isAppTab &&
        this.tabDomainsDiffer(owner, uri) &&
        Services.prefs.getBoolPref('zen.glance.enabled', true)
      );
    }

    /**
     * Handle tab open events
     * @param {Browser} browser - The browser element
     * @param {nsIURI} uri - The URI being opened
     */
    onTabOpen(browser, uri) {
      const tab = gBrowser.getTabForBrowser(browser);
      if (!tab) {
        return;
      }

      try {
        if (this.shouldOpenTabInGlance(tab, uri)) {
          this.#openGlanceForTab(tab);
        }
      } catch (e) {
        console.error('Error opening glance for tab:', e);
      }
    }

    /**
     * Open glance for a specific tab
     * @param {Tab} tab - The tab to open glance for
     */
    #openGlanceForTab(tab) {
      this.openGlance(
        {
          url: undefined,
        },
        tab,
        tab.owner
      );
    }

    /**
     * Finish opening glance and clean up
     */
    finishOpeningGlance() {
      gBrowser.tabContainer._invalidateCachedTabs();
      gZenWorkspaces.updateTabsContainers();
      this.overlay.classList.remove('zen-glance-overlay');
      this.#clearContainerStyles(this.browserWrapper);
      this.animatingFullOpen = false;
      this.closeGlance({ noAnimation: true, skipPermitUnload: true });
      this.#glances.delete(this.#currentGlanceID);
    }

    /**
     * Fully open glance (convert to regular tab)
     * @param {Object} options - Options for full opening
     * @param {boolean} options.forSplit - Whether this is for split view
     */
    async fullyOpenGlance({ forSplit = false } = {}) {
      if (!this.#currentGlanceID || !this.#currentTab) {
        return;
      }

      this.animatingFullOpen = true;
      this.#currentTab.setAttribute('zen-dont-split-glance', true);

      this.#handleZenFolderPinning();
      gBrowser.moveTabAfter(this.#currentTab, this.#currentParentTab);

      const browserRect = window.windowUtils.getBoundsWithoutFlushing(this.browserWrapper);
      this.#prepareTabForFullOpen();

      const sidebarButtons = this.browserWrapper.querySelector('.zen-glance-sidebar-container');
      if (sidebarButtons) {
        sidebarButtons.remove();
      }

      if (forSplit) {
        this.finishOpeningGlance();
        return;
      }

      if (gReduceMotion) {
        gZenViewSplitter.deactivateCurrentSplitView();
        this.finishOpeningGlance();
        return;
      }

      await this.#animateFullOpen(browserRect);
      this.finishOpeningGlance();
    }

    /**
     * Handle Zen folder pinning if applicable
     */
    #handleZenFolderPinning() {
      const isZenFolder = this.#currentParentTab?.group?.isZenFolder;
      if (Services.prefs.getBoolPref('zen.folders.owned-tabs-in-folder') && isZenFolder) {
        gBrowser.pinTab(this.#currentTab);
      }
    }

    /**
     * Prepare tab for full opening
     */
    #prepareTabForFullOpen() {
      this.#currentTab.removeAttribute('zen-glance-tab');
      this.#clearContainerStyles(this.browserWrapper);
      this.#currentTab.removeAttribute('glance-id');
      this.#currentParentTab.removeAttribute('glance-id');
      gBrowser.selectedTab = this.#currentTab;

      this.#currentParentTab.linkedBrowser
        .closest('.browserSidebarContainer')
        .classList.remove('zen-glance-background');
      this.#currentParentTab._visuallySelected = false;
      gBrowser.TabStateFlusher.flush(this.#currentTab.linkedBrowser);
    }

    /**
     * Animate the full opening process
     * @param {Object} browserRect - The browser rectangle
     */
    async #animateFullOpen(browserRect) {
      // Write styles early to avoid flickering
      this.browserWrapper.style.opacity = 1;
      this.browserWrapper.style.width = `${browserRect.width}px`;
      this.browserWrapper.style.height = `${browserRect.height}px`;

      await gZenUIManager.motion.animate(
        this.browserWrapper,
        {
          width: ['85%', '100%'],
          height: ['100%', '100%'],
        },
        {
          duration: this.#GLANCE_ANIMATION_DURATION,
          type: 'spring',
          bounce: 0,
        }
      );

      this.browserWrapper.style.width = '';
      this.browserWrapper.style.height = '';
      this.browserWrapper.style.opacity = '';
      gZenViewSplitter.deactivateCurrentSplitView({ removeDeckSelected: true });
    }

    /**
     * Open glance for bookmark activation
     * @param {Event} event - The bookmark click event
     * @returns {boolean} False to prevent default behavior
     */
    openGlanceForBookmark(event) {
      const activationMethod = Services.prefs.getStringPref('zen.glance.activation-method', 'ctrl');

      if (!this.#isActivationKeyPressed(event, activationMethod)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const data = this.#createGlanceDataFromBookmark(event);
      this.openGlance(data);

      return false;
    }

    /**
     * Check if the correct activation key is pressed
     * @param {Event} event - The event
     * @param {string} activationMethod - The activation method
     * @returns {boolean} True if key is pressed
     */
    #isActivationKeyPressed(event, activationMethod) {
      const keyMap = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };

      return keyMap[activationMethod] || false;
    }

    /**
     * Create glance data from bookmark event
     * @param {Event} event - The bookmark event
     * @returns {Object} Glance data object
     */
    #createGlanceDataFromBookmark(event) {
      const rect = window.windowUtils.getBoundsWithoutFlushing(event.target);
      const tabPanelRect = window.windowUtils.getBoundsWithoutFlushing(gBrowser.tabpanels);
      // the bookmark is most likely outisde the tabpanel, so we need to give a negative number
      // so it can be corrected later
      let top = rect.top - tabPanelRect.top;
      let left = rect.left - tabPanelRect.left;
      return {
        url: event.target._placesNode.uri,
        clientX: left,
        clientY: top,
        width: rect.width,
        height: rect.height,
      };
    }

    /**
     * Get the focused tab based on direction
     * @param {number} aDir - Direction (-1 for parent, 1 for current)
     * @returns {Tab} The focused tab
     */
    getFocusedTab(aDir) {
      return aDir < 0 ? this.#currentParentTab : this.#currentTab;
    }

    /**
     * Split the current glance into a split view
     */
    async splitGlance() {
      if (!this.#currentGlanceID) {
        return;
      }

      const currentTab = this.#currentTab;
      const currentParentTab = this.#currentParentTab;

      this.#handleZenFolderPinningForSplit(currentParentTab);
      await this.fullyOpenGlance({ forSplit: true });

      gZenViewSplitter.splitTabs([currentTab, currentParentTab], 'vsep', 1);

      const browserContainer = currentTab.linkedBrowser?.closest('.browserSidebarContainer');
      if (!gReduceMotion && browserContainer) {
        gZenViewSplitter.animateBrowserDrop(browserContainer);
      }
    }

    /**
     * Handle Zen folder pinning for split view
     * @param {Tab} parentTab - The parent tab
     */
    #handleZenFolderPinningForSplit(parentTab) {
      const isZenFolder = parentTab?.group?.isZenFolder;
      if (Services.prefs.getBoolPref('zen.folders.owned-tabs-in-folder') && isZenFolder) {
        gBrowser.pinTab(this.#currentTab);
      }
    }

    /**
     * Get the tab or its glance parent
     * @param {Tab} tab - The tab to check
     * @returns {Tab} The tab or its parent
     */
    getTabOrGlanceParent(tab) {
      if (tab?.hasAttribute('glance-id') && this.#glances) {
        const parentTab = this.#glances.get(tab.getAttribute('glance-id'))?.parentTab;
        if (parentTab) {
          return parentTab;
        }
      }
      return tab;
    }

    /**
     * Get the tab or its glance child
     * @param {Tab} tab - The tab to check
     * @returns {Tab} The tab or its child
     */
    getTabOrGlanceChild(tab) {
      return tab?.glanceTab || tab;
    }

    /**
     * Check if deck should remain selected
     * @param {Element} currentPanel - Current panel
     * @param {Element} oldPanel - Previous panel
     * @returns {boolean} True if deck should remain selected
     */
    shouldShowDeckSelected(currentPanel, oldPanel) {
      const currentBrowser = currentPanel?.querySelector('browser');
      const oldBrowser = oldPanel?.querySelector('browser');

      if (!currentBrowser || !oldBrowser) {
        return false;
      }

      const currentTab = gBrowser.getTabForBrowser(currentBrowser);
      const oldTab = gBrowser.getTabForBrowser(oldBrowser);

      if (!currentTab || !oldTab) {
        return false;
      }

      const currentGlanceID = currentTab.getAttribute('glance-id');
      const oldGlanceID = oldTab.getAttribute('glance-id');

      if (currentGlanceID && oldGlanceID) {
        return (
          currentGlanceID === oldGlanceID && oldPanel.classList.contains('zen-glance-background')
        );
      }

      return false;
    }

    /**
     * Handle search select command
     * @param {string} where - Where to open the search result
     */
    onSearchSelectCommand(where) {
      if (!this.#isGlanceEnabledForSearch()) {
        return;
      }

      if (where !== 'tab') {
        return;
      }

      const currentTab = gBrowser.selectedTab;
      const parentTab = currentTab.owner;

      if (!parentTab || parentTab.hasAttribute('glance-id')) {
        return;
      }

      this.#openGlanceForSearch(currentTab, parentTab);
    }

    /**
     * Check if glance is enabled for search
     * @returns {boolean} True if enabled
     */
    #isGlanceEnabledForSearch() {
      return (
        Services.prefs.getBoolPref('zen.glance.enabled', false) &&
        Services.prefs.getBoolPref('zen.glance.enable-contextmenu-search', true)
      );
    }

    /**
     * Open glance for search result
     * @param {Tab} currentTab - Current tab
     * @param {Tab} parentTab - Parent tab
     */
    #openGlanceForSearch(currentTab, parentTab) {
      const browserRect = window.windowUtils.getBoundsWithoutFlushing(gBrowser.tabbox);
      const clickPosition = gZenUIManager._lastClickPosition || {
        clientX: browserRect.width / 2,
        clientY: browserRect.height / 2,
      };

      this.openGlance(
        {
          url: undefined,
          ...clickPosition,
          width: 0,
          height: 0,
        },
        currentTab,
        parentTab
      );
    }
  }

  window.gZenGlanceManager = new nsZenGlanceManager();
}
