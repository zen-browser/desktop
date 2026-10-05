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
  FILE_GROUPS: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
  canDrawThumbnail: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
  fileGroupOf: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
  transferText: "moz-src:///zen/library/ZenLibraryUtils.sys.mjs",
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  DownloadsCommon:
    "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
  DownloadsViewUI:
    "moz-src:///browser/components/downloads/DownloadsViewUI.sys.mjs",
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

function clearDownloads() {
  lazy.DownloadsCommon.getData(window, true).removeFinished();
  lazy.PlacesUtils.history
    .removeVisitsByFilter({
      transition: lazy.PlacesUtils.history.TRANSITIONS.DOWNLOAD,
    })
    .catch(console.error);
}

const FILE_MIME = "application/x-moz-file";
const OPENING_FEEDBACK_MS = 1500;

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
  #finishedStatuses = new WeakMap();

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

  /** The view of the old library window this section stands in for. */
  static legacyLibraryView = "Downloads";

  /** @returns {object[]} What a right click on the downloads tab offers */
  static get tabMenu() {
    return [{ l10nId: "library-downloads-clear-all", command: clearDownloads }];
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
        options: lazy.FILE_GROUPS.map(id => ({
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
    return lazy.fileGroupOf(this.#fileName(download)) ?? undefined;
  }

  #activeTypes() {
    return lazy.FILE_GROUPS.filter(id => this.isFilterActive("type", id));
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

  /**
   * @param {object} download - The download a row stands for
   * @returns {string|null} The finished file itself, when it is a picture
   *   worth showing in place of a file icon
   */
  #previewUrl(download) {
    const path = download.succeeded && download.target.path;
    if (!path || !lazy.canDrawThumbnail(path)) {
      return null;
    }
    return PathUtils.toFileURI(path);
  }

  /**
   * @param {object} download - The download a row stands for
   * @returns {boolean} Whether the file it brought in is gone from where it
   *   was put
   */
  #isMissing(download) {
    return download.deleted || (download.succeeded && !download.target.exists);
  }

  #isPending(download) {
    return !download.stopped || (download.canceled && download.hasPartialData);
  }

  #joinStatus(...parts) {
    return parts
      .filter(Boolean)
      .reduce((a, b) => lazy.DownloadsCommon.strings.statusSeparator(a, b));
  }

  /**
   * What a finished download's row says under its name. Nothing in it changes
   * while the download sits there, but a row builds its line again every time
   * it is drawn.
   *
   * @param {object} download - A download that finished
   * @returns {string} Its status line
   */
  #finishedStatus(download) {
    const day = new Date().setHours(0, 0, 0, 0);
    const kept = this.#finishedStatuses.get(download);
    if (
      kept &&
      kept.day === day &&
      kept.endTime === download.endTime &&
      kept.url === download.source.url &&
      kept.size === download.target.size
    ) {
      return kept.text;
    }
    const parsed = URL.parse(download.source.url);
    const uri = parsed && Services.io.newURI(parsed.href);
    const host = uri
      ? lazy.BrowserUtils.formatURIForDisplay(uri, { onlyBaseDomain: true })
      : "";
    const [date] = lazy.DownloadUtils.getReadableDates(
      new Date(download.endTime)
    );
    const text = this.#joinStatus(
      lazy.DownloadsViewUI.getSizeWithUnits(download),
      host,
      date
    );
    this.#finishedStatuses.set(download, {
      day,
      endTime: download.endTime,
      url: download.source.url,
      size: download.target.size,
      text,
    });
    return text;
  }

  #statusText(download) {
    const strings = lazy.DownloadsCommon.strings;
    if (!download.stopped) {
      return lazy.transferText(download);
    }
    if (download.deleted) {
      return strings.fileDeleted;
    }
    if (download.succeeded) {
      if (!download.target.exists) {
        return strings.fileMovedOrMissing;
      }
      return this.#finishedStatus(download);
    }
    if (download.canceled && download.hasPartialData) {
      return this.#joinStatus(strings.statePaused, lazy.transferText(download));
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

  /**
   * Whether a download that is still coming in will be opened the moment it
   * finishes.
   *
   * @param {object} download
   * @returns {boolean}
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
    this.requestUpdate();
  }

  #onRowClick(download) {
    if (!download.stopped) {
      this.#toggleOpenWhenDone(download);
      return;
    }
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

  #deleteDownloadFile(download) {
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
      case "delete":
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
      case "delete":
        this.#deleteDownloadFile(download);
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
    // eslint-disable-next-line mozilla/valid-services
    Services.zen.playHapticFeedback();
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
        <menuitem data-action="delete" data-l10n-id="library-downloads-menu-delete"/>
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
    let statusNode;
    if (download === this.#openingDownload) {
      statusNode = html`<span
        class="zen-library-download-status"
        data-l10n-id="library-downloads-opening-in"
      ></span>`;
    } else if (this.#opensWhenDone(download)) {
      statusNode = html`<span
        class="zen-library-download-status"
        data-l10n-id="library-downloads-open-when-done"
      ></span>`;
    } else {
      statusNode = html`<span class="zen-library-download-status"
        >${this.#statusText(download)}</span
      >`;
    }
    return html`
      <span class="zen-library-row-subtitle">
        ${statusNode}
        <span class="zen-library-download-url"
          >${this.#formatUrl(download.source.url)}</span
        >
      </span>
    `;
  }

  /**
   * @param {object} download - The download that is still coming in
   * @returns {object} The arc around its icon, where "pathLength" being 100
   *   makes the dashes the percentage of the way there, and one with no total
   *   to go by keeps a quarter of the ring and spins
   */
  #renderProgressRing(download) {
    const dash = download.hasProgress ? Math.round(download.progress) : 25;
    return html`
      <svg class="zen-library-row-progress" viewBox="0 0 32 32">
        <circle class="zen-library-row-progress-track" cx="16" cy="16" r="14" />
        <circle
          class="zen-library-row-progress-arc"
          cx="16"
          cy="16"
          r="14"
          pathLength="100"
          style="stroke-dasharray: ${dash} 100"
        />
      </svg>
    `;
  }

  #renderCancelButton(download) {
    return html`
      <toolbarbutton
        class="toolbarbutton-1"
        data-l10n-id="library-downloads-cancel-button"
        @click=${event => {
          event.stopPropagation();
          this.#cancelDownload(download);
        }}
      >
        <img
          class="toolbarbutton-icon"
          src="chrome://browser/skin/zen-icons/close.svg"
          alt=""
        />
      </toolbarbutton>
    `;
  }

  #renderRetryButton(download) {
    return html`
      <toolbarbutton
        class="toolbarbutton-1"
        data-l10n-id="library-downloads-retry-button"
        @click=${event => {
          event.stopPropagation();
          this.#retryDownload(download);
        }}
      >
        <img
          class="toolbarbutton-icon"
          src="chrome://browser/skin/zen-icons/reload.svg"
          alt=""
        />
      </toolbarbutton>
    `;
  }

  #renderDownload(download) {
    const pending = this.#isPending(download);
    return html`
      <div
        class="zen-library-row"
        draggable="true"
        ?pending=${pending}
        ?missing=${this.#isMissing(download)}
        ?indeterminate=${pending && !download.hasProgress}
        ?paused=${pending && download.stopped}
        ?open-when-done=${this.#opensWhenDone(download)}
        ?opening=${download === this.#openingDownload}
        @click=${() => this.#onRowClick(download)}
        @contextmenu=${event => {
          event.preventDefault();
          this.#openMenu(download, event.currentTarget, null, event);
        }}
        @dragstart=${event => this.#onDragStart(event, download)}
      >
        <div class="zen-library-row-icon-box">
          <img
            class="zen-library-row-icon"
            ?preview=${!pending && !!this.#previewUrl(download)}
            src=${
              pending
                ? "chrome://browser/skin/zen-icons/forward.svg"
                : (this.#previewUrl(download) ?? this.#iconUrl(download))
            }
            @error=${event => {
              if (!event.target.hasAttribute("preview")) {
                return;
              }
              event.target.removeAttribute("preview");
              event.target.src = this.#iconUrl(download);
            }}
            alt=""
          />
          ${when(pending, () => this.#renderProgressRing(download))}
        </div>
        <div class="zen-library-row-text">
          <span class="zen-library-row-title">${this.#fileName(download)}</span>
          ${this.#renderSubtitle(download)}
        </div>
        <div class="zen-library-row-actions">
          ${when(!download.stopped, () => this.#renderCancelButton(download))}
          ${when(this.#canRetry(download), () =>
            this.#renderRetryButton(download)
          )}
          <toolbarbutton
            class="toolbarbutton-1"
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
            <img
              class="toolbarbutton-icon"
              src="chrome://global/skin/icons/more.svg"
              alt=""
            />
          </toolbarbutton>
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
