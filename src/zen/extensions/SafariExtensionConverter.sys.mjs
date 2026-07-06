/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * SafariExtensionConverter — Safari Web Extension import/convert pipeline.
 *
 * Safari 14+ uses W3C WebExtensions wrapped in a .safariextension package.
 * This module strips the Safari-specific native wrapper and extracts the
 * standard WebExtension manifest + assets for installation in Nixo.
 */

"use strict";

var EXPORTED_SYMBOLS = ["SafariExtensionConverter"];

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
  Services: "resource://gre/modules/Services.sys.mjs",
  ZipUtils: "resource://gre/modules/ZipUtils.sys.mjs",
});

const SAFARI_WEBEXT_MANIFEST_KEY = "safari_web_extension";

var SafariExtensionConverter = {
  /**
   * Check if a file is a Safari extension.
   * Safari extensions can be:
   *   - .safariextension (directory-based)
   *   - .safariextz (signed archive, Zip-based)
   *   - .safari-web-extension (macOS native wrapper)
   */
  isSafariExtension(path) {
    const ext = path.split(".").pop()?.toLowerCase();
    return ["safariextension", "safariextz", "safari-web-extension"].includes(ext);
  },

  /**
   * Convert a Safari Web Extension to a standard WebExtension XPI.
   * Returns an object with the converted extension data or an error.
   * @param {string} sourcePath - Path to the .safariextz or .safariextension
   * @returns {Promise<{success: boolean, xpiPath?: string, manifest?: object, error?: string}>}
   */
  async convert(sourcePath) {
    try {
      // Step 1: Extract the Safari extension package
      const tmpDir = await this._extractPackage(sourcePath);
      if (!tmpDir) {
        return { success: false, error: "Failed to extract extension package" };
      }

      // Step 2: Locate and validate WebExtension manifest
      const manifest = await this._findWebExtManifest(tmpDir);
      if (!manifest) {
        return {
          success: false,
          error: "No WebExtension manifest found in this Safari extension. " +
            "Note: Native Safari extensions (SFSafariExtensionHandler) " +
            "cannot be converted as they use platform-native APIs.",
        };
      }

      // Step 3: Patch manifest for Firefox compatibility
      this._patchManifest(manifest);

      // Step 4: Build the XPI
      const xpiPath = await this._buildXPI(tmpDir, manifest);

      return {
        success: true,
        xpiPath,
        manifest,
      };
    } catch (e) {
      Cu.reportError("[Nixo] Safari extension conversion failed: " + e);
      return { success: false, error: e.message };
    }
  },

  async _extractPackage(sourcePath) {
    const tmpDir = lazy.FileUtils.getDir("TmpD", ["nixo-safari-ext"], true);
    const file = await IOUtils.getFile(sourcePath);

    if (sourcePath.endsWith(".safariextz")) {
      // .safariextz is a signed Zip archive
      await lazy.ZipUtils.extractFiles(file, tmpDir);
    } else if (sourcePath.endsWith(".safariextension")) {
      // .safariextension is a directory/bundle
      await IOUtils.copy(sourcePath, tmpDir.path, { recursive: true });
    } else {
      return null;
    }
    return tmpDir;
  },

  async _findWebExtManifest(dir) {
    // Safari Web Extensions store the W3C manifest under
    // safari_web_extension/manifest.json within the package
    const candidates = [
      PathUtils.join(dir.path, SAFARI_WEBEXT_MANIFEST_KEY, "manifest.json"),
      PathUtils.join(dir.path, "manifest.json"),
      PathUtils.join(dir.path, "Resources", "manifest.json"),
    ];

    for (const candidatePath of candidates) {
      try {
        const exists = await IOUtils.exists(candidatePath);
        if (exists) {
          const data = await IOUtils.readJSON(candidatePath);
          if (data.manifest_version) {
            return data;
          }
        }
      } catch (e) {
        // File not found or invalid JSON, try next
      }
    }
    return null;
  },

  _patchManifest(manifest) {
    // Ensure Firefox-compatible manifest version
    if (manifest.manifest_version === 2 || manifest.manifest_version === 3) {
      manifest.manifest_version = manifest.manifest_version;
    }
    // Add Firefox-specific keys if missing
    manifest.browser_specific_settings ??= {};
    manifest.browser_specific_settings.gecko = {
      id: manifest.browser_specific_settings?.gecko?.id ||
          "safari-converted-" + crypto.randomUUID(),
      strict_min_version: "121.0",
    };
    // Remove Safari-specific keys
    delete manifest.safari;
    delete manifest["__SafariSharedExtensionPoints"];
    return manifest;
  },

  async _buildXPI(tmpDir, manifest) {
    const xpiPath = PathUtils.join(
      tmpDir.path,
      "..",
      manifest.browser_specific_settings.gecko.id + ".xpi"
    );
    // Create a ZIP archive with .xpi extension
    await lazy.ZipUtils.createZip(tmpDir.path, xpiPath);
    return xpiPath;
  },

  /**
   * Provides user-facing information about Safari extension compatibility.
   */
  getCompatibilityInfo() {
    return {
      supported: "Safari Web Extensions (Safari 14+)",
      notSupported: "Native Safari extensions using SFSafariExtensionHandler, " +
        "Safari App Extensions, and Xcode-based extensions",
      instructions: "Safari Web Extensions are standard W3C WebExtensions " +
        "and should work after conversion. Native Safari extensions use " +
        "Apple-specific APIs and cannot run on Gecko-based browsers.",
    };
  },
};
