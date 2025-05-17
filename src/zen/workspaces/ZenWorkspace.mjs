{
  class ZenWorkspace extends MozXULElement {
    static get markup() {
      return `
        <vbox class="zen-workspace-tabs-section zen-current-workspace-indicator" flex="1">
          <hbox class="zen-current-workspace-indicator-icon"></hbox>
          <hbox class="zen-current-workspace-indicator-name"></hbox>
        </vbox>
        <arrowscrollbox orient="vertical" tabindex="-1">
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
      if (this.delayConnectedCallback()) {
        return;
      }

      this.appendChild(this.constructor.fragment);

      this.tabsContainer = this.querySelector('.zen-workspace-normal-tabs-section');
      this.indicator = this.querySelector('.zen-current-workspace-indicator');
      this.pinnedTabsContainer = this.querySelector('.zen-workspace-pinned-tabs-section');
      this.initializeAttributeInheritance();

      this.scrollbox = this.querySelector('arrowscrollbox');

      // Add them manually since attribute inheritance doesn't work
      // for multiple layers of shadow DOM.
      this.tabsContainer.setAttribute('zen-workspace-id', this.id);
      this.pinnedTabsContainer.setAttribute('zen-workspace-id', this.id);

      this.dispatchEvent(
        new CustomEvent('ZenWorkspaceAttached', {
          bubbles: true,
          composed: true,
          detail: { workspace: this },
        })
      );
    }
  }

  customElements.define('zen-workspace', ZenWorkspace);
}
