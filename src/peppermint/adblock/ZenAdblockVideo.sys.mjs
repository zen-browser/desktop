// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const MAX_REWRITE_BYTES = 8 * 1024 * 1024;

const AD_KEY = /"(?:adPlacements|adSlots|playerAds)"/g;

// Runs in the page. Renames ad fields in player JSON and in the objects
// YouTube assigns before the player reads them. List scriptlets cover the
// anti-adblock workaround; this covers the ad payload itself.
export const VIDEO_PAGE_HOOK = `
(function () {
  if (window.__zenAdblockVideo) {
    return;
  }
  window.__zenAdblockVideo = true;
  const AD_KEY = /"(?:adPlacements|adSlots|playerAds)"/g;
  const API = /\\/(?:youtubei\\/v1\\/(?:player|get_watch|next|reel)|playlist)(?:\\?|$)|\\/watch\\?/;
  function strip(text) {
    if (typeof text !== "string" || text.length < 12 || text.indexOf('"ad') === -1) {
      return text;
    }
    return text.replace(AD_KEY, '"no_ads"');
  }
  function prune(value) {
    if (!value || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        prune(value[i]);
      }
      return;
    }
    delete value.adPlacements;
    delete value.playerAds;
    delete value.adSlots;
    if (value.playerResponse) {
      prune(value.playerResponse);
    }
  }
  function hookProp(name) {
    let stored = window[name];
    if (stored) {
      try { prune(stored); } catch (e) {}
    }
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get() { return stored; },
        set(value) {
          try { prune(value); } catch (e) {}
          stored = value;
        },
      });
    } catch (e) {}
  }
  hookProp("ytInitialPlayerResponse");
  hookProp("ytInitialData");
  const parse = JSON.parse;
  JSON.parse = function (text, reviver) {
    if (typeof text === "string") {
      text = strip(text);
    }
    return parse.call(this, text, reviver);
  };
  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const pending = origFetch.apply(this, arguments);
      if (!API.test(String(url))) {
        return pending;
      }
      return pending.then(function (response) {
        return response.clone().text().then(function (text) {
          const next = strip(text);
          if (next === text) {
            return response;
          }
          return new Response(next, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }).catch(function () { return response; });
      });
    };
  }
  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function (_method, url) {
      try { this.__zenAdUrl = String(url || ""); } catch (e) {}
      return open.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      try {
        if (API.test(this.__zenAdUrl || "")) {
          this.addEventListener("readystatechange", function () {
            if (this.readyState !== 4 || typeof this.responseText !== "string") {
              return;
            }
            const next = strip(this.responseText);
            if (next === this.responseText) {
              return;
            }
            try {
              Object.defineProperty(this, "responseText", { configurable: true, get: function () { return next; } });
              Object.defineProperty(this, "response", { configurable: true, get: function () { return next; } });
            } catch (e) {}
          });
        }
      } catch (e) {}
      return send.apply(this, arguments);
    };
  }
})();
`;

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isYouTubeHost(hostname) {
  if (!hostname) {
    return false;
  }
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com") ||
    host === "youtubekids.com" ||
    host.endsWith(".youtubekids.com") ||
    host === "youtubei.googleapis.com" ||
    host.endsWith(".youtubei.googleapis.com")
  );
}

export function needsVideoPageHook(url) {
  return isYouTubeHost(hostnameOf(url));
}

/**
 * Requests that only exist to serve or measure a video ad.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isVideoAdRequest(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;
  if (host === "imasdk.googleapis.com" || host.endsWith(".imasdk.googleapis.com")) {
    return true;
  }
  if (host === "dmxleo.dailymotion.com") {
    return true;
  }
  if (!isYouTubeHost(host)) {
    return false;
  }
  return (
    path.startsWith("/pagead") ||
    path.startsWith("/ptracking") ||
    path.startsWith("/get_midroll") ||
    path.startsWith("/api/stats/ads")
  );
}

/**
 * Player and watch JSON only. HTML documents also contain the player
 * script, and renaming keys there would rename the code that reads them.
 *
 * @param {string} url
 * @param {string} [contentType]
 * @returns {boolean}
 */
export function shouldRewriteVideoAdResponse(url, contentType = "") {
  const type = String(contentType).split(";")[0].trim().toLowerCase();
  if (
    type.startsWith("text/html") ||
    type.startsWith("video/") ||
    type.startsWith("audio/") ||
    type.startsWith("image/")
  ) {
    return false;
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!isYouTubeHost(parsed.hostname)) {
    return false;
  }
  const path = parsed.pathname;
  if (
    path.includes("/youtubei/v1/player") ||
    path.includes("/youtubei/v1/get_watch") ||
    path.includes("/youtubei/v1/next") ||
    path.includes("/youtubei/v1/reel")
  ) {
    return true;
  }
  if (!type.includes("json")) {
    return false;
  }
  return path === "/playlist" || path === "/watch";
}

export function rewriteVideoAdBody(text) {
  if (typeof text !== "string" || text.length < 12 || !text.includes('"ad')) {
    return text;
  }
  return text.replace(AD_KEY, '"no_ads"');
}

export class VideoAdStreamListener {
  constructor(channel) {
    this.chunks = [];
    this.received = 0;
    this.overflow = false;
    this.originalListener = channel.setNewListener(this);
  }

  onStartRequest() {}

  onDataAvailable(_request, stream, _offset, count) {
    const binary = Cc["@mozilla.org/binaryinputstream;1"].createInstance(
      Ci.nsIBinaryInputStream
    );
    binary.setInputStream(stream);
    const bytes = binary.readBytes(count);
    this.received += bytes.length;
    if (this.received > MAX_REWRITE_BYTES) {
      this.overflow = true;
    }
    this.chunks.push(bytes);
  }

  onStopRequest(request, status) {
    let body = this.chunks.join("");
    this.chunks = [];
    if (!this.overflow && Components.isSuccessCode(status)) {
      try {
        body = rewriteVideoAdBody(body);
      } catch {
        // Keep the original bytes.
      }
    }
    try {
      if (request instanceof Ci.nsIHttpChannel) {
        request.setResponseHeader("Content-Length", String(body.length), false);
      }
    } catch {
      // Some responses freeze Content-Length.
    }
    const replacement = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(
      Ci.nsIStringInputStream
    );
    try {
      replacement.setByteStringData(body);
    } catch {
      replacement.setData(body, body.length);
    }
    try {
      this.originalListener.onStartRequest(request);
      if (body.length) {
        this.originalListener.onDataAvailable(request, replacement, 0, body.length);
      }
      this.originalListener.onStopRequest(request, status);
    } catch (error) {
      console.error("ZenAdblock video response rewrite failed", error);
    }
  }

  QueryInterface = ChromeUtils.generateQI(["nsIStreamListener", "nsIRequestObserver"]);
}
