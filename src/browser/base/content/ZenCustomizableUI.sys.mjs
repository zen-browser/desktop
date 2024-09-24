export var ZenCustomizableUI = new (class {
  constructor() {}

  TYPE_TOOLBAR = 'toolbar';
  defaultSidebarIcons = ['zen-sidepanel-button', 'zen-workspaces-button', 'new-tab-button'];

  startup(CustomizableUIInternal) {
    CustomizableUIInternal.registerArea('zen-sidebar-top-buttons', {
      type: this.TYPE_TOOLBAR,
      defaultPlacements: ['PanelUI-menu-button', 'zen-expand-sidebar-button', 'zen-profile-button'],
      defaultCollapsed: null,
    });
    CustomizableUIInternal.registerArea('zen-sidebar-icons-wrapper', {
      type: this.TYPE_TOOLBAR,
      defaultPlacements: this.defaultSidebarIcons,
      defaultCollapsed: null,
    });
  }

  // We do not have access to the window object here
  init(window) {
    this._addSidebarButtons(window);
    this._hideToolbarButtons(window);
  }

  _addSidebarButtons(window) {
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
          <toolbarbutton id="zen-profile-button" 
            class="zen-sidebar-action-button toolbarbutton-1 chromeclass-toolbar-additional"
            delegatesanchor="true"
            onmousedown="ZenProfileDialogUI.showSubView(this, event)"
            onkeypress="ZenProfileDialogUI.showSubView(this, event)"
            consumeanchor="zen-profile-button"
            closemenu="none"
            data-l10n-id="toolbar-button-account"
            cui-areatype="toolbar"
            badged="true"
            removable="true">
            <vbox>
              <image id="zen-profile-button-icon" />
            </vbox>
          </toolbarbutton>
        </hbox>
      </toolbar>
    `);
    window.document.getElementById('navigator-toolbox').prepend(sidebarBox);
    const sideBarTopButtons = window.document
      .getElementById('zen-sidebar-top-buttons')
      .querySelector('#zen-sidebar-top-buttons-customization-target');

    const newTab = window.document.getElementById('vertical-tabs-newtab-button');
    newTab.classList.add('zen-sidebar-action-button');

    const wrapper = window.document.createXULElement('toolbarbutton');
    wrapper.id = 'zen-workspaces-button';
    window.document.getElementById('zen-sidebar-icons-wrapper').prepend(wrapper);

    window.CustomizableUI.registerToolbarNode(window.document.getElementById('zen-sidebar-top-buttons'));

    const panelMenu = window.document.getElementById('PanelUI-menu-button');
    panelMenu.classList.add('zen-sidebar-action-button');
    panelMenu.setAttribute('cui-areatype', 'toolbar');
    panelMenu.setAttribute('removable', 'true');

    sideBarTopButtons.prepend(panelMenu);

    for (let id of this.defaultSidebarIcons) {
      const elem = window.document.getElementById(id);
      if (!elem) continue;
      elem.setAttribute('removable', 'true');
    }

    window.CustomizableUI.registerToolbarNode(window.document.getElementById('zen-sidebar-icons-wrapper'));

    if (window.AppConstants.platform === 'macosx') {
      this._moveWindowButtons(window);
      this._rearrangeButtonsForMac(window);
    }
  }

  _moveWindowButtons(window) {
    const windowControls = window.document.getElementsByClassName('titlebar-buttonbox-container');
    const toolboxIcons = window.document.getElementById('zen-sidebar-top-buttons-customization-target');
    for (let i = 0; i < windowControls.length; i++) {
      if (i === 0) {
        toolboxIcons.prepend(windowControls[i]);
        continue;
      }
      windowControls[i].remove();
    }
  }

  _rearrangeButtonsForMac(window) {
    const titlebarButtons = window.document.getElementsByClassName('titlebar-buttonbox')[0].children;
    titlebarButtons[3].parentNode.insertBefore(titlebarButtons[3], titlebarButtons[0]);
  }

  _hideToolbarButtons(window) {
    const elementsToHide = ['alltabs-button'];
    for (let id of elementsToHide) {
      const elem = window.document.getElementById(id);
      if (elem) {
        elem.setAttribute('hidden', 'true');
      }
    }
  }
})();
