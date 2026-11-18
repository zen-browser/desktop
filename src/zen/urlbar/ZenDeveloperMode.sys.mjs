// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  DevToolsShim: "chrome://devtools-startup/content/DevToolsShim.sys.mjs",
});

const ENABLED_PREF = "zen.urlbar.local-developer-mode.enabled";
const POLICY_DISABLED_PREF = "devtools.policy.disabled";
const TOOLS = [
  {
    name: "toolbox",
    id: "",
    icon: "chrome://browser/skin/zen-icons/selectable/code.svg",
  },
  {
    name: "inspector",
    id: "inspector",
    icon: "chrome://devtools/skin/images/tool-inspector.svg",
  },
  {
    name: "console",
    id: "webconsole",
    icon: "chrome://devtools/skin/images/tool-webconsole.svg",
  },
  {
    name: "network",
    id: "netmonitor",
    icon: "chrome://devtools/skin/images/tool-network.svg",
  },
];

export function isLocalDevelopmentURI(uri) {
  if (!uri || (!uri.schemeIs("http") && !uri.schemeIs("https"))) {
    return false;
  }
  return ["localhost", "127.0.0.1", "::1"].includes(uri.asciiHost);
}

export class ZenDeveloperMode extends ZenUIComponent {
  #toolbar;
  #address;
  #addressText;

  init() {
    if (!this.window.gURLBar) {
      return;
    }

    this.listenBrowserTabsProgress();
    this.addEventListener("TabSelect");
    this.addEventListener("SSTabRestoring");
    Services.prefs.addObserver(ENABLED_PREF, this);
    Services.prefs.addObserver(POLICY_DISABLED_PREF, this);
    this.observe();
  }

  uninit() {
    if (!this.window.gURLBar) {
      return;
    }
    this.window.gBrowser.removeTabsProgressListener(this);
    Services.prefs.removeObserver(ENABLED_PREF, this);
    Services.prefs.removeObserver(POLICY_DISABLED_PREF, this);
    this.#toolbar?.removeEventListener("command", this);
    this.#toolbar?.remove();
  }

  onLocationChange(browser, webProgress, request, location) {
    if (!webProgress.isTopLevel) {
      return;
    }
    const { gBrowser } = this.window;
    this.#updateTab(gBrowser.getTabForBrowser(browser), location);
    if (browser === gBrowser.selectedBrowser) {
      this.#updateToolbar(location);
    }
  }

  on_TabSelect() {
    const { selectedTab, selectedBrowser } = this.window.gBrowser;
    const uri = selectedBrowser?.currentURI;
    this.#updateTab(selectedTab, uri);
    this.#updateToolbar(uri);
  }

  on_SSTabRestoring(event) {
    const tab = event.target;
    this.#updateTab(tab, tab.linkedBrowser?.currentURI);
  }

  observe() {
    const { gBrowser } = this.window;
    for (const tab of gBrowser.tabs) {
      this.#updateTab(tab, tab.linkedBrowser?.currentURI);
    }
    this.#updateToolbar(gBrowser.selectedBrowser?.currentURI);
  }

  async on_command(event) {
    const { selectedTab, selectedBrowser } = this.window.gBrowser;
    if (!this.#isActive(selectedBrowser?.currentURI)) {
      return;
    }

    const { browserCommand, toolId } = event.target.dataset;
    if (browserCommand) {
      this.document.getElementById(browserCommand).doCommand();
    } else if (toolId !== undefined) {
      try {
        await lazy.DevToolsShim.showToolboxForTab(selectedTab, {
          toolId: toolId || undefined,
        });
      } catch (error) {
        console.error("Unable to open Developer Tools", error);
      }
    }
  }

  #isActive(uri) {
    return (
      Services.prefs.getBoolPref(ENABLED_PREF, true) &&
      !Services.prefs.getBoolPref(POLICY_DISABLED_PREF, false) &&
      isLocalDevelopmentURI(uri)
    );
  }

  #updateTab(tab, uri) {
    if (!tab) {
      return;
    }

    const active = this.#isActive(uri);
    if (tab.hasAttribute("zen-local-development") === active) {
      return;
    }

    tab.toggleAttribute("zen-local-development", active);
    if (!active) {
      tab.querySelector(".zen-developer-mode-tab-badge")?.remove();
      return;
    }

    const badge = this.document.createXULElement("label");
    badge.className = "zen-developer-mode-tab-badge";
    this.document.l10n.setAttributes(badge, "zen-developer-mode-tab-badge");
    tab.querySelector(".tab-label-container")?.after(badge);
  }

  #updateToolbar(uri) {
    const stack = this.#isActive(uri)
      ? this.window.gBrowser.selectedBrowser?.parentElement
      : null;
    if (!stack?.classList.contains("browserStack")) {
      this.#toolbar?.remove();
      return;
    }

    this.#toolbar ??= this.#createToolbar();
    const address = Services.io.createExposableURI(uri).displaySpec;
    this.#addressText.textContent = address;
    this.#address.setAttribute("aria-description", address);
    if (this.#toolbar.nextElementSibling !== stack) {
      stack.before(this.#toolbar);
    }
  }

  #createToolbar() {
    const markup = `
      <hbox id="zen-developer-mode-toolbar" role="group"
            data-l10n-id="zen-developer-mode-toolbar">
        <toolbarbutton id="zen-developer-mode-address" class="tabbable"
                       tabindex="0" crop="end"
                       data-browser-command="Browser:OpenLocation"
                       data-l10n-id="zen-developer-mode-edit-address">
          <box class="zen-developer-mode-address-content">
            <html:span class="zen-developer-mode-url"/>
          </box>
        </toolbarbutton>
        <toolbarbutton class="tabbable zen-developer-mode-icon" tabindex="0"
                       style="--zen-developer-mode-icon-image: url(chrome://browser/skin/zen-icons/link.svg)"
                       data-browser-command="cmd_zenCopyCurrentURL"
                       data-l10n-id="zen-developer-mode-copy-address">
          <box class="zen-developer-mode-glyph" aria-hidden="true"/>
        </toolbarbutton>
        <hbox class="zen-developer-mode-tools">
          ${TOOLS.map(
            ({ name, id, icon }) =>
              `<toolbarbutton class="tabbable zen-developer-mode-icon" tabindex="0"
                              style="--zen-developer-mode-icon-image: url(${icon})"
                              data-tool-id="${id}" data-l10n-id="zen-developer-mode-shortcut-${name}">
               <box class="zen-developer-mode-glyph" aria-hidden="true"/>
             </toolbarbutton>`
          ).join("")}
        </hbox>
      </hbox>
    `;
    const toolbar =
      this.window.MozXULElement.parseXULToFragment(markup).firstElementChild;
    this.#address = toolbar.firstElementChild;
    this.#addressText = this.#address.querySelector(".zen-developer-mode-url");
    toolbar.addEventListener("command", this);
    return toolbar;
  }
}
