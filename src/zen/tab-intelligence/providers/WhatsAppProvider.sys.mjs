// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenBaseTabProvider } from "resource:///modules/zen/intelligence/ZenBaseTabProvider.sys.mjs";

export class WhatsAppProvider extends ZenBaseTabProvider {
  get type() {
    return "chat";
  }

  get serviceName() {
    return "WhatsApp";
  }

  matches(url) {
    return (
      typeof url === "string" && url.startsWith("https://web.whatsapp.com/")
    );
  }

  checkQuickStatus(document, window) {
    let unreadCount = 0;
    const title = document.title || "";
    const titleMatch = title.match(/\((\d+)\)/);
    if (titleMatch) {
      unreadCount = parseInt(titleMatch[1], 10) || 0;
    }

    if (unreadCount === 0) {
      const badges = document.querySelectorAll(
        "span[data-icon='unread-count'], span[aria-label*='unread' i], span[aria-label*='non lu' i]"
      );
      for (const badge of badges) {
        const num = parseInt(badge.textContent?.trim(), 10);
        if (!isNaN(num)) {
          unreadCount += num;
        } else {
          unreadCount += 1;
        }
      }
    }

    return {
      hasUnread: unreadCount > 0,
      unreadCount,
      hasImminentMeeting: false,
      imminentMeeting: null,
    };
  }

  fetchDetails(document, window) {
    const items = [];
    const unreadBadges = document.querySelectorAll(
      "span[data-icon='unread-count'], span[aria-label*='unread' i], span[aria-label*='non lu' i]"
    );

    for (let i = 0; i < Math.min(unreadBadges.length, 5); i++) {
      const badge = unreadBadges[i];
      const chatRow = badge.closest(
        "div[role='listitem'], div[role='row'], div[tabindex='-1']"
      );

      const nameEl = chatRow?.querySelector("span[title]");
      const name = nameEl?.getAttribute("title") || nameEl?.textContent?.trim() || "Chat";

      const snippetEl = chatRow?.querySelector("span[dir='ltr'], span.matched-text");
      const snippet = snippetEl?.textContent?.trim() || "";

      items.push({
        title: name,
        subtitle: "Unread message",
        snippet,
        url: window.location.href,
      });
    }

    if (items.length === 0) {
      const title = document.title || "";
      const match = title.match(/\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 1;
      items.push({
        title: "WhatsApp",
        subtitle: `${count} unread conversation${count > 1 ? "s" : ""}`,
        snippet: "Click to view chats",
        url: window.location.href,
      });
    }

    return {
      type: this.type,
      service: this.serviceName,
      items,
    };
  }
}
