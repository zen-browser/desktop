/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  canDrawThumbnail: "moz-src:///zen/library/ZenLibraryFileTypes.sys.mjs",
  DownloadsCommon:
    "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  DownloadsViewUI:
    "moz-src:///browser/components/downloads/DownloadsViewUI.sys.mjs",
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
});

const ENTRIES = 4;
const CLOSE_DELAY_MS = 200;
const FILE_MIME = "application/x-moz-file";
const BADGE_MARKUP = `
  <span class="zen-library-download-badge no-squircles">
    <span class="zen-library-download-progress no-squircles"></span>
  </span>
`;

class ZenLibraryDownloadStack {
  #button;
  #badge;
  #list;
  #library = null;
  #entries = [];
  #data;
  #downloads = [];
  #inBatch = false;
  #loaded = false;
  #recentNewDownload = false;
  #closeTimer = null;
  #contextMenuOpen = false;
  #secondsLeft = new WeakMap();

  /**
   * @param {Element} button - The library toolbar button
   */
  constructor(button) {
    this.#button = button;
    button.setAttribute("command", "cmd_zenToggleLibrary");
    button.classList.add("toolbarbutton-badge-stack-host");
    button.appendChild(
      this.#parse(
        `<box class="toolbarbutton-badge-stack">${BADGE_MARKUP}</box>`
      )
    );
    this.#badge = button.querySelector(".zen-library-download-badge");
    this.#badge.id = "library-button-badge";
    this.#list = this.#buildList();

    button.addEventListener("mouseenter", this);
    button.addEventListener("mouseleave", this);
    this.#list.addEventListener("mouseenter", this);
    this.#list.addEventListener("mouseleave", this);

