// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenBaseTabProvider } from "resource:///modules/zen/intelligence/ZenBaseTabProvider.sys.mjs";

export class GmailProvider extends ZenBaseTabProvider {
  get type() {
    return "mail";
  }

  get serviceName() {
    return "Gmail";
  }

  matches(url) {
    return typeof url === "string" && url.startsWith("https://mail.google.com/");
  }

  checkQuickStatus(document, window) {
    let unreadCount = 0;
    const title = document.title || "";
    const titleMatch = title.match(/\((\d+)\)/);
    if (titleMatch) {
      unreadCount = parseInt(titleMatch[1], 10) || 0;
    }

    if (unreadCount === 0) {
      const inboxBadge = document.querySelector(".J-N-Jz .bsU, .bsU");
      if (inboxBadge) {
        const text = inboxBadge.textContent?.trim();
        const num = parseInt(text, 10);
        if (!isNaN(num)) {
          unreadCount = num;
        }
      }
    }

    const unreadRowsCount = document.querySelectorAll(
      "tr.zE, tr.zA:not(.yO), div[role='main'] tr.zE"
    ).length;
    const hasUnread = unreadCount > 0 || unreadRowsCount > 0;

    return {
      hasUnread,
      unreadCount: unreadCount || unreadRowsCount,
      hasImminentMeeting: false,
      imminentMeeting: null,
    };
  }

  fetchDetails(document, window) {
    const items = [];
    const rows = document.querySelectorAll(
      "tr.zE, tr.zA:not(.yO), div[role='main'] tr"
    );

    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i];
      const senderEl = row.querySelector(".yP, .zF, span[name], span[email], .bA4");
      const sender = senderEl?.textContent?.trim() || "Google Mail";

      const subjectEl = row.querySelector(".bog, .bqe, span[data-thread-id]");
      const subject = subjectEl?.textContent?.trim() || "(No subject)";

      const snippetEl = row.querySelector(".y2");
      let snippet = snippetEl?.textContent?.trim() || "";
      if (snippet.startsWith("-") || snippet.startsWith("–")) {
        snippet = snippet.substring(1).trim();
      }

      const timeEl = row.querySelector(".xW");
      const time = timeEl?.textContent?.trim() || "";

      items.push({
        title: sender,
        subtitle: subject,
        snippet,
        time,
        url: window.location.href,
      });
    }

    if (items.length === 0) {
      const title = document.title || "";
      const match = title.match(/\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 1;
      items.push({
        title: "Gmail",
        subtitle: `${count} unread conversation${count > 1 ? "s" : ""}`,
        snippet: "Click to view inbox",
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
