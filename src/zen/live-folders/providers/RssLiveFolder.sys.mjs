// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenLiveFolderProvider } from "resource:///modules/zen/ZenLiveFolder.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-live-folders.ftl"])
);

export class nsRssLiveFolderProvider extends nsZenLiveFolderProvider {
  static type = "rss";

  constructor({ id, state, manager }) {
    super({ id, state, manager });

    this.state.url = state.url;
    this.state.maxItems = state.maxItems ?? 10;
    this.state.timeRange = state.timeRange ?? 0;
  }

  async fetchItems() {
    try {
      const { text } = await this.fetch(this.state.url);

      const doc = new DOMParser().parseFromString(text, "text/xml");

      const cutoffTime = Date.now() - this.state.timeRange;

      const isAtom = doc.querySelector("feed > entry") !== null;
      const selector = isAtom ? "entry" : "item";
      const elements = doc.querySelectorAll(selector);

      const items = Array.from(elements)
        .map((item) => {
          const title = item.querySelector("title")?.textContent || "";

          const linkNode = item.querySelector("link");
          const url =
            isAtom && linkNode ? linkNode.getAttribute("href") : linkNode?.textContent || "";

          const guid = item.querySelector(isAtom ? "id" : "guid")?.textContent;
          const id = guid || url;

          const dateStr = item.querySelector(isAtom ? "updated" : "pubDate")?.textContent;
          const date = dateStr ? new Date(dateStr) : null;

          return { title, url, id, date };
        })
        .filter((item) => {
          if (!item.url || !item.date) {
            return false;
          }
          if (!this.state.timeRange) {
            return true;
          }
          return !isNaN(item.date.getTime()) && item.date.getTime() >= cutoffTime;
        })
        .slice(0, this.state.maxItems);
      for (let item of items) {
        if (item.url) {
          try {
            const url = new URL(item.url);
            const favicon = await lazy.PlacesUtils.favicons.getFaviconForPage(
              Services.io.newURI(url.href)
            );
            item.icon =
              favicon?.dataURI.spec ||
              this.manager.window.gZenEmojiPicker.getSVGURL("logo-rss.svg");
          } catch {
            // Ignore errors related to fetching favicons for individual items
          }
        }
      }
      return items;
    } catch {
      return "zen-live-folder-failed-fetch";
    }
  }

  _buildRadioOption({ key, value, l10nId, l10nArgs }) {
    return {
      type: "radio",
      key,
      value,
      l10nId,
      l10nArgs,
      checked: this.state[key] === value,
    };
  }

  _buildItemLimitOptions() {
    const entries = [5, 10, 25, 50];
    return entries.map((entry) => {
      return this._buildRadioOption({
        key: "maxItems",
        value: entry,
        l10nId: "zen-live-folder-rss-option-item-limit-num",
        l10nArgs: { limit: entry },
      });
    });
  }

  _buildTimeRangeOptions() {
    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;

    const entries = [
      { hours: 1, ms: 1 * HOUR_MS },
      { hours: 6, ms: 6 * HOUR_MS },
      { hours: 12, ms: 12 * HOUR_MS },
      { hours: 24, ms: 24 * HOUR_MS },
      { days: 3, ms: 3 * DAY_MS },
    ];

    return [
      this._buildRadioOption({
        key: "timeRange",
        value: 0,
        l10nId: "zen-live-folder-time-range-all-time",
      }),
      { type: "separator" },
      ...entries.map((entry) => {
        const isDays = "days" in entry;

        return this._buildRadioOption({
          key: "timeRange",
          value: entry.ms,
          l10nId: isDays ? "zen-live-folder-time-range-days" : "zen-live-folder-time-range-hours",
          l10nArgs: isDays ? { days: entry.days } : { hours: entry.hours },
        });
      }),
    ];
  }

  get options() {
    return [
      {
        l10nId: "zen-live-folder-rss-option-feed-url",
        key: "feedURL",
      },
      {
        l10nId: "zen-live-folder-rss-option-item-limit",
        key: "maxItems",
        options: this._buildItemLimitOptions(),
      },
      {
        l10nId: "zen-live-folder-rss-option-time-range",
        key: "timeRange",
        options: this._buildTimeRangeOptions(),
      },
    ];
  }

  // static so it can be easily accessed by the manager without having to create the live folder first
  static async getMetadata(url, window) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { label: "", icon: window.gZenEmojiPicker.getSVGURL("logo-rss.svg") };
      }

      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");

      const isAtom = doc.querySelector("feed") !== null;
      const title = (
        isAtom
          ? doc.querySelector("feed > title")?.textContent
          : doc.querySelector("rss > channel > title, channel > title")?.textContent
      )?.trim();

      const linkNode = isAtom
        ? doc.querySelector("feed > link[rel='alternate'][href], feed > link[href]")
        : doc.querySelector("rss > channel > link, channel > link");
      const feedLink =
        (isAtom ? linkNode?.getAttribute("href") : linkNode?.textContent)?.trim() || "";

      const faviconPageUrl = feedLink ? new URL(feedLink, url).href : url;
      let favicon = await lazy.PlacesUtils.favicons.getFaviconForPage(
        Services.io.newURI(faviconPageUrl)
      );

      return {
        label: title || "",
        icon: favicon?.dataURI.spec || window.gZenEmojiPicker.getSVGURL("logo-rss.svg"),
      };
    } catch (e) {
      return { label: "", icon: window.gZenEmojiPicker.getSVGURL("logo-rss.svg") };
    }
  }

  static async promptForFeedUrl(window, initialUrl = "") {
    const input = { value: initialUrl };
    const [prompt] = await lazy.l10n.formatValues(["zen-live-folder-rss-prompt-feed-url"]);
    const promptOk = Services.prompt.prompt(window, prompt, null, input, null, {
      value: null,
    });

    if (!promptOk) {
      return null;
    }

    try {
      const raw = (input.value ?? "").trim();
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error();
      }

      return parsed.href;
    } catch {
      window.gZenUIManager.showToast("zen-live-folder-rss-invalid-url-title", {
        descriptionId: "zen-live-folder-rss-invalid-url-description",
        timeout: 6000,
      });
    }

    return null;
  }

  async getMetadata() {
    return nsRssLiveFolderProvider.getMetadata(this.state.url, this.manager.window);
  }

  async onOptionTrigger(option) {
    super.onOptionTrigger(option);

    const key = option.getAttribute("option-key");
    const value = option.getAttribute("option-value");

    if (!this.options.some((x) => x.key === key)) {
      return;
    }

    switch (key) {
      case "feedURL": {
        const url = await nsRssLiveFolderProvider.promptForFeedUrl(
          this.manager.window,
          this.state.url
        );
        if (url) {
          this.state.url = url;
          this.refresh();
        }
        break;
      }
      case "maxItems":
      case "timeRange": {
        const parsedValue = Number.parseInt(value);
        if (!Number.isNaN(parsedValue)) {
          this.state[key] = parsedValue;
          this.refresh();
        }
        break;
      }
    }

    this.requestSave();
  }

  serialize() {
    return {
      state: this.state,
    };
  }
}
