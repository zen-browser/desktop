// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenLiveFolderProvider } from "resource:///modules/zen/ZenLiveFolder.sys.mjs";

const ORIGIN = "https://www.youtube.com";
const WATCH_LATER = `${ORIGIN}/playlist?list=WL`;
const ICON = "chrome://browser/content/zen-images/favicons/youtube.svg";
const LIMITS = [50, 100, 250, 500];
const NO_AUTH = "zen-live-folder-youtube-no-auth";
const UNEXPECTED = "zen-live-folder-youtube-unexpected-response";

// Read a balanced JSON object, including braces inside strings. Page scripts are
// data only: never evaluate JavaScript from the signed-in page.
function readObject(text, offset) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = offset; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        quoted = false;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}" && --depth === 0) {
      return JSON.parse(text.slice(offset, i + 1));
    }
  }
  throw new Error(UNEXPECTED);
}

function textOf(value) {
  return value?.simpleText ?? value?.runs?.map(run => run.text).join("") ?? "";
}

export class nsYoutubeLiveFolderProvider extends nsZenLiveFolderProvider {
  static type = "youtube";

  constructor(config) {
    super(config);
    this.state.limit = LIMITS.includes(this.state.limit)
      ? this.state.limit
      : 100;
  }

  parsePage(html) {
    const document = new DOMParser().parseFromString(html, "text/html");
    if (
      document.querySelector(
        'form[action*="consent.youtube.com"], form[action*="consent.google.com"]'
      )
    ) {
      throw new Error(NO_AUTH);
    }
    let initial;
    const config = {};
    for (const script of document.querySelectorAll("script")) {
      const source = script.textContent;
      for (const match of source.matchAll(/ytcfg\.set\s*\(\s*(?=\{)/g)) {
        Object.assign(
          config,
          readObject(source, match.index + match[0].length)
        );
      }
      const match =
        /(?:window\s*\[\s*["']ytInitialData["']\s*\]|\bytInitialData)\s*=\s*(?=\{)/.exec(
          source
        );
      if (match) {
        initial = readObject(source, match.index + match[0].length);
      }
    }
    const loggedOut =
      initial?.responseContext?.mainAppWebResponseContext?.loggedOut;
    if (config.LOGGED_IN === false || loggedOut === true) {
      throw new Error(NO_AUTH);
    }
    if (!initial || (config.LOGGED_IN !== true && loggedOut !== false)) {
      throw new Error(UNEXPECTED);
    }
    const tabs = initial.contents?.twoColumnBrowseResultsRenderer?.tabs;
    const selected = tabs?.find(tab => tab.tabRenderer?.selected)?.tabRenderer;
    // Only traverse the selected playlist section, never the recommendation sidebar.
    const sections = selected?.content?.sectionListRenderer?.contents;
    const lists = (sections ?? []).flatMap(section =>
      (section.itemSectionRenderer?.contents ?? []).flatMap(item =>
        item.playlistVideoListRenderer ? [item.playlistVideoListRenderer] : []
      )
    );
    if (
      lists.length !== 1 ||
      (lists[0].playlistId && lists[0].playlistId !== "WL")
    ) {
      throw new Error(UNEXPECTED);
    }
    return { config, initial, list: lists[0] };
  }

  parseItems(list) {
    if (!Array.isArray(list.contents)) {
      throw new Error(UNEXPECTED);
    }
    const items = [];
    const tokens = [];
    for (const entry of list.contents) {
      const video = entry.playlistVideoRenderer;
      if (video) {
        // Deleted/private entries lack a channel or explicitly forbid playback.
        if (video.isPlayable === false || !video.shortBylineText) {
          continue;
        }
        const title = textOf(video.title);
        if (!/^[\w-]{11}$/.test(video.videoId) || !title) {
          throw new Error(UNEXPECTED);
        }
        items.push({
          id: video.videoId,
          title,
          subtitle: textOf(video.shortBylineText),
          icon: ICON,
          url: `${ORIGIN}/watch?v=${video.videoId}`,
        });
      } else if (entry.continuationItemRenderer) {
        const endpoint = entry.continuationItemRenderer.continuationEndpoint;
        const token = endpoint?.continuationCommand?.token;
        if (!token) {
          throw new Error(UNEXPECTED);
        }
        tokens.push(token);
      } else if (!entry.messageRenderer) {
        throw new Error(UNEXPECTED);
      }
    }
    for (const continuation of list.continuations ?? []) {
      const token = continuation.nextContinuationData?.continuation;
      if (!token) {
        throw new Error(UNEXPECTED);
      }
      tokens.push(token);
    }
    if (new Set(tokens).size > 1) {
      throw new Error(UNEXPECTED);
    }
    return { items, token: tokens[0] };
  }

  parseContinuation(data, targetId) {
    if (data.responseContext?.mainAppWebResponseContext?.loggedOut === true) {
      throw new Error(NO_AUTH);
    }
    const list = data.continuationContents?.playlistVideoListContinuation;
    if (list) {
      return list;
    }
    const actions = [
      ...(data.onResponseReceivedActions ?? []),
      ...(data.onResponseReceivedEndpoints ?? []),
    ].flatMap(action =>
      action.appendContinuationItemsAction
        ? [action.appendContinuationItemsAction]
        : []
    );
    const matches = actions.filter(action =>
      targetId
        ? action.targetId === targetId
        : action.continuationItems?.some(item => item.playlistVideoRenderer)
    );
    if (matches.length !== 1) {
      throw new Error(UNEXPECTED);
    }
    return { contents: matches[0].continuationItems };
  }

  getSessionHeaders(config, initial) {
    const cookies = new Map();
    const now = Date.now() / 1000;
    for (const cookie of Services.cookies.getCookiesFromHost(
      "www.youtube.com",
      {
        userContextId: this.userContextId,
      }
    )) {
      if (
        (cookie.isSession || cookie.expiry > now) &&
        "/youtubei/v1/browse".startsWith(cookie.path)
      ) {
        cookies.set(cookie.name, cookie.value);
      }
    }
    const syncId =
      config.DATASYNC_ID ??
      initial.responseContext?.mainAppWebResponseContext?.datasyncId ??
      "";
    const [first, second] = syncId.split("||");
    const userSession = config.USER_SESSION_ID ?? (second || first);
    const pageId = config.DELEGATED_SESSION_ID ?? (second ? first : null);
    const timestamp = Math.floor(now).toString();
    const auth = [];
    // Match YouTube's SID hashes, including its fallback and secondary account context.
    // Reference: yt-dlp/extractor/youtube/_base.py (_make_sid_authorization).
    for (const [scheme, sid] of [
      [
        "SAPISIDHASH",
        cookies.get("SAPISID") || cookies.get("__Secure-3PAPISID"),
      ],
      ["SAPISID1PHASH", cookies.get("__Secure-1PAPISID")],
      ["SAPISID3PHASH", cookies.get("__Secure-3PAPISID")],
    ]) {
      if (!sid) {
        continue;
      }
      const input = [timestamp, sid, ORIGIN];
      if (userSession) {
        input.unshift(userSession);
      }
      const bytes = new TextEncoder().encode(input.join(" "));
      const hash = Cc["@mozilla.org/security/hash;1"].createInstance(
        Ci.nsICryptoHash
      );
      hash.init(Ci.nsICryptoHash.SHA1);
      hash.update(bytes, bytes.length);
      const hex = Array.from(hash.finish(false), char =>
        char.charCodeAt(0).toString(16).padStart(2, "0")
      ).join("");
      auth.push(`${scheme} ${timestamp}_${hex}${userSession ? "_u" : ""}`);
    }
    if (!auth.length) {
      throw new Error(NO_AUTH);
    }
    const headers = {
      Authorization: auth.join(" "),
      Origin: ORIGIN,
      "X-Origin": ORIGIN,
      "Content-Type": "application/json",
      "X-Goog-AuthUser": String(config.SESSION_INDEX ?? 0),
      "X-Youtube-Bootstrap-Logged-In": "true",
      "X-YouTube-Client-Name": String(config.INNERTUBE_CONTEXT_CLIENT_NAME),
      "X-YouTube-Client-Version": config.INNERTUBE_CONTEXT.client.clientVersion,
    };
    if (pageId) {
      headers["X-Goog-PageId"] = pageId;
    }
    const visitor =
      config.VISITOR_DATA ?? config.INNERTUBE_CONTEXT.client.visitorData;
    if (visitor) {
      headers["X-Goog-Visitor-Id"] = visitor;
    }
    return headers;
  }

  async fetchItems() {
    try {
      const userContextId = this.userContextId;
      const checkContainer = () => {
        if (this.userContextId !== userContextId) {
          throw new Error("zen-live-folder-failed-fetch");
        }
      };
      const response = await this.request(WATCH_LATER);
      checkContainer();
      this.checkResponse(response);
      const { config, initial, list } = this.parsePage(response.text);
      const limit = this.state.limit;
      const items = new Map();
      const seenTokens = new Set();
      let page = list;
      let context;
      let headers;
      // Cap requests even if the site returns endlessly changing empty pages.
      for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
        const parsed = this.parseItems(page);
        for (const item of parsed.items) {
          if (!items.has(item.id)) {
            items.set(item.id, item);
          }
          if (items.size === limit) {
            return Array.from(items.values());
          }
        }
        if (!parsed.token) {
          return Array.from(items.values());
        }
        if (seenTokens.has(parsed.token)) {
          throw new Error(UNEXPECTED);
        }
        seenTokens.add(parsed.token);
        if (!context) {
          if (
            !config.INNERTUBE_CONTEXT?.client?.clientVersion ||
            !config.INNERTUBE_CONTEXT_CLIENT_NAME
          ) {
            throw new Error(UNEXPECTED);
          }
          context = structuredClone(config.INNERTUBE_CONTEXT);
        }
        headers = this.getSessionHeaders(config, initial);
        const url = new URL(`${ORIGIN}/youtubei/v1/browse`);
        url.searchParams.set("prettyPrint", "false");
        if (config.INNERTUBE_API_KEY) {
          url.searchParams.set("key", config.INNERTUBE_API_KEY);
        }
        const next = await this.request(url.href, {
          method: "POST",
          headers,
          body: JSON.stringify({ context, continuation: parsed.token }),
        });
        checkContainer();
        this.checkResponse(next);
        const data = JSON.parse(next.text);
        if (data.error) {
          throw new Error(
            data.error.code === 401 || data.error.code === 403
              ? NO_AUTH
              : "zen-live-folder-failed-fetch"
          );
        }
        page = this.parseContinuation(data, list.targetId);
        const visitor = data.responseContext?.visitorData;
        if (visitor) {
          context.client.visitorData = visitor;
          config.VISITOR_DATA = visitor;
        }
      }
      throw new Error(UNEXPECTED);
    } catch (error) {
      // Never log responses, continuation tokens, or credentials.
      return [NO_AUTH, UNEXPECTED, "zen-live-folder-failed-fetch"].includes(
        error.message
      )
        ? error.message
        : UNEXPECTED;
    }
  }

  async request(url, options) {
    try {
      return await this.fetch(url, options);
    } catch {
      throw new Error("zen-live-folder-failed-fetch");
    }
  }

  checkResponse(response) {
    if (
      response.url &&
      /^(?:consent\.(?:youtube|google)\.com|accounts\.google\.com)$/.test(
        new URL(response.url).hostname
      )
    ) {
      throw new Error(NO_AUTH);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(NO_AUTH);
    }
    if (response.status !== 200) {
      throw new Error("zen-live-folder-failed-fetch");
    }
  }

  get options() {
    return [
      {
        l10nId: "zen-live-folder-youtube-item-limit",
        key: "setVideoLimit",
        options: LIMITS.map(limit => ({
          l10nId: "zen-live-folder-youtube-item-limit-num",
          l10nArgs: { limit },
          key: "setVideoLimit",
          value: limit,
          type: "radio",
          checked: this.state.limit === limit,
        })),
      },
    ];
  }

  onOptionTrigger(option) {
    super.onOptionTrigger(option);
    const limit = Number(option.getAttribute("option-value"));
    if (
      option.getAttribute("option-key") === "setVideoLimit" &&
      LIMITS.includes(limit)
    ) {
      this.state.limit = limit;
      this.requestSave();
      this.refresh();
    }
  }

  onActionButtonClick(errorId) {
    if (errorId === NO_AUTH || errorId === UNEXPECTED) {
      const browser = this.manager.window.gBrowser;
      browser.selectedTab = browser.addTrustedTab(WATCH_LATER, {
        userContextId: this.userContextId,
      });
    } else {
      super.onActionButtonClick(errorId);
    }
  }

  serialize() {
    return { state: { ...this.state } };
  }
}
