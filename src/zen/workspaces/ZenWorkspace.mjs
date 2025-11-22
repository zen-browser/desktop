// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class nsZenWorkspace extends MozXULElement {
    static get markup() {
      return `
        <vbox class="zen-workspace-tabs-section zen-current-workspace-indicator" flex="1" context="zenWorkspaceMoreActions">
          <hbox class="zen-current-workspace-indicator-icon" />
          <label class="zen-current-workspace-indicator-name" flex="1" />
          <toolbarbutton class="toolbarbutton-1 chromeclass-toolbar-additional zen-workspaces-actions" context="zenWorkspaceMoreActions" />
        </vbox>
        <arrowscrollbox orient="vertical" class="workspace-arrowscrollbox">
          <vbox class="zen-workspace-tabs-section zen-workspace-pinned-tabs-section" hide-separator="true">
            <hbox class="pinned-tabs-container-separator">
              <toolbarseparator flex="1" />
              <toolbarbutton command="cmd_zenGroupTabs"
                             class="zen-workspace-group-tabs-button toolbarbutton-1">
                <div class="zen-group-icon-container" style="display: grid; place-items: center; margin-inline-end: 5px;">
                  <svg height="16px" width="16px" class="zen-group-loading-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="grid-area: 1 / 1;">
                    <g>
                      <path d="M12 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M12 18V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M4.92999 4.92999L7.75999 7.75999" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M16.24 16.24L19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M2 12H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M18 12H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M4.92999 19.07L7.75999 16.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M16.24 7.75999L19.07 4.92999" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                    </g>
                  </svg>
                  <svg height="16px" width="16px" viewBox="0 0 512 512" class="zen-group-icon" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="grid-area: 1 / 1;">
                    <path d="m153.654 18l52.57 134.734c1.698 3.994 4.05 5.83 7.243 6.977c3.2 1.15 7.36 1.2 11.058.17s6.71-3.146 7.996-4.915c1.288-1.77 1.634-2.564.505-5.24l-.046-.112L181.57 18zm94.168 120.143l1.88 4.81l-.09-.223c3.346 7.937 1.828 16.822-2.532 22.82c-4.36 5.996-10.773 9.734-17.723 11.67c-6.95 1.937-14.653 2.065-21.98-.57s-14.155-8.447-17.742-16.923l-.05-.118l-1.757-4.5c-31.31 19.804-42.47 42.026-35.367 68.89c1.24 4.681 3.422 12.364 5.964 22.13c74.37-5.274 139.945-23.872 199.808-51.6c-10.297-13.867-22.5-25.83-38.232-34.53c-20.505-11.34-47.652-20.157-72.178-21.857zm120.557 71.52c-61.497 28.81-129.173 48.378-205.575 54.196c2.03 8.683 4.08 18.28 5.95 28.495c89.592-10.084 163.043-26.22 217.755-48.767c-5.743-11.72-11.593-23.19-18.13-33.924m26.04 50.16c-57.093 23.772-131.99 40.087-222.73 50.322C180.697 371.423 179.614 446.752 128 480c16.27 0 31.892-.152 46.926-.45c17.84-25.554 31.27-66.222 32.08-86.146c8.27 16.793 3.297 59.32-5.36 85.434c2.735-.093 5.435-.193 8.127-.297c11.824-12.397 11.724-28.632 14.72-47.284c3.324 14.92 7 32.967 9.505 46.156c11.273-.616 22.152-1.34 32.606-2.183c16.38-20.358 21.65-49.604 18.63-85.48c4.226 29.1 9.116 62.138 11.873 82.55a772 772 0 0 0 27.807-3.614c5.04-18.787-4.1-48.444-2.072-69.54c11.123 43.113 22.247 55.45 33.37 64.043a456 456 0 0 0 15.733-3.526c-4.7-13.95 1.573-22.497 1.18-39.986c5.647 18.99 14.625 26.958 24.428 32.816c6.506-2.1 12.66-4.336 18.492-6.697c-10.538-6.57-10.113-26.374-12.38-42.926c5.954 21.703 14.413 32.418 24.083 37.816c29.124-13.8 48.69-31.534 60.398-53.657c-9.078-3.82-18.674-13.002-28.068-20.092c13.214 7.477 23.684 10.614 32.37 10.93a112 112 0 0 0 3.552-9.868c-56.326-19.528-80.07-64.018-101.58-108.178z"/>
                  </svg>
                </div>
                <label data-l10n-id="zen-workspaces-group-tabs-title">Group</label>
              </toolbarbutton>
              <toolbarbutton command="cmd_zenCloseUnpinnedTabs"
                             tooltip="dynamic-shortcut-tooltip"
                             data-l10n-id="zen-workspaces-close-all-unpinned-tabs-title"
                             class="zen-workspace-close-unpinned-tabs-button" />
            </hbox>
          </vbox>
          <vbox class="zen-workspace-tabs-section zen-workspace-normal-tabs-section">
            <!-- Let it as an ID to mantain compatibility with firefox's tabbrowser -->
            <hbox id="tabbrowser-arrowscrollbox-periphery">
              <toolbartabstop/>
              <toolbarbutton id="tabs-newtab-button"
                             class="toolbarbutton-1"
                             command="cmd_newNavigatorTab"
                             tooltip="dynamic-shortcut-tooltip"
                             data-l10n-id="tabs-toolbar-new-tab"/>
              <spacer class="closing-tabs-spacer" style="width: 0;"/>
            </hbox>
          </vbox>
        </arrowscrollbox>
        <vbox class="zen-workspace-empty-space" flex="1" />
      `;
    }

    static get inheritedAttributes() {
      return {
        '.zen-workspace-tabs-section': 'zen-workspace-id=id',
      };
    }

    constructor() {
      super();
    }

    connectedCallback() {
      if (this.delayConnectedCallback() || this._hasConnected) {
        // If we are not ready yet, or if we have already connected, we
        // don't need to do anything.
        return;
      }

      this._hasConnected = true;
      this.appendChild(this.constructor.fragment);

      this.tabsContainer = this.querySelector('.zen-workspace-normal-tabs-section');
      this.indicator = this.querySelector('.zen-current-workspace-indicator');
      this.pinnedTabsContainer = this.querySelector('.zen-workspace-pinned-tabs-section');
      this.initializeAttributeInheritance();

      this.scrollbox = this.querySelector('arrowscrollbox');
      this.scrollbox.smoothScroll = Services.prefs.getBoolPref(
        'zen.startup.smooth-scroll-in-tabs',
        false
      );

      this.scrollbox.addEventListener('wheel', this, true);
      this.scrollbox.addEventListener('underflow', this);
      this.scrollbox.addEventListener('overflow', this);

      this.indicator.querySelector('.zen-current-workspace-indicator-name').onRenameFinished =
        this.onIndicatorRenameFinished.bind(this);

      this.pinnedTabsContainer.scrollbox = this.scrollbox;

      this.indicator
        .querySelector('.zen-workspaces-actions')
        .addEventListener('click', this.onActionsCommand.bind(this));

      this.indicator
        .querySelector('.zen-current-workspace-indicator-icon')
        .addEventListener('dblclick', (event) => {
          event.stopPropagation();
          gZenWorkspaces.changeWorkspaceIcon();
        });

      this.scrollbox._getScrollableElements = () => {
        const children = [...this.pinnedTabsContainer.children, ...this.tabsContainer.children];
        if (Services.prefs.getBoolPref('zen.view.show-newtab-button-top', false)) {
          // Move the perifery to the first non-pinned tab
          const periphery = this.tabsContainer.querySelector(
            '#tabbrowser-arrowscrollbox-periphery'
          );
          if (periphery) {
            const firstNonPinnedTabIndex = children.findIndex(
              (child) => gBrowser.isTab(child) && !child.pinned
            );
            if (firstNonPinnedTabIndex > -1) {
              // Change to new location and remove from the old one on the list
              const peripheryIndex = children.indexOf(periphery);
              if (peripheryIndex > -1) {
                children.splice(peripheryIndex, 1);
              }
              children.splice(firstNonPinnedTabIndex, 0, periphery);
            }
          }
        }
        return Array.prototype.filter.call(
          children,
          this.scrollbox._canScrollToElement,
          this.scrollbox
        );
      };

      this.scrollbox._canScrollToElement = (element) => {
        if (gBrowser.isTab(element)) {
          return (
            !element.hasAttribute('zen-essential') &&
            !this.hasAttribute('positionpinnedtabs') &&
            !element.hasAttribute('zen-empty-tab')
          );
        }
        return true;
      };

      // Override for performance reasons. This is the size of a single element
      // that can be scrolled when using mouse wheel scrolling. If we don't do
      // this then arrowscrollbox computes this value by calling
      // _getScrollableElements and dividing the box size by that number.
      // However in the tabstrip case we already know the answer to this as,
      // when we're overflowing, it is always the same as the tab min width or
      // height. For tab group labels, the number won't exactly match, but
      // that shouldn't be a problem in practice since the arrowscrollbox
      // stops at element bounds when finishing scrolling.
      try {
        Object.defineProperty(this.scrollbox, 'lineScrollAmount', {
          get: () => 36,
        });
      } catch (e) {
        console.warn('Failed to set lineScrollAmount', e);
      }

      // Add them manually since attribute inheritance doesn't work
      // for multiple layers of shadow DOM.
      this.tabsContainer.setAttribute('zen-workspace-id', this.id);
      this.pinnedTabsContainer.setAttribute('zen-workspace-id', this.id);

      this.#updateOverflow();

      this.onGradientCacheChanged = this.#onGradientCacheChanged.bind(this);
      window.addEventListener('ZenGradientCacheChanged', this.onGradientCacheChanged);

      this.onGroupingStart = this.#onGroupingStart.bind(this);
      this.onGroupingEnd = this.#onGroupingEnd.bind(this);
      window.addEventListener('ZenGroupingTabsStart', this.onGroupingStart);
      window.addEventListener('ZenGroupingTabsEnd', this.onGroupingEnd);

      this.dispatchEvent(
        new CustomEvent('ZenWorkspaceAttached', {
          bubbles: true,
          composed: true,
          detail: { workspace: this },
        })
      );
    }

    disconnectedCallback() {
      window.removeEventListener('ZenGradientCacheChanged', this.onGradientCacheChanged);
      window.removeEventListener('ZenGroupingTabsStart', this.onGroupingStart);
      window.removeEventListener('ZenGroupingTabsEnd', this.onGroupingEnd);
    }

    get active() {
      return this.hasAttribute('active');
    }

    set active(value) {
      if (value) {
        this.setAttribute('active', 'true');
      } else {
        this.removeAttribute('active');
      }
      this.#updateOverflow();
    }

    #updateOverflow() {
      if (!this.scrollbox) return;
      if (this.overflows) {
        this.#dispatchEventFromScrollbox('overflow');
      } else {
        this.#dispatchEventFromScrollbox('underflow');
      }
    }

    #dispatchEventFromScrollbox(type) {
      this.scrollbox.dispatchEvent(new CustomEvent(type, {}));
    }

    get overflows() {
      return this.scrollbox.overflowing;
    }

    handleEvent(event) {
      if (this.active) {
        gBrowser.tabContainer.handleEvent(event);
      }
    }

    get workspaceUuid() {
      return this.id;
    }

    async onIndicatorRenameFinished(newName) {
      if (newName === '') {
        return;
      }
      let workspaces = (await gZenWorkspaces._workspaces()).workspaces;
      let workspaceData = workspaces.find((workspace) => workspace.uuid === this.workspaceUuid);
      workspaceData.name = newName;
      await gZenWorkspaces.saveWorkspace(workspaceData);
      this.indicator.querySelector('.zen-current-workspace-indicator-name').textContent = newName;
      gZenUIManager.showToast('zen-workspace-renamed-toast');
    }

    onActionsCommand(event) {
      event.stopPropagation();
      const popup = document.getElementById('zenWorkspaceMoreActions');
      const target = event.target;
      target.setAttribute('open', 'true');
      this.indicator.setAttribute('open', 'true');
      const handlePopupHidden = (event) => {
        if (event.target !== popup) return;
        target.removeAttribute('open');
        this.indicator.removeAttribute('open');
        popup.removeEventListener('popuphidden', handlePopupHidden);
      };
      popup.addEventListener('popuphidden', handlePopupHidden);
      popup.openPopup(event.target, 'after_start');
    }

    get groupTabsButton() {
      return this.querySelector('.zen-workspace-group-tabs-button');
    }

    #onGroupingStart() {
      if (!this.groupTabsButton) return;
      this.groupTabsButton.setAttribute('disabled', 'true');
      this.groupTabsButton.setAttribute('grouping', 'true');
    }

    #onGroupingEnd() {
      if (!this.groupTabsButton) return;
      this.groupTabsButton.removeAttribute('disabled');
      this.groupTabsButton.removeAttribute('grouping');
    }

    get newTabButton() {
      return this.querySelector('#tabs-newtab-button');
    }

    #onGradientCacheChanged() {
      const { isDarkMode, isExplicitMode, toolbarColor, primaryColor } =
        gZenThemePicker.getGradientForWorkspace(
          gZenWorkspaces.getWorkspaceFromId(this.workspaceUuid)
        );
      if (isExplicitMode) {
        this.style.colorScheme = isDarkMode ? 'dark' : 'light';
      } else {
        this.style.colorScheme = '';
      }
      this.style.setProperty('--toolbox-textcolor', `rgba(${toolbarColor.join(',')})`);
      this.style.setProperty('--zen-primary-color', primaryColor);
    }

    clearThemeStyles() {
      this.style.colorScheme = '';
      this.style.removeProperty('--toolbox-textcolor');
      this.style.removeProperty('--zen-primary-color');
    }
  }

  customElements.define('zen-workspace', nsZenWorkspace);
}
