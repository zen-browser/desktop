/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, repeat, when } from "chrome://global/content/vendor/lit.all.mjs";
import {
  MS_PER_DAY,
  PAGE_SIZE,
  ZenLibrarySearchSection,
  whenFilterGroup,
} from "moz-src:///zen/library/sections/ZenLibrarySearchSection.mjs";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  DownloadsCommon:
    "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
  DownloadsViewUI:
    "moz-src:///browser/components/downloads/DownloadsViewUI.sys.mjs",
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
});

const FILE_MIME = "application/x-moz-file";
const OPENING_FEEDBACK_MS = 1500;

const FILE_TYPES = {
  images: "png jpg jpeg gif webp svg bmp tif tiff heic heif avif ico",
  video: "mp4 mkv mov avi webm m4v wmv flv mpg mpeg",
  audio: "mp3 wav flac aac ogg oga m4a opus wma aiff",
  documents:
    "pdf doc docx xls xlsx ppt pptx txt md rtf odt ods odp csv epub pages numbers key",
  archives: "zip rar 7z tar gz bz2 xz tgz zst",
  apps: "dmg pkg exe msi app deb rpm appimage apk jar",
};
const EXTENSION_TYPES = new Map();
for (const [type, extensions] of Object.entries(FILE_TYPES)) {
  for (const extension of extensions.split(" ")) {
    EXTENSION_TYPES.set(extension, type);
  }
}

export class ZenLibraryDownloadsSection extends ZenLibrarySearchSection {
  static id = "downloads";
  static label = "library-downloads-section-title";

  static render(library) {
    return html`
      <zen-library-downloads-section
        class="zen-library-section"
        data-section="downloads"
        .library=${library}
      ></zen-library-downloads-section>
    `;
  }

  // Oldest to newest, mirroring the order of the underlying download list.
  #downloads = [];
  #data = null;
  #loaded = false;
  #inBatch = false;
  #limit = PAGE_SIZE;
  #visible = [];
  #refreshed = new WeakSet();
  #secondsLeft = new WeakMap();

  #menu = null;
  #menuDownload = null;
  #menuRow = null;
  #openingDownload = null;
  #openingTimer = null;

  connectedCallback() {
    super.connectedCallback();
    this.#data = lazy.DownloadsCommon.getData(window, true);
    this.#data.addView(this);
    this.#menu = this.#buildMenu();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#data?.removeView(this);
    this.#data = null;
    this.#menu?.hidePopup();
    this.#menu?.remove();
    this.#menu = null;
    clearTimeout(this.#openingTimer);
    this.#openingTimer = null;
    this.#openingDownload = null;
  }

  get searchPlaceholderL10nId() {
    return "places-search-downloads";
  }

  get filterTitleL10nId() {
    return "library-downloads-filter-title";
  }

  get filterGroups() {
    return [
      {
        id: "type",
        titleL10nId: "library-downloads-filter-type",
        options: Object.keys(FILE_TYPES).map(id => ({
          id,
          l10nId: `library-downloads-type-${id}`,
        })),
      },
      whenFilterGroup("library-downloads-filter-when"),
    ];
  }

  onSearchChanged() {
    this.#limit = PAGE_SIZE;
    this.requestUpdate();
  }

  onFiltersChanged() {
    this.#limit = PAGE_SIZE;
    this.requestUpdate();
  }

  onListScrolledToEnd() {
    if (this.#visible.length < this.#limit) {
      return;
    }
    this.#limit += PAGE_SIZE;
    this.requestUpdate();
  }

  // DownloadList view

  onDownloadBatchStarting() {
    this.#inBatch = true;
  }

  onDownloadBatchEnded() {
    this.#inBatch = false;
    this.#loaded = true;
    this.requestUpdate();
  }

  onDownloadAdded(download, { insertBefore } = {}) {
    const index = insertBefore ? this.#downloads.indexOf(insertBefore) : -1;
    if (index === -1) {
      this.#downloads.push(download);
    } else {
      this.#downloads.splice(index, 0, download);
    }
    this.#scheduleUpdate();
  }

  onDownloadChanged() {
    this.#scheduleUpdate();
  }

  onDownloadRemoved(download) {
    const index = this.#downloads.indexOf(download);
    if (index !== -1) {
      this.#downloads.splice(index, 1);
    }
    if (this.#menuDownload === download) {
      this.#menu?.hidePopup();
    }
    this.#scheduleUpdate();
  }

  #scheduleUpdate() {
    if (!this.#inBatch) {
      this.requestUpdate();
    }
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    // Check that the files of rendered downloads still exist, like the
    // downloads panel does when it opens.
    for (const download of this.#visible) {
      if (download.succeeded && !this.#refreshed.has(download)) {
        this.#refreshed.add(download);
        download.refresh().catch(console.error);
      }
    }
  }

