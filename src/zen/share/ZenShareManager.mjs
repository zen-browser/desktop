// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { nsZenThemePicker } from "resource:///modules/zen/ZenGradientGenerator.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
  ZenShareClient: "resource:///modules/zen/share/ZenShareClient.sys.mjs",
  ZenShareError: "resource:///modules/zen/share/ZenShareClient.sys.mjs",
});

const SHARE_DOCUMENT_VERSION = "1";

const SHAREABLE_ICON_RE = /^(data:|chrome:)/;
const FOLDER_ICON_RE = /^chrome:\/\//;

/**
 * Shares spaces, folders and split views through the share server, and
 * imports them back from share links.
 */
class nsZenShareManager extends nsZenDOMOperatedFeature {
  init() {
    if (!this.enabled) {
      for (const id of [
        "context_zenShareWorkspace",
        "context_zenShareFolder",
      ]) {
        document.getElementById(id)?.setAttribute("hidden", "true");
      }
      return;
    }
    delayedStartupPromise.then(() => {
      gBrowser.addTabsProgressListener({
        onLocationChange: (browser, webProgress, request, aLocation) => {
          this.#onLocationChange(browser, webProgress, aLocation);
        },
      });
    });
  }

  get enabled() {
    return !gZenWorkspaces.privateWindowOrDisabled;
  }

  // Mark: sharing

