// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class nsZenWorkspaceCreation extends MozXULElement {
    #wasInCollapsedMode = false;

    promiseInitialized = new Promise((resolve) => {
      this.resolveInitialized = resolve;
    });

    #hiddenElements = [];

    static get elementsToDisable() {
      return [
        'cmd_zenOpenWorkspacePanel',
        'cmd_zenOpenWorkspaceCreation',
        'cmd_zenToggleSidebar',
        'cmd_newNavigatorTab',
        'cmd_newNavigatorTabNoEvent',
      ];
    }

    static get markup() {
      return `
        <vbox class="zen-workspace-creation" flex="1">
          <form>
            <vbox>
              <html:h1 data-l10n-id="zen-workspace-creation-header" class="zen-workspace-creation-title" />
              <html:div>
                <label data-l10n-id="zen-workspace-creation-label" class="zen-workspace-creation-label" />
              </html:div>
            </vbox>
            <vbox class="zen-workspace-creation-form">
              <hbox class="zen-workspace-creation-name-wrapper">
                <toolbarbutton class="zen-workspace-creation-icon-label" />
                <html:input
                  class="zen-workspace-creation-name"
                  type="text"
                  data-l10n-id="zen-workspace-creation-name" />
              </hbox>
              <hbox class="zen-workspace-creation-profile-wrapper">
                <label class="zen-workspace-creation-profile-label" data-l10n-id="zen-workspace-creation-profile" />
                <button class="zen-workspace-creation-profile" />
              </hbox>
              <button
                class="zen-workspace-creation-edit-theme-button"
                data-l10n-id="zen-workspaces-change-theme"
                command="cmd_zenOpenZenThemePicker" />
              <menupopup class="zen-workspace-creation-profiles-popup" />
            </vbox>
            <vbox class="zen-workspace-creation-buttons">
              <html:div>
                <button class="zen-workspace-creation-create-button footer-button primary"
                  data-l10n-id="zen-panel-ui-workspaces-create" disabled="true" />
              </html:div>
              <button class="zen-workspace-creation-cancel-button footer-button"
                data-l10n-id="zen-general-cancel-label" />
            </vbox>
          </form>
        </vbox>
      `;
    }

    get workspaceId() {
      return this.getAttribute('workspace-id');
    }

    get previousWorkspaceId() {
      return this.getAttribute('previous-workspace-id');
    }

    get elementsToAnimate() {
      return [
        this.querySelector('.zen-workspace-creation-title'),
        this.querySelector('.zen-workspace-creation-label').parentElement,
        this.querySelector('.zen-workspace-creation-name-wrapper'),
        this.querySelector('.zen-workspace-creation-profile-wrapper'),
        this.querySelector('.zen-workspace-creation-edit-theme-button'),
        this.createButton.parentNode,
        this.cancelButton,
      ];
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        // If we are not ready yet, or if we have already connected, we
        // don't need to do anything.
        return;
      }

      this.appendChild(this.constructor.fragment);
      this.initializeAttributeInheritance();

      this.inputName = this.querySelector('.zen-workspace-creation-name');
      this.inputIcon = this.querySelector('.zen-workspace-creation-icon-label');
      this.inputProfile = this.querySelector('.zen-workspace-creation-profile');
      this.createButton = this.querySelector('.zen-workspace-creation-create-button');
      this.cancelButton = this.querySelector('.zen-workspace-creation-cancel-button');

      for (const element of this.elementsToAnimate) {
        element.style.opacity = 0;
      }

      this.#wasInCollapsedMode =
        document.documentElement.getAttribute('zen-sidebar-expanded') !== 'true';

      gNavToolbox.setAttribute('zen-sidebar-expanded', 'true');
      document.documentElement.setAttribute('zen-sidebar-expanded', 'true');

      window.docShell.treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIAppWindow)
        .rollupAllPopups();

      this.handleZenWorkspacesChangeBind = this.handleZenWorkspacesChange.bind(this);

      for (const element of this.parentElement.children) {
        if (element !== this) {
          element.hidden = true;
          this.#hiddenElements.push(element);
        }
      }

      for (const element of nsZenWorkspaceCreation.elementsToDisable) {
        const el = document.getElementById(element);
        if (el) {
          el.setAttribute('disabled', 'true');
        }
      }

      this.createButton.addEventListener('command', this.onCreateButtonCommand.bind(this));
      this.cancelButton.addEventListener('command', this.onCancelButtonCommand.bind(this));

      this.inputName.addEventListener('input', () => {
        this.createButton.disabled = !this.inputName.value.trim();
      });

      this.inputIcon.addEventListener('command', this.onIconCommand.bind(this));

      this.profilesPopup = this.querySelector('.zen-workspace-creation-profiles-popup');

      if (gZenWorkspaces.shouldShowContainers) {
        this.inputProfile.addEventListener('command', this.onProfileCommand.bind(this));
        this.profilesPopup.addEventListener('popupshown', this.onProfilePopupShown.bind(this));
        this.profilesPopup.addEventListener('command', this.onProfilePopupCommand.bind(this));

        this.currentProfile = {
          id: 0,
          name: 'Default',
        };
      } else {
        this.inputProfile.parentNode.hidden = true;
      }

      document.getElementById('zen-sidebar-splitter').style.pointerEvents = 'none';

      gZenUIManager.motion
        .animate(
          [gBrowser.tabContainer, gURLBar.textbox],
          {
            opacity: [1, 0],
          },
          {
            duration: 0.3,
            type: 'spring',
            bounce: 0,
          }
        )
        .then(() => {
          gBrowser.tabContainer.style.visibility = 'collapse';
          if (gZenVerticalTabsManager._hasSetSingleToolbar) {
            document.getElementById('nav-bar').style.visibility = 'collapse';
          }
          this.style.visibility = 'visible';
          gZenCompactModeManager.getAndApplySidebarWidth();
          this.resolveInitialized();
          gZenUIManager.motion
            .animate(
              this.elementsToAnimate,
              {
                y: [20, 0],
                opacity: [0, 1],
                filter: ['blur(2px)', 'blur(0)'],
              },
              {
                duration: 0.6,
                type: 'spring',
                bounce: 0,
                delay: gZenUIManager.motion.stagger(0.05, { startDelay: 0.2 }),
              }
            )
            .then(() => {
              this.inputName.focus();
              gZenWorkspaces.workspaceElement(this.workspaceId).hidden = false;
            });
        });
    }

    async onCreateButtonCommand() {
      const workspace = await gZenWorkspaces.getActiveWorkspace();
      workspace.name = this.inputName.value.trim();
      workspace.icon = this.inputIcon.label || undefined;
      workspace.containerTabId = this.currentProfile;
      await gZenWorkspaces.saveWorkspace(workspace);

      await this.#cleanup();

      await gZenWorkspaces._organizeWorkspaceStripLocations(workspace, true);
      await gZenWorkspaces.updateTabsContainers();

      gBrowser.tabContainer._invalidateCachedTabs();
    }

    async onCancelButtonCommand() {
      await gZenWorkspaces.changeWorkspaceWithID(this.previousWorkspaceId);
    }

    onIconCommand(event) {
      gZenEmojiPicker
        .open(event.target)
        .then(async (emoji) => {
          this.inputIcon.label = emoji || '';
        })
        .catch((error) => {
          console.warn('Error changing workspace icon:', error);
        });
    }

    set currentProfile(profile) {
      this.inputProfile.label = profile.name;
      this._profileId = profile.id;
    }

    get currentProfile() {
      return this._profileId;
    }

    onProfileCommand(event) {
      this.profilesPopup.openPopup(event.target, 'after_start');
    }

    onProfilePopupShown(event) {
      return window.createUserContextMenu(event, {
        isContextMenu: true,
        showDefaultTab: true,
      });
    }

    onProfilePopupCommand(event) {
      let userContextId = parseInt(event.target.getAttribute('data-usercontextid'));
      if (isNaN(userContextId)) {
        return;
      }
      this.currentProfile = {
        id: userContextId,
        name: event.target.label,
      };
    }

    finishSetup() {
      gZenWorkspaces.addChangeListeners(this.handleZenWorkspacesChangeBind, { once: true });
    }

    async handleZenWorkspacesChange() {
      await gZenWorkspaces.removeWorkspace(this.workspaceId);
      await this.#cleanup();
    }

    async #cleanup() {
      await gZenUIManager.motion.animate(
        this.elementsToAnimate.reverse(),
        {
          y: [0, 20],
          opacity: [1, 0],
          filter: ['blur(0)', 'blur(2px)'],
        },
        {
          duration: 0.4,
          type: 'spring',
          bounce: 0,
          delay: gZenUIManager.motion.stagger(0.05),
        }
      );

      document.getElementById('zen-sidebar-splitter').style.pointerEvents = '';

      gZenWorkspaces.removeChangeListeners(this.handleZenWorkspacesChangeBind);
      for (const element of this.constructor.elementsToDisable) {
        const el = document.getElementById(element);
        if (el) {
          el.removeAttribute('disabled');
        }
      }

      if (this.#wasInCollapsedMode) {
        gNavToolbox.removeAttribute('zen-sidebar-expanded');
        document.documentElement.removeAttribute('zen-sidebar-expanded');
      }

      document.documentElement.removeAttribute('zen-creating-workspace');

      gBrowser.tabContainer.style.visibility = '';
      gBrowser.tabContainer.style.opacity = 0;
      if (gZenVerticalTabsManager._hasSetSingleToolbar) {
        document.getElementById('nav-bar').style.visibility = '';
        gURLBar.textbox.style.opacity = 0;
      }

      this.remove();
      gZenUIManager.updateTabsToolbar();

      const workspace = await gZenWorkspaces.getActiveWorkspace();
      await gZenWorkspaces._organizeWorkspaceStripLocations(workspace, true);
      await gZenWorkspaces.updateTabsContainers();

      await gZenUIManager.motion.animate(
        [gBrowser.tabContainer, gURLBar.textbox],
        {
          opacity: [0, 1],
        },
        {
          duration: 0.3,
          type: 'spring',
          bounce: 0,
        }
      );

      gBrowser.tabContainer.style.opacity = '';
      if (gZenVerticalTabsManager._hasSetSingleToolbar) {
        gURLBar.textbox.style.opacity = '';
      }

      for (const element of this.#hiddenElements) {
        element.hidden = false;
      }

      this.#hiddenElements = [];
    }
  }

  customElements.define('zen-workspace-creation', nsZenWorkspaceCreation);
}
