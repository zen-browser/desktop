// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  requestIdleCallback: "resource://gre/modules/Timer.sys.mjs",
  cancelIdleCallback: "resource://gre/modules/Timer.sys.mjs",
  NetUtil: "resource://gre/modules/NetUtil.sys.mjs",
  NetworkHelper: "resource://devtools/shared/network-observer/NetworkHelper.sys.mjs",
});

export class nsZenLiveFolderProvider {
  #timerHandle = null;
  #idleCallbackHandle = null;

  constructor({ id, manager, state }) {
    this.id = id;
    this.manager = manager;
    this.state = { ...state };
  }

  fetchItems() {
    throw new Error("Unimplemented");
  }

  getMetadata() {
    throw new Error("Unimplemented");
  }

  async refresh() {
    this.stop();
    const result = await this.#internalFetch();
    this.start();
    return result;
  }

  start() {
    const now = Date.now();
    const lastFetched = this.state.lastFetched;
    const interval = this.state.interval;

    const timeSinceLast = now - lastFetched;
    let delay = interval - timeSinceLast;

    if (delay <= 0) {
      delay = 0;
    }

    this.#scheduleNext(delay);
  }

  stop() {
    if (this.#timerHandle) {
      lazy.clearTimeout(this.#timerHandle);
      this.#timerHandle = null;
    }

    if (this.#idleCallbackHandle) {
      lazy.cancelIdleCallback(this.#idleCallbackHandle);
      this.#idleCallbackHandle = null;
    }
  }

  #scheduleNext(delay) {
    if (this.#timerHandle) {
      lazy.clearTimeout(this.#timerHandle);
    }

    this.#timerHandle = lazy.setTimeout(() => {
      const fetchWhenIdle = () => {
        this.#internalFetch();
        this.#idleCallbackHandle = null;
      };

      this.#idleCallbackHandle = lazy.requestIdleCallback(fetchWhenIdle);
      this.#scheduleNext(this.state.interval);
    }, delay);
  }

  async #internalFetch() {
    try {
      const items = await this.fetchItems();
      this.state.lastFetched = Date.now();
      this.requestSave();

      this.manager.onLiveFolderFetch(this, items);
      return items;
    } catch {}

