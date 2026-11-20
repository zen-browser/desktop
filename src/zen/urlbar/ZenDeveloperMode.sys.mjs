// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  DevToolsShim: "chrome://devtools-startup/content/DevToolsShim.sys.mjs",
});
ChromeUtils.defineLazyGetter(lazy, "ClipboardHelper", () =>
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper)
);

const ENABLED_PREF = "zen.urlbar.local-developer-mode.enabled";
const POLICY_DISABLED_PREF = "devtools.policy.disabled";
const COMPACT_HIDE_TOOLBAR_PREF = "zen.view.compact.hide-toolbar";
const TOOLS = [
  {
    name: "toolbox",
    id: "",
    icon: "chrome://browser/skin/zen-icons/developer.svg",
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
  #currentAddress;
  #navControls;
  #layoutObserver;
  #resizeObserver;

  init() {
    if (!this.window.gURLBar) {
      return;
    }

    this.listenBrowserTabsProgress();
    this.addEventListener("TabSelect");
    this.addEventListener("SSTabRestoring");
    // Firefox dispatches this event on the browser without bubbling.
    this.addEventListener("EndSwapDocShells", { capture: true });
    Services.prefs.addObserver(ENABLED_PREF, this);
    Services.prefs.addObserver(POLICY_DISABLED_PREF, this);
    Services.prefs.addObserver(COMPACT_HIDE_TOOLBAR_PREF, this);
    this.#navControls = this.document.getElementById(
      "zen-developer-mode-nav-controls"
    );
    this.#layoutObserver = new this.window.MutationObserver(() => {
      this.#updateToolbar(this.window.gBrowser.selectedBrowser?.currentURI);
    });
    this.#layoutObserver.observe(this.document.documentElement, {
      attributeFilter: [
        "zen-single-toolbar",
        "zen-compact-mode",
        "customizing",
        "inDOMFullscreen",
        "inFullscreen",
        "chromehidden",
      ],
    });
    this.observe();
  }

  uninit() {
    if (!this.window.gURLBar) {
      return;
    }
    this.window.gBrowser.removeTabsProgressListener(this);
    Services.prefs.removeObserver(ENABLED_PREF, this);
    Services.prefs.removeObserver(POLICY_DISABLED_PREF, this);
    Services.prefs.removeObserver(COMPACT_HIDE_TOOLBAR_PREF, this);
    this.#layoutObserver.disconnect();
    this.#resizeObserver?.disconnect();
    this.#navControls?.removeEventListener("command", this);
    this.#toolbar?.removeEventListener("command", this);
    this.#toolbar?.remove();
  }

  onLocationChange(browser, webProgress, request, location) {
    if (webProgress.isTopLevel) {
      this.#updateBrowser(browser, location);
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

  on_EndSwapDocShells(event) {
    const browser = event.originalTarget;
    this.#updateBrowser(browser, browser.currentURI);
  }

  observe(subject, topic, pref) {
    const { gBrowser } = this.window;
    if (pref !== COMPACT_HIDE_TOOLBAR_PREF) {
      for (const tab of gBrowser.tabs) {
        this.#updateTab(tab, tab.linkedBrowser?.currentURI);
      }
    }
    this.#updateToolbar(gBrowser.selectedBrowser?.currentURI);
  }

  async on_command(event) {
    const { selectedTab, selectedBrowser } = this.window.gBrowser;
    if (!this.#currentAddress || !this.#isActive(selectedBrowser?.currentURI)) {
      return;
    }

    const { browserCommand, copyAddress, toolId } = event.target.dataset;
    if (copyAddress) {
      lazy.ClipboardHelper.copyString(this.#currentAddress);
      this.window.gZenUIManager.showToast("zen-copy-urls-confirmation", {
        l10nArgs: { count: 1 },
        timeout: 3000,
      });
    } else if (browserCommand) {
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

  #updateBrowser(browser, uri) {
    const { gBrowser } = this.window;
    this.#updateTab(gBrowser.getTabForBrowser(browser), uri);
    if (browser === gBrowser.selectedBrowser) {
      this.#updateToolbar(uri);
    }
  }

  #updateTab(tab, uri) {
    if (!tab) {
      return;
    }

    const active = this.#isActive(uri);
    tab.toggleAttribute("zen-local-development", active);
    const existingBadge = tab.querySelector(".zen-developer-mode-tab-badge");
    if (!active) {
      existingBadge?.remove();
      return;
    }
    if (existingBadge) {
      return;
    }

    const label = tab.querySelector(".tab-label-container");
    if (!label) {
      return;
    }

    const badge = this.document.createXULElement("label");
    badge.className = "zen-developer-mode-tab-badge";
    this.document.l10n.setAttributes(badge, "zen-developer-mode-tab-badge");
    label.after(badge);
  }

  #updateToolbar(uri) {
    const root = this.document.documentElement;
    const stack = this.#isActive(uri)
      ? this.window.gBrowser.selectedBrowser?.parentElement
      : null;
    const showControls =
      stack?.classList.contains("browserStack") &&
      !root.matches('[customizing], [inDOMFullscreen="true"]');
    // Compact hover reveals are temporary. Keep the controls in the same place.
    const useNavBar = Boolean(
      showControls &&
      this.#navControls &&
      !root.matches(
        '[zen-single-toolbar="true"], [inFullscreen], [chromehidden~="toolbar"]'
      ) &&
      !(
        root.getAttribute("zen-compact-mode") === "true" &&
        Services.prefs.getBoolPref(COMPACT_HIDE_TOOLBAR_PREF, false)
      )
    );
    root.toggleAttribute("zen-developer-mode-in-nav-bar", useNavBar);
    if (this.#navControls) {
      if (
        useNavBar &&
        !this.#navControls.querySelector(".zen-developer-mode-controls")
      ) {
        this.#navControls.appendChild(
          this.window.MozXULElement.parseXULToFragment(
            this.#controlsMarkup(false)
          )
        );
        this.#navControls.addEventListener("command", this);
        this.#observeToolbarSize(this.#navControls.closest("toolbar"));
      }
      this.#navControls.hidden = !useNavBar;
    }

    this.#currentAddress = showControls
      ? Services.io.createExposableURI(uri).displaySpec
      : "";
    if (!showControls || useNavBar) {
      this.#toolbar?.remove();
      return;
    }

    this.#toolbar ??= this.#createToolbar();
    if (this.#addressText.textContent !== this.#currentAddress) {
      this.#addressText.textContent = this.#currentAddress;
      this.#address.setAttribute("aria-description", this.#currentAddress);
    }
    if (this.#toolbar.nextElementSibling !== stack) {
      stack.before(this.#toolbar);
    }
  }

  #observeToolbarSize(toolbar) {
    this.#resizeObserver ??= new this.window.ResizeObserver(() => {
      const focused = this.document.activeElement;
      if (
        !focused?.matches(
          ".zen-developer-mode-control, .zen-developer-mode-overflow"
        )
      ) {
        return;
      }

      // Both variants are visible only while the outgoing control has focus.
      // Transfer focus so CSS can hide it.
      const controls = focused.closest(".zen-developer-mode-controls");
      const overflow = controls.querySelector(".zen-developer-mode-overflow");
      const firstShortcut = controls.querySelector(
        ".zen-developer-mode-control"
      );
      if (!overflow.checkVisibility() || !firstShortcut.checkVisibility()) {
        return;
      }

      const target = focused === overflow ? firstShortcut : overflow;
      if (controls.closest('toolbar[keyNav="true"]')) {
        this.window.ToolbarKeyboardNavigator._focusButton(target);
      } else {
        target.focus();
      }
    });
    this.#resizeObserver.observe(toolbar);
  }

  #controlsMarkup(inPage) {
    const focus = inPage ? 'tabindex="0"' : "";
    const actions = [
      {
        command: 'data-copy-address="true"',
        l10n: "zen-developer-mode-copy-address",
        icon: "chrome://browser/skin/zen-icons/link.svg",
      },
      ...TOOLS.map(({ id, name, icon }) => ({
        command: `data-tool-id="${id}"`,
        l10n: `zen-developer-mode-shortcut-${name}`,
        icon,
      })),
    ];
    return `<hbox class="zen-developer-mode-controls" align="center">
      <hbox class="zen-developer-mode-shortcuts" align="center">
        ${actions
          .map(
            ({ command, l10n, icon }) => `
          <toolbarbutton class="toolbarbutton-1 zen-developer-mode-control" ${focus}
                         style="list-style-image: url(${icon})" ${command} data-l10n-id="${l10n}"/>
        `
          )
          .join("")}
      </hbox>
      <toolbarbutton class="toolbarbutton-1 zen-developer-mode-overflow" ${focus}
                     type="menu" data-l10n-id="zen-developer-mode-overflow">
        <box class="zen-developer-mode-menu-indicator" aria-hidden="true">
          <image/>
        </box>
        <menupopup>
          ${actions.map(({ command, l10n }) => `<menuitem ${command} data-l10n-id="${l10n}"/>`).join("")}
        </menupopup>
      </toolbarbutton>
    </hbox>`;
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
        ${this.#controlsMarkup(true)}
      </hbox>
    `;
    const toolbar =
      this.window.MozXULElement.parseXULToFragment(markup).firstElementChild;
    this.#address = toolbar.firstElementChild;
    this.#addressText = this.#address.querySelector(".zen-developer-mode-url");
    toolbar.addEventListener("command", this);
    this.#observeToolbarSize(toolbar);
    return toolbar;
  }
}
