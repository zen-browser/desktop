/* -*- Mode: indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sts=2 sw=2 et tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = XPCOMUtils.declareLazy({
  styleSheetService: {
    service: "@mozilla.org/content/style-sheet-service;1",
    iid: Ci.nsIStyleSheetService,
  },
});

const AGENT_SHEET = Ci.nsIStyleSheetService.AGENT_SHEET;

export class nsZenBoostStyles {
  #stylesCache = new Map();

  /**
   * Retrieves the CSS style string for a given boost configuration.
   * Caches styles to optimize performance.
   *
   * @param {object} boostData - The boost configuration data.
   * @param {string} domain - The domain associated with the boost.
   * @returns {string} The generated CSS style string.
   */
  getStyleForBoost(boostData, domain) {
    if (this.#stylesCache.has(domain)) {
      return this.#stylesCache.get(domain);
    }

    const rawStyle = this.#generateStyleString(boostData);
    if (!rawStyle || rawStyle.trim() === "") {
      return null;
    }

    const styleUri = this.#convertStyleToDataUri(rawStyle);
    this.#cacheStyle(styleUri, domain);
    return this.getStyleForBoost(boostData, domain);
  }

  invalidateStyleForDomain(domain) {
    if (this.#stylesCache.has(domain)) {
      const { uri } = this.#stylesCache.get(domain);
      lazy.styleSheetService.unregisterSheet(uri, AGENT_SHEET);
      this.#stylesCache.delete(domain);
    }
  }

  /**
   * Generates a CSS style string based on the boost configuration.
   *
   * @param {object} boostData - The boost configuration data.
   * @returns {string} The generated CSS style string.
   * @private
   */
  #generateStyleString(boostData) {
    let style = ``;

    const fontFamily =
      boostData.fontFamily != ""
        ? `font-family: ${boostData.fontFamily} !important;`
        : ``;
    const fontCase =
      boostData.textCaseOverride != "none"
        ? `text-transform: ${boostData.textCaseOverride} !important;`
        : ``;

    let zapBlocks = "";
    if (boostData.zapSelectors) {
      for (const selector of boostData.zapSelectors) {
        zapBlocks += `${selector}:not([zen-zap-unhide]){ display: none !important; }\n`;
      }

      if (zapBlocks != "") {
        style += `/* Zen-Zaps */\n`;
        style += `${zapBlocks}\n`;
      }
    }

    if (fontCase != "" || fontFamily != "") {
      style += `/* Text Format */\n`;
      style += `body *:not(.google-symbols, gf-load-icon-font, mat-icon, .google-material-icons) {\n`;
      style += `${fontFamily}\n`;
      style += `${fontCase}\n`;
      style += `}\n`;
    }

    if ((boostData.customCSS || "").trim() != "") {
      style += `/* USER CSS */\n`;
      style += `${boostData.customCSS || ""}\n`;
    }

    return style;
  }

  /**
   * Converts a raw CSS style string into a data URI.
   *
   * @param {string} rawStyle - The raw CSS style string.
   * @returns {string} The data URI representing the CSS style.
   * @private
   */
  #convertStyleToDataUri(rawStyle) {
    const encodedStyle = encodeURIComponent(rawStyle);
    return Services.io.newURI(`data:text/css;charset=utf-8,${encodedStyle}`);
  }

  /**
   * Prefetches the style from the data URI and caches it.
   *
   * @param {string} styleUri - The data URI of the CSS style.
   * @param {string} domain - The domain associated with the boost.
   * @private
   */
  #cacheStyle(styleUri, domain) {
    this.#stylesCache.set(domain, {
      uuid: Services.uuid.generateUUID().toString(),
      uri: styleUri,
    });
  }
}