  // Helpers

  #fileName(download) {
    return download.target.path
      ? PathUtils.filename(download.target.path)
      : download.source.url;
  }

  #hasFile(download) {
    return download.succeeded && !download.deleted && download.target.exists;
  }

  #file(download) {
    return new lazy.FileUtils.File(download.target.path);
  }

  #formatUrl(url) {
    return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  }

  #matchesQuery(download) {
    const query = this.searchQuery.toLowerCase();
    return (
      this.#fileName(download).toLowerCase().includes(query) ||
      download.source.url.toLowerCase().includes(query)
    );
  }

  #fileType(download) {
    const extension = this.#fileName(download).match(/\.([^.]+)$/)?.[1];
    return extension ? EXTENSION_TYPES.get(extension.toLowerCase()) : undefined;
  }

  #activeTypes() {
    return Object.keys(FILE_TYPES).filter(id =>
      this.isFilterActive("type", id)
    );
  }

  #whenCutoff() {
    const days = this.activeWhenDays;
    return days ? Date.now() - days * MS_PER_DAY : 0;
  }

  #computeVisible() {
    const visible = [];
    const types = this.#activeTypes();
    const cutoff = this.#whenCutoff();
    for (let i = this.#downloads.length - 1; i >= 0; i--) {
      const download = this.#downloads[i];
      if (types.length && !types.includes(this.#fileType(download))) {
        continue;
      }
      if (cutoff && !(download.endTime >= cutoff)) {
        continue;
      }
      if (!this.searchQuery || this.#matchesQuery(download)) {
        visible.push(download);
        if (visible.length >= this.#limit) {
          break;
        }
      }
    }
    return visible;
  }

  #iconUrl(download) {
    if (!download.target.path) {
      return "moz-icon://.unknown?size=32";
    }
    return `moz-icon://${download.target.path}?size=32${
      download.succeeded ? "&state=normal" : ""
    }`;
  }

  #isPending(download) {
    return !download.stopped || (download.canceled && download.hasPartialData);
  }

  #joinStatus(...parts) {
    return parts
      .filter(Boolean)
      .reduce((a, b) => lazy.DownloadsCommon.strings.statusSeparator(a, b));
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
      const uri = URL.parse(download.source.url)?.URI;
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

  // Actions

  #showInFolder(download) {
    if (!this.#hasFile(download)) {
      return;
    }
    lazy.DownloadsCommon.showDownloadedFile(this.#file(download));
  }

  #onRowClick(download) {
    if (!this.#hasFile(download)) {
      return;
    }
    this.#showInFolder(download);
    clearTimeout(this.#openingTimer);
    this.#openingDownload = download;
    this.#openingTimer = setTimeout(() => {
      this.#openingTimer = null;
      this.#openingDownload = null;
      this.requestUpdate();
    }, OPENING_FEEDBACK_MS);
    this.requestUpdate();
  }

  #canRetry(download) {
    return (
      download.stopped &&
      !download.succeeded &&
      (download.canceled || !!download.error)
    );
  }

  #retryDownload(download) {
    if (download.start) {
      // Errors when retrying are already reported as download failures.
      download.start().catch(() => {});
      return;
    }
    // History-only entries have no session object, so download the URL again.
    const targetName = download.target.path
      ? PathUtils.filename(download.target.path)
      : null;
    window.DownloadURL(download.source.url, targetName, document);
  }

  #cancelDownload(download) {
    download.cancel().catch(() => {});
    download
      .removePartialData()
      .catch(console.error)
      .finally(() => download.target.refresh());
  }

  #openDownload(download) {
    if (!this.#hasFile(download)) {
      return;
    }
    lazy.DownloadsCommon.openDownload(download, { openWhere: "tab" });
  }

  #copyFile(download) {
    if (!this.#hasFile(download)) {
      return;
    }
    const transferable = Cc[
      "@mozilla.org/widget/transferable;1"
    ].createInstance(Ci.nsITransferable);
    transferable.init(window.docShell.QueryInterface(Ci.nsILoadContext));
    transferable.addDataFlavor(FILE_MIME);
    transferable.setTransferData(FILE_MIME, this.#file(download));
    Services.clipboard.setData(
      transferable,
      null,
      Services.clipboard.kGlobalClipboard
    );
  }

  #hideDownload(download) {
    lazy.DownloadsCommon.deleteDownload(download).catch(console.error);
  }

  #trashDownload(download) {
    lazy.DownloadsCommon.deleteDownloadFiles(
      download,
      lazy.DownloadsViewUI.clearHistoryOnDelete
    ).catch(console.error);
  }

  #isActionEnabled(action, download) {
    switch (action) {
      case "open":
      case "copy":
      case "show":
        return this.#hasFile(download);
      case "copy-link":
        return !download.source.isDataURICleared;
      case "trash":
        return (
          this.#hasFile(download) ||
          !download.stopped ||
          download.hasPartialData
        );
      default:
        return true;
    }
  }

  #doAction(action, download) {
    switch (action) {
      case "open":
        this.#openDownload(download);
        break;
      case "copy":
        this.#copyFile(download);
        break;
      case "copy-link":
        lazy.DownloadsCommon.copyDownloadLink(download);
        break;
      case "show":
        this.#showInFolder(download);
        break;
      case "hide":
        this.#hideDownload(download);
        break;
      case "trash":
        this.#trashDownload(download);
        break;
    }
  }

  #onDragStart(event, download) {
    if (!this.#hasFile(download) || !this.#file(download).exists()) {
      event.preventDefault();
      return;
    }
    const file = this.#file(download);
    const { dataTransfer } = event;
    dataTransfer.mozSetDataAt(FILE_MIME, file, 0);
    dataTransfer.effectAllowed = "copyMove";
    dataTransfer.setData("text/uri-list", Services.io.newFileURI(file).spec);
    dataTransfer.addElement(event.currentTarget);
  }

  // Context menu

  #buildMenu() {
    const menu = window.MozXULElement.parseXULToFragment(`
      <menupopup class="zen-library-downloads-menu">
        <menuitem data-action="open" data-l10n-id="library-downloads-menu-open"/>
        <menuitem data-action="show" data-l10n-id="downloads-cmd-show-menuitem-2"/>
        <menuseparator/>
        <menuitem data-action="copy" data-l10n-id="library-downloads-menu-copy"/>
        <menuitem data-action="copy-link" data-l10n-id="downloads-cmd-copy-download-link"/>
        <menuseparator/>
        <menuitem data-action="hide" data-l10n-id="library-downloads-menu-hide"/>
        <menuitem data-action="trash" data-l10n-id="library-downloads-menu-trash"/>
      </menupopup>
    `).firstElementChild;
    menu.addEventListener("command", event => {
      if (this.#menuDownload) {
        this.#doAction(event.target.dataset.action, this.#menuDownload);
      }
    });
    menu.addEventListener("popuphidden", () => {
      this.#menuRow?.removeAttribute("menu-open");
      this.#menuRow = null;
      this.#menuDownload = null;
    });
    document.getElementById("mainPopupSet").appendChild(menu);
    return menu;
  }

  #openMenu(download, row, anchor, event) {
    const fileName = this.#fileName(download);
    for (const item of this.#menu.querySelectorAll("menuitem")) {
      const { action } = item.dataset;
      if (action === "open" || action === "copy") {
        document.l10n.setAttributes(item, item.dataset.l10nId, {
          name: fileName,
        });
      }
      item.disabled = !this.#isActionEnabled(action, download);
    }
    this.#menuRow?.removeAttribute("menu-open");
    this.#menuRow = row;
    this.#menuDownload = download;
    row.setAttribute("menu-open", "true");
    if (anchor) {
      this.#menu.openPopup(anchor, "after_end", 0, 4, false, false, event);
    } else {
      this.#menu.openPopupAtScreen(event.screenX, event.screenY, true, event);
    }
  }

  // Rendering

  #renderSubtitle(download) {
    const statusNode =
      download === this.#openingDownload
        ? html`<span
            class="zen-library-download-status"
            data-l10n-id="library-downloads-opening-in"
          ></span>`
        : html`<span class="zen-library-download-status"
            >${this.#statusText(download)}</span
          >`;
    return html`
      <span class="zen-library-row-subtitle">
        ${statusNode}
        <span class="zen-library-download-url"
          >${this.#formatUrl(download.source.url)}</span
        >
      </span>
    `;
  }

  #renderCancelButton(download) {
    return html`
      <button
        data-l10n-id="library-downloads-cancel-button"
        @click=${event => {
          event.stopPropagation();
          this.#cancelDownload(download);
        }}
      >
        <img src="chrome://browser/skin/zen-icons/close.svg" alt="" />
      </button>
    `;
  }

  #renderRetryButton(download) {
    return html`
      <button
        data-l10n-id="library-downloads-retry-button"
        @click=${event => {
          event.stopPropagation();
          this.#retryDownload(download);
        }}
      >
        <img src="chrome://browser/skin/zen-icons/reload.svg" alt="" />
      </button>
    `;
  }

  #renderDownload(download) {
    const pending = this.#isPending(download);
    const progress = download.hasProgress ? download.progress : 0;
    return html`
      <div
        class="zen-library-row"
        draggable="true"
        style="--zen-library-download-progress: ${progress}%"
        ?pending=${pending}
        ?indeterminate=${pending && !download.hasProgress}
        ?paused=${pending && download.stopped}
        ?opening=${download === this.#openingDownload}
        @click=${() => this.#onRowClick(download)}
        @contextmenu=${event => {
          event.preventDefault();
          this.#openMenu(download, event.currentTarget, null, event);
        }}
        @dragstart=${event => this.#onDragStart(event, download)}
      >
        <img
          class="zen-library-row-icon"
          src=${this.#iconUrl(download)}
          alt=""
        />
        <div class="zen-library-row-text">
          <span class="zen-library-row-title">${this.#fileName(download)}</span>
          ${this.#renderSubtitle(download)}
        </div>
        <div class="zen-library-row-actions">
          ${when(!download.stopped, () => this.#renderCancelButton(download))}
          ${when(this.#canRetry(download), () =>
            this.#renderRetryButton(download)
          )}
          <button
            data-l10n-id="library-downloads-more-button"
            @click=${event => {
              event.stopPropagation();
              this.#openMenu(
                download,
                event.currentTarget.closest(".zen-library-row"),
                event.currentTarget,
                event
              );
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  renderItems() {
    if (!this.#loaded) {
      return null;
    }
    this.#visible = this.#computeVisible();
    if (!this.#visible.length) {
      return html`
        <div
          class="zen-library-empty"
          data-l10n-id="library-downloads-empty"
        ></div>
      `;
    }
    return html`
      <div class="zen-library-group">
        ${repeat(
          this.#visible,
          download => download,
          download => this.#renderDownload(download)
        )}
      </div>
    `;
  }
}

customElements.define(
  "zen-library-downloads-section",
  ZenLibraryDownloadsSection
);
