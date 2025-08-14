// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export var ZenCustomizableUI = new (class {
  constructor() {}

  TYPE_TOOLBAR = 'toolbar';
  defaultSidebarIcons = ['downloads-button', 'zen-workspaces-button', 'zen-create-new-button'];

  startup(CustomizableUIInternal) {
    CustomizableUIInternal.registerArea(
      'zen-sidebar-top-buttons',
      {
        type: this.TYPE_TOOLBAR,
        defaultPlacements: [],
        defaultCollapsed: null,
        overflowable: true,
      },
      true
    );
    CustomizableUIInternal.registerArea(
      'zen-sidebar-foot-buttons',
      {
        type: this.TYPE_TOOLBAR,
        defaultPlacements: this.defaultSidebarIcons,
        defaultCollapsed: null,
      },
      true
    );
  }

  // We do not have access to the window object here
  init(window) {
    this._addSidebarButtons(window);
    this._hideToolbarButtons(window);
  }

  _addSidebarButtons(window) {
    const kDefaultSidebarWidth = '210px';
    const toolbox = window.gNavToolbox;

    // Set a splitter to navigator-toolbox
    const splitter = window.document.createXULElement('splitter');
    splitter.setAttribute('id', 'zen-sidebar-splitter');
    splitter.setAttribute('orient', 'horizontal');
    splitter.setAttribute('resizebefore', 'sibling');
    splitter.setAttribute('resizeafter', 'none');
    toolbox.insertAdjacentElement('afterend', splitter);

    const sidebarBox = window.MozXULElement.parseXULToFragment(`
      <toolbar id="zen-sidebar-top-buttons"
        fullscreentoolbar="true"
        class="browser-toolbar customization-target"
        brighttext="true"
        data-l10n-id="tabs-toolbar"
        customizable="true"
        context="toolbar-context-menu"
        flex="1"
        skipintoolbarset="true"
        customizationtarget="zen-sidebar-top-buttons-customization-target"
        overflowable="true"
        default-overflowbutton="nav-bar-overflow-button"
        default-overflowtarget="widget-overflow-list"
        default-overflowpanel="widget-overflow"
        addon-webext-overflowbutton="unified-extensions-button"
        addon-webext-overflowtarget="overflowed-extensions-list"
        mode="icons">
        <hbox id="zen-sidebar-top-buttons-customization-target" class="customization-target" flex="1">
          <html:div id="zen-sidebar-top-buttons-separator" skipintoolbarset="true" overflows="false"></html:div>
        </hbox>
      </toolbar>
    `);
    toolbox.prepend(sidebarBox);
    new window.MutationObserver((e) => {
      if (e[0].type !== 'attributes' || e[0].attributeName !== 'width') return;
      this._dispatchResizeEvent(window);
    }).observe(toolbox, {
      attributes: true, //configure it to listen to attribute changes
    });

    // remove all styles except for the width, since we are xulstoring the complet style list
    const width = toolbox.style.width || kDefaultSidebarWidth;
    toolbox.removeAttribute('style');
    toolbox.style.width = width;
    toolbox.setAttribute('width', width);

    splitter.addEventListener('dblclick', (e) => {
      if (e.button !== 0) return;
      toolbox.style.width = kDefaultSidebarWidth;
      toolbox.setAttribute('width', kDefaultSidebarWidth);
    });

    const newTab = window.document.getElementById('vertical-tabs-newtab-button');
    newTab.classList.add('zen-sidebar-action-button');

    for (let id of this.defaultSidebarIcons) {
      const elem = window.document.getElementById(id);
      if (!elem || elem.id === 'zen-workspaces-button') continue;
      elem.setAttribute('removable', 'true');
    }

    this._initCreateNewButton(window);
    this._moveWindowButtons(window);
  }

  _initCreateNewButton(window) {
    const button = window.document.getElementById('zen-create-new-button');
    button.addEventListener('command', () => {
      if (button.hasAttribute('open')) {
        return;
      }
      const image = button.querySelector('image');
      const popup = window.document.getElementById('zenCreateNewPopup');
      button.setAttribute('open', 'true');
      const handlePopupHidden = () => {
        window.setTimeout(() => {
          button.removeAttribute('open');
        }, 500);
        window.gZenUIManager.motion.animate(
          image,
          { transform: ['rotate(45deg)', 'rotate(0deg)'] },
          { duration: 0.2 }
        );
      };
      popup.addEventListener('popuphidden', handlePopupHidden, { once: true });
      popup.openPopup(button, 'after_start');
      window.gZenUIManager.motion.animate(
        image,
        { transform: ['rotate(0deg)', 'rotate(45deg)'] },
        { duration: 0.2 }
      );
    });
  }

  _moveWindowButtons(window) {
    const windowControls = window.document.getElementsByClassName('titlebar-buttonbox-container');
    const toolboxIcons = window.document.getElementById(
      'zen-sidebar-top-buttons-customization-target'
    );
    if (
      window.AppConstants.platform === 'macosx' ||
      window.matchMedia('(-moz-gtk-csd-reversed-placement)').matches
    ) {
      for (let i = 0; i < windowControls.length; i++) {
        if (i === 0) {
          toolboxIcons.prepend(windowControls[i]);
          continue;
        }
        windowControls[i].remove();
      }
    }
  }

  _hideToolbarButtons(window) {
    const wrapper = window.document.getElementById('zen-sidebar-foot-buttons');
    const elementsToHide = ['new-tab-button'];
    for (let id of elementsToHide) {
      const elem = window.document.getElementById(id);
      if (elem) {
        wrapper.prepend(elem);
      }
    }
  }

  _dispatchResizeEvent(window) {
    window.dispatchEvent(new window.Event('resize'));
  }

  registerToolbarNodes(window) {
    window.CustomizableUI.registerToolbarNode(
      window.document.getElementById('zen-sidebar-top-buttons')
    );
    window.CustomizableUI.registerToolbarNode(
      window.document.getElementById('zen-sidebar-foot-buttons')
    );
  }
})();
