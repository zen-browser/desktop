// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  DownloadsCommon:
    "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
  DownloadsViewUI:
    "moz-src:///browser/components/downloads/DownloadsViewUI.sys.mjs",
  DownloadUtils: "resource://gre/modules/DownloadUtils.sys.mjs",
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
});

const RECENT_KEEP = 5;
// Mouse can stray this far past the panel/button before we dismiss the stack.
const HOVER_TOLERANCE_TOP_PX = 100;
const HOVER_TOLERANCE_SIDE_PX = 40;

/**
 * Per-window controller for the toolbar Library button:
 *   - Watches downloads and overlays a progress ring on the button while
 *     anything is in flight (indeterminate spinner when total bytes are
 *     unknown).
 *   - Pops a small panel with the most recent finished/active downloads
 *     when the user hovers the button.
 */
class nsZenLibraryButton extends nsZenDOMOperatedFeature {
  #button = null;
  #downloads = null;
  #view = null;
  #active = new Set();
  #recent = [];
  #panel = null;
  #closeAnim = null;
  #trackingMouse = false;
  #contextMenuOpen = false;

  init() {
    this.#button = document.getElementById("zen-library-button");
    if (!this.#button) {
      return;
    }

    this.#setupDownloads();

    this.#button.addEventListener("mouseenter", this);
    window.addEventListener("unload", this, { once: true });
  }

  handleEvent(event) {
    switch (event.type) {
      case "mouseenter":
        this.#onEnter();
        break;
      case "mousemove":
        this.#checkMousePosition(event);
        break;
      case "unload":
        this.#button?.removeEventListener("mouseenter", this);
        this.#detachMouseTracking();
        if (this.#downloads && this.#view) {
          this.#downloads.removeView(this.#view);
        }
        break;
    }
  }

