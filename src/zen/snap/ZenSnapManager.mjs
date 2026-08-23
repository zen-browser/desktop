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
  init() {
    console.warn("[ZenSnapManager] Initialized successfully.");
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

  async onInputClicked(data) {
    console.warn("[ZenSnapManager] Input click detected:", data);

    const clipboardInfo = this.getClipboardInfo();
    console.warn(
      `[ZenSnapManager] Clipboard status: Image=${clipboardInfo.hasImage}, File=${clipboardInfo.hasFile}`
    );

    const downloads = await this.getRecentDownloads();
    console.warn(
      `[ZenSnapManager] Found ${downloads.length} recent downloads:`
    );
    for (const item of downloads) {
      console.warn(
        `  -> ${item.target?.path} (${item.contentType || "unknown type"})`
      );
    }
  }
}

window.gZenSnapManager = new nsZenSnapManager();
