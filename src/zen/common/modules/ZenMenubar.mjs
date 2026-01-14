// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const WINDOW_SCHEME_PREF = "zen.view.window.scheme";
const WINDOW_SCHEME_MAPPING = {
  dark: 0,
  light: 1,
  auto: 2,
};

class nsZenMenuBar {
  init() {
    this.#initViewMenu();
    this.#initSpacesMenu();
  }

  #initViewMenu() {
    let appearanceMenu = window.MozXULElement.parseXULToFragment(`
      <menu data-l10n-id="zen-menubar-appearance">
        <menupopup>
          <menuitem data-l10n-id="zen-menubar-appearance-description" disabled="true" />
          <menuitem data-l10n-id="zen-menubar-appearance-auto" data-type="auto" type="radio" checked="true" />
          <menuitem data-l10n-id="zen-menubar-appearance-light" data-type="light" type="radio" />
          <menuitem data-l10n-id="zen-menubar-appearance-dark" data-type="dark" type="radio" />
        </menupopup>
      </menu>`);
    const menu = appearanceMenu.querySelector("menu");
    menu.addEventListener("command", (event) => {
      const type = event.target.getAttribute("data-type");
      const schemeValue = WINDOW_SCHEME_MAPPING[type];
      Services.prefs.setIntPref(WINDOW_SCHEME_PREF, schemeValue);
    });
    const viewMenu = document.getElementById("view-menu");
    const parentPopup = viewMenu.querySelector("menupopup");
    parentPopup.prepend(document.createXULElement("menuseparator"));
    parentPopup.prepend(menu);

    const sibling = document.getElementById("viewSidebarMenuMenu");
    const togglePinnedItem = window.MozXULElement.parseXULToFragment(
      '<menuitem data-l10n-id="zen-menubar-toggle-pinned-tabs" />'
    ).querySelector("menuitem");
    if (!gZenWorkspaces.privateWindowOrDisabled) {
      sibling.after(togglePinnedItem);
    }

    parentPopup.addEventListener("popupshowing", () => {
      const currentScheme = Services.prefs.getIntPref(WINDOW_SCHEME_PREF);
      for (const [type, value] of Object.entries(WINDOW_SCHEME_MAPPING)) {
        let menuItem = menu.querySelector(`menuitem[data-type="${type}"]`);
        if (value === currentScheme) {
          menuItem.setAttribute("checked", "true");
        } else {
          menuItem.removeAttribute("checked");
        }
      }
      const pinnedAreCollapsed =
        gZenWorkspaces.activeWorkspaceElement?.hasCollapsedPinnedTabs ?? false;
      const args = { pinnedAreCollapsed };
      document.l10n.setArgs(togglePinnedItem, args);
    });

    togglePinnedItem.addEventListener("command", () => {
      gZenWorkspaces.activeWorkspaceElement?.collapsiblePins.toggle();
    });
  }

  #initSpacesMenu() {
    let spacesMenubar = window.MozXULElement.parseXULToFragment(`
      <menu id="zen-spaces-menubar" data-l10n-id="zen-panel-ui-spaces-label">
        <menupopup>
          <menuitem data-l10n-id="zen-panel-ui-workspaces-create" command="cmd_zenOpenWorkspaceCreation"/>
          <menuitem data-l10n-id="zen-workspaces-change-theme" command="cmd_zenOpenZenThemePicker"/>
          <menuitem data-l10n-id="zen-workspaces-panel-change-name" command="cmd_zenChangeWorkspaceName"/>
          <menuitem data-l10n-id="zen-workspaces-panel-change-icon" command="cmd_zenChangeWorkspaceIcon"/>
          <menuseparator/>
          <menuitem 
            data-l10n-id="zen-panel-ui-workspaces-change-forward"
            command="cmd_zenWorkspaceForward"
            key="zen-workspace-forward"/>
          <menuitem
            data-l10n-id="zen-panel-ui-workspaces-change-back"
            command="cmd_zenWorkspaceBack"
            key="zen-workspace-backward"/>
        </menupopup>
      </menu>`);
    document.getElementById("view-menu").after(spacesMenubar);
    document.getElementById("zen-spaces-menubar").addEventListener("popupshowing", () => {
      gZenWorkspaces.updateWorkspacesChangeContextMenu();
    });
  }
}

export const ZenMenubar = new nsZenMenuBar();