  async shareSpace(workspaceId) {
    const workspace = gZenWorkspaces.getWorkspaceFromId(workspaceId);
    const element = gZenWorkspaces.workspaceElement(workspaceId);
    if (!workspace || !element) {
      return;
    }
    const item = {
      type: "space",
      name: workspace.name || "Space",
      items: [
        ...this.#serializeItems(element.pinnedTabsContainer.children, {
          pinned: true,
        }),
        ...this.#serializeItems(element.tabsContainer.children, {
          pinned: false,
        }),
      ],
    };
    const theme = this.#serializeTheme(workspace.theme);
    if (theme) {
      item.theme = theme;
    }
    await this.#createAndCopyLink(item);
  }

  async shareFolder(folder) {
    if (!folder?.isZenFolder) {
      return;
    }
    await this.#createAndCopyLink(this.#serializeFolder(folder));
  }

  async shareSplitView(group) {
    if (!group?.hasAttribute("split-view-group")) {
      return;
    }
    const item = this.#serializeSplitGroup(group);
    if (!item) {
      this.#showCreateError(
        new lazy.ZenShareError("empty", "nothing to share")
      );
      return;
    }
    await this.#createAndCopyLink(item);
  }

  #serializeSplitGroup(group) {
    const tabs = group.tabs
      .filter(tab => !tab.hasAttribute("zen-empty-tab"))
      .map(tab => this.#serializeTab(tab, { pinned: tab.pinned }))
      .filter(Boolean);
    return tabs.length >= 2
      ? { type: "splitView", tabs: tabs.slice(0, gZenViewSplitter.MAX_TABS) }
      : null;
  }

  async #createAndCopyLink(item) {
    if (!this.enabled) {
      return;
    }
    if (!(await this.#confirmShare())) {
      return;
    }
    try {
      const created = await lazy.ZenShareClient.createShare(
        { version: SHARE_DOCUMENT_VERSION, shared: item },
        { name: this.#displayName() }
      );
      Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Ci.nsIClipboardHelper)
        .copyString(created.link);
      // The description's l10n args come from the whole options object.
      gZenUIManager.showToast("zen-share-link-copied-toast", {
        descriptionId: created.expiresAt
          ? "zen-share-link-expires-description"
          : "zen-share-link-permanent-description",
        date: created.expiresAt
          ? new Date(created.expiresAt).toLocaleDateString()
          : "",
        timeout: 6000,
      });
    } catch (e) {
      this.#showCreateError(e);
    }
  }

  #displayName() {
    return (
      Services.prefs.getStringPref("zen.share.display-name", "") || undefined
    );
  }

  async #confirmShare() {
    if (
      Services.prefs.getBoolPref("zen.share.dont-ask-before-sharing", false)
    ) {
      return true;
    }
    const args = {
      accepted: false,
      name: Services.prefs.getStringPref("zen.share.display-name", ""),
    };
    await gDialogBox.open(
      "chrome://browser/content/zen-components/windows/zen-share-confirm.xhtml",
      args
    );
    if (args.accepted) {
      Services.prefs.setStringPref("zen.share.display-name", args.name);
      if (args.dontAsk) {
        Services.prefs.setBoolPref("zen.share.dont-ask-before-sharing", true);
      }
    }
    return args.accepted;
  }

  #showCreateError(error) {
    console.error("ZenShare: could not create share:", error);
    const descriptions = {
      auth: "zen-share-error-auth-description",
      "too-large": "zen-share-error-too-large-description",
      "rate-limited": "zen-share-error-rate-limited-description",
      network: "zen-share-error-network-description",
      empty: "zen-share-error-empty-description",
    };
    gZenUIManager.showToast("zen-share-error-toast", {
      descriptionId:
        descriptions[error.code] || "zen-share-error-server-description",
      timeout: 6000,
    });
  }

  // Mark: serialization

  #serializeItems(children, { pinned }) {
    const items = [];
    for (const child of children) {
      if (gBrowser.isTab(child)) {
        if (
          child.hasAttribute("zen-empty-tab") ||
          child.hasAttribute("zen-glance-tab")
        ) {
          continue;
        }
        const tab = this.#serializeTab(child, { pinned });
        if (tab) {
          items.push(tab);
        }
      } else if (child.isZenFolder) {
        items.push(this.#serializeFolder(child));
      } else if (gBrowser.isTabGroup(child)) {
        const split = child.hasAttribute("split-view-group")
          ? this.#serializeSplitGroup(child)
          : null;
        if (split) {
          items.push(split);
          continue;
        }
        // Plain tab groups (and degenerate splits) keep their member tabs.
        for (const tab of child.tabs) {
          if (tab.hasAttribute("zen-empty-tab")) {
            continue;
          }
          const serialized = this.#serializeTab(tab, { pinned });
          if (serialized) {
            items.push(serialized);
          }
        }
      }
    }
    return items;
  }

  #serializeFolder(folder) {
    const item = {
      type: "folder",
      name: folder.label || "Folder",
      items: this.#serializeItems(folder.allItems, { pinned: false }),
    };
    const icon = folder.iconURL;
    if (icon) {
      item.icon = icon;
    }
    return item;
  }

  #serializeTab(tab, { pinned = false } = {}) {
    const url = tab.linkedBrowser?.currentURI?.spec;
    if (!url || !/^https?:\/\//.test(url)) {
      return null;
    }
    const item = { type: "tab", url };
    const label = tab.label;
    if (label) {
      item.label = label;
    }
    const image = this.#serializeIcon(tab);
    if (image) {
      item.image = image;
    }
    if (pinned) {
      item.isPinned = true;
    }
    return item;
  }

  #serializeIcon(tab) {
    let icon = tab.getAttribute("image") || "";
    if (icon.startsWith("moz-remote-image:")) {
      try {
        icon =
          new URLSearchParams(Services.io.newURI(icon).query).get("url") || "";
      } catch (e) {
        return "";
      }
    }
    return SHAREABLE_ICON_RE.test(icon) ? icon : "";
  }

  #serializeTheme(theme) {
    if (theme?.type !== "gradient" || !Array.isArray(theme.gradientColors)) {
      return null;
    }
    const gradientColors = theme.gradientColors
      .map(color => this.#serializeGradientColor(color))
      .filter(Boolean);
    if (!gradientColors.length) {
      return null;
    }
    return { type: "gradient", gradientColors };
  }

  #serializeGradientColor(color) {
    let c = color?.c;
    if (typeof c === "string") {
      c = this.#parseCssColor(c);
    } else if (Array.isArray(c)) {
      c = c.slice(0, 3).map(Number);
    }
    if (
      !Array.isArray(c) ||
      c.length !== 3 ||
      c.some(n => !Number.isFinite(n))
    ) {
      return null;
    }
    const out = { c, type: typeof color.type === "string" ? color.type : "" };
    if (typeof color.isCustom === "boolean") {
      out.isCustom = color.isCustom;
    }
    if (typeof color.isPrimary === "boolean") {
      out.isPrimary = color.isPrimary;
    }
    if (typeof color.algorithm === "string") {
      out.algorithm = color.algorithm;
    }
    if (color.lightness !== undefined && color.lightness !== null) {
      out.lightness = String(color.lightness);
    }
    if (
      Number.isFinite(color.position?.x) &&
      Number.isFinite(color.position?.y)
    ) {
      out.position = { x: color.position.x, y: color.position.y };
    }
    return out;
  }

  #parseCssColor(value) {
    const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
    if (hex) {
      const full =
        hex.length === 3 ? [...hex].map(ch => ch + ch).join("") : hex;
      return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    }
    const numbers = value
      .match(/\d+(\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number);
    return numbers?.length === 3 ? numbers : null;
  }

  // Mark: importing

  #stylesLoaded = false;

  // The overlay styles are only needed once a share link is opened.
  #ensureStyles() {
    if (this.#stylesLoaded) {
      return;
    }
    this.#stylesLoaded = true;
    window.windowUtils.loadSheetUsingURIString(
      "chrome://browser/content/zen-styles/zen-share.css",
      window.windowUtils.AUTHOR_SHEET
    );
  }

  #setHostTabSubtitle(browser, subtitle) {
    const tab = gBrowser.getTabForBrowser(browser);
    if (!tab) {
      return;
    }
    tab.setAttribute("zen-show-sublabel", subtitle);
    document.l10n.setArgs(tab.querySelector(".zen-tab-sublabel"), {
      tabSubtitle: subtitle,
    });
  }

  #clearHostTabSubtitle(browser) {
    const tab = gBrowser.getTabForBrowser(browser);
    if (!tab?.hasAttribute("zen-show-sublabel")) {
      return;
    }
    tab.removeAttribute("zen-show-sublabel");
    document.l10n.setArgs(tab.querySelector(".zen-tab-sublabel"), {
      tabSubtitle: "zen-default-pinned",
    });
  }

  #onLocationChange(browser, webProgress, aLocation) {
    if (!webProgress.isTopLevel) {
      return;
    }
    if (browser._zenShareOverlay) {
      browser._zenShareOverlay.remove();
      delete browser._zenShareOverlay;
      browser.removeAttribute("zen-share-overlay-showing");
      this.#clearHostTabSubtitle(browser);
    }
    const share = lazy.ZenShareClient.parseShareUrl(aLocation.spec);
    if (!share) {
      return;
    }
    if (share.type === "split-view") {
      // Split views are light enough to open right away, no preview step.
      this.#openSharedSplitView(browser, share);
    } else {
      this.#showImportOverlay(browser, share);
    }
  }

  async #openSharedSplitView(browser, share) {
    let item;
    const shareTab = gBrowser.getTabForBrowser(browser);
    shareTab.style.display = "none";
    const failure = () => {
      shareTab.style.removeProperty("display");
    };
    try {
      const { doc } = await lazy.ZenShareClient.fetchSharePreview(share);
      item = doc.shared?.type === "splitView" ? doc.shared : null;
    } catch (e) {
      console.error("ZenShare: could not load shared split view:", e);
      const descriptions = {
        "not-found": "zen-share-import-error-dead-description",
        "invalid-document": "zen-share-import-error-invalid-description",
      };
      gZenUIManager.showToast("zen-share-import-error-toast", {
        descriptionId:
          descriptions[e.code] || "zen-share-error-network-description",
        timeout: 6000,
      });
      failure();
      return;
    }
    if (!item) {
      failure();
      return;
    }
    const workspaceId = gZenWorkspaces.activeWorkspace;
    const pinned = item.tabs.every(child => child.isPinned);
    const tabs = item.tabs.map(child => {
      // Eager browsers so every pane renders as soon as the split shows.
      const tab = this.#importTab(child, workspaceId, { lazyBrowser: false });
      if (pinned) {
        gBrowser.pinTab(tab);
      }
      this.#placeTab(tab, workspaceId, pinned);
      return tab;
    });
    gZenViewSplitter.splitTabs(tabs, "grid", 0);
    gBrowser.removeTab(shareTab, {
      closeWindowWithLastTab: false,
      skipSessionStore: true,
    });
    // Shake the new split group in the sidebar.
    const group = tabs[0]?.group;
    if (group?.hasAttribute("split-view-group")) {
      requestAnimationFrame(() => {
        gZenUIManager.motion
          .animate(
            group,
            { x: [-28, 0] },
            { type: "spring", bounce: 0.9, duration: 1.4 }
          )
          .then(() => {
            group.style.removeProperty("transform");
          });
      });
    }
  }

  async #showImportOverlay(browser, share) {
    const stack = browser.closest(".browserStack");
    if (!stack) {
      return;
    }
    this.#ensureStyles();
    // Only the status text shows until the preview loads.
    const overlay = window.MozXULElement.parseXULToFragment(`
      <html:div class="zen-share-overlay">
        <html:div class="zen-share-overlay-card">
          <html:div class="zen-share-overlay-items"/>
          <html:div class="zen-share-overlay-status"
                    data-l10n-id="zen-share-overlay-loading"/>
          <html:div class="zen-share-overlay-footer" hidden="hidden">
            <html:div class="zen-share-overlay-badge-stack">
              <html:div class="zen-share-overlay-badge-sheet second"/>
              <html:div class="zen-share-overlay-badge-sheet first"/>
              <html:div class="zen-share-overlay-badge">
                <html:img class="zen-share-overlay-badge-icon"
                          draggable="false"/>
                <html:div class="zen-share-overlay-badge-text">
                  <html:div class="zen-share-overlay-badge-title"/>
                  <html:div class="zen-share-overlay-badge-subtitle"/>
                </html:div>
              </html:div>
            </html:div>
          </html:div>
        </html:div>
        <html:button class="zen-big-accent-button primary zen-share-overlay-add"
                     hidden="hidden" disabled="disabled"/>
      </html:div>
    `).firstElementChild;
    const items = overlay.querySelector(".zen-share-overlay-items");
    const statusEl = overlay.querySelector(".zen-share-overlay-status");
    const footer = overlay.querySelector(".zen-share-overlay-footer");
    const badgeIcon = overlay.querySelector(".zen-share-overlay-badge-icon");
    const badgeTitle = overlay.querySelector(".zen-share-overlay-badge-title");
    const badgeSubtitle = overlay.querySelector(
      ".zen-share-overlay-badge-subtitle"
    );
    const button = overlay.querySelector(".zen-share-overlay-add");

    stack.appendChild(overlay);
    browser._zenShareOverlay = overlay;
    browser.setAttribute("zen-share-overlay-showing", "true");

    let preview;
    try {
      preview = await lazy.ZenShareClient.fetchSharePreview(share);
    } catch (e) {
      console.error("ZenShare: could not load share preview:", e);
      const descriptions = {
        "not-found": "zen-share-import-error-dead-description",
        "invalid-document": "zen-share-import-error-invalid-description",
      };
      document.l10n.setAttributes(
        statusEl,
        descriptions[e.code] || "zen-share-error-network-description"
      );
      return;
    }
    if (browser._zenShareOverlay !== overlay) {
      // Navigated away while loading.
      return;
    }
    const { doc, name: sharerName } = preview;
    const first = doc.shared;
    const type = first.type;

    badgeTitle.textContent = first.name;
    this.#renderPreviewRows(items, first.items);
    if (type === "folder") {
      // The real zen folder icon, with the shared custom icon when set.
      const folderIcon = this.#buildFolderIcon(first.icon);
      folderIcon.classList.add("zen-share-overlay-badge-icon");
      folderIcon.setAttribute("state", "open");
      badgeIcon.replaceWith(folderIcon);
    } else {
      badgeIcon.src = "chrome://browser/skin/zen-icons/duplicate-tab.svg";
    }
    if (sharerName) {
      document.l10n.setAttributes(
        badgeSubtitle,
        `zen-share-overlay-from-${type}`,
        { name: sharerName }
      );
    } else {
      document.l10n.setAttributes(
        badgeSubtitle,
        "zen-share-overlay-shared-with-you"
      );
    }
    // Mirror the badge subtitle under the tab's label, like live folders do.
    const [tabSubtitle] = await document.l10n.formatValues([
      sharerName
        ? { id: `zen-share-overlay-from-${type}`, args: { name: sharerName } }
        : { id: "zen-share-overlay-shared-with-you" },
    ]);
    this.#setHostTabSubtitle(browser, tabSubtitle);
    statusEl.remove();
    footer.hidden = false;
    document.l10n.setAttributes(button, `zen-share-overlay-add-${type}`);
    button.hidden = false;
    button.disabled = false;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await this.#importDocument(doc);
        gZenUIManager.showToast("zen-share-imported-toast");
        const tab = gBrowser.getTabForBrowser(browser);
        if (tab) {
          gBrowser.removeTab(tab, {
            closeWindowWithLastTab: false,
            skipSessionStore: true,
          });
        }
      } catch (e) {
        console.error("ZenShare: could not import share:", e);
        gZenUIManager.showToast("zen-share-import-error-toast", {
          timeout: 6000,
        });
        button.disabled = false;
      }
    });
  }

  #renderPreviewRows(container, entries) {
    for (const entry of entries) {
      if (entry.type === "folder") {
        container.appendChild(this.#buildFolderRow(entry));
      } else if (entry.type === "splitView") {
        const split = window.MozXULElement.parseXULToFragment(`
          <html:div class="zen-share-overlay-split"/>
        `).firstElementChild;
        for (const tab of entry.tabs) {
          split.appendChild(this.#buildTabRow(tab));
        }
        container.appendChild(split);
      } else {
        container.appendChild(this.#buildTabRow(entry));
      }
    }
  }

  #buildTabRow(entry) {
    const row = window.MozXULElement.parseXULToFragment(`
      <html:div class="zen-share-overlay-row">
        <html:img class="zen-share-overlay-row-icon" draggable="false"/>
        <html:div class="zen-share-overlay-row-label"/>
      </html:div>
    `).firstElementChild;
    row.title = entry.url;
    row.querySelector(".zen-share-overlay-row-icon").src =
      entry.image && SHAREABLE_ICON_RE.test(entry.image)
        ? entry.image
        : `page-icon:${entry.url}`;
    row.querySelector(".zen-share-overlay-row-label").textContent =
      entry.label || entry.url;
    row.addEventListener("click", () => {
      const stackRect = row.closest(".browserStack").getBoundingClientRect();
      const data = {
        url: entry.url,
        clientX: stackRect.width / 2,
        clientY: stackRect.height / 2,
        width: 0,
        height: 0,
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      };
      gZenGlanceManager.lastLinkClickData = data;
      gZenGlanceManager.openGlance(data);
    });
    return row;
  }

  #buildFolderRow(entry) {
    const wrapper = window.MozXULElement.parseXULToFragment(`
      <html:div class="zen-share-overlay-folder" collapsed="true">
        <html:div class="zen-share-overlay-row">
          <html:div class="zen-share-overlay-row-label"/>
        </html:div>
        <html:div class="zen-share-overlay-children-clip">
          <html:div class="zen-share-overlay-children"/>
        </html:div>
      </html:div>
    `).firstElementChild;
    const row = wrapper.querySelector(".zen-share-overlay-row");
    const label = row.querySelector(".zen-share-overlay-row-label");
    label.textContent = entry.name;
    const icon = this.#buildFolderIcon(entry.icon);
    row.insertBefore(icon, label);
    this.#renderPreviewRows(
      wrapper.querySelector(".zen-share-overlay-children"),
      entry.items
    );
    row.addEventListener("click", () => {
      const collapsed = wrapper.toggleAttribute("collapsed");
      if (collapsed) {
        icon.removeAttribute("state");
      } else {
        icon.setAttribute("state", "open");
      }
    });
    return wrapper;
  }

  #buildFolderIcon(customIcon) {
    const { nsZenFolder } = ChromeUtils.importESModule(
      "chrome://browser/content/zen-components/ZenFolder.mjs",
      { global: "current" }
    );
    const svg = nsZenFolder.rawIcon.cloneNode(true);
    svg.classList.add("zen-share-overlay-folder-icon");
    if (customIcon && FOLDER_ICON_RE.test(customIcon)) {
      svg.querySelector(".icon image").setAttribute("href", customIcon);
    }
    return svg;
  }

  async #importDocument(doc) {
    const item = doc.shared;
    switch (item.type) {
      case "space":
        await this.#importSpace(item);
        break;
      case "folder":
        this.#importFolder(item, gZenWorkspaces.activeWorkspace);
        break;
      case "splitView":
        this.#importSplitView(item);
        break;
    }
  }

  async #importSpace(item) {
    const workspace = await gZenWorkspaces.createAndSaveWorkspace(
      item.name,
      undefined,
      false,
      0,
      {
        beforeChangeCallback: async newWorkspace => {
          for (const child of item.items) {
            if (child.type === "tab") {
              const tab = this.#importTab(child, newWorkspace.uuid);
              if (child.isPinned) {
                gBrowser.pinTab(tab);
              }
              this.#placeTab(tab, newWorkspace.uuid, !!child.isPinned);
            } else if (child.type === "folder") {
              this.#importFolder(child, newWorkspace.uuid);
            } else if (child.type === "splitView") {
              this.#importSplitView(child, newWorkspace.uuid);
            }
          }
        },
      }
    );
    if (!workspace) {
      return;
    }
    workspace.name = item.name;
    const theme = item.theme;
    if (theme) {
      workspace.theme = nsZenThemePicker.getTheme(
        theme.gradientColors.map(color => this.#importGradientColor(color))
      );
    }
    gZenWorkspaces.saveWorkspace(workspace);
    gZenThemePicker.onWorkspaceChange(workspace);
    gZenStartup.playWindowSweepAnimation();
  }

  #importGradientColor(color) {
    if (color.isCustom) {
      const [r, g, b] = color.c;
      return { ...color, c: `rgb(${r}, ${g}, ${b})` };
    }
    return color;
  }

  #importFolder(item, workspaceId, parentFolder = null) {
    const folder = gZenFolders.createFolder([], {
      label: item.name,
      collapsed: true,
      workspaceId,
      insertAfter: parentFolder
        ? parentFolder.groupContainer.lastElementChild
        : null,
    });
    if (item.icon && FOLDER_ICON_RE.test(item.icon)) {
      gZenFolders.setFolderUserIcon(folder, item.icon);
    }
    for (const child of item.items) {
      if (child.type === "tab") {
        const tab = this.#importTab(child, workspaceId);
        gBrowser.pinTab(tab);
        folder.addTabs([tab]);
      } else if (child.type === "folder") {
        this.#importFolder(child, workspaceId, folder);
      } else if (child.type === "splitView") {
        this.#importSplitView(child, workspaceId, folder);
      }
    }
    return folder;
  }

  #importSplitView(item, workspaceId, folder = null) {
    workspaceId ??= gZenWorkspaces.activeWorkspace;
    const pinned = item.tabs.every(child => child.isPinned);
    const tabs = item.tabs.map(child => {
      const tab = this.#importTab(child, workspaceId);
      if (folder) {
        gBrowser.pinTab(tab);
        folder.addTabs([tab]);
      } else {
        if (pinned) {
          gBrowser.pinTab(tab);
        }
        this.#placeTab(tab, workspaceId, pinned);
      }
      return tab;
    });
    gZenViewSplitter.splitTabs(tabs, "grid", -1);
  }

  // Deterministic placement at the end of the right section;
  // moveTabToWorkspace's anchor follows the new-tab-button position pref.
  #placeTab(tab, workspaceId, pinned) {
    const element = gZenWorkspaces.workspaceElement(workspaceId);
    const container = pinned
      ? element.pinnedTabsContainer
      : element.tabsContainer;
    const anchor = pinned
      ? container.querySelector(".pinned-tabs-container-separator")
      : container.querySelector("#tabbrowser-arrowscrollbox-periphery");
    gBrowser.zenHandleTabMove(tab, () => {
      tab.setAttribute("zen-workspace-id", workspaceId);
      container.insertBefore(tab, anchor);
    });
  }

  #importTab(item, workspaceId, { lazyBrowser = true } = {}) {
    const tab = gBrowser.addTrustedTab(item.url, {
      createLazyBrowser: lazyBrowser,
      inBackground: true,
      skipAnimation: true,
      skipBackgroundNotify: true,
      lazyTabTitle: item.label || undefined,
      skipRoute: true,
    });
    if (workspaceId) {
      tab.setAttribute("zen-workspace-id", workspaceId);
    }
    if (item.image && SHAREABLE_ICON_RE.test(item.image)) {
      try {
        gBrowser.setIcon(tab, item.image);
        lazy.TabStateCache.update(tab.linkedBrowser.permanentKey, {
          image: null,
        });
      } catch (e) {
        console.error("ZenShare: could not set imported tab icon:", e);
      }
    }
    return tab;
  }
}

window.gZenShareManager = new nsZenShareManager();
