// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const ENABLED_PREF = "zen.developer-mode.enabled";
const MODE_ATTRIBUTE = "zen-developer-mode";
const TOP_TOOLBAR_ATTRIBUTE = "zen-developer-top-toolbar";
const ACTIVE_TOOLBAR_ATTRIBUTE = "zen-developer-top-toolbar-active";
const COMPACT_TOOLBAR_ATTRIBUTE = "zen-developer-top-toolbar-compact";
// Leave room for navigation, the editable URL, and the full action strip.
const MIN_INLINE_TOOLBAR_WIDTH = 540;

const SITE_PREF = "zen.developer-mode.site-override";
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PanelMultiView:
    "moz-src:///browser/components/customizableui/PanelMultiView.sys.mjs",
});
ChromeUtils.defineLazyGetter(lazy, "contentPrefs", () =>
  Cc["@mozilla.org/content-pref/service;1"].getService(
    Ci.nsIContentPrefService2,
  ),
);

export function developerModeHost(uri) {
  if (!uri?.schemeIs("http") && !uri?.schemeIs("https")) {
    return null;
  }
  return uri.asciiHost.toLowerCase().replace(/\.$/, "") || null;
}

export function isLocalDevelopmentURI(uri) {
  const host = developerModeHost(uri);
  return Boolean(
    host &&
    (host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"),
  );
}

export function canUseDeveloperMode(uri) {
  return (
    Services.prefs.getBoolPref(ENABLED_PREF, false) &&
    Boolean(developerModeHost(uri))
  );
}

function contentPrefOperation(operation) {
  return new Promise((resolve, reject) => {
    let result;
    operation({
      handleResult(pref) {
        result = pref;
      },
      handleError(status) {
        reject(
          Components.Exception("Developer Mode site preference failed", status),
        );
      },
      handleCompletion(reason) {
        if (reason === Ci.nsIContentPrefCallback2.COMPLETE_OK) {
          resolve(result);
        } else {
          reject(new Error("Developer Mode site preference did not complete"));
        }
      },
    });
  });
}

function readOverride(host, context) {
  return (
    lazy.contentPrefs.getCachedByDomainAndName(host, SITE_PREF, context) ??
    contentPrefOperation((callback) =>
      lazy.contentPrefs.getByDomainAndName(host, SITE_PREF, context, callback),
    )
  );
}

function effectiveMode(uri, pref) {
  return pref?.value == null ? isLocalDevelopmentURI(uri) : pref.value === 1;
}

// null means Firefox has not loaded this hostname's preference yet.
export function cachedDeveloperMode(uri, context) {
  if (!canUseDeveloperMode(uri)) {
    return false;
  }
  const pref = lazy.contentPrefs.getCachedByDomainAndName(
    developerModeHost(uri),
    SITE_PREF,
    context,
  );
  return pref ? effectiveMode(uri, pref) : null;
}

export async function readDeveloperMode(uri, context) {
  if (!canUseDeveloperMode(uri)) {
    return false;
  }
  return effectiveMode(
    uri,
    await readOverride(developerModeHost(uri), context),
  );
}

export async function setDeveloperMode(uri, context, enabled) {
  if (!context || !canUseDeveloperMode(uri)) {
    return;
  }

  const host = developerModeHost(uri);
  // In a private window, clearing the override restores the inherited choice.
  const baseline = context.usePrivateBrowsing
    ? effectiveMode(uri, await readOverride(host, Cu.createLoadContext()))
    : isLocalDevelopmentURI(uri);
  if (enabled === baseline) {
    await contentPrefOperation((callback) =>
      lazy.contentPrefs.removeByDomainAndName(
        host,
        SITE_PREF,
        context,
        callback,
      ),
    );
  } else {
    await contentPrefOperation((callback) =>
      lazy.contentPrefs.set(
        host,
        SITE_PREF,
        enabled ? 1 : 0,
        context,
        callback,
      ),
    );
  }
}

export class ZenDeveloperMode extends ZenUIComponent {
  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsIContentPrefObserver",
  ]);

  #ready = false;
  #closed = false;
  #bars = new Map();
  #command = Promise.resolve();
  #nativeTools = null;
  #menuTools = null;
  #navBar;
  #toolbarObserver;

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
    this.#navBar = this.document.getElementById("nav-bar");
    this.#toolbarObserver = new this.window.ResizeObserver(() => {
      this.#syncToolbarOverflow();
    });
    this.#toolbarObserver.observe(this.#navBar);
    this.listenBrowserTabsProgress();
    Services.prefs.addObserver(ENABLED_PREF, this);
    lazy.contentPrefs.addObserverForName(SITE_PREF, this);
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
    lazy.contentPrefs.removeObserverForName(SITE_PREF, this);
    this.window.gBrowser.removeTabsProgressListener(this);
    for (const tab of this.window.gBrowser.tabs) {
      this.#removeToolbar(tab);
    }
    this.#toolbarObserver.disconnect();
    this.#nativeTools?.remove();
    this.#menuTools?.remove();
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

  onContentPrefSet(host) {
    this.#refreshHost(host);
  }

  onContentPrefRemoved(host) {
    this.#refreshHost(host);
  }

  #refreshHost(host) {
    const { gBrowser, gURLBar } = this.window;
    for (const tab of gBrowser.tabs) {
      if (developerModeHost(tab.linkedBrowser?.currentURI) === host) {
        this.#refreshTab(tab);
      }
    }
    if (developerModeHost(gBrowser.currentURI) === host) {
      this.#syncLayout();
      if (!gURLBar.focused) {
        gURLBar.setURI();
      }
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
    const uri = browser?.currentURI;
    const active = cachedDeveloperMode(uri, browser?.loadContext);
    if (active === null) {
      this.#removeToolbar(tab);
      const host = developerModeHost(uri);
      readDeveloperMode(uri, browser.loadContext)
        .then(() => {
          if (
            this.#closed ||
            tab.closing ||
            !tab.isConnected ||
            browser !== tab.linkedBrowser ||
            developerModeHost(browser.currentURI) !== host ||
            cachedDeveloperMode(browser.currentURI, browser.loadContext) ===
              null
          ) {
            return;
          }
          this.#refreshTab(tab);
          const { gBrowser, gURLBar } = this.window;
          if (tab === gBrowser.selectedTab) {
            this.#syncLayout();
            if (!gURLBar.focused) {
              gURLBar.setURI();
            }
          }
        })
        .catch(console.error);
      return;
    }
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

  #appendButtons(toolbar, getTab, inMenu = false) {
    const event = inMenu ? "command" : "click";
    const copy = this.#createButton(
      "copy",
      "chrome://browser/skin/zen-icons/link.svg",
      inMenu,
    );
    copy.addEventListener(event, () => {
      this.window.gBrowser.selectedTab = getTab();
      this.document.getElementById("cmd_zenCopyCurrentURL").doCommand();
    });
    const screenshot = this.#createButton(
      "screenshot",
      "chrome://browser/skin/zen-icons/screenshot.svg",
      inMenu,
    );
    screenshot.addEventListener(event, () => {
      this.window.gBrowser.selectedTab = getTab();
      Services.obs.notifyObservers(
        this.window,
        "menuitem-screenshot",
        "ToolbarButton",
      );
    });

    if (inMenu) {
      toolbar.append(copy, screenshot);
    } else {
      const divider = this.document.createElementNS(HTML_NS, "span");
      divider.className = "zen-developer-action-divider";
      divider.setAttribute("aria-hidden", "true");
      toolbar.append(copy, divider, screenshot, divider.cloneNode(false));
    }
    for (const [toolId, name, icon] of [
      ["webconsole", "console", "tool-webconsole.svg"],
      ["netmonitor", "network", "tool-network.svg"],
      ["inspector", "inspect", "tool-inspector.svg"],
    ]) {
      const button = this.#createButton(
        name,
        "chrome://devtools/skin/images/" + icon,
        inMenu,
      );
      button.dataset.tool = toolId;
      button.addEventListener(event, () => {
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
    const sitePanel = this.window.gZenSiteDataPanel;
    if (sitePanel?.unifiedPanel.state === "open") {
      sitePanel.refreshDeveloperMode();
    }
    if (active) {
      this.#ensureNativeTools();
    }
    this.#syncToolbarOverflow();
    if (changed && !gURLBar.focused) {
      gURLBar.setURI();
    }
  }

  #syncToolbarOverflow() {
    if (!this.#ready || this.#closed) {
      return;
    }
    const root = this.document.documentElement;
    // The toolbar width is independent of its contents. Measuring the URL
    // field here would oscillate as moving the tools changes its width.
    const compact =
      root.hasAttribute(ACTIVE_TOOLBAR_ATTRIBUTE) &&
      this.#navBar.clientWidth < MIN_INLINE_TOOLBAR_WIDTH;
    if (compact && !this.#menuTools) {
      const view = lazy.PanelMultiView.getViewNode(
        this.document,
        "appMenu-mainView",
      );
      const group = this.document.createXULElement("vbox");
      group.id = "zen-developer-menu-tools";
      group.setAttribute("role", "group");
      this.document.l10n.setAttributes(group, "zen-developer-mode-toolbar");
      this.#appendButtons(group, () => this.window.gBrowser.selectedTab, true);
      group.append(this.document.createXULElement("toolbarseparator"));
      view.querySelector("#appMenu-new-tab-button2").before(group);
      this.#menuTools = group;
    }
    root.toggleAttribute(COMPACT_TOOLBAR_ATTRIBUTE, compact);
    if (this.#menuTools) {
      this.#menuTools.hidden = !compact;
    }
  }

  #ensureNativeTools() {
    if (!this.#nativeTools?.isConnected) {
      const group = this.document.createElementNS(HTML_NS, "div");
      group.id = "zen-developer-nav-tools";
      // This is an ephemeral group, not a customizable overflow widget.
      group.setAttribute("overflows", "false");
      group.setAttribute("skipintoolbarset", "true");
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

  #createButton(name, icon, inMenu) {
    if (inMenu) {
      const button = this.document.createXULElement("toolbarbutton");
      button.className = "subviewbutton subviewbutton-iconic";
      button.setAttribute("image", icon);
      button.dataset.action = name;
      this.document.l10n.setAttributes(button, "zen-developer-mode-" + name);
      button.addEventListener("command", () => this.window.PanelUI.hide());
      return button;
    }

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
