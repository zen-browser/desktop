
{
  const lazy = {};
  XPCOMUtils.defineLazyPreferenceGetter(
    lazy,
    "sidebarHeightThrottle",
    "zen.view.sidebar-height-throttle",
    500
  );
  var ZenStartup = {
    init() {
      this.openWatermark();
      window.SessionStore.promiseInitialized.then(async () => {
        this._changeSidebarLocation();
        this._zenInitBrowserLayout();
        this._focusSearchBar();
      });
    },

    _zenInitBrowserLayout() {
      if (this.__hasInitBrowserLayout) return;
      this.__hasInitBrowserLayout = true;
      try {
        console.info('ZenThemeModifier: init browser layout');
        const kNavbarItems = ['nav-bar', 'PersonalToolbar'];
        const kNewContainerId = 'zen-appcontent-navbar-container';
        let newContainer = document.getElementById(kNewContainerId);
        for (let id of kNavbarItems) {
          const node = document.getElementById(id);
          console.assert(node, 'Could not find node with id: ' + id);
          if (!node) continue;
          newContainer.appendChild(node);
        }

        // Fix notification deck
        document
          .getElementById('zen-appcontent-navbar-container')
          .appendChild(document.getElementById('tab-notification-deck-template'));

        // Disable smooth scroll
        gBrowser.tabContainer.arrowScrollbox.smoothScroll = false;

        ZenWorkspaces.init();
        gZenVerticalTabsManager.init();
        gZenCompactModeManager.init();
        gZenKeyboardShortcuts.init();

        function throttle(f, delay) {
          let timer = 0;
          return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => f.apply(this, args), delay);
          };
        }

        new ResizeObserver(throttle(this._updateTabsToolbar.bind(this), lazy.sidebarHeightThrottle)).observe(document.getElementById('tabbrowser-tabs'));
      } catch (e) {
        console.error('ZenThemeModifier: Error initializing browser layout', e);
      }
      this.closeWatermark();
    },

    _updateTabsToolbar() {
      // Set tabs max-height to the "toolbar-items" height
      const toolbarItems = document.getElementById('tabbrowser-tabs');
      const tabs = document.getElementById('tabbrowser-arrowscrollbox');
      tabs.style.maxHeight = '0px'; // reset to 0
      const toolbarRect = toolbarItems.getBoundingClientRect();
      // -5 for the controls padding
      let totalHeight = toolbarRect.height - 5;
      // remove the height from other elements that aren't hidden
      const otherElements = document.querySelectorAll('#tabbrowser-tabs > *:not([hidden="true"])');
      for (let tab of otherElements) {
        if (tabs === tab) continue;
        totalHeight -= tab.getBoundingClientRect().height;
      }
      tabs.style.maxHeight = totalHeight + 'px';
      //console.info('ZenThemeModifier: set tabs max-height to', totalHeight + 'px');
    },

    openWatermark() {
      if (!Services.prefs.getBoolPref('zen.watermark.enabled', false)) {
        return;
      }
      const watermark = window.MozXULElement.parseXULToFragment(`
        <html:div id="zen-watermark">
          <image src="chrome://branding/content/about-logo.png" />
        </html:div>
      `);
      document.body.appendChild(watermark);
    },

    closeWatermark() {
      const watermark = document.getElementById('zen-watermark');
      if (watermark) {
        watermark.setAttribute('hidden', 'true');
      }
    },

    _changeSidebarLocation() {
      const legacyLocation = Services.prefs.getBoolPref('zen.themes.tabs.legacy-location', false);
      const kElementsToAppend = ['sidebar-splitter', 'sidebar-box'];
      const wrapper = document.getElementById('zen-tabbox-wrapper');
      const appWrapepr = document.getElementById('zen-sidebar-box-container');
      for (let id of kElementsToAppend) {
        const elem = document.getElementById(id);
        if (elem) {
          wrapper.prepend(elem);
        }
      }
      appWrapepr.setAttribute('hidden', 'true');

      const browser = document.getElementById('browser');
      const toolbox = document.getElementById('navigator-toolbox');
      browser.prepend(toolbox);

      // remove all styles except for the width, since we are xulstoring the complet style list
      const width = toolbox.style.width;
      toolbox.removeAttribute('style');
      toolbox.style.width = width;

      // Set a splitter to navigator-toolbox
      const splitter = document.createXULElement('splitter');
      splitter.setAttribute('id', 'zen-sidebar-splitter');
      splitter.setAttribute('orient', 'horizontal');
      splitter.setAttribute('resizebefore', 'sibling');
      splitter.setAttribute('resizeafter', 'none');
      toolbox.insertAdjacentElement('afterend', splitter);

      this._moveWindowButtons();
      this._addSidebarButtons();
      this._hideToolbarButtons();
    },

    _moveWindowButtons() {
      const windowControls = document.getElementById('titlebar-buttonbox-container');
      const toolboxIcons = document.getElementById('zen-sidebar-top-buttons');
      if (AppConstants.platform == "macosx") {
        toolboxIcons.prepend(windowControls);
      }
    },

    _hideToolbarButtons() {
      const elementsToHide = [
        'alltabs-button',
      ];
      for (let id of elementsToHide) {
        const elem = document.getElementById(id);
        if (elem) {
          elem.setAttribute('hidden', 'true');
        }
      }
    },

    _addSidebarButtons() {
      const sidebarBox = window.MozXULElement.parseXULToFragment(`
        <toolbar id="zen-sidebar-top-buttons"
          fullscreentoolbar="true" 
          class="browser-toolbar customization-target zen-dont-hide-on-fullscreen"
          brighttext="true"
          data-l10n-id="tabs-toolbar"
          customizable="true"
          toolbarname="Zen Sidebar Top Buttons"
          context="toolbar-context-menu"
          flex="1"
          customizationtarget="zen-sidebar-top-buttons-customization-target"
          mode="icons">
          <hbox id="zen-sidebar-top-buttons-customization-target" class="customization-target" flex="1">
            <toolbarbutton removable="true" class="chromeclass-toolbar-additional toolbarbutton-1 zen-sidebar-action-button" id="zen-expand-sidebar-button" data-l10n-id="sidebar-zen-expand" cui-areatype="toolbar" oncommand="gZenVerticalTabsManager.toggleExpand();"></toolbarbutton>
            <toolbarbutton removable="true" class="chromeclass-toolbar-additional toolbarbutton-1 zen-sidebar-action-button chromeclass-toolbar-additional subviewbutton-nav" badge="true" closemenu="none" delegatesanchor="true" cui-areatype="toolbar" id="zen-profile-button" data-l10n-id="toolbar-button-account" onclick="ZenProfileDialogUI.showSubView(this, event)"></toolbarbutton>  
          </hbox>
        </toolbar>
      `);
      document.getElementById('navigator-toolbox').prepend(sidebarBox);
      const sideBarTopButtons = document.getElementById('zen-sidebar-top-buttons')
        .querySelector('#zen-sidebar-top-buttons-customization-target');

      const newTab = document.getElementById('vertical-tabs-newtab-button');
      newTab.classList.add('zen-sidebar-action-button');

      setTimeout(() => {
        CustomizableUI.registerArea(
          "zen-sidebar-top-buttons",
          {
            type: CustomizableUI.TYPE_TOOLBAR,
            defaultPlacements: [
              "PanelUI-menu-button", "zen-expand-sidebar-button", "zen-profile-button"
            ],
            defaultCollapsed: null,
          }
        );
        CustomizableUI.registerToolbarNode(
          document.getElementById('zen-sidebar-top-buttons')
        );

        const panelMenu = document.getElementById('PanelUI-menu-button');
        panelMenu.classList.add('zen-sidebar-action-button');
        panelMenu.setAttribute('cui-areatype', 'toolbar');

        sideBarTopButtons.prepend(panelMenu);

        const defaultSidebarIcons = [
          'zen-sidepanel-button',
          'zen-workspaces-button',
          'new-tab-button'
        ];
        for (let id of defaultSidebarIcons) {
          const elem = document.getElementById(id);
          if (id === 'zen-workspaces-button' || !elem) continue;
          elem.setAttribute('removable', 'true');
        }
        CustomizableUI.registerArea(
          "zen-sidebar-icons-wrapper",
          {
            type: CustomizableUI.TYPE_TOOLBAR,
            defaultPlacements: defaultSidebarIcons,
            defaultCollapsed: null,
          }
        );
        CustomizableUI.registerToolbarNode(
          document.getElementById('zen-sidebar-icons-wrapper')
        );
      }, 100);
    },

    _focusSearchBar() {
      gURLBar.focus();
    },
  };

  ZenStartup.init();
}
