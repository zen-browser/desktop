// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class ZenWorkspace extends MozXULElement {
    static get markup() {
      return `
        <vbox class="zen-workspace-tabs-section zen-current-workspace-indicator" flex="1">
          <hbox class="zen-current-workspace-indicator-icon"></hbox>
          <hbox class="zen-current-workspace-indicator-name"></hbox>
        </vbox>
        <arrowscrollbox orient="vertical" class="workspace-arrowscrollbox">
          <vbox class="zen-workspace-tabs-section zen-workspace-pinned-tabs-section">
            <html:div class="vertical-pinned-tabs-container-separator"></html:div>
          </vbox>
          <vbox class="zen-workspace-tabs-section zen-workspace-normal-tabs-section">
            <!-- Let it me as an ID to mantain compatibility with firefox's tabbrowser -->
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

      this.dispatchEvent(
        new CustomEvent('ZenWorkspaceAttached', {
          bubbles: true,
          composed: true,
          detail: { workspace: this },
        })
      );
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
  }

  customElements.define('zen-workspace', ZenWorkspace);
}
