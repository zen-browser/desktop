// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { GmailProvider } from "resource:///modules/zen/intelligence/GmailProvider.sys.mjs";
import { GoogleCalendarProvider } from "resource:///modules/zen/intelligence/GoogleCalendarProvider.sys.mjs";
import { WhatsAppProvider } from "resource:///modules/zen/intelligence/WhatsAppProvider.sys.mjs";

const PROVIDERS = [
  new GmailProvider(),
  new GoogleCalendarProvider(),
  new WhatsAppProvider(),
];

export class ZenTabIntelligenceChild extends JSWindowActorChild {
  #activeProvider = null;
  #observer = null;
  #debounceTimer = null;
  #lastStatusJson = null;

  handleEvent(event) {
    switch (event.type) {
      case "DOMContentLoaded":
      case "pageshow":
      case "DOMTitleChanged":
        this.#scheduleUpdate(250);
        break;
    }
  }

  #getProvider() {
    if (this.#activeProvider) {
      return this.#activeProvider;
    }

    const url = this.document?.documentURI;
    if (!url) return null;

    this.#activeProvider = PROVIDERS.find(p => p.matches(url)) || null;
    return this.#activeProvider;
  }

  #scheduleUpdate(delayMs = 300) {
    if (this.#debounceTimer) {
      this.contentWindow?.clearTimeout(this.#debounceTimer);
    }

    this.#debounceTimer = this.contentWindow?.setTimeout(() => {
      this.#runUpdate();
    }, delayMs);
  }

  #setupObserver() {
    if (this.#observer || !this.document) return;

    this.#observer = new this.contentWindow.MutationObserver(() => {
      this.#scheduleUpdate(500);
    });

    const targetNode = this.document.querySelector("title") || this.document.documentElement;
    if (targetNode) {
      this.#observer.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  #runUpdate() {
    const provider = this.#getProvider();
    if (!provider || !this.document || !this.contentWindow) return;

    this.#setupObserver();

    try {
      const status = provider.checkQuickStatus(this.document, this.contentWindow);
      const statusJson = JSON.stringify(status);

      if (statusJson !== this.#lastStatusJson) {
        this.#lastStatusJson = statusJson;
        this.sendAsyncMessage("ZenTabIntelligence:StatusUpdate", status);
      }
    } catch (e) {
      console.error("[ZenTabIntelligenceChild] Update error:", e);
    }
  }

  receiveMessage(message) {
    if (message.name === "ZenTabIntelligence:RequestDetails") {
      const provider = this.#getProvider();
      if (!provider || !this.document || !this.contentWindow) {
        return { items: [] };
      }

      try {
        return provider.fetchDetails(this.document, this.contentWindow);
      } catch (e) {
        console.error("[ZenTabIntelligenceChild] Details error:", e);
        return { items: [] };
      }
    }
    return null;
  }

  didDestroy() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
    if (this.#debounceTimer && this.contentWindow) {
      this.contentWindow.clearTimeout(this.#debounceTimer);
      this.#debounceTimer = null;
    }
  }
}