    this.#data = lazy.DownloadsCommon.getData(this.#window, true);
    this.#data.addView(this);
  }

  destroy() {
    this.#data.removeView(this);
    this.#window.clearTimeout(this.#closeTimer);
    this.#list.remove();
  }

  get #window() {
    return this.#button.documentGlobal;
  }

  get #footButtons() {
    return this.#list.parentElement;
  }

  /** The tab strip, once the window has it. */
  get #tabs() {
    return this.#window.gBrowser?.tabContainer ?? null;
  }

  #parse(markup) {
    return this.#window.MozXULElement.parseXULToFragment(markup);
  }

  handleEvent(event) {
    switch (event.type) {
      case "mouseenter":
        this.#window.clearTimeout(this.#closeTimer);
        if (event.currentTarget === this.#button) {
          this.#open();
        }
        break;
      case "mouseleave":
        this.#scheduleClose();
        break;
    }
  }

  #scheduleClose() {
    this.#window.clearTimeout(this.#closeTimer);
    this.#closeTimer = this.#window.setTimeout(() => {
      if (!this.#contextMenuOpen) {
        this.#close();
      }
    }, CLOSE_DELAY_MS);
  }

  #open() {
    if (this.#footButtons.hasAttribute("zen-library-stack-open")) {
      return;
    }
    this.#aimBadge();
    this.#tabs?.removeAttribute("zen-library-stack-closing");
    for (const host of [this.#footButtons, this.#tabs]) {
      host?.setAttribute("zen-library-stack-open", "true");
    }
  }

  #close() {
    if (!this.#footButtons.hasAttribute("zen-library-stack-open")) {
      return;
    }
    this.#recentNewDownload = false;
    this.#updateBadgeShowing();
    for (const host of [this.#footButtons, this.#tabs]) {
      host?.removeAttribute("zen-library-stack-open");
    }
    // The strip's fade stays until its progress is back at zero.
    const tabs = this.#tabs;
    if (!tabs) {
      return;
    }
    tabs.setAttribute("zen-library-stack-closing", "true");
    tabs.addEventListener("transitionend", function onEnd(event) {
      if (event.propertyName === "--zen-library-progress") {
        tabs.removeEventListener("transitionend", onEnd);
        tabs.removeAttribute("zen-library-stack-closing");
      }
    });
  }

  /**
   * Points the button's badge at the newest entry's badge, where it flies
   * to as the list opens, from wherever it is right now.
   */
  #aimBadge() {
    const entry = this.#entries.at(-1);
    if (entry.hidden) {
      return;
    }
    const target = entry.querySelector(".zen-library-download-badge");
    const from = this.#badge.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const style = this.#window.getComputedStyle(this.#badge);
    // The entry is still translated down while closed; land where it ends.
    const entryTransform = this.#window.getComputedStyle(entry).transform;
    const rise =
      entryTransform === "none"
        ? 0
        : new this.#window.DOMMatrixReadOnly(entryTransform).f;
    this.#badge.style.setProperty(
      "--zen-library-badge-to-x",
      `${parseFloat(style.left) + to.left - from.left}px`
    );
    this.#badge.style.setProperty(
      "--zen-library-badge-to-y",
      `${parseFloat(style.top) + to.top - from.top - rise}px`
    );
  }

  #buildList() {
    const document = this.#window.document;
    const footButtons = document.getElementById("zen-sidebar-foot-buttons");
    // Not a widget of the toolbar, so its customization leaves it alone.
    footButtons.appendChild(
      this.#parse(
        `<box id="zen-library-download-list" skipintoolbarset="true"></box>`
      )
    );
    const list = document.getElementById("zen-library-download-list");
    for (let i = 0; i < ENTRIES; i++) {
      list.appendChild(
        this.#parse(`
          <div class="zen-library-download-list-download">
            ${BADGE_MARKUP}
            <vbox class="zen-library-download-list-title-container">
              <span class="zen-library-download-list-title"></span>
              <span class="zen-library-download-list-subtitle"></span>
            </vbox>
            <toolbarbutton class="toolbarbutton-1 zen-library-download-action no-squircles" />
          </div>
        `)
      );
    }
    this.#entries = [...list.children];
    for (const entry of this.#entries) {
      entry.setAttribute("draggable", "true");
      entry.addEventListener("dragstart", event =>
        this.#onDragStart(event, entry.download)
      );
      entry.addEventListener("click", event => {
        if (event.button === 0) {
          this.#openDownload(entry.download);
        }
      });
      entry.addEventListener("contextmenu", event =>
        this.#showContextMenu(event, entry.download)
      );
      const action = entry.querySelector(".zen-library-download-action");
      action.addEventListener("click", event => event.stopPropagation());
      action.addEventListener("command", () =>
        this.#cancelDownload(entry.download)
      );
    }
    return list;
  }

  /**
   * Cancels a download under way, partial file and all.
   *
   * @param {Download} download
   */
  #cancelDownload(download) {
    if (!download || download.stopped) {
      return;
    }
    download.cancel().catch(() => {});
    download
      .removePartialData()
      .catch(console.error)
      .finally(() => download.target.refresh());
  }

  /**
   * @param {object} download
   * @returns {boolean} Whether it will be opened as soon as it is here
   */
  #opensWhenDone(download) {
    return !download.stopped && !!download.launchWhenSucceeded;
  }

  /**
   * Clicking a download that is still coming in asks for it to be opened as
   * soon as it is here, the way the downloads panel does.
   *
   * @param {object} download
   */
  #toggleOpenWhenDone(download) {
    download.launchWhenSucceeded = !download.launchWhenSucceeded;
    download._launchedFromPanel = download.launchWhenSucceeded;
    this.#updateList();
  }

  #openDownload(download) {
    if (!download.stopped) {
      this.#toggleOpenWhenDone(download);
      return;
    }
    if (download.succeeded) {
      lazy.DownloadsCommon.openDownload(download).catch(console.error);
    } else if (download.source?.url) {
      this.#window.openTrustedLinkIn(download.source.url, "tab");
    }
  }

  #onDragStart(event, download) {
    if (!download?.succeeded || download.deleted || !download.target?.exists) {
      event.preventDefault();
      return;
    }
    const file = new lazy.FileUtils.File(download.target.path);
    const { dataTransfer } = event;
    dataTransfer.mozSetDataAt(FILE_MIME, file, 0);
    dataTransfer.effectAllowed = "copyMove";
    dataTransfer.setData("text/uri-list", Services.io.newFileURI(file).spec);
    dataTransfer.addElement(event.currentTarget);
    // eslint-disable-next-line mozilla/valid-services
    Services.zen.playHapticFeedback();
  }

  #updateList() {
    const shown = this.#downloads.slice(-ENTRIES);
    const unused = ENTRIES - shown.length;
    this.#entries.forEach((entry, i) => {
      const download = shown[i - unused];
      entry.hidden = !download;
      entry.download = download ?? null;
      if (!download) {
        return;
      }
      this.#updateBadge(
        entry.querySelector(".zen-library-download-badge"),
        download
      );
      entry.querySelector(".zen-library-download-list-title").textContent =
        this.#fileName(download);
      const subtitle = entry.querySelector(
        ".zen-library-download-list-subtitle"
      );
      if (this.#opensWhenDone(download)) {
        this.#window.document.l10n.setAttributes(
          subtitle,
          "library-downloads-open-when-done"
        );
      } else {
        subtitle.removeAttribute("data-l10n-id");
        subtitle.textContent = this.#statusText(download);
      }
      entry.toggleAttribute("downloading", !download.stopped);
      entry.toggleAttribute("open-when-done", this.#opensWhenDone(download));
    });
    this.#window
      .promiseDocumentFlushed(() => this.#list.getBoundingClientRect().height)
      .then(height => {
        this.#tabs?.style.setProperty(
          "--zen-library-stack-height",
          `${height}px`
        );
      });
  }

  #updateBadge(badge, download) {
    const pending = this.#isPending(download);
    badge.toggleAttribute("downloading", pending);
    if (badge === this.#badge) {
      badge.parentElement.toggleAttribute("downloading", pending);
    }
    if (download) {
      const preview = this.#previewUrl(download);
      badge.style.setProperty(
        "--download-image",
        `${preview ? `url('${preview}'), ` : ""}url('${this.#iconUrl(download)}')`
      );
    }
    badge
      .querySelector(".zen-library-download-progress")
      .style.setProperty(
        "--value",
        download?.hasProgress ? download.progress : 0
      );
  }

  #updateBadgeShowing() {
    this.#footButtons.toggleAttribute(
      "zen-library-badge",
      this.#isPending(this.#downloads.at(-1)) || this.#recentNewDownload
    );
  }

  // DownloadList view

  onDownloadBatchStarting() {
    this.#inBatch = true;
  }

  onDownloadBatchEnded() {
    this.#inBatch = false;
    this.#loaded = true;
    this.#update();
  }

  onDownloadAdded(download, { insertBefore } = {}) {
    const index = insertBefore ? this.#downloads.indexOf(insertBefore) : -1;
    if (index === -1) {
      this.#downloads.push(download);
    } else {
      this.#downloads.splice(index, 0, download);
    }
    if (this.#loaded) {
      this.#recentNewDownload = true;
    }
    this.#update();
  }

  onDownloadChanged() {
    this.#update();
  }

  onDownloadRemoved(download) {
    const index = this.#downloads.indexOf(download);
    if (index !== -1) {
      this.#downloads.splice(index, 1);
    }
    this.#update();
  }

  #update() {
    if (this.#inBatch) {
      return;
    }
    const newest = this.#downloads.at(-1);
    this.#updateList();
    this.#updateBadge(this.#badge, newest);
    this.#updateBadgeShowing();
    this.#applyDownloadState();
  }

  /**
   * Keeps the newest download's state on the library while it is open, for
   * its downloads tab to show.
   *
   * @param {Element} library
   */
  attachLibrary(library) {
    this.#library = library;
    this.#applyDownloadState();
  }

  detachLibrary(library) {
    if (this.#library === library) {
      this.#library = null;
    }
  }

  #applyDownloadState() {
    if (!this.#library) {
      return;
    }
    const newest = this.#downloads.at(-1);
    this.#library.toggleAttribute(
      "zen-library-downloading",
      this.#isPending(newest)
    );
    this.#library.style.setProperty(
      "--zen-library-download-progress",
      `${newest?.hasProgress ? Math.round(newest.progress) : 0}%`
    );
  }

  // Helpers

  #fileName(download) {
    return download.target.path
      ? PathUtils.filename(download.target.path)
      : download.source.url;
  }

  /**
   * @param {object} download - The download an entry stands for
   * @returns {string|null} The finished file itself, when it is a picture
   */
  #previewUrl(download) {
    const path = download.succeeded && download.target.path;
    if (!path || !lazy.canDrawThumbnail(path)) {
      return null;
    }
    return PathUtils.toFileURI(path);
  }

  #isPending(download) {
    return (
      !!download &&
      (!download.stopped || (download.canceled && download.hasPartialData))
    );
  }

  #joinStatus(...parts) {
    return parts
      .filter(Boolean)
      .reduce((a, b) => lazy.DownloadsCommon.strings.statusSeparator(a, b));
  }

  #iconUrl(download) {
    if (!download.target.path) {
      return "moz-icon://.unknown?size=32";
    }
    return `moz-icon://${download.target.path}?size=32${
      download.succeeded ? "&state=normal" : ""
    }`;
  }

  #statusText(download) {
    const strings = lazy.DownloadsCommon.strings;
    const totalBytes = download.hasProgress ? download.totalBytes : -1;
    if (!download.stopped) {
      const [statusText, secondsLeft] = lazy.DownloadUtils.getDownloadStatus(
        download.currentBytes,
        totalBytes,
        download.speed,
        this.#secondsLeft.get(download) ?? Infinity
      );
      this.#secondsLeft.set(download, secondsLeft);
      return statusText;
    }
    this.#secondsLeft.delete(download);
    if (download.deleted) {
      return strings.fileDeleted;
    }
    if (download.succeeded) {
      if (!download.target.exists) {
        return strings.fileMovedOrMissing;
      }
      const parsed = URL.parse(download.source.url);
      const uri = parsed && Services.io.newURI(parsed.href);
      const host = uri
        ? lazy.BrowserUtils.formatURIForDisplay(uri, { onlyBaseDomain: true })
        : "";
      const [date] = lazy.DownloadUtils.getReadableDates(
        new Date(download.endTime)
      );
      return this.#joinStatus(
        lazy.DownloadsViewUI.getSizeWithUnits(download),
        host,
        date
      );
    }
    if (download.canceled && download.hasPartialData) {
      return this.#joinStatus(
        strings.statePaused,
        lazy.DownloadUtils.getTransferTotal(download.currentBytes, totalBytes)
      );
    }
    if (download.error?.becauseBlockedByParentalControls) {
      return strings.stateBlockedParentalControls;
    }
    if (download.error?.becauseBlockedByReputationCheck) {
      return strings.blockedMalware;
    }
    return download.canceled ? strings.stateCanceled : strings.stateFailed;
  }

  #contextMenuItems(download) {
    const C = lazy.DownloadsCommon;
    const state = C.stateOfDownload(download);
    const isActive =
      state === C.DOWNLOAD_DOWNLOADING || state === C.DOWNLOAD_PAUSED;
    const fileExists =
      state === C.DOWNLOAD_FINISHED &&
      download.target?.exists !== false &&
      !download.deleted;
    const sourceUrl = download.source?.originalUrl || download.source?.url;
    const items = [];
    if (state === C.DOWNLOAD_DOWNLOADING) {
      items.push({
        l10nId: "downloads-cmd-pause",
        onClick: () => download.cancel().catch(() => {}),
      });
    } else if (state === C.DOWNLOAD_PAUSED) {
      items.push({
        l10nId: "downloads-cmd-resume",
        onClick: () => download.start?.().catch(() => {}),
      });
    }
    if (fileExists) {
      items.push({
        l10nId: "downloads-cmd-show-menuitem-2",
        onClick: () =>
          C.showDownloadedFile(new lazy.FileUtils.File(download.target.path)),
      });
    }
    if (sourceUrl) {
      items.push({
        l10nId: "downloads-cmd-go-to-download-page",
        onClick: () => this.#window.openTrustedLinkIn(sourceUrl, "tab"),
      });
      items.push({
        l10nId: "downloads-cmd-copy-download-link",
        onClick: () =>
          Cc["@mozilla.org/widget/clipboardhelper;1"]
            .getService(Ci.nsIClipboardHelper)
            .copyString(sourceUrl),
      });
    }
    items.push({ separator: true });
    if (fileExists) {
      items.push({
        l10nId: "downloads-cmd-delete-file",
        onClick: () =>
          C.deleteDownloadFiles(
            download,
            lazy.DownloadsViewUI.clearHistoryOnDelete
          ).catch(console.error),
      });
    }
    if (!isActive) {
      items.push({
        l10nId: "downloads-cmd-remove-from-history",
        onClick: () => C.deleteDownload(download).catch(console.error),
      });
    }
    return items;
  }

  #showContextMenu(event, download) {
    if (!download) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const document = this.#window.document;
    const popup = document.createXULElement("menupopup");
    for (const item of this.#contextMenuItems(download)) {
      if (item.separator) {
        if (popup.lastChild && popup.lastChild.tagName !== "menuseparator") {
          popup.appendChild(document.createXULElement("menuseparator"));
        }
        continue;
      }
      const menuitem = document.createXULElement("menuitem");
      menuitem.setAttribute("data-l10n-id", item.l10nId);
      menuitem.addEventListener(
        "command",
        () => {
          try {
            item.onClick();
          } catch (ex) {
            console.error(ex);
          }
        },
        { once: true }
      );
      popup.appendChild(menuitem);
    }
    if (popup.lastChild?.tagName === "menuseparator") {
      popup.lastChild.remove();
    }
    if (!popup.childElementCount) {
      return;
    }

    this.#contextMenuOpen = true;
    popup.addEventListener(
      "popuphidden",
      () => {
        this.#contextMenuOpen = false;
        popup.remove();
        this.#scheduleClose();
      },
      { once: true }
    );
    document.getElementById("mainPopupSet").appendChild(popup);
    popup.openPopupAtScreen(event.screenX, event.screenY, true);
  }
}

const stacks = new WeakMap();

export const ZenLibraryWidget = {
  id: "zen-library-button",
  l10nId: "zen-library-button",
  _introducedByPref: "zen.library.enabled",

  onCreated(node) {
    stacks.set(node.ownerDocument, new ZenLibraryDownloadStack(node));
  },

  onDestroyed(document) {
    stacks.get(document)?.destroy();
    stacks.delete(document);
  },

  attachLibrary(library) {
    stacks.get(library.ownerDocument)?.attachLibrary(library);
  },

  detachLibrary(library) {
    stacks.get(library.ownerDocument)?.detachLibrary(library);
  },
};
