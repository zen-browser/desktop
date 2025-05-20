{
  class ZenWorkspaceIcons extends MozXULElement {
    constructor() {
      super();
    }

    connectedCallback() {
      if (this.delayConnectedCallback() || this._hasConnected) {
        return;
      }

      this._hasConnected = true;
      window.addEventListener('ZenWorkspacesUIUpdate', this, true);
    }

    #createWorkspaceIcon(workspace) {
      const button = document.createXULElement('toolbarbutton');
      button.setAttribute('class', 'subviewbutton');
      button.setAttribute('tooltiptext', workspace.name);
      button.setAttribute('zen-workspace-id', workspace.uuid);
      const icon = document.createXULElement('label');
      icon.setAttribute('class', 'zen-workspace-icon');
      if (gZenWorkspaces.workspaceHasIcon(workspace)) {
        icon.textContent = workspace.icon;
      } else {
        icon.setAttribute('no-icon', true);
      }
      button.appendChild(icon);
      button.addEventListener('command', this);
      return button;
    }

    async #updateIcons() {
      const workspaces = await gZenWorkspaces._workspaces();
      this.innerHTML = '';
      for (const workspace of workspaces.workspaces) {
        const button = this.#createWorkspaceIcon(workspace);
        this.appendChild(button);
      }
      if (workspaces.workspaces.length <= 1) {
        this.setAttribute('dont-show', 'true');
      } else {
        this.removeAttribute('dont-show');
      }
    }

    on_command(event) {
      const button = event.target;
      const uuid = button.getAttribute('zen-workspace-id');
      if (uuid) {
        gZenWorkspaces.changeWorkspaceWithID(uuid);
      }
    }

    async on_ZenWorkspacesUIUpdate(event) {
      await this.#updateIcons();
      this.activeIndex = event.detail.activeIndex;
    }

    set activeIndex(uuid) {
      const buttons = this.querySelectorAll('toolbarbutton');
      if (!buttons.length) {
        return;
      }
      let i = 0;
      let selected = -1;
      for (const button of buttons) {
        if (button.getAttribute('zen-workspace-id') == uuid) {
          selected = i;
        } else {
          button.removeAttribute('active');
        }
        i++;
      }
      buttons[selected].setAttribute('active', true);
      this.setAttribute('selected', selected);
    }

    get activeIndex() {
      const selected = this.getAttribute('selected');
      const buttons = this.querySelectorAll('toolbarbutton');
      let i = 0;
      for (const button of buttons) {
        if (i == selected) {
          return button.getAttribute('zen-workspace-id');
        }
        i++;
      }
      return null;
    }
  }

  customElements.define('zen-workspace-icons', ZenWorkspaceIcons);
}
