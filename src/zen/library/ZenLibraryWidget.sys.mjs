/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  CustomizableWidgets:
    "moz-src:///browser/components/customizableui/CustomizableWidgets.sys.mjs",
  DownloadsCommon:
    "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  DownloadsViewUI:
    "moz-src:///browser/components/downloads/DownloadsViewUI.sys.mjs",
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
});

export const ZenLibraryWidget = {
  id: "zen-library-button",
  l10nId: "zen-library-button",
  _introducedByPref: "zen.library.enabled",
  _toolbarButton: null,
  _downloadData: null,
  _buttonBadge: null,
  _firstEntryBadge: null,
  _firstEntry: null,
  _downloads: [],
  _downloadListElement: null,
  _downloadListEntries: [],
  _inBatch: false,
  _loaded: false,
  _secondsLeft: new WeakMap(),
  _showProgress: 1,
  _progressMotion: null,
  _cmpBinding: null,
  _insideDownloadPanel: false,
  _insideToolbarButton: false,
  _contextMenuOpen: false,
  _recentNewDownload: false,
  onCreated(aNode) {
    aNode.setAttribute("command", "cmd_zenToggleLibrary");

    this._downloadData = lazy.DownloadsCommon.getData(this.window, true);
    this._downloadData.addView(this);

    aNode.classList.add("toolbarbutton-badge-stack-host");
    aNode.appendChild(this.buildBadge());
    this._buttonBadge = aNode.querySelector(
      ".zen-library-download-badge"
    );
    this._buttonBadge.id = "library-button-badge";

    aNode.addEventListener("mouseenter", this.mouseEnter.bind(this));
    aNode.addEventListener("mouseleave", this.mouseLeave.bind(this));

    this._toolbarButton = aNode;
    this.buildDownloadList();

    this._updateProgress(0);
  },

  checkMousePosition(event) {
    const HOVER_TOLERANCE_SIDE_PX = 20;
    const HOVER_TOLERANCE_TOP_PX = 40;

    if (this._contextMenuOpen) {
      return;
    }

    const x = event?.clientX ?? -Infinity;
    const y = event?.clientY ?? -Infinity;
    const panelRect = this._downloadListElement.getBoundingClientRect();
    const left =
      Math.min(panelRect.left, panelRect?.left ?? panelRect.left) -
      HOVER_TOLERANCE_SIDE_PX;
    const right =
      Math.max(panelRect.right, panelRect?.right ?? panelRect.right) +
      HOVER_TOLERANCE_SIDE_PX;
    const top = panelRect.top - HOVER_TOLERANCE_TOP_PX;
    const bottom =
      Math.max(panelRect.bottom, panelRect?.bottom ?? panelRect.bottom) +
      HOVER_TOLERANCE_SIDE_PX;
    if (x < left || x > right || y < top || y > bottom) {
      this._insideDownloadPanel = false;
      this.checkClose();
      return;
    }
    this._insideDownloadPanel = true;
  },

  mouseEnterDownloadsList() {
    this.attachMouseTracker();
  },

  mouseEnter() {
    this._insideToolbarButton = true;
    this.animateToggle(1);
  },

  mouseLeave() {
    this._insideToolbarButton = false;

    const CLOSE_TIME = 200;
    this.window.setTimeout(() => {
      this.checkClose();
    }, CLOSE_TIME);
  },

  checkClose() {
    if (!this._insideDownloadPanel && 
        !this._insideToolbarButton) {
      this.detachMouseTracker();
      this.animateToggle(0);
      this._recentNewDownload = false;
    }
  },
        
  attachMouseTracker() {
    if (this._cmpBinding) {
      return;
    }

    this._cmpBinding = this.checkMousePosition.bind(this);
    this.window.addEventListener("mousemove", this._cmpBinding);
  },

  detachMouseTracker() {
    if (!this._cmpBinding) {
      return;
    }

    this.window.removeEventListener("mousemove", this._cmpBinding);
    this._cmpBinding = null;
  },

  animateToggle(isOpen) {
    if (this._progressMotion) {
      this._progressMotion.stop();
      this._progressMotion = null;
    }

    const value = isOpen ? 1 : 0;
    this._progressMotion = this.window.gZenUIManager.motion.animate(
      this._showProgress,
      value,
      {
        type: "spring",
        stiffness: 720,
        damping: 47,
        mass: 1.2,
        onUpdate: latest => {
          this._updateProgress(latest);
        },
        onComplete: () => {
          this._updateProgress(value);
        },
      }
    );
  },

  _updateProgress(value) {
    this._showProgress = value;

    const target = this._firstEntryBadge;
    const badge = this._buttonBadge;

    [...this._downloadListEntries, badge].forEach(entry => {
      entry.style.setProperty("--progress", value);
    });

    const showBadge = this._isBadgeShowing();

    if (value === 1 || !showBadge) {
      target.style.visibility = "initial";
      badge.style.visibility = "hidden";
    } else {
      target.style.visibility = "hidden";
      badge.style.visibility = "initial";
    }

    if (value === 0) {
      this._downloadListElement.style.display = "none";
      this._hideMask();
    } else {
      this._showMask(value);
      this._downloadListElement.style.display = "initial";
    }

    const targetRelative = this._getRelativeCoordinates(target, badge);
    const a = { x: 12, y: -12 };
    const b = { x: targetRelative.left, y: targetRelative.top };
    const arcPoint = this._pointOnArc(a, b, value);

    Object.assign(badge.style, {
      left: `${arcPoint.x}px`,
      top: `${arcPoint.y}px`,
    });
  },

  _isBadgeShowing() {
    return this._isPending(this._firstEntry.download) || this._recentNewDownload;
  },

  _getRelativeCoordinates(targetElement, movingElement) {
    const targetRect = targetElement.getBoundingClientRect();
    const movingRect = movingElement.getBoundingClientRect();

    const computed = this.window.getComputedStyle(movingElement);

    const currentLeft = parseFloat(computed.left) || 0;
    const currentTop = parseFloat(computed.top) || 0;

    return {
      left: currentLeft + (targetRect.left - movingRect.left),
      top: currentTop + (targetRect.top - movingRect.top),
    };
  },

  _pointOnArc(A, B, t) {
    const midpoint = {
      x: (A.x + B.x) / 2,
      y: (A.y + B.y) / 2,
    };
    const control = {
      x: midpoint.x + Math.abs(B.y - A.y) / 2,
      y: midpoint.y - Math.abs(B.x - A.x) / 2,
    };
    const inverseT = 1 - t;

    return {
      x:
        inverseT ** 2 * A.x + 2 * inverseT * t * control.x + t ** 2 * B.x,
      y:
        inverseT ** 2 * A.y + 2 * inverseT * t * control.y + t ** 2 * B.y,
    };
  },

  buildBadge() {
    const badge = this.window.MozXULElement.parseXULToFragment(`
      <box class="toolbarbutton-badge-stack">
        ${this.getBadge()}
      </box>
    `);
    return badge;
  },

  getBadge() {
    return `
      <span class="zen-library-download-badge">
        <span class="zen-library-download-progress"></span>
      </span>
    `;
  },

  updateButtonBadgeVisibility() {
    const showBadge = this._isBadgeShowing();
    if (!showBadge) {
      this._firstEntryBadge.style.visibility = "initial";
      this._buttonBadge.style.visibility = "hidden";
    } else {
      this._firstEntryBadge.style.visibility = "hidden";
      this._buttonBadge.style.visibility = "initial";
    }
  },

  updateBadge(badge, download) {
    if (!badge) {
      return;
    }

    const pending = download && this._isPending(download);
    const progress = download?.hasProgress ? download.progress : 0;
    const progressElement = badge.querySelector(
      ".zen-library-download-progress"
    );
    const badgeStack = this._toolbarButton.querySelector(
      ".toolbarbutton-badge-stack"
    );

    badge.toggleAttribute("downloading", pending);
    badgeStack.toggleAttribute("downloading", pending);

    if (download) {
      badge.style.setProperty(
        "--download-image",
        `url('${this._iconUrl(download)}')`
      );
    }
    progressElement.style.setProperty("--value", progress);
  },

  buildDownloadList() {
    const DISPLAYED_DOWNLOAD_ENTRIES = 4;

    const footButtons = this.window.document.getElementById(
      "zen-sidebar-foot-buttons"
    );
    const downloadFragment = this.window.MozXULElement.parseXULToFragment(`
      <box id="zen-library-download-list">
      </box>
    `);
    footButtons.appendChild(downloadFragment);
    this._downloadListElement = this.window.document.getElementById(
      "zen-library-download-list"
    );

    this._downloadListElement.addEventListener("mouseenter", this.mouseEnterDownloadsList.bind(this));

    for (let i = 0; i < DISPLAYED_DOWNLOAD_ENTRIES; i++) {
      const element = `
        <div id="zen-library-download-list-download-${i}" class="zen-library-download-list-download">
          ${this.getBadge()}
          <vbox class="zen-library-download-list-title-container">
            <span class="zen-library-download-list-title"></span>
            <span class="zen-library-download-list-subtitle"></span>
          </vbox>
        </div>
      `;
      const downloadItemFragment =
        this.window.MozXULElement.parseXULToFragment(element);
      this._downloadListElement.appendChild(downloadItemFragment);
    }

    for (let i = 0; i < DISPLAYED_DOWNLOAD_ENTRIES; i++) {
      const downloadItem = this.window.document.getElementById(
        `zen-library-download-list-download-${i}`
      );
      if (i == DISPLAYED_DOWNLOAD_ENTRIES - 1) {
        this._firstEntry = downloadItem;
        this._firstEntryBadge = downloadItem.querySelector(
          ".zen-library-download-badge"
        );
      }

      downloadItem.addEventListener("click", (e) => {
        if (e.button !== 0)
          return;
        const dl = downloadItem.download;
        if (dl.succeeded) {
          lazy.DownloadsCommon.openDownload(dl).catch(console.error);
        } else if (dl.source?.url) {
          this.window.openTrustedLinkIn(dl.source.url, "tab");
        }
      });
      downloadItem.addEventListener("contextmenu", e => this._showContextMenu(e, downloadItem.download));

      this._downloadListEntries.push(downloadItem);
    }

    this.updateDownloadList();
  },

  getDownloadForIndex(i) {
    return this._downloads[i];
  },

  getDownloadTitle(download) {
    return this._fileName(download);
  },

  getDownloadSubtitle(download) {
    return this._statusText(download);
  },

  updateDownloadList() {
    const revDownloads = this._downloads.toReversed();
    const revDownloadList = this._downloadListEntries.toReversed();

    let entryIndex = 0;
    for (let i = 0; i < revDownloads.length; i++) {
      if (entryIndex >= revDownloadList.length) {
        break;
      }

      const download = revDownloads[i];
      if (!download) {
        continue;
      }

      const downloadEntryNode = revDownloadList[i];
      downloadEntryNode.hidden = false;
      downloadEntryNode.download = download;

      this.updateBadge(
        downloadEntryNode.querySelector(".zen-library-download-badge"),
        download
      );

      downloadEntryNode.querySelector(
        ".zen-library-download-list-title"
      ).textContent = this.getDownloadTitle(download);
      downloadEntryNode.querySelector(
        ".zen-library-download-list-subtitle"
      ).textContent = this.getDownloadSubtitle(download);

      entryIndex++;
    }

    const tabs = this.window.gBrowser?.tabContainer;
    if (tabs) {
      const entryHeight = 60;
      tabs.style.setProperty(
        "--zen-library-stack-height",
        `${entryHeight * (entryIndex)}px`
      );
    }

    for (let j = entryIndex; j < revDownloadList.length; j++) {
      const downloadEntryNode = revDownloadList[j];
      downloadEntryNode.hidden = true;
      downloadEntryNode.download = null;
    }
  },

  _showMask(opacity) {
    const tabs = this.window.gBrowser?.tabContainer;
    tabs?.setAttribute("zen-library-stack-open", "true");
    tabs?.style.setProperty("--zen-library-mask-opacity", opacity);
  },

  _hideMask() {
    const tabs = this.window.gBrowser?.tabContainer;
    tabs?.removeAttribute("zen-library-stack-open");
  },

  // DownloadList view

  onDownloadBatchStarting() {
    this._inBatch = true;
  },

  onDownloadBatchEnded() {
    this._inBatch = false;
    this._loaded = true;
    this.requestUpdate();
  },

  onDownloadAdded(download, { insertBefore } = {}) {
    const index = insertBefore
      ? this._downloads.indexOf(insertBefore)
      : -1;
    if (index === -1) {
      this._downloads.push(download);
    } else {
      this._downloads.splice(index, 0, download);
    }
    
    if (this._loaded) {
      this._recentNewDownload = true;
    }

    this.updateButtonBadgeVisibility();
    this._scheduleUpdate();
  },

  onDownloadChanged() {
    this._scheduleUpdate();
  },

  onDownloadRemoved(download) {
    const index = this._downloads.indexOf(download);
    if (index !== -1) {
      this._downloads.splice(index, 1);
    }
    this._scheduleUpdate();
  },

  _scheduleUpdate() {
    if (!this._inBatch) {
      this.requestUpdate();
    }
  },

  requestUpdate() {
    this.updateDownloadList();
    const latestDownload = this._downloads[this._downloads.length - 1];
    this.updateBadge(this._buttonBadge, latestDownload);
  },

  // Helpers
  _fileName(download) {
    return download.target.path
      ? PathUtils.filename(download.target.path)
      : download.source.url;
  },

  _isPending(download) {
    if (!download) 
      return false;
    return (
      !download.stopped || (download.canceled && download.hasPartialData)
    );
  },

  _joinStatus(...parts) {
    return parts
      .filter(Boolean)
      .reduce((a, b) =>
        lazy.DownloadsCommon.strings.statusSeparator(a, b)
      );
  },

  _iconUrl(download) {
    if (!download.target.path) {
      return "moz-icon://.unknown?size=32";
    }
    return `moz-icon://${download.target.path}?size=32${
      download.succeeded ? "&state=normal" : ""
    }`;
  },

  _statusText(download) {
    const strings = lazy.DownloadsCommon.strings;
    const totalBytes = download.hasProgress ? download.totalBytes : -1;
    if (!download.stopped) {
      const [statusText, secondsLeft] =
        lazy.DownloadUtils.getDownloadStatus(
          download.currentBytes,
          totalBytes,
          download.speed,
          this._secondsLeft.get(download) ?? Infinity
        );
      this._secondsLeft.set(download, secondsLeft);
      return statusText;
    }
    this._secondsLeft.delete(download);
    if (download.deleted) {
      return strings.fileDeleted;
    }
    if (download.succeeded) {
      if (!download.target.exists) {
        return strings.fileMovedOrMissing;
      }
      const uri = URL.parse(download.source.url)?.URI;
      const host = uri
        ? lazy.BrowserUtils.formatURIForDisplay(uri, {
            onlyBaseDomain: true,
          })
        : "";
      const [date] = lazy.DownloadUtils.getReadableDates(
        new Date(download.endTime)
      );
      return this._joinStatus(
        lazy.DownloadsViewUI.getSizeWithUnits(download),
        host,
        date
      );
    }
    if (download.canceled && download.hasPartialData) {
      return this._joinStatus(
        strings.statePaused,
        lazy.DownloadUtils.getTransferTotal(
          download.currentBytes,
          totalBytes
        )
      );
    }
    if (download.error?.becauseBlockedByParentalControls) {
      return strings.stateBlockedParentalControls;
    }
    if (download.error?.becauseBlockedByReputationCheck) {
      return strings.blockedMalware;
    }
    return download.canceled
      ? strings.stateCanceled
      : strings.stateFailed;
  },

  _showContextMenu(event, dl) {
    if (!dl) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const C = lazy.DownloadsCommon;
    const state = C.stateOfDownload(dl);
    const isFinished = state === C.DOWNLOAD_FINISHED;
    const isActive =
      state === C.DOWNLOAD_DOWNLOADING || state === C.DOWNLOAD_PAUSED;
    const fileExists = isFinished && dl.target?.exists !== false && !dl.deleted;
    const sourceUrl = dl.source?.originalUrl || dl.source?.url;
    const items = [];

    if (state === C.DOWNLOAD_DOWNLOADING) {
      items.push({
        l10nId: "downloads-cmd-pause",
        onClick: () => dl.cancel().catch(() => {}),
      });
    } else if (state === C.DOWNLOAD_PAUSED) {
      items.push({
        l10nId: "downloads-cmd-resume",
        onClick: () => dl.start?.().catch(() => {}),
      });
    }

    if (fileExists) {
      items.push({
        l10nId: "downloads-cmd-show-menuitem-2",
        onClick: () => {
          try {
            const file = new lazy.FileUtils.File(dl.target.path);
            C.showDownloadedFile(file);
          } catch (ex) {
            console.error(ex);
          }
        },
      });
    }

    if (sourceUrl) {
      items.push({
        l10nId: "downloads-cmd-go-to-download-page",
        onClick: () => this.window.openTrustedLinkIn(sourceUrl, "tab"),
      });
      items.push({
        l10nId: "downloads-cmd-copy-download-link",
        onClick: () => {
          const helper = Cc[
            "@mozilla.org/widget/clipboardhelper;1"
          ].getService(Ci.nsIClipboardHelper);
          helper.copyString(sourceUrl);
        },
      });
    }

    items.push({ separator: true });

    if (fileExists) {
      items.push({
        l10nId: "downloads-cmd-delete-file",
        onClick: () => {
          C.deleteDownloadFiles(
            dl,
            lazy.DownloadsViewUI.clearHistoryOnDelete
          ).catch(console.error);
        },
      });
    }

    if (!isActive) {
      items.push({
        l10nId: "downloads-cmd-remove-from-history",
        onClick: () => C.deleteDownload(dl).catch(console.error),
      });
    }

    if (!items.some(i => !i.separator)) {
      return;
    }

    const document = this.window.document;
    const popupSet = document.getElementById("mainPopupSet");
    const popup = document.createXULElement("menupopup");
    for (const item of items) {
      if (item.separator) {
        if (
          !popup.lastChild ||
          popup.lastChild.tagName === "menuseparator"
        ) {
          continue;
        }
        popup.appendChild(document.createXULElement("menuseparator"));
        continue;
      }
      const mi = document.createXULElement("menuitem");
      mi.setAttribute("data-l10n-id", item.l10nId);
      mi.addEventListener(
        "command",
        () => {
          try {
            item.onClick?.();
          } catch (ex) {
            console.error(ex);
          }
        },
        { once: true }
      );
      popup.appendChild(mi);
    }
    
    while (popup.lastChild?.tagName === "menuseparator") {
      popup.lastChild.remove();
    }
    
    this._contextMenuOpen = true;
    popup.addEventListener(
      "popuphidden",
      () => {
        this._contextMenuOpen = false;
        popup.remove();
        this._checkMousePosition();
      },
      { once: true }
    );
    popupSet.appendChild(popup);
    popup.openPopupAtScreen(event.screenX, event.screenY, true);
  }
};