// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

/**
 * Manages the Zen Snap feature - quick tray for recent files and clipboard
 * Allows users to attach files from clipboard, recent downloads, or recent files
 */
class nsZenSnapManager extends nsZenDOMOperatedFeature {
  #modalElement = null;
  #backdropElement = null;
  #closeBtn = null;
  #browseAllBtn = null;
  #emptyStatus = null;
  #clipboardCard = null;
  #clipboardPreview = null;
  #clipboardSubtitle = null;
  #currentClipboardImage = null;
  #downloadCard = null;
  #downloadPreview = null;
  #downloadTitle = null;
  #downloadSubtitle = null;
  #currentDownload = null;
  #currentActor = null;
  #currentInputData = null;
  #dismissTimeout = null;

  init() {
    this.#setupElements();
  }

  #setupElements() {
    this.#modalElement = document.getElementById("zen-snap-modal");
    this.#backdropElement = document.getElementById("zen-snap-backdrop");
    if (!this.#modalElement) {
      return;
    }

    this.#closeBtn = document.getElementById("zen-snap-close-btn");
    this.#browseAllBtn = document.getElementById("zen-snap-browse-all-btn");
    this.#emptyStatus = document.getElementById("zen-snap-empty-status");
    this.#clipboardCard = document.getElementById("zen-snap-clipboard-card");
    this.#clipboardPreview = document.getElementById(
      "zen-snap-clipboard-preview"
    );
    this.#clipboardSubtitle = document.getElementById(
      "zen-snap-clipboard-subtitle"
    );
    this.#downloadCard = document.getElementById("zen-snap-download-card");
    this.#downloadPreview = document.getElementById(
      "zen-snap-download-preview"
    );
    this.#downloadTitle = document.getElementById("zen-snap-download-title");
    this.#downloadSubtitle = document.getElementById(
      "zen-snap-download-subtitle"
    );

    this.#closeBtn?.addEventListener("command", () => this.hideModal());
    this.#browseAllBtn?.addEventListener("command", () =>
      this.#onBrowseAllClicked()
    );
    this.#clipboardCard?.addEventListener("click", () =>
      this.#onClipboardCardClicked()
    );
    this.#downloadCard?.addEventListener("click", () =>
      this.#onDownloadCardClicked()
    );
    this.#backdropElement?.addEventListener("click", () => this.hideModal());

    window.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape" && this.isModalOpen()) {
          event.preventDefault();
          event.stopPropagation();
          this.hideModal();
        }
      },
      true
    );

    window.addEventListener("TabSelect", () => {
      if (this.isModalOpen()) {
        this.hideModal();
      }
    });

    window.addEventListener("TabClose", () => {
      if (this.isModalOpen()) {
        this.hideModal();
      }
    });

    window.addEventListener("ZenWorkspacesChanged", () => {
      if (this.isModalOpen()) {
        this.hideModal();
      }
    });
  }

  isModalOpen() {
    return !!(this.#modalElement && !this.#modalElement.hidden);
  }

  #onBrowseAllClicked() {
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

  #onClipboardCardClicked() {
    if (this.#currentClipboardImage) {
      this.#onClipboardImageClicked(this.#currentClipboardImage);
    }
  }

  #onDownloadCardClicked() {
    if (this.#currentDownload?.target?.path) {
      this.#selectFile(this.#currentDownload.target.path);
    }
  }

  #isImageFile(path) {
    if (!path) {
      return false;
    }
    return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(path);
  }

  async #onClipboardImageClicked(clipboardData) {
    try {
      if (!clipboardData?.bytes) {
        return;
      }
      const tempDir = PathUtils.join(PathUtils.tempDir, "zen-snap");
      await IOUtils.makeDirectory(tempDir, {
        ignoreExisting: true,
        permissions: 0o700,
      });

      const extension = clipboardData.flavor.includes("png") ? "png" : "jpg";
      const tempPath = PathUtils.join(
        tempDir,
        `zen-snap-${Date.now()}.${extension}`
      );
      const uint8 = new Uint8Array(clipboardData.bytes.length);
      for (let i = 0; i < clipboardData.bytes.length; i++) {
        uint8[i] = clipboardData.bytes.charCodeAt(i);
      }
      await IOUtils.write(tempPath, uint8);
      this.#selectFile(tempPath);

      // Auto-cleanup: remove temporary file after the webpage has processed it
      setTimeout(async () => {
        try {
          await IOUtils.remove(tempPath, { ignoreAbsent: true });
        } catch {
          // Ignore temp cleanup error
        }
      }, 15000);
    } catch (e) {
      console.error("[ZenSnapManager] Failed to attach clipboard image:", e);
    }
  }

  #formatBytes(bytes) {
    if (!bytes || bytes <= 0) {
      return "0 B";
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async getRecentDownloads(limit = 1) {
    try {
      const Downloads = window.Downloads;
      const list = await Downloads.getList(Downloads.ALL);
      const allDownloads = await list.getAll();

      const validDownloads = [];
      for (const download of allDownloads) {
        if (!download.succeeded) {
          continue;
        }
        const path = download.target?.path;
        if (!path) {
          continue;
        }
        let exists = download.target?.exists;
        if (exists === undefined) {
          try {
            exists = await IOUtils.exists(path);
          } catch (e) {
            exists = false;
          }
        }
        if (exists) {
          validDownloads.push(download);
        }
      }

      return validDownloads.slice(-limit).reverse();
    } catch (error) {
      console.error("[ZenSnapManager] Failed to fetch downloads:", error);
      return [];
    }
  }

  getClipboardImageData() {
    try {
      const clipboard = Services.clipboard;
      const kGlobal = Ci.nsIClipboard.kGlobalClipboard;

      const flavors = ["image/png", "image/jpeg", "image/bmp", "image/gif"];
      const matchingFlavor = flavors.find(f =>
        clipboard.hasDataMatchingFlavors([f], kGlobal)
      );
      if (!matchingFlavor) {
        return null;
      }

      const trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
        Ci.nsITransferable
      );
      trans.init(null);
      trans.addDataFlavor(matchingFlavor);
      clipboard.getData(trans, kGlobal);

      const dataObj = {};
      trans.getTransferData(matchingFlavor, dataObj);
      if (!dataObj.value) {
        return null;
      }

      const rawStream = dataObj.value.QueryInterface(Ci.nsIInputStream);
      const binaryStream = Cc[
        "@mozilla.org/binaryinputstream;1"
      ].createInstance(Ci.nsIBinaryInputStream);
      binaryStream.setInputStream(rawStream);

      const size = binaryStream.available();
      if (size <= 0) {
        return null;
      }

      const bytes = binaryStream.readBytes(size);
      const base64 = btoa(bytes);
      const dataUrl = `data:${matchingFlavor};base64,${base64}`;

      return {
        flavor: matchingFlavor,
        dataUrl,
        size,
        bytes,
      };
    } catch (error) {
      console.error("[ZenSnapManager] Failed to read clipboard image:", error);
      return null;
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
    if (this.#backdropElement) {
      this.#backdropElement.classList.remove("zen-snap-visible");
      this.#backdropElement.classList.add("zen-snap-hidden");
      setTimeout(() => {
        if (this.#backdropElement.classList.contains("zen-snap-hidden")) {
          this.#backdropElement.hidden = true;
        }
      }, 200);
    }
    // Free preview memory immediately
    if (this.#clipboardPreview) {
      this.#clipboardPreview.src = "";
    }
    this.#currentClipboardImage = null;

    if (this.#downloadPreview) {
      this.#downloadPreview.src = "";
    }
    this.#currentDownload = null;

    if (this.#dismissTimeout) {
      clearTimeout(this.#dismissTimeout);
      this.#dismissTimeout = null;
    }
  }

  #showModal(data, downloads, clipboardImage) {
    if (!this.#modalElement || !this.#downloadCard) {
      this.#setupElements();
    }
    if (!this.#modalElement) {
      return;
    }

    if (this.#backdropElement) {
      this.#backdropElement.hidden = false;
      this.#backdropElement.classList.remove("zen-snap-hidden");
      this.#backdropElement.classList.add("zen-snap-visible");
    }

    let hasItems = false;

    if (clipboardImage) {
      this.#currentClipboardImage = clipboardImage;
      if (this.#clipboardCard) {
        this.#clipboardCard.hidden = false;
        this.#clipboardCard.setAttribute("tooltiptext", "Image from Clipboard");
      }
      if (this.#clipboardPreview) {
        this.#clipboardPreview.src = clipboardImage.dataUrl;
      }
      if (this.#clipboardSubtitle) {
        const typeLabel = clipboardImage.flavor
          .replace("image/", "")
          .toUpperCase();
        const sizeFormatted = this.#formatBytes(clipboardImage.size);
        this.#clipboardSubtitle.setAttribute(
          "value",
          `${typeLabel} • ${sizeFormatted}`
        );
      }
      hasItems = true;
    } else {
      this.#currentClipboardImage = null;
      if (this.#clipboardCard) {
        this.#clipboardCard.hidden = true;
      }
      if (this.#clipboardPreview) {
        this.#clipboardPreview.src = "";
      }
    }

    if (downloads?.length) {
      const dl = downloads[0];
      this.#currentDownload = dl;
      const filePath = dl.target?.path;
      let fileName = "Downloaded file";
      try {
        fileName = PathUtils.filename(filePath);
      } catch (e) {
        fileName = filePath ? filePath.split("/").pop() : "Downloaded file";
      }
      const isImage = this.#isImageFile(filePath);

      if (this.#downloadPreview) {
        if (isImage) {
          this.#downloadPreview.src = PathUtils.toFileURI(filePath);
          this.#downloadPreview.classList.remove("is-icon");
        } else {
          this.#downloadPreview.src = `moz-icon://${filePath}?size=48`;
          this.#downloadPreview.classList.add("is-icon");
        }
      }

      if (this.#downloadTitle) {
        this.#downloadTitle.setAttribute("value", fileName);
      }

      if (this.#downloadSubtitle) {
        const ext = filePath ? filePath.split(".").pop().toUpperCase() : "FILE";
        const sizeFormatted = this.#formatBytes(
          dl.totalBytes || dl.target?.size
        );
        this.#downloadSubtitle.setAttribute(
          "value",
          `${ext} • ${sizeFormatted}`
        );
      }

      if (this.#downloadCard) {
        this.#downloadCard.hidden = false;
        this.#downloadCard.setAttribute("tooltiptext", fileName);
      }
      hasItems = true;
    } else {
      this.#currentDownload = null;
      if (this.#downloadCard) {
        this.#downloadCard.hidden = true;
      }
      if (this.#downloadPreview) {
        this.#downloadPreview.src = "";
      }
    }

    if (this.#emptyStatus) {
      this.#emptyStatus.hidden = hasItems;
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
    if (!Services.prefs.getBoolPref("zen.snap.enabled", true)) {
      return;
    }

    this.#currentActor = actor;
    this.#currentInputData = data;

    const clipboardImage = this.getClipboardImageData();
    const downloads = await this.getRecentDownloads();

    this.#showModal(data, downloads, clipboardImage);
  }
}

window.gZenSnapManager = new nsZenSnapManager();
