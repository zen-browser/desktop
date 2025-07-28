// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
const lazyCompactMode = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazyCompactMode,
  'COMPACT_MODE_FLASH_DURATION',
  'zen.view.compact.toolbar-flash-popup.duration',
  800
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazyCompactMode,
  'COMPACT_MODE_FLASH_ENABLED',
  'zen.view.compact.toolbar-flash-popup',
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazyCompactMode,
  'COMPACT_MODE_CAN_ANIMATE_SIDEBAR',
  'zen.view.compact.animate-sidebar',
  true
);

ChromeUtils.defineLazyGetter(lazyCompactMode, 'mainAppWrapper', () =>
  document.getElementById('zen-main-app-wrapper')
);

var gZenCompactModeManager = {
  _flashTimeouts: {},
  _evenListeners: [],
  _removeHoverFrames: {},

  preInit() {
    // Remove it before initializing so we can properly calculate the width
    // of the sidebar at startup and avoid overflowing items not being hidden
    this._wasInCompactMode =
      Services.xulStore.getValue(
        AppConstants.BROWSER_CHROME_URL,
        'zen-main-app-wrapper',
        'zen-compact-mode'
      ) || Services.prefs.getBoolPref('zen.view.compact.should-enable-at-startup', false);
    lazyCompactMode.mainAppWrapper.removeAttribute('zen-compact-mode');

    this.addContextMenu();
    this._resolvePreInit();
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
        buttons.removeAttribute('zen-has-hover');
      });
    }

    this._preInitPromise.then(() => {
      this.preference = this._wasInCompactMode;
      delete this._resolvePreInit;
      delete this._preInitPromise;
    });
  },

  get preference() {
    return lazyCompactMode.mainAppWrapper.getAttribute('zen-compact-mode') === 'true';
  },

  get shouldBeCompact() {
    return !document.documentElement.getAttribute('chromehidden').includes('toolbar');
  },

  set preference(value) {
    if (!this.shouldBeCompact) {
      value = false;
    }
    if (
      this.preference === value ||
      document.documentElement.hasAttribute('zen-compact-animating')
    ) {
      if (typeof this._wasInCompactMode !== 'undefined') {
        // We wont do anything with it anyway, so we remove it
        delete this._wasInCompactMode;
      }
      // We dont want the user to be able to spam the button
      return;
    }
    this.sidebar.removeAttribute('zen-user-show');
    // We use this element in order to make it persis across restarts, by using the XULStore.
    // main-window can't store attributes other than window sizes, so we use this instead
    lazyCompactMode.mainAppWrapper.setAttribute('zen-compact-mode', value);
    document.documentElement.setAttribute('zen-compact-mode', value);
    Services.xulStore.persist(lazyCompactMode.mainAppWrapper, 'zen-compact-mode');
    if (typeof this._wasInCompactMode === 'undefined') {
      Services.prefs.setBoolPref('zen.view.compact.should-enable-at-startup', value);
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
    this.sidebarObserverId = ZenHasPolyfill.observeSelectorExistence(
      this.sidebar,
      [
        {
          selector:
            ":is([panelopen='true'], [open='true'], #urlbar:focus-within, [breakout-extend='true']):not(#urlbar[zen-floating-urlbar='true']):not(tab):not(.zen-compact-mode-ignore)",
        },
      ],
      'zen-compact-mode-active'
    );
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
      lazyCompactMode.COMPACT_MODE_FLASH_ENABLED &&
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
          <menuitem id="zen-context-menu-compact-mode-hide-sidebar" data-l10n-id="zen-toolbar-context-compact-mode-just-tabs" type="radio" command="cmd_zenCompactModeHideSidebar"/>
          <menuitem id="zen-context-menu-compact-mode-hide-toolbar" data-l10n-id="zen-toolbar-context-compact-mode-just-toolbar" type="radio" command="cmd_zenCompactModeHideToolbar"/>
          <menuitem id="zen-context-menu-compact-mode-hide-both" data-l10n-id="zen-toolbar-context-compact-mode-hide-both" type="radio" command="cmd_zenCompactModeHideBoth"/>
        </menupopup>
      </menu>
    `);
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
    this.updateContextMenu();
  },

  updateCompactModeContext(isSingleToolbar) {
    const menuitem = document.getElementById('zen-context-menu-compact-mode-toggle');
    const menu = document.getElementById('zen-context-menu-compact-mode');
    menu.setAttribute('hidden', isSingleToolbar);
    if (isSingleToolbar) {
      menu.before(menuitem);
    } else {
      menu.querySelector('menupopup').prepend(menuitem);
    }
  },

  hideSidebar() {
    Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
    Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', false);
  },

  hideToolbar() {
    Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
    Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', false);
  },

  hideBoth() {
    Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
    Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
  },

  addEventListener(callback) {
    this._evenListeners.push(callback);
  },

  removeEventListener(callback) {
    const index = this._evenListeners.indexOf(callback);
    if (index !== -1) {
      this._evenListeners.splice(index, 1);
    }
  },

  async _updateEvent() {
    // IF we are animating IN, call the callbacks first so we can calculate the width
    // once the window buttons are shown
    this.updateContextMenu();
    if (this.preference) {
      ZenHasPolyfill.connectObserver(this.sidebarObserverId);
    } else {
      ZenHasPolyfill.disconnectObserver(this.sidebarObserverId);
    }
    if (!this.preference) {
      this._evenListeners.forEach((callback) => callback());
      await this.animateCompactMode();
    } else {
      await this.animateCompactMode();
      this._evenListeners.forEach((callback) => callback());
    }
    gZenUIManager.updateTabsToolbar();
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
      let canAnimate =
        lazyCompactMode.COMPACT_MODE_CAN_ANIMATE_SIDEBAR && !this.isSidebarPotentiallyOpen();
      if (typeof this._wasInCompactMode !== 'undefined') {
        canAnimate = false;
        delete this._wasInCompactMode;
      }
      // Do this so we can get the correct width ONCE compact mode styled have been applied
      if (canAnimate) {
        this.sidebar.setAttribute('animate', 'true');
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

          resolve();
          return;
        }
        if (canHideSidebar && isCompactMode) {
          if (document.documentElement.hasAttribute('zen-sidebar-expanded')) {
            sidebarWidth -= 0.5 * splitterWidth;
            if (elementSeparation < splitterWidth) {
              // Subtract from the splitter width to end up with the correct element separation
              sidebarWidth += 1.5 * splitterWidth - elementSeparation;
            }
          } else {
            sidebarWidth -= elementSeparation;
          }
          this.sidebar.style.marginRight = '0px';
          this.sidebar.style.marginLeft = '0px';
          gZenUIManager.motion
            .animate(
              this.sidebar,
              {
                marginRight: this.sidebarIsOnRight ? `-${sidebarWidth}px` : 0,
                marginLeft: this.sidebarIsOnRight ? 0 : `-${sidebarWidth}px`,
              },
              {
                ease: 'easeIn',
                type: 'spring',
                bounce: 0,
                duration: 0.15,
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
                duration: 0.15,
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
        }
      });
    });
  },

  updateContextMenu() {
    document
      .getElementById('zen-context-menu-compact-mode-toggle')
      .setAttribute('checked', this.preference);

    const hideTabBar = Services.prefs.getBoolPref('zen.view.compact.hide-tabbar', false);
    const hideToolbar = Services.prefs.getBoolPref('zen.view.compact.hide-toolbar', false);
    const hideBoth = hideTabBar && hideToolbar;

    const idName = 'zen-context-menu-compact-mode-hide-';
    document.getElementById(idName + 'sidebar').setAttribute('checked', !hideBoth && hideTabBar);
    document.getElementById(idName + 'toolbar').setAttribute('checked', !hideBoth && hideToolbar);
    document.getElementById(idName + 'both').setAttribute('checked', hideBoth);
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

  toggle() {
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
    if (typeof this._showSidebarAndToolbarOnHover === 'undefined') {
      this._showSidebarAndToolbarOnHover = Services.prefs.getBoolPref(
        'zen.view.compact.show-sidebar-and-toolbar-on-hover',
        true
      );
    }
    return [
      ...(!this._showSidebarAndToolbarOnHover
        ? []
        : [
            {
              element: this.sidebar,
              screenEdge: this.sidebarIsOnRight ? 'right' : 'left',
              keepHoverDuration: 100,
            },
            {
              element: document.getElementById('zen-appcontent-navbar-wrapper'),
              screenEdge: 'top',
            },
          ]),
      {
        element: gZenVerticalTabsManager.actualWindowButtons,
      },
    ];
  },

  flashSidebar(duration = lazyCompactMode.COMPACT_MODE_FLASH_DURATION) {
    let tabPanels = document.getElementById('tabbrowser-tabpanels');
    if (!tabPanels.matches("[zen-split-view='true']")) {
      this.flashElement(this.sidebar, duration, this.sidebar.id);
    }
  },

  flashElement(element, duration, id, attrName = 'flash-popup') {
    //if (element.matches(':hover')) {
    //  return;
    //}
    if (this._flashTimeouts[id]) {
      clearTimeout(this._flashTimeouts[id]);
    } else {
      requestAnimationFrame(() => element.setAttribute(attrName, 'true'));
    }
    this._flashTimeouts[id] = setTimeout(() => {
      window.requestAnimationFrame(() => {
        element.removeAttribute(attrName);
        this._flashTimeouts[id] = null;
      });
    }, duration);
  },

  clearFlashTimeout(id) {
    clearTimeout(this._flashTimeouts[id]);
    this._flashTimeouts[id] = null;
  },

  addMouseActions() {
    gURLBar.textbox.addEventListener('mouseenter', (event) => {
      if (event.target.closest('#urlbar[zen-floating-urlbar]')) {
        // Ignore sidebar mouse enter if the urlbar is floating
        this.clearFlashTimeout('has-hover' + gZenVerticalTabsManager._hasSetSingleToolbar);
        window.requestAnimationFrame(() => {
          this.sidebar.removeAttribute('zen-has-hover');
        });
        this._hasHoveredUrlbar = true;
        return;
      }
    });

    for (let i = 0; i < this.hoverableElements.length; i++) {
      let target = this.hoverableElements[i].element;
      const onEnter = (event) => {
        setTimeout(() => {
          if (event.type === 'mouseenter' && !event.target.matches(':hover')) return;
          // Dont register the hover if the urlbar is floating and we are hovering over it
          this.clearFlashTimeout('has-hover' + target.id);
          if (
            document.documentElement.getAttribute('supress-primary-adjustment') === 'true' ||
            this._hasHoveredUrlbar
          ) {
            return;
          }
          window.requestAnimationFrame(() => target.setAttribute('zen-has-hover', 'true'));
        }, 0);
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

        // If it's a child element but not the target, ignore the event
        if (
          target.contains(event.explicitOriginalTarget) &&
          event.explicitOriginalTarget !== target
        ) {
          return;
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
            event.explicitOriginalTarget.closest('#urlbar[zen-floating-urlbar]') ||
            (document.documentElement.getAttribute('supress-primary-adjustment') === 'true' &&
              gZenVerticalTabsManager._hasSetSingleToolbar) ||
            this._hasHoveredUrlbar
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
              target.removeAttribute('zen-has-hover')
            );
          }
        }, 0);
      };

      target.addEventListener('mouseenter', onEnter);
      target.addEventListener('dragover', onEnter);

      target.addEventListener('mouseleave', onLeave);
      target.addEventListener('dragleave', onLeave);
    }

    document.documentElement.addEventListener('mouseleave', (event) => {
      const screenEdgeCrossed = this._getCrossedEdge(event.pageX, event.pageY);
      if (!screenEdgeCrossed) return;
      for (let entry of this.hoverableElements) {
        if (screenEdgeCrossed !== entry.screenEdge) continue;
        const target = entry.element;
        const boundAxis = entry.screenEdge === 'right' || entry.screenEdge === 'left' ? 'y' : 'x';
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
            target.removeAttribute('zen-has-hover');
            this.clearFlashTimeout('has-hover' + target.id);
          },
          { once: true }
        );
      }
    });

    gURLBar.textbox.addEventListener('mouseleave', () => {
      setTimeout(() => {
        delete this._hasHoveredUrlbar;
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

  toggleToolbar() {
    let toolbar = document.getElementById('zen-appcontent-navbar-wrapper');
    toolbar.toggleAttribute('zen-user-show');
  },

  _clearAllHoverStates() {
    // Clear hover attributes from all hoverable elements
    for (let entry of this.hoverableElements) {
      const target = entry.element;
      if (target && !target.matches(':hover') && target.hasAttribute('zen-has-hover')) {
        target.removeAttribute('zen-has-hover');
        this.clearFlashTimeout('has-hover' + target.id);
      }
    }
  },

  isSidebarPotentiallyOpen() {
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
      !this._nextTimeWillBeActive &&
      this.canHideSidebar
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

gZenCompactModeManager._preInitPromise = new Promise((resolve) => {
  gZenCompactModeManager._resolvePreInit = resolve;
});

document.addEventListener(
  'MozBeforeInitialXULLayout',
  () => {
    gZenCompactModeManager.preInit();
  },
  { once: true }
);
