// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const ENABLED_PREF = "zen.developer-mode.enabled";
const MODE_ATTRIBUTE = "zen-developer-mode";
const TOP_TOOLBAR_ATTRIBUTE = "zen-developer-top-toolbar";
const ACTIVE_TOOLBAR_ATTRIBUTE = "zen-developer-top-toolbar-active";

export function isLocalDevelopmentURI(uri) {
  try {
    if (!uri.schemeIs("http") && !uri.schemeIs("https")) {
      return false;
    }
    const host = uri.asciiHost.toLowerCase().replace(/\.$/, "");
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"
    );
  } catch {
    return false;
  }
}

export class ZenDeveloperMode extends ZenUIComponent {
  #ready = false;
  #closed = false;
  #bars = new Map();
  #command = Promise.resolve();
  #nativeTools = null;

  init() {
    for (const type of [
      "TabSelect",
      "TabOpen",
      "SSTabRestored",
      "resize",
      "aftercustomization",
    ]) {
      this.addEventListener(type);
    }
    this.addEventListener("TabClose");
    this.listenBrowserTabsProgress();
    Services.prefs.addObserver(ENABLED_PREF, this);
    this.window.gZenStartup.promiseInitialized.then(() => {
      if (!this.#closed) {
        this.#ready = true;
        this.observe();
      }
    });
  }

  uninit() {
    this.#closed = true;
    Services.prefs.removeObserver(ENABLED_PREF, this);
    this.window.gBrowser.removeTabsProgressListener(this);
    for (const tab of this.window.gBrowser.tabs) {
      this.#removeToolbar(tab);
    }
    this.#nativeTools?.remove();
  }

  observe() {
    for (const tab of this.window.gBrowser.tabs) {
      this.#refreshTab(tab);
    }
    this.#syncLayout();
    if (this.#ready && !this.#closed && !this.window.gURLBar.focused) {
      this.window.gURLBar.setURI();
    }
  }

  on_TabSelect(event) {
    this.#refreshTab(event.target);
    this.#syncLayout();
  }
  on_TabOpen(event) {
    this.#refreshTab(event.target);
  }
  on_SSTabRestored(event) {
    this.#refreshTab(event.target);
    this.#syncLayout();
  }
  on_resize() {
    this.#syncLayout();
  }
  on_aftercustomization() {
    this.#syncLayout();
  }
  on_TabClose(event) {
    this.#removeToolbar(event.target);
  }

  onLocationChange(browser, progress) {
    if (progress?.isTopLevel) {
      this.#refreshTab(this.window.gBrowser.getTabForBrowser(browser));
      if (browser === this.window.gBrowser.selectedBrowser) {
        this.#syncLayout();
      }
    }
  }

