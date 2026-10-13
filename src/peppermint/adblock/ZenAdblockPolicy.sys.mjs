// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  FiltersEngine,
  Request,
} from "resource:///modules/zen/adblock/vendor/adblocker.mjs";
import { matchesBootstrapHost } from "resource:///modules/zen/adblock/ZenAdblockLists.sys.mjs";
import { isVideoAdRequest } from "resource:///modules/zen/adblock/ZenAdblockVideo.sys.mjs";

export const ADBLOCK_LEVELS = ["light", "medium", "heavy"];

export function engineConfigForLevel(level) {
  return {
    loadExtendedSelectors: level === "heavy",
    loadGenericCosmeticsFilters: level !== "light",
    enableHtmlFiltering: false,
  };
}

export function cosmeticQueryOptions(level) {
  return {
    getBaseRules: level !== "light",
    getInjectionRules: level !== "light",
    getExtendedRules: level === "heavy",
    getRulesFromDOM: true,
    getRulesFromHostname: true,
  };
}

export function parseFilterList(text, level) {
  return FiltersEngine.parse(text || "", engineConfigForLevel(level));
}

export function deserializeEngine(bytes) {
  return FiltersEngine.deserialize(bytes);
}

const FIRST_PARTY_FAST_TYPES = new Set([
  "image",
  "imageset",
  "stylesheet",
  "font",
  "media",
  "ping",
  "csp_report",
  "web_manifest",
  "other",
]);

/**
 * Whether a request is worth a filter-engine match. Top-level documents and
 * system-triggered loads are skipped. First-party images, fonts, and similar
 * types are skipped too; scripts and subframes still go through the engine
 * because lists block those on the page's own host.
 *
 * @param {object} details
 * @param {string} details.type
 * @param {boolean} details.isSystem
 * @param {string} details.requestHost
 * @param {string} details.sourceHost
 * @returns {boolean}
 */
export function shouldInspectNetworkRequest({
  type,
  isSystem,
  requestHost,
  sourceHost,
}) {
  if (isSystem || type === "main_frame") {
    return false;
  }
  if (
    requestHost &&
    sourceHost &&
    requestHost === sourceHost &&
    FIRST_PARTY_FAST_TYPES.has(type || "other")
  ) {
    return false;
  }
  return true;
}

export function contentPolicyToRequestType(type) {
  const policy = Ci.nsIContentPolicy;
  switch (type) {
    case policy.TYPE_DOCUMENT:
      return "main_frame";
    case policy.TYPE_SUBDOCUMENT:
      return "sub_frame";
    case policy.TYPE_STYLESHEET:
      return "stylesheet";
    case policy.TYPE_SCRIPT:
      return "script";
    case policy.TYPE_IMAGE:
      return "image";
    case policy.TYPE_OBJECT:
      return "object";
    case policy.TYPE_OBJECT_SUBREQUEST:
      return "object_subrequest";
    case policy.TYPE_XMLHTTPREQUEST:
    case policy.TYPE_FETCH:
      return "xmlhttprequest";
    case policy.TYPE_PING:
    case policy.TYPE_BEACON:
      return "ping";
    case policy.TYPE_FONT:
      return "font";
    case policy.TYPE_MEDIA:
      return "media";
    case policy.TYPE_WEBSOCKET:
      return "websocket";
    case policy.TYPE_CSP_REPORT:
      return "csp_report";
    case policy.TYPE_IMAGESET:
      return "imageset";
    case policy.TYPE_WEB_MANIFEST:
      return "web_manifest";
    case policy.TYPE_DTD:
      return "xml_dtd";
    case policy.TYPE_XSLT:
      return "xslt";
    default:
      return "other";
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Decide what to do with one network request.
 *
 * @param {object} details
 * @param {object | null} details.engine Compiled filter engine, or null
 *   before lists have loaded.
 * @param {"off" | "light" | "medium" | "heavy"} details.level Effective level
 *   for the page that issued the request.
 * @param {string} details.url
 * @param {string} details.sourceUrl
 * @param {string} details.type WebRequest type (script, sub_frame, ...).
 * @returns {{ action: "allow" | "cancel" | "redirect", url?: string, reason?: string, uncloak?: boolean, hostname?: string }}
 */
export function decideNetworkRequest({ engine, level, url, sourceUrl, type }) {
  if (!level || level === "off") {
    return { action: "allow" };
  }

  if (isVideoAdRequest(url)) {
    return { action: "cancel", reason: "video-ad" };
  }

  if (!engine) {
    if (matchesBootstrapHost(hostnameOf(url))) {
      return { action: "cancel", reason: "bootstrap" };
    }
    return { action: "allow" };
  }

  let request;
  try {
    request = Request.fromRawDetails({
      url,
      sourceUrl: sourceUrl || url,
      type: type || "other",
    });
  } catch {
    return { action: "allow" };
  }

  let result;
  try {
    result = engine.match(request);
  } catch {
    return { action: "allow" };
  }

  if (result.match) {
    if (result.redirect?.dataUrl) {
      return { action: "redirect", url: result.redirect.dataUrl, reason: "filter" };
    }
    return { action: "cancel", reason: "filter" };
  }

  if (result.rewrite?.url && result.rewrite.url !== url) {
    return { action: "redirect", url: result.rewrite.url, reason: "rewrite" };
  }

  const heavyThirdParty =
    level === "heavy" &&
    request.isThirdParty &&
    (type === "script" || type === "sub_frame") &&
    !result.exception;
  if (heavyThirdParty) {
    return { action: "cancel", reason: "heavy" };
  }

  return {
    action: "allow",
    uncloak: level !== "light" && request.isThirdParty && !result.exception,
    hostname: request.hostname,
  };
}