    return null;
  }

  get options() {
    return [];
  }

  onOptionTrigger(option) {
    const key = option.getAttribute("option-key");

    switch (key) {
      case "refresh": {
        this.refresh();
        break;
      }
      case "setInterval": {
        const intervalMs = Number.parseInt(option.getAttribute("option-value"));
        if (intervalMs > 0) {
          this.state.interval = intervalMs;
          this.requestSave();
          this.stop();
          this.start();
        }

        break;
      }
    }
  }

  onActionButtonClick(errorId) {
    switch (errorId) {
      case "zen-live-folder-failed-fetch": {
        this.refresh();
        break;
      }
    }
  }

  requestSave() {
    this.manager.saveState();
  }

  fetch(url, { maxContentLength = 5 * 1024 * 1024 } = {}) {
    const uri = lazy.NetUtil.newURI(url);
    // TODO: Support userContextId when fetching, it should be inherited from the folder's
    // current space context ID.
    let userContextId = 0;
    let folder = this.manager.getFolderForLiveFolder(this);
    if (folder) {
      let space = folder.ownerGlobal.gZenWorkspaces.getWorkspaceFromId(
        folder.getAttribute("zen-workspace-id")
      );
      if (space) {
        userContextId = space.containerTabId || 0;
      }
    }
    const principal = Services.scriptSecurityManager.createContentPrincipal(uri, {
      userContextId,
    });

    const securityFlags =
      Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_INHERITS_SEC_CONTEXT |
      Ci.nsILoadInfo.SEC_COOKIES_INCLUDE;

    const channel = Services.io
      .newChannelFromURI(
        uri,
        this.manager.window.document,
        principal,
        principal,
        securityFlags,
        Ci.nsIContentPolicy.TYPE_DOCUMENT
      )
      .QueryInterface(Ci.nsIHttpChannel);

    let httpStatus = null;
    let contentType = "";
    let headerCharset = null;

    const { promise, resolve, reject } = Promise.withResolvers();

    const byteChunks = [];
    let totalLength = 0;

    channel.asyncOpen({
      onDataAvailable: (request, stream, _offset, count) => {
        totalLength += count;
        if (totalLength > maxContentLength) {
          request.cancel(Cr.NS_ERROR_FILE_TOO_BIG);
        } else {
          byteChunks.push(lazy.NetUtil.readInputStream(stream, count));
        }
      },
      onStartRequest: (request) => {
        const http = request.QueryInterface(Ci.nsIHttpChannel);

        try {
          httpStatus = http.responseStatus;
        } catch (ex) {
          httpStatus = null;
        }

        try {
          contentType = http.getResponseHeader("content-type");
        } catch (ex) {}

        if (contentType && !lazy.NetworkHelper.isTextMimeType(contentType.split(";")[0].trim())) {
          request.cancel(Cr.NS_ERROR_FILE_UNKNOWN_TYPE);
        }

        // Save charset without quotes or spaces for TextDecoder
        const match = contentType.match(/charset=["' ]*([^;"' ]+)/i);
        if (match) {
          headerCharset = match[1];
        }

        // Enforce max length if provided by server
        try {
          const headerLen = Number(http.getResponseHeader("content-length"));
          if (Number.isFinite(headerLen) && headerLen > maxContentLength) {
            request.cancel(Cr.NS_ERROR_FILE_TOO_BIG);
          }
        } catch (ex) {}
      },
      onStopRequest: (_request, status) => {
        if (!Components.isSuccessCode(status)) {
          reject(Components.Exception("Failed to fetch document", status));
          return;
        }

        const bytes = new Uint8Array(totalLength);
        let writeOffset = 0;
        for (const chunk of byteChunks) {
          bytes.set(new Uint8Array(chunk), writeOffset);
          writeOffset += chunk.byteLength;
        }

        let effectiveCharset = "utf-8";

        const mimeType = contentType ? contentType.split(";")[0].trim().toLowerCase() : "";
        if (mimeType === "text/html") {
          effectiveCharset = this.sniffCharset(bytes, headerCharset);
        } else if (headerCharset) {
          const norm = this.normalizeAndValidateEncodingLabel(headerCharset);
          if (norm) {
            effectiveCharset = norm;
          }
        }

        let decoded;
        try {
          decoded = new TextDecoder(effectiveCharset).decode(bytes);
        } catch (e) {
          decoded = new TextDecoder("utf-8").decode(bytes);
        }

        resolve({ text: decoded, status: httpStatus, contentType });
      },
    });

    return promise;
  }

  /**
   * Sniff an effective charset for the given response bytes using the HTML standard's precedence:
   *   1) Byte Order Mark (BOM)
   *   2) <meta charset> or http-equiv in the first 8KB of the document
   *   3) HTTP Content-Type header charset (if provided and valid)
   *   4) Default to utf-8
   *
   * @param {Uint8Array} bytes - The raw response bytes.
   * @param {string} headerCharset - The charset from the Content-Type header.
   * @returns {string} A validated, effective charset label for TextDecoder.
   */
  sniffCharset(bytes, headerCharset = "") {
    // 1. BOM detection (highest priority)
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return "utf-8";
    }
    if (bytes.length >= 2) {
      if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return "utf-16be";
      }
      if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return "utf-16le";
      }
    }

    // 2. Scan the first 8KB for a meta-declared charset. This is checked before
    // the HTTP header as a heuristic for misconfigured servers where the HTML
    // is more likely to be correct.
    try {
      const headLen = Math.min(bytes.length, 8192);
      const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, headLen));

      const metaCharsetRegex = /<meta\s+charset\s*=\s*["']?([a-z0-9_-]+)/i;
      let match = head.match(metaCharsetRegex);

      if (!match) {
        const httpEquivRegex =
          /<meta\s+http-equiv\s*=\s*["']?content-type["']?[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([a-z0-9_-]+)/i;
        match = head.match(httpEquivRegex);
      }

      if (match && match[1]) {
        const norm = this.normalizeAndValidateEncodingLabel(match[1]);
        if (norm) {
          return norm;
        }
      }
    } catch (e) {
      // Ignore errors during meta scan and fall through.
    }

    // 3. Use charset from HTTP header if it's valid.
    if (headerCharset) {
      const norm = this.normalizeAndValidateEncodingLabel(headerCharset);
      if (norm) {
        return norm;
      }
    }

    // 4. Default to UTF-8 if no other charset is found.
    return "utf-8";
  }

  /**
   * Normalizes a charset label and validates it is supported by TextDecoder.
   *
   * @param {string} label - The raw encoding label from headers or meta tags.
   * @returns {string|null} The normalized, validated label, or null if invalid.
   */
  normalizeAndValidateEncodingLabel(label) {
    const l = (label || "").trim();
    if (!l) {
      return null;
    }
    try {
      // TextDecoder constructor handles aliases and validation.
      return new TextDecoder(l).encoding;
    } catch (e) {
      // The label was invalid or unsupported.
    }
    return null;
  }
}