  #setupDownloads() {
    this.#downloads = lazy.DownloadsCommon.getData(window, true);
    this.#view = {
      onDownloadAdded: dl => {
        if (!dl.stopped) {
          this.#active.add(dl);
        } else if (dl.succeeded) {
          this.#pushRecent(dl);
        }
        this.#updateRing();
        this.#refreshPanel();
      },
      onDownloadChanged: dl => {
        if (dl.stopped) {
          this.#active.delete(dl);
          if (dl.succeeded) {
            this.#pushRecent(dl);
          }
        } else {
          this.#active.add(dl);
        }
        this.#updateRing();
        this.#refreshPanel();
      },
      onDownloadRemoved: dl => {
        this.#active.delete(dl);
        this.#recent = this.#recent.filter(d => d !== dl);
        this.#updateRing();
        this.#refreshPanel();
      },
    };
    this.#downloads.addView(this.#view);
  }

  #pushRecent(dl) {
    if (!this.#recent.includes(dl)) {
      this.#recent.unshift(dl);
      this.#recent = this.#recent.slice(0, RECENT_KEEP);
    }
  }

  /** Update the conic-gradient progress + indeterminate state on the button. */
  #updateRing() {
    if (!this.#button) {
      return;
    }
    if (this.#active.size === 0) {
      this.#button.removeAttribute("downloading");
      this.#button.removeAttribute("downloading-indeterminate");
      this.#button.style.removeProperty("--zen-library-button-progress");
      return;
    }
    let total = 0;
    let current = 0;
    let hasUnknown = false;
    for (const dl of this.#active) {
      if (dl.hasProgress && dl.totalBytes > 0) {
        total += dl.totalBytes;
        current += dl.currentBytes;
      } else {
        hasUnknown = true;
      }
    }
    this.#button.setAttribute("downloading", "true");
    if (hasUnknown || total === 0) {
      this.#button.setAttribute("downloading-indeterminate", "true");
      this.#button.style.removeProperty("--zen-library-button-progress");
    } else {
      this.#button.removeAttribute("downloading-indeterminate");
      const ratio = Math.max(0, Math.min(1, current / total));
      this.#button.style.setProperty(
        "--zen-library-button-progress",
        String(ratio)
      );
    }
  }

  #ensurePanel() {
    if (this.#panel) {
      return this.#panel;
    }
    const stack = document.createElement("div");
    stack.id = "zen-library-button-panel";
    stack.classList.add("zen-library-button-panel");
    stack.dataset.state = "closed";

    const list = document.createElement("div");
    list.className = "zen-library-button-panel-list";
    stack.appendChild(list);

    const host = document.getElementById("zen-sidebar-foot-buttons");
    host.before(stack);
    this.#panel = stack;
    return stack;
  }

  #refreshPanel() {
    if (!this.#panel || this.#panel.dataset.state !== "open") {
      return;
    }
    this.#populatePanel();
  }

  #populatePanel() {
    const items = [
      ...Array.from(this.#active),
      ...this.#recent.filter(d => !this.#active.has(d)),
    ].slice(0, RECENT_KEEP);

    if (!items.length) {
      return;
    }

    const panel = this.#ensurePanel();
    const list = panel.querySelector(".zen-library-button-panel-list");
    list.replaceChildren();

    for (const dl of items) {
      list.appendChild(this.#renderRow(dl));
    }
  }

  #renderRow(dl) {
    const row = document.createElement("div");
    row.className = "zen-library-button-panel-row";
    if (this.#isFileMissing(dl)) {
      row.dataset.fileDeleted = "true";
    }
    row.addEventListener("click", () => {
      if (dl.succeeded) {
        lazy.DownloadsCommon.openDownload(dl).catch(console.error);
      } else if (dl.source?.url) {
        window.openTrustedLinkIn(dl.source.url, "tab");
      }
    });
    row.addEventListener("contextmenu", e => this.#showContextMenu(e, dl));

    const icon = document.createElement("img");
    icon.className = "zen-library-button-panel-icon";
    icon.alt = "";
    icon.src = dl.target?.path
      ? `moz-icon://${dl.target.path}?size=16`
      : "moz-icon://.unknown?size=16";
    row.appendChild(icon);

    const labels = document.createElement("div");
    labels.className = "zen-library-button-panel-labels";

    const display = lazy.DownloadsViewUI.getDisplayName(dl);
    const name = typeof display === "string" ? display : dl.source?.url || "";
    const label = document.createXULElement("label");
    label.className = "zen-library-button-panel-name";
    label.textContent = name;
    labels.appendChild(label);

    const sublabel = document.createXULElement("label");
    sublabel.className = "zen-library-button-panel-status";
    sublabel.textContent = this.#statusFor(dl);
    labels.appendChild(sublabel);

    row.appendChild(labels);
    return row;
  }

  /** True when the on-disk file is gone (deleted / moved). */
  #isFileMissing(dl) {
    if (!dl) {
      return false;
    }
    if (dl.deleted) {
      return true;
    }
    return dl.succeeded && dl.target?.exists === false;
  }

  #statusFor(dl) {
    const C = lazy.DownloadsCommon;
    const state = C.stateOfDownload(dl);
    if (state === C.DOWNLOAD_DOWNLOADING) {
      const total = dl.hasProgress ? dl.totalBytes : -1;
      const [status] = lazy.DownloadUtils.getDownloadStatus(
        dl.currentBytes,
        total,
        dl.speed
      );
      return status;
    }
    if (state === C.DOWNLOAD_FINISHED) {
      return (
        lazy.DownloadsViewUI.getSizeWithUnits(dl) ||
        C.strings.sizeUnknown ||
        ""
      );
    }
    if (state === C.DOWNLOAD_PAUSED) {
      return C.strings.statePaused || "Paused";
    }
    if (state === C.DOWNLOAD_FAILED) {
      return C.strings.stateFailed || "Failed";
    }
    if (state === C.DOWNLOAD_CANCELED) {
      return C.strings.stateCanceled || "Canceled";
    }
    return "";
  }

  /**
   * Right-click → small XUL menupopup mirroring the relevant subset of
   * Firefox's `downloadsContextMenu` (built dynamically so we can react to
   * each row's current state). Reuses `browser/downloads.ftl` strings.
   */
  #showContextMenu(event, dl) {
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
        onClick: () => window.openTrustedLinkIn(sourceUrl, "tab"),
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
    // Drop a trailing separator if any.
    while (popup.lastChild?.tagName === "menuseparator") {
      popup.lastChild.remove();
    }
    // Pin the hover panel open for the lifetime of the context menu — the
    // popup briefly steals focus and would otherwise let the mouse-distance
    // check dismiss the stack mid-interaction.
    this.#contextMenuOpen = true;
    popup.addEventListener(
      "popuphidden",
      () => {
        this.#contextMenuOpen = false;
        popup.remove();
        // Re-evaluate distance now that the popup is gone.
        if (this.#panel?.dataset.state === "open") {
          this.#checkMousePosition();
        }
      },
      { once: true }
    );
    popupSet.appendChild(popup);
    popup.openPopupAtScreen(event.screenX, event.screenY, true);
  }

  #onEnter() {
    if (this.#active.size === 0 && this.#recent.length === 0) {
      return;
    }
    // Customize mode can move the button out of the sidebar's foot toolbar —
    // the inline stack only makes sense when it's still there.
    if (!this.#button.closest("#zen-sidebar-foot-buttons")) {
      return;
    }
    // Interrupt a pending close so we reuse the same element instead of
    // racing a tear-down.
    this.#closeAnim?.cancel();
    this.#closeAnim = null;

    const panel = this.#ensurePanel();
    this.#populatePanel();
    panel.dataset.state = "open";
    this.#updateMaskHeight(panel);
    panel.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 180,
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
        fill: "forwards",
        id: "zen-library-stack-open",
      }
    );
    this.#attachMouseTracking();
  }

  /**
   * Publish the panel's rendered height as a CSS variable on the tab strip
   * so the strip's mask gradient fades over exactly the area the stack
   * occupies (instead of a hardcoded amount).
   */
  #updateMaskHeight(panel) {
    const tabs = window.gBrowser?.tabContainer;
    if (!tabs) {
      return;
    }
    requestAnimationFrame(() => {
      if (!panel.isConnected) {
        return;
      }
      const h = Math.ceil(panel.getBoundingClientRect().height);
      tabs.style.setProperty("--zen-library-stack-height", `${h}px`);
      tabs.setAttribute("zen-library-stack-open", "true");
    });
  }

  #attachMouseTracking() {
    if (this.#trackingMouse) {
      return;
    }
    window.addEventListener("mousemove", this, true);
    this.#trackingMouse = true;
  }

  #detachMouseTracking() {
    if (!this.#trackingMouse) {
      return;
    }
    window.removeEventListener("mousemove", this, true);
    this.#trackingMouse = false;
  }

  /**
   * Hide the stack when the cursor moves outside a tolerance zone around the
   * panel + button: HOVER_TOLERANCE_TOP_PX above, HOVER_TOLERANCE_SIDE_PX on
   * either side (and the same below). Pinned open while a context menu is up.
   */
  #checkMousePosition(event) {
    if (this.#contextMenuOpen || !this.#panel) {
      return;
    }
    if (this.#panel.dataset.state !== "open") {
      this.#detachMouseTracking();
      return;
    }
    const x = event?.clientX ?? -Infinity;
    const y = event?.clientY ?? -Infinity;
    const panelRect = this.#panel.getBoundingClientRect();
    const buttonRect = this.#button?.getBoundingClientRect();
    const left =
      Math.min(panelRect.left, buttonRect?.left ?? panelRect.left) -
      HOVER_TOLERANCE_SIDE_PX;
    const right =
      Math.max(panelRect.right, buttonRect?.right ?? panelRect.right) +
      HOVER_TOLERANCE_SIDE_PX;
    const top = panelRect.top - HOVER_TOLERANCE_TOP_PX;
    const bottom =
      Math.max(panelRect.bottom, buttonRect?.bottom ?? panelRect.bottom) +
      HOVER_TOLERANCE_SIDE_PX;
    if (x < left || x > right || y < top || y > bottom) {
      this.#hide();
    }
  }

  #hide() {
    if (!this.#panel || this.#closeAnim) {
      return;
    }
    this.#detachMouseTracking();
    const tabs = window.gBrowser?.tabContainer;
    tabs?.removeAttribute("zen-library-stack-open");
    const panel = this.#panel;
    panel.dataset.state = "closed";
    const anim = panel.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(8px)" },
      ],
      {
        duration: 140,
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
        fill: "forwards",
        id: "zen-library-stack-close",
      }
    );
    this.#closeAnim = anim;
    anim.finished.then(
      () => {
        if (this.#closeAnim !== anim) {
          return;
        }
        panel.remove();
        if (this.#panel === panel) {
          this.#panel = null;
        }
        this.#closeAnim = null;
        tabs?.style.removeProperty("--zen-library-stack-height");
      },
      () => {
        /* cancelled — re-entered while closing */
      }
    );
  }
}

new nsZenLibraryButton();
