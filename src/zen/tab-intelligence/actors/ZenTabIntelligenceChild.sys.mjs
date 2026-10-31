// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenTabIntelligenceChild extends JSWindowActorChild {
  #observer = null;
  #debounceTimer = null;
  #lastStatusJson = null;

  handleEvent(event) {
    if (this.contentWindow !== this.contentWindow?.top) {
      return;
    }
    switch (event.type) {
      case "DOMContentLoaded":
      case "pageshow":
        this.#scheduleUpdate(300);
        break;
    }
  }

  #getServiceType() {
    const url = this.document?.documentURI || "";
    if (url.startsWith("https://web.whatsapp.com/")) return "whatsapp";
    return null;
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

    const targetNode =
      this.document.querySelector("title") || this.document.documentElement;
    if (targetNode) {
      this.#observer.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  #runUpdate() {
    const service = this.#getServiceType();
    if (!service || !this.document || !this.contentWindow) return;

    this.#setupObserver();

    try {
      const status = this.#checkStatus(service);
      const statusJson = JSON.stringify(status);

      if (statusJson !== this.#lastStatusJson) {
        this.#lastStatusJson = statusJson;
        this.sendAsyncMessage("ZenTabIntelligence:StatusUpdate", status);
      }
    } catch (e) {
      // Silent catch
    }
  }

  #checkStatus(service) {
    if (service === "whatsapp") {
      const doc = this.document;
      const title = doc.title || "";
      const titleMatch = title.match(/\((\d+)\)/);
      let unreadCount = titleMatch ? parseInt(titleMatch[1], 10) : 0;

      if (unreadCount === 0) {
        const badges = doc.querySelectorAll(
          "span[data-icon='unread-count'], span[aria-label*='unread' i], span[aria-label*='non lu' i]"
        );
        for (const b of badges) {
          const num = parseInt(b.textContent?.trim(), 10);
          unreadCount += !isNaN(num) ? num : 1;
        }
      }

      return {
        hasUnread: unreadCount > 0,
        unreadCount,
        hasImminentMeeting: false,
        imminentMeeting: null,
      };
    }

    return { hasUnread: false, unreadCount: 0, hasImminentMeeting: false, imminentMeeting: null };
  }

  receiveMessage(message) {
    return { items: [] };
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