  #removeToolbar(tab) {
    this.#bars.get(tab)?.toolbar.remove();
    this.#bars.delete(tab);
    tab.querySelector(".zen-developer-tab-sublabel")?.remove();
    tab.removeAttribute(MODE_ATTRIBUTE);
  }

  #refreshTab(tab) {
    if (!this.#ready || this.#closed || !tab || tab.closing) {
      return;
    }
    const browser = tab.linkedBrowser;
    const active =
      Services.prefs.getBoolPref(ENABLED_PREF, false) &&
      isLocalDevelopmentURI(browser?.currentURI);
    tab.toggleAttribute(MODE_ATTRIBUTE, active);
    if (!active) {
      this.#removeToolbar(tab);
      return;
    }
    let subtitle = tab.querySelector(".zen-developer-tab-sublabel");
    if (!subtitle) {
      subtitle = this.document.createXULElement("label");
      subtitle.className = "zen-developer-tab-sublabel";
      subtitle.setAttribute("role", "presentation");
      subtitle.setAttribute("crop", "end");
      tab.querySelector(".tab-label-container").append(subtitle);
    }
    subtitle.value = browser.currentURI.displayHostPort;
    let bar = this.#bars.get(tab);
    if (!bar?.toolbar.isConnected) {
      const container = browser.closest(".browserStack");
      if (!container) {
        return;
      }
      bar = this.#createToolbar(tab);
      container.prepend(bar.toolbar);
      this.#bars.set(tab, bar);
    }
    if (this.document.activeElement !== bar.input) {
      bar.input.value = browser.currentURI.spec;
    }
  }

  #createToolbar(tab) {
    const toolbar = this.document.createElementNS(HTML_NS, "div");
    toolbar.className = "zen-developer-toolbar";
    toolbar.setAttribute("role", "toolbar");
    this.document.l10n.setAttributes(toolbar, "zen-developer-mode-toolbar");
    toolbar.addEventListener("focusin", (event) => {
      if (this.window.gBrowser.selectedTab !== tab) {
        this.window.gBrowser.selectedTab = tab;
        event.target.focus({ preventScroll: true });
      }
    });
    const input = this.document.createElementNS(HTML_NS, "input");
    input.className = "zen-developer-url";
    input.type = "url";
    input.spellcheck = false;
    input.setAttribute("autocomplete", "off");
    this.document.l10n.setAttributes(input, "zen-developer-mode-url");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        input.value = tab.linkedBrowser.currentURI.spec;
        tab.linkedBrowser.focus();
      } else if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        const value = input.value.trim();
        if (value) {
          const uri = Services.uriFixup.getFixupURIInfo(
            value,
            Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS,
          ).preferredURI;
          this.window.gBrowser.selectedTab = tab;
          this.window.openTrustedLinkIn(uri.spec, "current");
        }
      }
    });
    input.addEventListener("blur", () => {
      input.value = tab.linkedBrowser.currentURI.spec;
    });
    toolbar.append(input);
    this.#appendButtons(toolbar, () => tab);
    return { toolbar, input };
  }

  #appendButtons(toolbar, getTab) {
    const copy = this.#createButton(
      "copy",
      "chrome://global/skin/icons/edit-copy.svg",
    );
    copy.addEventListener("click", () => {
      Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Ci.nsIClipboardHelper)
        .copyString(getTab().linkedBrowser.currentURI.spec);
    });
    const divider = this.document.createElementNS(HTML_NS, "span");
    divider.className = "zen-developer-action-divider";
    divider.setAttribute("aria-hidden", "true");
    toolbar.append(copy, divider);
    for (const [toolId, name, icon] of [
      ["webconsole", "console", "tool-webconsole.svg"],
      ["netmonitor", "network", "tool-network.svg"],
      ["inspector", "inspect", "tool-inspector.svg"],
    ]) {
      const button = this.#createButton(
        name,
        "chrome://devtools/skin/images/" + icon,
      );
      button.dataset.tool = toolId;
      button.addEventListener("click", () => {
        const tab = getTab();
        this.#command = this.#command
          .then(() => this.#toggleTool(tab, toolId))
          .catch(console.error);
      });
      toolbar.append(button);
    }
  }

  #syncLayout() {
    if (!this.#ready || this.#closed) {
      return;
    }
    const { gBrowser, gZenVerticalTabsManager, gURLBar } = this.window;
    const root = this.document.documentElement;
    const top =
      Services.prefs.getBoolPref(ENABLED_PREF, false) &&
      !gZenVerticalTabsManager._hasSetSingleToolbar &&
      !gZenVerticalTabsManager.hidesTabsToolbar;
    const changed = root.hasAttribute(TOP_TOOLBAR_ATTRIBUTE) !== top;
    root.toggleAttribute(TOP_TOOLBAR_ATTRIBUTE, top);
    const active =
      top &&
      gBrowser.selectedTab.hasAttribute(MODE_ATTRIBUTE) &&
      !root.hasAttribute("customizing");
    root.toggleAttribute(ACTIVE_TOOLBAR_ATTRIBUTE, active);
    if (active) {
      this.#ensureNativeTools();
    }
    if (changed && !gURLBar.focused) {
      gURLBar.setURI();
    }
  }

  #ensureNativeTools() {
    if (!this.#nativeTools?.isConnected) {
      const group = this.document.createElementNS(HTML_NS, "div");
      group.id = "zen-developer-nav-tools";
      group.setAttribute("role", "group");
      this.document.l10n.setAttributes(group, "zen-developer-mode-toolbar");
      this.#appendButtons(group, () => this.window.gBrowser.selectedTab);
      this.#nativeTools = group;
    }
    const target = this.document.getElementById("nav-bar-customization-target");
    const urlbar = this.document.getElementById("urlbar-container");
    if (urlbar.parentNode === target) {
      if (this.#nativeTools.previousElementSibling !== urlbar) {
        urlbar.after(this.#nativeTools);
      }
    } else if (this.#nativeTools.parentNode !== target) {
      target.append(this.#nativeTools);
    }
  }

  #createButton(name, icon) {
    const button = this.document.createElementNS(HTML_NS, "button");
    button.className = "zen-developer-button";
    button.type = "button";
    button.dataset.action = name;
    this.document.l10n.setAttributes(button, "zen-developer-mode-" + name);
    const image = this.document.createElementNS(HTML_NS, "img");
    image.src = icon;
    image.alt = "";
    image.draggable = false;
    button.append(image);
    return button;
  }

  async #toggleTool(tab, toolId) {
    if (this.#closed || tab.closing || !tab.isConnected) {
      return;
    }
    const { DevToolsShim } = ChromeUtils.importESModule(
      "chrome://devtools-startup/content/DevToolsShim.sys.mjs",
    );
    if (!DevToolsShim.isEnabled()) {
      return;
    }
    this.window.gBrowser.selectedTab = tab;
    DevToolsShim.initDevTools();
    const { require } = ChromeUtils.importESModule(
      "resource://devtools/shared/loader/Loader.sys.mjs",
    );
    const { gDevTools } = require("devtools/client/framework/devtools");
    const toolbox = gDevTools.getToolboxForTab(tab);
    if (toolbox?.currentToolId === toolId) {
      await toolbox.destroy();
      return;
    }
    const {
      gDevToolsBrowser,
    } = require("devtools/client/framework/devtools-browser");
    await gDevToolsBrowser.selectToolCommand(this.window, toolId);
  }
}
