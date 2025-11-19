/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

{
  const lazy = {};

  XPCOMUtils.defineLazyPreferenceGetter(
    lazy,
    'COMPACT_MODE_FLASH_DURATION',
    'zen.view.compact.toolbar-flash-popup.duration',
    800
  );

  XPCOMUtils.defineLazyPreferenceGetter(
    lazy,
    'COMPACT_MODE_FLASH_ENABLED',
    'zen.view.compact.toolbar-flash-popup',
    true
  );

  XPCOMUtils.defineLazyPreferenceGetter(
    lazy,
    'COMPACT_MODE_CAN_ANIMATE_SIDEBAR',
    'zen.view.compact.animate-sidebar',
    true
  );

  XPCOMUtils.defineLazyPreferenceGetter(
    lazy,
    'COMPACT_MODE_SHOW_SIDEBAR_AND_TOOLBAR_ON_HOVER',
    'zen.view.compact.show-sidebar-and-toolbar-on-hover',
    true
  );

  ChromeUtils.defineLazyGetter(lazy, 'mainAppWrapper', () =>
    document.getElementById('zen-main-app-wrapper')
  );

  window.gZenCompactModeManager = {
    _flashTimeouts: {},
    _eventListeners: [],
    _removeHoverFrames: {},

    // Delay to avoid flickering when hovering over the sidebar
    HOVER_HACK_DELAY: Services.prefs.getIntPref('zen.view.compact.hover-hack-delay', 0),

    preInit() {
      this._wasInCompactMode = Services.prefs.getBoolPref(
        'zen.view.compact.enable-at-startup',
        false
      );
      this._canDebugLog = Services.prefs.getBoolPref('zen.view.compact.debug', false);

      this.addContextMenu();
    },

    init() {
      this.addMouseActions();

      const tabIsRightObserver = this._updateSidebarIsOnRight.bind(this);
      Services.prefs.addObserver('zen.tabs.vertical.right-side', tabIsRightObserver);

      window.addEventListener(
        'unload',
        () => {
          Services.prefs.removeObserver('zen.tabs.vertical.right-side', tabIsRightObserver);
        },
        { once: true }
      );

      gZenUIManager.addPopupTrackingAttribute(this.sidebar);
      gZenUIManager.addPopupTrackingAttribute(
        document.getElementById('zen-appcontent-navbar-wrapper')
      );

      this.addHasPolyfillObserver();

      // Clear hover states when window state changes (minimize, maximize, etc.)
      window.addEventListener('sizemodechange', () => this._clearAllHoverStates());

      this._canShowBackgroundTabToast = Services.prefs.getBoolPref(
        'zen.view.compact.show-background-tab-toast',
        true
      );

      if (AppConstants.platform == 'macosx') {
        window.addEventListener('mouseover', (event) => {
          const buttons = gZenVerticalTabsManager.actualWindowButtons;
          if (event.target.closest('.titlebar-buttonbox-container') === buttons) return;
          this._setElementExpandAttribute(buttons, false);
        });
      }

      SessionStore.promiseAllWindowsRestored.then(() => {
        this.preference = this._wasInCompactMode;
      });
    },

    log(...args) {
      if (this._canDebugLog) {
        console.log('[Zen Compact Mode]', ...args);
      }
    },

    get preference() {
      return document.documentElement.getAttribute('zen-compact-mode') === 'true';
    },

    get shouldBeCompact() {
      return !document.documentElement.getAttribute('chromehidden')?.includes('toolbar');
    },

    set preference(value) {
      if (!this.shouldBeCompact) {
        value = false;
      }
      this.log('Setting compact mode preference to', value);
      if (
        this.preference === value ||
        document.documentElement.hasAttribute('zen-compact-animating')
      ) {
        if (typeof this._wasInCompactMode !== 'undefined') {
          // We wont do anything with it anyway, so we remove it
          delete this._wasInCompactMode;
        }
        delete this._ignoreNextHover;
        // We dont want the user to be able to spam the button
        return;
      }
      this.sidebar.removeAttribute('zen-user-show');
      // We use this element in order to make it persis across restarts, by using the XULStore.
      // main-window can't store attributes other than window sizes, so we use this instead
      lazy.mainAppWrapper.setAttribute('zen-compact-mode', value);
      document.documentElement.setAttribute('zen-compact-mode', value);
      if (typeof this._wasInCompactMode === 'undefined') {
        Services.prefs.setBoolPref('zen.view.compact.enable-at-startup', value);
      }
      this._updateEvent();
    },

    get sidebarIsOnRight() {
      if (typeof this._sidebarIsOnRight !== 'undefined') {
        return this._sidebarIsOnRight;
      }
      this._sidebarIsOnRight = Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
      return this._sidebarIsOnRight;
    },

    get sidebar() {
      return gNavToolbox;
    },

    addHasPolyfillObserver() {
      const attributes = ['panelopen', 'open', 'breakout-extend', 'zen-floating-urlbar'];
      this.sidebarObserverId = ZenHasPolyfill.observeSelectorExistence(
        this.sidebar,
        [
          {
            selector:
              ":is([panelopen='true'], [open='true'], [breakout-extend='true']):not(#urlbar[zen-floating-urlbar='true']):not(tab):not(.zen-compact-mode-ignore)",
          },
        ],
        'zen-compact-mode-active',
        attributes
      );
      this.toolbarObserverId = ZenHasPolyfill.observeSelectorExistence(
        document.getElementById('zen-appcontent-navbar-wrapper'),
        [
          {
            selector:
              ":is([panelopen='true'], [open='true'], #urlbar:focus-within, [breakout-extend='true']):not(.zen-compact-mode-ignore)",
          },
        ],
        'zen-compact-mode-active',
        attributes
      );
      // Always connect this observer, we need it even if compact mode is disabled
      ZenHasPolyfill.connectObserver(this.toolbarObserverId);
    },

    flashSidebarIfNecessary(aInstant = false) {
      // This function is called after exiting DOM fullscreen mode,
      // so we do a bit of a hack to re-calculate the URL height
      if (aInstant) {
        gZenVerticalTabsManager.recalculateURLBarHeight();
      }
      if (
        !aInstant &&
        this.preference &&
        lazy.COMPACT_MODE_FLASH_ENABLED &&
        !gZenGlanceManager._animating
      ) {
        this.flashSidebar();
      }
    },

    addContextMenu() {
      const fragment = window.MozXULElement.parseXULToFragment(`
      <menu id="zen-context-menu-compact-mode" data-l10n-id="zen-toolbar-context-compact-mode">
        <menupopup>
          <menuitem id="zen-context-menu-compact-mode-toggle" data-l10n-id="zen-toolbar-context-compact-mode-enable" type="checkbox" command="cmd_zenCompactModeToggle"/>
          <menuseparator/>
          <menuitem id="zen-context-menu-compact-mode-hide-sidebar" data-l10n-id="zen-toolbar-context-compact-mode-just-tabs" type="radio" />
          <menuitem id="zen-context-menu-compact-mode-hide-toolbar" data-l10n-id="zen-toolbar-context-compact-mode-just-toolbar" type="radio" />
          <menuitem id="zen-context-menu-compact-mode-hide-both" data-l10n-id="zen-toolbar-context-compact-mode-hide-both" type="radio" />
        </menupopup>
      </menu>
    `);

      const idToAction = {
        'zen-context-menu-compact-mode-hide-sidebar': this.hideSidebar.bind(this),
        'zen-context-menu-compact-mode-hide-toolbar': this.hideToolbar.bind(this),
        'zen-context-menu-compact-mode-hide-both': this.hideBoth.bind(this),
      };

      for (let menuitem of fragment.querySelectorAll('menuitem')) {
        if (menuitem.id in idToAction) {
          menuitem.addEventListener('command', idToAction[menuitem.id]);
        }
      }

      document.getElementById('viewToolbarsMenuSeparator').before(fragment);
      this.updateContextMenu();
    },

    updateCompactModeContext(isSingleToolbar) {
      const isIllegalState = this.checkIfIllegalState();
      const menuitem = document.getElementById('zen-context-menu-compact-mode-toggle');
      const menu = document.getElementById('zen-context-menu-compact-mode');
      if (isSingleToolbar) {
        menu.setAttribute('hidden', 'true');
        menu.before(menuitem);
      } else {
        menu.removeAttribute('hidden');
        menu.querySelector('menupopup').prepend(menuitem);
      }
      const hideToolbarMenuItem = document.getElementById(
        'zen-context-menu-compact-mode-hide-toolbar'
      );
      if (isIllegalState) {
        hideToolbarMenuItem.setAttribute('disabled', 'true');
      } else {
        hideToolbarMenuItem.removeAttribute('disabled');
      }
    },

    hideSidebar() {
      Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
      Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', false);
      this.callAllEventListeners();
    },

    hideToolbar() {
      Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
      Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', false);
      this.callAllEventListeners();
    },

    hideBoth() {
      Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
      Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
      this.callAllEventListeners();
    },

    /* Check for illegal states and fix them
     * @returns {boolean} If the context menu should just show the "toggle" item
     *    instead of a submenu with hide options
     */
    checkIfIllegalState() {
      // Due to how we layout the sidebar and toolbar, there are some states
      // that are not allowed mainly due to the caption buttons not being accessible
      // at the top left/right of the window.
      const isSidebarExpanded = gZenVerticalTabsManager._prefsSidebarExpanded;
      if (isSidebarExpanded) {
        // Fast exit if the sidebar is expanded, as we dont have illegal states then
        return false;
      }
      const canHideSidebar = this.canHideSidebar;
      const canHideToolbar = this.canHideToolbar;
      const isLeftSideButtons = !gZenVerticalTabsManager.isWindowsStyledButtons;
      const isRightSidebar = gZenVerticalTabsManager._prefsRightSide;
      // on macos: collapsed + left side + only toolbar
      // on windows: collapsed + right side + only toolbar
      const closelyIllegalState =
        (isLeftSideButtons && !isRightSidebar) || (!isLeftSideButtons && isRightSidebar);
      if (closelyIllegalState && canHideToolbar && !canHideSidebar) {
        // This state is illegal
        Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
        Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', false);
        this.callAllEventListeners();
        return true;
      }
      return closelyIllegalState;
    },

    callAllEventListeners() {
      this._eventListeners.forEach((callback) => callback());
    },

    addEventListener(callback) {
      this._eventListeners.push(callback);
    },

    removeEventListener(callback) {
      const index = this._eventListeners.indexOf(callback);
      if (index !== -1) {
        this._eventListeners.splice(index, 1);
      }
    },

    async _updateEvent() {
      const isUrlbarFocused = gURLBar.focused;
      // IF we are animating IN, call the callbacks first so we can calculate the width
      // once the window buttons are shown
      this.updateContextMenu();
      if (!this.preference) {
        this.callAllEventListeners();
        await this.animateCompactMode();
      } else {
        await this.animateCompactMode();
        this.callAllEventListeners();
      }
      gZenUIManager.updateTabsToolbar();
      if (isUrlbarFocused) {
        gURLBar.focus();
      }
      if (this.preference) {
        ZenHasPolyfill.connectObserver(this.sidebarObserverId);
      } else {
        ZenHasPolyfill.disconnectObserver(this.sidebarObserverId);
      }
      window.dispatchEvent(new CustomEvent('ZenCompactMode:Toggled', { detail: this.preference }));
    },

    // NOTE: Dont actually use event, it's just so we make sure
    // the caller is from the ResizeObserver
    getAndApplySidebarWidth(event = undefined) {
      if (this._ignoreNextResize) {
        delete this._ignoreNextResize;
        return;
      }
      let sidebarWidth = this.sidebar.getBoundingClientRect().width;
      const shouldRecalculate =
        this.preference || document.documentElement.hasAttribute('zen-creating-workspace');
      const sidebarExpanded = document.documentElement.hasAttribute('zen-sidebar-expanded');
      if (sidebarWidth > 1) {
        if (shouldRecalculate && sidebarExpanded) {
          sidebarWidth = Math.max(sidebarWidth, 150);
        }
        // Second variable to get the genuine width of the sidebar
        this.sidebar.style.setProperty('--actual-zen-sidebar-width', `${sidebarWidth}px`);
        window.dispatchEvent(new window.Event('resize')); // To recalculate the layout
        if (
          event &&
          shouldRecalculate &&
          sidebarExpanded &&
          !gZenVerticalTabsManager._hadSidebarCollapse
        ) {
          return;
        }
        delete gZenVerticalTabsManager._hadSidebarCollapse;
        this.sidebar.style.setProperty('--zen-sidebar-width', `${sidebarWidth}px`);
      }
      return sidebarWidth;
    },

    get canHideSidebar() {
      return (
        Services.prefs.getBoolPref('zen.view.compact.hide-tabbar') ||
        gZenVerticalTabsManager._hasSetSingleToolbar
      );
    },

    get canHideToolbar() {
      return (
        Services.prefs.getBoolPref('zen.view.compact.hide-toolbar') &&
        !gZenVerticalTabsManager._hasSetSingleToolbar
      );
    },

    animateCompactMode() {
      // Get the splitter width before hiding it (we need to hide it before animating on right)
      document.documentElement.setAttribute('zen-compact-animating', 'true');
      return new Promise((resolve) => {
        // We need to set the splitter width before hiding it
        let splitterWidth = document
          .getElementById('zen-sidebar-splitter')
          .getBoundingClientRect().width;
        const isCompactMode = this.preference;
        const canHideSidebar = this.canHideSidebar;
        let canAnimate = lazy.COMPACT_MODE_CAN_ANIMATE_SIDEBAR && !this.isSidebarPotentiallyOpen();
        if (typeof this._wasInCompactMode !== 'undefined') {
          canAnimate = false;
          delete this._wasInCompactMode;
        }
        // Do this so we can get the correct width ONCE compact mode styled have been applied
        if (canAnimate) {
          this.sidebar.setAttribute('animate', 'true');
        }
        if (this._ignoreNextHover) {
          this._setElementExpandAttribute(this.sidebar, false);
        }
        this.sidebar.style.removeProperty('margin-right');
        this.sidebar.style.removeProperty('margin-left');
        this.sidebar.style.removeProperty('transform');
        window.requestAnimationFrame(() => {
          delete this._ignoreNextResize;
          let sidebarWidth = this.getAndApplySidebarWidth();
          const elementSeparation = ZenThemeModifier.elementSeparation;
          if (!canAnimate) {
            this.sidebar.removeAttribute('animate');
            document.documentElement.removeAttribute('zen-compact-animating');

            this.getAndApplySidebarWidth({});
            this._ignoreNextResize = true;

            delete this._ignoreNextHover;

            resolve();
            return;
          }
          if (document.documentElement.hasAttribute('zen-sidebar-expanded')) {
            sidebarWidth -= 0.5 * splitterWidth;
            if (elementSeparation < splitterWidth) {
              // Subtract from the splitter width to end up with the correct element separation
              sidebarWidth += 1.5 * splitterWidth - elementSeparation;
            }
          } else {
            sidebarWidth -= elementSeparation;
          }
          if (canHideSidebar && isCompactMode) {
            this._setElementExpandAttribute(this.sidebar, false);
            gZenUIManager.motion
              .animate(
                this.sidebar,
                {
                  marginRight: [0, this.sidebarIsOnRight ? `-${sidebarWidth}px` : 0],
                  marginLeft: [0, this.sidebarIsOnRight ? 0 : `-${sidebarWidth}px`],
                },
                {
                  ease: 'easeIn',
                  type: 'spring',
                  bounce: 0,
                  duration: 0.12,
                }
              )
              .then(() => {
                this.sidebar.style.transition = 'none';
                this.sidebar.style.pointEvents = 'none';
                const titlebar = document.getElementById('titlebar');
                titlebar.style.visibility = 'hidden';
                titlebar.style.transition = 'none';
                this.sidebar.removeAttribute('animate');
                document.documentElement.removeAttribute('zen-compact-animating');

                setTimeout(() => {
                  this.getAndApplySidebarWidth({});
                  this._ignoreNextResize = true;

                  setTimeout(() => {
                    if (this._ignoreNextHover) {
                      setTimeout(() => {
                        delete this._ignoreNextHover;
                      });
                    }

                    this.sidebar.style.removeProperty('margin-right');
                    this.sidebar.style.removeProperty('margin-left');
                    this.sidebar.style.removeProperty('transition');
                    this.sidebar.style.removeProperty('transform');
                    this.sidebar.style.removeProperty('point-events');

                    titlebar.style.removeProperty('visibility');
                    titlebar.style.removeProperty('transition');

                    gURLBar.textbox.style.removeProperty('visibility');

                    resolve();
                  });
                });
              });
          } else if (canHideSidebar && !isCompactMode) {
            // Shouldn't be ever true, but just in case
            delete this._ignoreNextHover;
            document.getElementById('browser').style.overflow = 'clip';
            if (this.sidebarIsOnRight) {
              this.sidebar.style.marginRight = `-${sidebarWidth}px`;
            } else {
              this.sidebar.style.marginLeft = `-${sidebarWidth}px`;
            }
            gZenUIManager.motion
              .animate(
                this.sidebar,
                this.sidebarIsOnRight
                  ? {
                      marginRight: [`-${sidebarWidth}px`, 0],
                      transform: ['translateX(100%)', 'translateX(0)'],
                    }
                  : { marginLeft: 0 },
                {
                  ease: 'easeOut',
                  type: 'spring',
                  bounce: 0,
                  duration: 0.12,
                }
              )
              .then(() => {
                this.sidebar.removeAttribute('animate');
                document.getElementById('browser').style.removeProperty('overflow');
                this.sidebar.style.transition = 'none';
                this.sidebar.style.removeProperty('margin-right');
                this.sidebar.style.removeProperty('margin-left');
                this.sidebar.style.removeProperty('transform');
                document.documentElement.removeAttribute('zen-compact-animating');
                setTimeout(() => {
                  this.sidebar.style.removeProperty('transition');
                  resolve();
                });
              });
          } else {
            this.sidebar.removeAttribute('animate'); // remove the attribute if we are not animating
            document.documentElement.removeAttribute('zen-compact-animating');
            delete this._ignoreNextHover;
            resolve();
          }
        });
      });
    },

    updateContextMenu() {
      document
        .getElementById('zen-context-menu-compact-mode-toggle')
        .setAttribute('checked', this.preference);

      const hideTabBar = this.canHideSidebar;
      const hideToolbar = this.canHideToolbar;
      const hideBoth = hideTabBar && hideToolbar;

      const idName = 'zen-context-menu-compact-mode-hide-';
      const sidebarItem = document.getElementById(idName + 'sidebar');
      const toolbarItem = document.getElementById(idName + 'toolbar');
      const bothItem = document.getElementById(idName + 'both');
      sidebarItem.setAttribute('checked', !hideBoth && hideTabBar);
      toolbarItem.setAttribute('checked', !hideBoth && hideToolbar);
      bothItem.setAttribute('checked', hideBoth);
    },

    _removeOpenStateOnUnifiedExtensions() {
      // Fix for bug https://github.com/zen-browser/desktop/issues/1925
      const buttons = document.querySelectorAll(
        'toolbarbutton:is(#unified-extensions-button, .webextension-browser-action)'
      );
      for (let button of buttons) {
        button.removeAttribute('open');
      }
    },

    toggle(ignoreHover = false) {
      // Only ignore the next hover when we are enabling compact mode
      this._ignoreNextHover = ignoreHover && !this.preference;
      return (this.preference = !this.preference);
    },

    _updateSidebarIsOnRight() {
      this._sidebarIsOnRight = Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
    },

    toggleSidebar() {
      this.sidebar.toggleAttribute('zen-user-show');
    },

    get hideAfterHoverDuration() {
      if (this._hideAfterHoverDuration) {
        return this._hideAfterHoverDuration;
      }
      return Services.prefs.getIntPref('zen.view.compact.toolbar-hide-after-hover.duration');
    },

    get hoverableElements() {
      return [
        {
          element: this.sidebar,
          screenEdge: this.sidebarIsOnRight ? 'right' : 'left',
          keepHoverDuration: 100,
        },
        {
          element: document.getElementById('zen-appcontent-navbar-wrapper'),
          screenEdge: 'top',
        },
        {
          element: gZenVerticalTabsManager.actualWindowButtons,
        },
      ];
    },

    flashSidebar(duration = lazy.COMPACT_MODE_FLASH_DURATION) {
      let tabPanels = document.getElementById('tabbrowser-tabpanels');
      if (!tabPanels.matches("[zen-split-view='true']")) {
        this.flashElement(this.sidebar, duration, this.sidebar.id);
      }
    },

    flashElement(element, duration, id, attrName = 'flash-popup') {
      if (this._flashTimeouts[id]) {
        clearTimeout(this._flashTimeouts[id]);
      } else {
        requestAnimationFrame(() => this._setElementExpandAttribute(element, true, attrName));
      }
      this._flashTimeouts[id] = setTimeout(() => {
        window.requestAnimationFrame(() => {
          this._setElementExpandAttribute(element, false, attrName);
          this._flashTimeouts[id] = null;
        });
      }, duration);
    },

    clearFlashTimeout(id) {
      clearTimeout(this._flashTimeouts[id]);
      this._flashTimeouts[id] = null;
    },

    _setElementExpandAttribute(element, value, attr = 'zen-has-hover') {
      const kVerifiedAttributes = ['zen-has-hover', 'has-popup-menu', 'zen-compact-mode-active'];
      const isToolbar = element.id === 'zen-appcontent-navbar-wrapper';
      if (value) {
        if (attr === 'zen-has-hover' && element !== gZenVerticalTabsManager.actualWindowButtons) {
          element.setAttribute('zen-has-implicit-hover', 'true');
          if (!lazy.COMPACT_MODE_SHOW_SIDEBAR_AND_TOOLBAR_ON_HOVER) {
            return;
          }
        }
        element.setAttribute(attr, 'true');
        if (
          isToolbar &&
          ((gZenVerticalTabsManager._hasSetSingleToolbar &&
            (element.hasAttribute('should-hide') ||
              document.documentElement.hasAttribute('zen-has-bookmarks'))) ||
            (this.preference &&
              Services.prefs.getBoolPref('zen.view.compact.hide-toolbar') &&
              !gZenVerticalTabsManager._hasSetSingleToolbar))
        ) {
          gBrowser.tabpanels.setAttribute('has-toolbar-hovered', 'true');
        }
      } else {
        if (attr === 'zen-has-hover') {
          element.removeAttribute('zen-has-implicit-hover');
        }
        element.removeAttribute(attr);
        // Only remove if none of the verified attributes are present
        if (isToolbar && !kVerifiedAttributes.some((attr) => element.hasAttribute(attr))) {
          gBrowser.tabpanels.removeAttribute('has-toolbar-hovered');
        }
      }
    },

    addMouseActions() {
      gURLBar.textbox.addEventListener('mouseenter', (event) => {
        if (event.target.closest('#urlbar[zen-floating-urlbar]')) {
          window.requestAnimationFrame(() => {
            this._setElementExpandAttribute(gZenVerticalTabsManager.actualWindowButtons, false);
          });
          this._hasHoveredUrlbar = true;
          return;
        }
      });

      for (let i = 0; i < this.hoverableElements.length; i++) {
        let target = this.hoverableElements[i].element;

        // Add the attribute on startup if the mouse is already over the element
        if (target.matches(':hover')) {
          this._setElementExpandAttribute(target, true);
        }

        const onEnter = (event) => {
          setTimeout(() => {
            if (event.type === 'mouseenter' && !event.target.matches(':hover')) return;
            if (event.target.closest('panel')) return;
            // Dont register the hover if the urlbar is floating and we are hovering over it
            this.clearFlashTimeout('has-hover' + target.id);
            window.requestAnimationFrame(() => {
              if (
                document.documentElement.getAttribute('supress-primary-adjustment') === 'true' ||
                this._hasHoveredUrlbar ||
                this._ignoreNextHover ||
                target.hasAttribute('zen-has-hover')
              ) {
                return;
              }
              this._setElementExpandAttribute(target, true);
            });
          }, this.HOVER_HACK_DELAY);
        };

        const onLeave = (event) => {
          if (AppConstants.platform == 'macosx') {
            const buttonRect = gZenVerticalTabsManager.actualWindowButtons.getBoundingClientRect();
            const MAC_WINDOW_BUTTONS_X_BORDER = buttonRect.width + buttonRect.x;
            const MAC_WINDOW_BUTTONS_Y_BORDER = buttonRect.height + buttonRect.y;
            if (
              event.clientX < MAC_WINDOW_BUTTONS_X_BORDER &&
              event.clientY < MAC_WINDOW_BUTTONS_Y_BORDER &&
              event.clientX > buttonRect.x &&
              event.clientY > buttonRect.y
            ) {
              return;
            }
          }

          // See bug https://bugzilla.mozilla.org/show_bug.cgi?id=1979340 and issue https://github.com/zen-browser/desktop/issues/7746.
          // If we want the toolbars to be draggable, we need to make sure to check the hover state after a short delay.
          // This is because the mouse is left to be handled natively so firefox thinks the mouse left the window for a split second.
          setTimeout(() => {
            // Let's double check if the mouse is still hovering over the element, see the bug above.
            if (event.target.matches(':hover')) {
              return;
            }

            if (
              event.explicitOriginalTarget?.closest?.('#urlbar[zen-floating-urlbar]') ||
              (document.documentElement.getAttribute('supress-primary-adjustment') === 'true' &&
                gZenVerticalTabsManager._hasSetSingleToolbar) ||
              this._hasHoveredUrlbar ||
              this._ignoreNextHover ||
              (event.type === 'dragleave' &&
                event.explicitOriginalTarget !== target &&
                target.contains?.(event.explicitOriginalTarget))
            ) {
              return;
            }

            if (this.hoverableElements[i].keepHoverDuration) {
              this.flashElement(
                target,
                this.hoverableElements[i].keepHoverDuration,
                'has-hover' + target.id,
                'zen-has-hover'
              );
            } else {
              this._removeHoverFrames[target.id] = window.requestAnimationFrame(() =>
                this._setElementExpandAttribute(target, false)
              );
            }
          }, this.HOVER_HACK_DELAY);
        };

        target.addEventListener('mouseover', onEnter);
        target.addEventListener('dragover', onEnter);

        target.addEventListener('mouseleave', onLeave);
        target.addEventListener('dragleave', onLeave);
      }

      document.documentElement.addEventListener('mouseleave', (event) => {
        setTimeout(() => {
          const screenEdgeCrossed = this._getCrossedEdge(event.pageX, event.pageY);
          if (!screenEdgeCrossed) return;
          for (let entry of this.hoverableElements) {
            if (screenEdgeCrossed !== entry.screenEdge) continue;
            const target = entry.element;
            const boundAxis =
              entry.screenEdge === 'right' || entry.screenEdge === 'left' ? 'y' : 'x';
            if (!this._positionInBounds(boundAxis, target, event.pageX, event.pageY, 7)) {
              continue;
            }
            window.cancelAnimationFrame(this._removeHoverFrames[target.id]);

            this.flashElement(
              target,
              this.hideAfterHoverDuration,
              'has-hover' + target.id,
              'zen-has-hover'
            );
            document.addEventListener(
              'mousemove',
              () => {
                if (target.matches(':hover')) return;
                this._setElementExpandAttribute(target, false);
                this.clearFlashTimeout('has-hover' + target.id);
              },
              { once: true }
            );
          }
        }, this.HOVER_HACK_DELAY);
      });

      gURLBar.textbox.addEventListener('mouseleave', () => {
        setTimeout(() => {
          setTimeout(() => {
            requestAnimationFrame(() => {
              delete this._hasHoveredUrlbar;
            });
          }, 10);
        }, 0);
      });
    },

    _getCrossedEdge(posX, posY, element = document.documentElement, maxDistance = 10) {
      const targetBox = element.getBoundingClientRect();
      posX = Math.max(targetBox.left, Math.min(posX, targetBox.right));
      posY = Math.max(targetBox.top, Math.min(posY, targetBox.bottom));
      return ['top', 'bottom', 'left', 'right'].find((edge, i) => {
        const distance = Math.abs((i < 2 ? posY : posX) - targetBox[edge]);
        return distance <= maxDistance;
      });
    },

    _positionInBounds(axis = 'x', element, x, y, error = 0) {
      const bBox = element.getBoundingClientRect();
      if (axis === 'y') return bBox.top - error < y && y < bBox.bottom + error;
      else return bBox.left - error < x && x < bBox.right + error;
    },

    _clearAllHoverStates() {
      // Clear hover attributes from all hoverable elements
      for (let entry of this.hoverableElements) {
        const target = entry.element;
        if (target && !target.matches(':hover') && target.hasAttribute('zen-has-hover')) {
          this._setElementExpandAttribute(target, false);
          this.clearFlashTimeout('has-hover' + target.id);
        }
      }
    },

    isSidebarPotentiallyOpen() {
      if (this._ignoreNextHover) {
        this._setElementExpandAttribute(this.sidebar, false);
      }
      return (
        this.sidebar.hasAttribute('zen-user-show') ||
        this.sidebar.hasAttribute('zen-has-hover') ||
        this.sidebar.hasAttribute('zen-has-empty-tab')
      );
    },

    async _onTabOpen(tab, inBackground) {
      if (
        inBackground &&
        this.preference &&
        !this.isSidebarPotentiallyOpen() &&
        this._canShowBackgroundTabToast &&
        !gZenGlanceManager._animating &&
        !this._nextTimeWillBeActive
      ) {
        gZenUIManager.showToast('zen-background-tab-opened-toast', {
          button: {
            id: 'zen-open-background-tab-button',
            command: () => {
              const targetWindow = window.ownerGlobal.parent || window;
              targetWindow.gBrowser.selectedTab = tab;
            },
          },
        });
      }
      delete this._nextTimeWillBeActive;
    },
  };

  document.addEventListener(
    'MozBeforeInitialXULLayout',
    () => {
      gZenCompactModeManager.preInit();
    },
    { once: true }
  );
}
