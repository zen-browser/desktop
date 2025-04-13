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

ChromeUtils.defineLazyGetter(lazyCompactMode, 'mainAppWrapper', () => document.getElementById('zen-main-app-wrapper'));

var gZenCompactModeManager = {
  _flashTimeouts: {},
  _evenListeners: [],
  _removeHoverFrames: {},

  preInit() {
    // Remove it before initializing so we can properly calculate the width
    // of the sidebar at startup and avoid overflowing items not being hidden
    const isCompactMode = lazyCompactMode.mainAppWrapper.getAttribute('zen-compact-mode') === 'true';
    lazyCompactMode.mainAppWrapper.removeAttribute('zen-compact-mode');
    this._wasInCompactMode = isCompactMode;

    this.addMouseActions();
    this.addContextMenu();
  },

  init() {
    Services.prefs.addObserver('zen.tabs.vertical.right-side', this._updateSidebarIsOnRight.bind(this));

    gZenUIManager.addPopupTrackingAttribute(this.sidebar);
    gZenUIManager.addPopupTrackingAttribute(document.getElementById('zen-appcontent-navbar-container'));

    // Clear hover states when window state changes (minimize, maximize, etc.)
    window.addEventListener('sizemodechange', () => this._clearAllHoverStates());

    if (AppConstants.platform == 'macosx') {
      window.addEventListener('mouseover', (event) => {
        const buttons = gZenVerticalTabsManager.actualWindowButtons;
        if (event.target.closest('.titlebar-buttonbox-container') === buttons) return;
        buttons.removeAttribute('zen-has-hover');
      });
    }
    this.preference = this._wasInCompactMode;
  },

  get preference() {
    return lazyCompactMode.mainAppWrapper.getAttribute('zen-compact-mode') === 'true';
  },

  set preference(value) {
    if (this.preference === value || document.documentElement.hasAttribute('zen-compact-animating')) {
      if (typeof this._wasInCompactMode !== 'undefined') {
        // We wont do anything with it anyway, so we remove it
        delete this._wasInCompactMode;
      }
      // We dont want the user to be able to spam the button
      return value;
    }
    // We use this element in order to make it persis across restarts, by using the XULStore.
    // main-window can't store attributes other than window sizes, so we use this instead
    lazyCompactMode.mainAppWrapper.setAttribute('zen-compact-mode', value);
    document.documentElement.setAttribute('zen-compact-mode', value);
    this._updateEvent();
    return value;
  },

  get sidebarIsOnRight() {
    if (typeof this._sidebarIsOnRight !== 'undefined') {
      return this._sidebarIsOnRight;
    }
    this._sidebarIsOnRight = Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
    return this._sidebarIsOnRight;
  },

  get sidebar() {
    if (!this._sidebar) {
      this._sidebar = document.getElementById('navigator-toolbox');
    }
    return this._sidebar;
  },

  flashSidebarIfNecessary(aInstant = false) {
    // This function is called after exiting DOM fullscreen mode,
    // so we do a bit of a hack to re-calculate the URL height
    if (aInstant) {
      gZenVerticalTabsManager.recalculateURLBarHeight();
    }
    if (!aInstant && this.preference && lazyCompactMode.COMPACT_MODE_FLASH_ENABLED && !gZenGlanceManager._animating) {
      this.flashSidebar();
    }
  },

  addContextMenu() {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menu id="zen-context-menu-compact-mode" data-l10n-id="zen-toolbar-context-compact-mode">
        <menupopup>
          <menuitem id="zen-context-menu-compact-mode-toggle" data-l10n-id="zen-toolbar-context-compact-mode-enable" type="checkbox" oncommand="gZenCompactModeManager.toggle();"/>
          <menuseparator/>
          <menuitem id="zen-context-menu-compact-mode-hide-sidebar" data-l10n-id="zen-toolbar-context-compact-mode-just-tabs" type="radio" oncommand="gZenCompactModeManager.hideSidebar();"/>
          <menuitem id="zen-context-menu-compact-mode-hide-toolbar" data-l10n-id="zen-toolbar-context-compact-mode-just-toolbar" type="radio" oncommand="gZenCompactModeManager.hideToolbar();"/>
          <menuitem id="zen-context-menu-compact-mode-hide-both" data-l10n-id="zen-toolbar-context-compact-mode-hide-both" type="radio" oncommand="gZenCompactModeManager.hideBoth();"/>
        </menupopup>
      </menu>
    `);
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
    this.updateContextMenu();
  },

  updateCompactModeContext(isSingleToolbar) {
    const IDs = [
      'zen-context-menu-compact-mode-hide-sidebar',
      'zen-context-menu-compact-mode-hide-toolbar',
      'zen-context-menu-compact-mode-hide-both',
    ];
    for (let id of IDs) {
      document.getElementById(id).disabled = isSingleToolbar;
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

  async _updateEvent() {
    // IF we are animating IN, call the callbacks first so we can calculate the width
    // once the window buttons are shown
    this.updateContextMenu();
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
      this._ignoreNextResize = false;
      return;
    }
    let sidebarWidth = this.sidebar.getBoundingClientRect().width;
    if (sidebarWidth > 1) {
      gZenUIManager.restoreScrollbarState();
      // Second variable to get the genuine width of the sidebar
      this.sidebar.style.setProperty('--actual-zen-sidebar-width', `${sidebarWidth}px`);
      window.dispatchEvent(new window.Event('resize')); // To recalculate the layout
      if (event && this.preference) {
        return;
      }
      this.sidebar.style.setProperty('--zen-sidebar-width', `${sidebarWidth}px`);
    }
    return sidebarWidth;
  },

  animateCompactMode() {
    return new Promise((resolve) => {
      // Get the splitter width before hiding it (we need to hide it before animating on right)
      document.documentElement.setAttribute('zen-compact-animating', 'true');
      // We need to set the splitter width before hiding it
      let splitterWidth = document.getElementById('zen-sidebar-splitter').getBoundingClientRect().width;
      const isCompactMode = this.preference;
      const canHideSidebar =
        Services.prefs.getBoolPref('zen.view.compact.hide-tabbar') || gZenVerticalTabsManager._hasSetSingleToolbar;
      let canAnimate =
        lazyCompactMode.COMPACT_MODE_CAN_ANIMATE_SIDEBAR &&
        !this.sidebar.hasAttribute('zen-user-show') &&
        !this.sidebar.hasAttribute('zen-has-empty-tab') &&
        !this.sidebar.hasAttribute('zen-has-hover');
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
        let sidebarWidth = this.getAndApplySidebarWidth();
        if (!canAnimate) {
          this.sidebar.removeAttribute('animate');
          document.documentElement.removeAttribute('zen-compact-animating');

          this.getAndApplySidebarWidth({});
          this._ignoreNextResize = true;

          resolve();
          return;
        }
        if (canHideSidebar && isCompactMode) {
          const elementSeparation = ZenThemeModifier.elementSeparation;
          if (document.documentElement.hasAttribute('zen-sidebar-expanded')) {
            sidebarWidth -= 0.5 * splitterWidth;
            if (elementSeparation < splitterWidth) {
              // Subtract from the splitter width to end up with the correct element separation
              sidebarWidth += 1.5 * splitterWidth - elementSeparation;
            }
          }
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
                duration: 0.2,
              }
            )
            .then(() => {
              this.sidebar.style.transition = 'none';
              this.sidebar.style.opacity = 0;
              setTimeout(() => {
                this.sidebar.removeAttribute('animate');
                document.documentElement.removeAttribute('zen-compact-animating');

                this.getAndApplySidebarWidth({});
                this._ignoreNextResize = true;

                this.sidebar.style.removeProperty('margin-right');
                this.sidebar.style.removeProperty('margin-left');
                this.sidebar.style.removeProperty('opacity');
                this.sidebar.style.removeProperty('transition');

                resolve();
              }, 0);
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
                duration: 0.2,
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
    document.getElementById('zen-context-menu-compact-mode-toggle').setAttribute('checked', this.preference);

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
    const buttons = document.querySelectorAll('toolbarbutton:is(#unified-extensions-button, .webextension-browser-action)');
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
              element: document.getElementById('zen-appcontent-navbar-container'),
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
    for (let i = 0; i < this.hoverableElements.length; i++) {
      let target = this.hoverableElements[i].element;
      const onEnter = (event) => {
        if (event.type === 'mouseenter' && !event.target.matches(':hover')) return;
        // Dont register the hover if the urlbar is floating and we are hovering over it
        if (event.target.querySelector('#urlbar[zen-floating-urlbar]')) return;
        this.clearFlashTimeout('has-hover' + target.id);
        window.requestAnimationFrame(() => target.setAttribute('zen-has-hover', 'true'));
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
        if (target.contains(event.explicitOriginalTarget) && event.explicitOriginalTarget !== target) {
          return;
        }

        if (this.hoverableElements[i].keepHoverDuration && !event.target.querySelector('#urlbar[zen-floating-urlbar]')) {
          this.flashElement(target, this.hoverableElements[i].keepHoverDuration, 'has-hover' + target.id, 'zen-has-hover');
        } else {
          this._removeHoverFrames[target.id] = window.requestAnimationFrame(() => target.removeAttribute('zen-has-hover'));
        }
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

        this.flashElement(target, this.hideAfterHoverDuration, 'has-hover' + target.id, 'zen-has-hover');
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
    let toolbar = document.getElementById('zen-appcontent-navbar-container');
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
};

document.addEventListener(
  'MozBeforeInitialXULLayout',
  () => {
    gZenCompactModeManager.preInit();
  },
  { once: true }
);
