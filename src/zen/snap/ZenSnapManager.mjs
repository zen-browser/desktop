// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

/**
 * Manages the Zen Snap feature - quick tjray for recent files and clipboard
 * Allows users to attach files from clipboard, recent downloads, or recent files
 */
class nsZenSnapManager extends nsZenDOMOperatedFeature {
  #modalElement = null;
  #closeBtn = null;
  #browseAllBtn = null;
  #clipboardStatus = null;
  #downloadsContainer = null;
  #downloadsStatus = null;
  #currentActor = null;
  #currentInputData = null;
  #dismissTimeout = null;

  init() {
    this.#setupElements();
    console.warn("[ZenSnapManager] Initialized successfully.");
  }

  #setupElements() {
    this.#modalElement = document.getElementById("zen-snap-modal");
    if (!this.#modalElement) {
      console.warn(
        "[ZenSnapManager] #zen-snap-modal element not found in DOM."
      );
      return;
    }

    this.#closeBtn = document.getElementById("zen-snap-close-btn");
    this.#browseAllBtn = document.getElementById("zen-snap-browse-all-btn");
    this.#clipboardStatus = document.getElementById(
      "zen-snap-clipboard-status"
    );
    this.#downloadsContainer = document.getElementById(
      "zen-snap-downloads-container"
    );
    this.#downloadsStatus = document.getElementById(
      "zen-snap-downloads-status"
    );

    this.#closeBtn?.addEventListener("command", () => this.hideModal());
    this.#browseAllBtn?.addEventListener("command", () =>
      this.#onBrowseAllClicked()
    );
  }

  #onBrowseAllClicked() {
    console.warn(
      "[ZenSnapManager] Browse all clicked. Calling actor:",
      this.#currentActor
    );
    if (this.#currentActor) {
      this.#currentActor.openNativeFilePicker(
        this.#currentInputData?.accept,
        this.#currentInputData?.multiple
      );
    } else {
      console.error(
        "[ZenSnapManager] No active actor available for file picker."
      );
    }
    this.hideModal();
  }

  #selectFile(filePath) {
    if (filePath) {
      this.#currentActor?.sendFilesToContent([filePath]);
      this.hideModal();
    }
  }

  async getRecentDownloads(limit = 5) {
    try {
      const Downloads = window.Downloads;
      const list = await Downloads.getList(Downloads.ALL);
      const allDownloads = await list.getAll();

      return allDownloads
        .filter(download => download.succeeded && download.target?.exists)
        .slice(-limit)
        .reverse();
    } catch (error) {
      console.error("[ZenSnapManager] Failed to fetch downloads:", error);
      return [];
    }
  }

  getClipboardInfo() {
    try {
      const clipboard = Services.clipboard;
      const kGlobal = Ci.nsIClipboard.kGlobalClipboard;

      const hasImage = clipboard.hasDataMatchingFlavors(
        ["image/png", "image/jpeg", "image/bmp", "image/gif"],
        kGlobal
      );

      const hasFile = clipboard.hasDataMatchingFlavors(
        ["application/x-moz-file"],
        kGlobal
      );

      return {
        hasImage,
        hasFile,
      };
    } catch (error) {
      console.error("[ZenSnapManager] Failed to check clipboard:", error);
      return {
        hasImage: false,
        hasFile: false,
      };
    }
  }

  hideModal() {
    if (this.#modalElement) {
      this.#modalElement.classList.remove("zen-snap-visible");
      this.#modalElement.classList.add("zen-snap-hidden");
      setTimeout(() => {
        if (this.#modalElement.classList.contains("zen-snap-hidden")) {
          this.#modalElement.hidden = true;
        }
      }, 200);
    }
    if (this.#dismissTimeout) {
      clearTimeout(this.#dismissTimeout);
      this.#dismissTimeout = null;
    }
  }

  #showModal(data, downloads, clipboardInfo) {
    if (!this.#modalElement) {
      this.#setupElements();
    }
    if (!this.#modalElement) {
      return;
    }

    if (this.#clipboardStatus) {
      if (clipboardInfo.hasImage) {
        this.#clipboardStatus.setAttribute("value", "Image ready in clipboard");
        this.#clipboardStatus.classList.remove("zen-snap-item-empty");
      } else if (clipboardInfo.hasFile) {
        this.#clipboardStatus.setAttribute("value", "File ready in clipboard");
        this.#clipboardStatus.classList.remove("zen-snap-item-empty");
      } else {
        this.#clipboardStatus.setAttribute(
          "value",
          "No image or file in clipboard"
        );
        this.#clipboardStatus.classList.add("zen-snap-item-empty");
      }
    }

    if (this.#downloadsContainer) {
      const existingItems = this.#downloadsContainer.querySelectorAll(
        ".zen-snap-download-item"
      );
      for (const item of existingItems) {
        item.remove();
      }

      if (downloads.length) {
        if (this.#downloadsStatus) {
          this.#downloadsStatus.hidden = true;
        }
        for (const dl of downloads) {
          const item = document.createXULElement("hbox");
          item.className = "zen-snap-download-item";
          item.setAttribute("align", "center");

          const nameLabel = document.createXULElement("label");
          nameLabel.className = "zen-snap-download-name";
          const fileName = dl.target?.path
            ? dl.target.path.split("/").pop()
            : "Downloaded file";
          nameLabel.setAttribute("value", fileName);
          nameLabel.setAttribute("crop", "end");
          nameLabel.setAttribute("flex", "1");

          item.appendChild(nameLabel);
          if (dl.target?.path) {
            item.addEventListener("click", () =>
              this.#selectFile(dl.target.path)
            );
          }
          this.#downloadsContainer.appendChild(item);
        }
      } else if (this.#downloadsStatus) {
        this.#downloadsStatus.hidden = false;
        this.#downloadsStatus.setAttribute(
          "value",
          "No recent downloads found"
        );
      }
    }

    const position = Services.prefs.getStringPref(
      "zen.snap.position",
      "bottom-center"
    );
    this.#modalElement.setAttribute("data-position", position);

    this.#modalElement.hidden = false;
    this.#modalElement.classList.remove("zen-snap-hidden");
    this.#modalElement.classList.add("zen-snap-visible");

    if (this.#dismissTimeout) {
      clearTimeout(this.#dismissTimeout);
    }
  }

  async onInputClicked(data, actor) {
    this.#currentActor = actor;
    this.#currentInputData = data;
    console.warn("[ZenSnapManager] Input click intercepted:", data);

    const clipboardInfo = this.getClipboardInfo();
    const downloads = await this.getRecentDownloads();

    this.#showModal(data, downloads, clipboardInfo);
  }
}

window.gZenSnapManager = new nsZenSnapManager();
