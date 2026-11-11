/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  TaskbarTabs: "moz-src:///browser/components/taskbartabs/TaskbarTabs.sys.mjs",
  TaskbarTabsUtils:
    "moz-src:///browser/components/taskbartabs/TaskbarTabsUtils.sys.mjs",
});

const URLBAR_BUTTON_ID = "taskbar-tabs-button";
const CONTEXT_MENU_ITEM_ID = "context_zen-install-web-app";

// Firefox's "taskbar tab" wording replaced with Zen's "web app" wording.
const URLBAR_BUTTON_L10N_IDS = {
  "taskbar-tab-urlbar-button-open": "zen-web-app-urlbar-button-install",
  "taskbar-tab-urlbar-button-close": "zen-web-app-urlbar-button-uninstall",
};

/**
 * Zen integration for Firefox's web apps (Taskbar Tabs): Zen wording for the
 * URL bar button, and an "Install Page as App" entry in the tab context menu.
 */
class nsZenWebApps {
  /**
   * @param {Window} aWindow - The browser window that just started up.
   */
  onDelayedBrowserStartup(aWindow) {
    if (!aWindow.toolbar.visible) {
      return;
    }
    this.#initUrlbarButton(aWindow);
    if (
      !lazy.PrivateBrowsingUtils.isWindowPrivate(aWindow) &&
      !lazy.TaskbarTabsUtils.isTaskbarTabWindow(aWindow)
    ) {
      this.#initTabContextMenu(aWindow);
    }
  }

  #initUrlbarButton(aWindow) {
    const button = aWindow.document.getElementById(URLBAR_BUTTON_ID);
    if (!button) {
      return;
    }
    const applyZenL10nId = () => {
      const zenId = URLBAR_BUTTON_L10N_IDS[button.getAttribute("data-l10n-id")];
      if (zenId) {
        button.setAttribute("data-l10n-id", zenId);
      }
    };
    applyZenL10nId();
    new aWindow.MutationObserver(applyZenL10nId).observe(button, {
      attributes: true,
      attributeFilter: ["data-l10n-id"],
    });
  }

  #initTabContextMenu(aWindow) {
    const { document } = aWindow;
    const fragment = aWindow.MozXULElement.parseXULToFragment(`
      <menuitem id="${CONTEXT_MENU_ITEM_ID}"
                data-l10n-id="tab-context-zen-install-web-app"
                hidden="true"/>
    `);
    const anchor = document.getElementById("context_moveTabOptions");
    if (anchor) {
      anchor.after(fragment);
    } else {
      document.getElementById("tabContextMenu").appendChild(fragment);
    }

    const item = document.getElementById(CONTEXT_MENU_ITEM_ID);
    item.addEventListener("command", () => {
      const tab = aWindow.TabContextMenu.contextTab;
      if (tab) {
        lazy.TaskbarTabs.moveTabIntoTaskbarTab(tab);
      }
    });
    document
      .getElementById("tabContextMenu")
      .addEventListener("popupshowing", event => {
        if (event.target.id !== "tabContextMenu") {
          return;
        }
        const tab = aWindow.TabContextMenu.contextTab;
        item.hidden = !this.#canInstall(tab);
      });
  }

  /**
   * Mirrors the conditions under which Firefox shows its URL bar button.
   *
   * @param {MozTabbrowserTab} aTab - The tab to check.
   * @returns {boolean} Whether the tab's page can be installed as a web app.
   */
  #canInstall(aTab) {
    if (!aTab || aTab.multiselected || !lazy.TaskbarTabsUtils.isEnabled()) {
      return false;
    }
    if (
      AppConstants.platform === "linux"
        ? !lazy.ShellService.desktopEntryApi
        : AppConstants.platform !== "win"
    ) {
      return false;
    }
    const uri = aTab.linkedBrowser?.currentURI;
    return !!uri && ["http", "https"].includes(uri.scheme);
  }
}

export const ZenWebApps = new nsZenWebApps();
