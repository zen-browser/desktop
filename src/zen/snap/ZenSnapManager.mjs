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
  #clipboardStatus = null;
  #clipboardCard = null;
  #clipboardPreview = null;
  #clipboardSubtitle = null;
  #currentClipboardImage = null;
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
    this.#backdropElement = document.getElementById("zen-snap-backdrop");
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
    this.#clipboardCard = document.getElementById("zen-snap-clipboard-card");
    this.#clipboardPreview = document.getElementById(
      "zen-snap-clipboard-preview"
    );
    this.#clipboardSubtitle = document.getElementById(
      "zen-snap-clipboard-subtitle"
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
    this.#clipboardCard?.addEventListener("click", () =>
      this.#onClipboardCardClicked()
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

  #onClipboardCardClicked() {
    if (this.#currentClipboardImage) {
      this.#onClipboardImageClicked(this.#currentClipboardImage);
    }
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
      console.warn("[ZenSnapManager] Saved clipboard image to temp:", tempPath);
      this.#selectFile(tempPath);

      // Auto-cleanup: remove temporary file after the webpage has processed it
      setTimeout(async () => {
        try {
          await IOUtils.remove(tempPath, { ignoreAbsent: true });
        } catch (e) {
          console.warn("[ZenSnapManager] Error cleaning up temp file:", e);
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
    // Free clipboard preview memory immediately
    if (this.#clipboardPreview) {
      this.#clipboardPreview.src = "";
    }
    this.#currentClipboardImage = null;

    if (this.#dismissTimeout) {
      clearTimeout(this.#dismissTimeout);
      this.#dismissTimeout = null;
    }
  }

  #showModal(data, downloads, clipboardImage) {
    if (!this.#modalElement) {
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

    if (clipboardImage) {
      this.#currentClipboardImage = clipboardImage;
      if (this.#clipboardStatus) {
        this.#clipboardStatus.hidden = true;
      }
      if (this.#clipboardCard) {
        this.#clipboardCard.hidden = false;
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
    } else {
      this.#currentClipboardImage = null;
      if (this.#clipboardStatus) {
        this.#clipboardStatus.hidden = false;
      }
      if (this.#clipboardCard) {
        this.#clipboardCard.hidden = true;
      }
      if (this.#clipboardPreview) {
        this.#clipboardPreview.src = "";
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
    if (!Services.prefs.getBoolPref("zen.snap.enabled", true)) {
      return;
    }

    this.#currentActor = actor;
    this.#currentInputData = data;
    console.warn("[ZenSnapManager] Input click intercepted:", data);

    const clipboardImage = this.getClipboardImageData();
    const downloads = await this.getRecentDownloads();

    this.#showModal(data, downloads, clipboardImage);
  }
}

window.gZenSnapManager = new nsZenSnapManager();
