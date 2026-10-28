// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const VIDEO_CONFERENCE_REGEX =
  /https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/\d+[^\s"'<>]*|teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+|webex\.com\/[^\s"'<>]+|meet\.jit\.si\/[^\s"'<>]+)/i;

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
    if (url.startsWith("https://mail.google.com/")) return "gmail";
    if (url.startsWith("https://web.whatsapp.com/")) return "whatsapp";
    if (url.startsWith("https://calendar.google.com/")) return "calendar";
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
      // Content process silent catch
    }
  }

  #checkStatus(service) {
    const doc = this.document;
    const title = doc.title || "";
    const titleMatch = title.match(/\((\d+)\)/);
    let unreadCount = titleMatch ? parseInt(titleMatch[1], 10) : 0;

    if (service === "gmail") {
      if (unreadCount === 0) {
        const badge = doc.querySelector(".J-N-Jz .bsU, .bsU");
        const num = parseInt(badge?.textContent?.trim(), 10);
        if (!isNaN(num)) unreadCount = num;
      }
      const unreadRows = doc.querySelectorAll(
        "tr.zE, tr.zA:not(.yO), div[role='main'] tr.zE"
      ).length;
      const hasUnread = unreadCount > 0 || unreadRows > 0;
      return {
        hasUnread,
        unreadCount: unreadCount || unreadRows,
        hasImminentMeeting: false,
        imminentMeeting: null,
      };
    }

    if (service === "whatsapp") {
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

    if (service === "calendar") {
      const events = doc.querySelectorAll(
        "div[data-eventid], div[data-eventchip], div[role='button'][aria-label*=':'], div[role='gridcell'] div[role='button'], div[jsaction*='click:'][aria-label*=':']"
      );
      let imminentMeeting = null;
      const now = Date.now();

      for (const el of events) {
        const aria = el.getAttribute("aria-label") || el.textContent || "";
        const timeMatch = aria.match(/(\d{1,2})[:h](\d{2})(?:\s*([ap]\.?m\.?))?/i);
        if (!timeMatch) continue;

        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const meridiem = timeMatch[3]?.toLowerCase();
        if (meridiem?.startsWith("p") && hours < 12) hours += 12;
        if (meridiem?.startsWith("a") && hours === 12) hours = 0;

        const evDate = new Date();
        evDate.setHours(hours, minutes, 0, 0);
        const diffMinutes = (evDate.getTime() - now) / 60000;

        const videoMatch =
          el.innerHTML?.match(VIDEO_CONFERENCE_REGEX) ||
          el.querySelector("a[href*='meet.google.com'], a[href*='zoom.us'], a[href*='teams.microsoft.com']")?.href?.match(VIDEO_CONFERENCE_REGEX) ||
          doc.body?.innerHTML?.match(VIDEO_CONFERENCE_REGEX);

        if (videoMatch && diffMinutes >= -5 && diffMinutes <= 5) {
          const parsed = this.#parseCalendarAria(aria);
          imminentMeeting = {
            title: parsed.title || "Meeting",
            videoUrl: videoMatch[0],
            minutesLeft: Math.max(0, Math.ceil(diffMinutes)),
          };
          break;
        }
      }

      return {
        hasUnread: false,
        unreadCount: 0,
        hasImminentMeeting: !!imminentMeeting,
        imminentMeeting,
      };
    }

    return { hasUnread: false, unreadCount: 0, hasImminentMeeting: false, imminentMeeting: null };
  }

  receiveMessage(message) {
    if (message.name === "ZenTabIntelligence:RequestDetails") {
      const service = this.#getServiceType();
      if (!service || !this.document) return { items: [] };

      try {
        return this.#fetchDetails(service);
      } catch (e) {
        return { items: [] };
      }
    }
    return null;
  }

  #fetchDetails(service) {
    const doc = this.document;
    const items = [];

    if (service === "gmail") {
      const rows = doc.querySelectorAll(
        "tr.zE, tr.zA:not(.yO), div[role='main'] tr.zE"
      );
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const row = rows[i];
        const sender =
          row.querySelector(".yP, .zF, span[name], span[email], .bA4")?.textContent?.trim() ||
          "Sender";
        const subject =
          row.querySelector(".bog, .bqe, span[data-thread-id]")?.textContent?.trim() ||
          "(No subject)";
        let snippet = row.querySelector(".y2")?.textContent?.trim() || "";
        if (snippet.startsWith("-") || snippet.startsWith("–")) {
          snippet = snippet.substring(1).trim();
        }

        items.push({
          title: sender,
          subtitle: subject,
          snippet,
          url: this.contentWindow.location.href,
        });
      }
      return { type: "mail", service: "Gmail", items };
    }

    if (service === "whatsapp") {
      const badges = doc.querySelectorAll(
        "span[data-icon='unread-count'], span[aria-label*='unread' i], span[aria-label*='non lu' i]"
      );
      for (let i = 0; i < Math.min(badges.length, 5); i++) {
        const badge = badges[i];
        const chatRow = badge.closest(
          "div[role='listitem'], div[role='row'], div[tabindex='-1']"
        );
        const nameEl = chatRow?.querySelector("span[title]");
        const name =
          nameEl?.getAttribute("title") || nameEl?.textContent?.trim() || "Chat";
        const snippetEl = chatRow?.querySelector("span[dir='ltr'], span.matched-text");
        const snippet = snippetEl?.textContent?.trim() || "";

        items.push({
          title: name,
          subtitle: snippet || "",
          snippet: "",
          url: this.contentWindow.location.href,
        });
      }
      return { type: "chat", service: "WhatsApp", items };
    }

    if (service === "calendar") {
      const events = doc.querySelectorAll(
        "div[data-eventid], div[data-eventchip], div[role='button'][aria-label*=':'], div[role='gridcell'] div[role='button'], div[jsaction*='click:'][aria-label*=':']"
      );
      const seenTitles = new Set();
      for (let i = 0; i < events.length && items.length < 5; i++) {
        const el = events[i];
        const aria = el.getAttribute("aria-label") || el.textContent || "";
        const parsed = this.#parseCalendarAria(aria);
        if (!parsed.title || seenTitles.has(parsed.title)) continue;
        seenTitles.add(parsed.title);

        const videoMatch =
          el.innerHTML?.match(VIDEO_CONFERENCE_REGEX) ||
          el.querySelector("a[href*='meet.google.com'], a[href*='zoom.us']")?.href?.match(VIDEO_CONFERENCE_REGEX);

        items.push({
          title: parsed.title,
          subtitle: parsed.time || "",
          videoUrl: videoMatch ? videoMatch[0] : null,
          url: this.contentWindow.location.href,
        });
      }
      return { type: "calendar", service: "Google Calendar", items };
    }

    return { items: [] };
  }

  #parseCalendarAria(aria) {
    if (!aria) return { title: "Calendar Event", time: "" };
    const parts = aria.split(",").map(p => p.trim()).filter(Boolean);
    const timeRegex = /\b\d{1,2}[:h](\d{2})?(?:\s*(?:[ap]\.?m\.?|à|to|-)\s*\d{1,2}[:h](\d{2})?)?(?:\s*[ap]\.?m\.?)?/i;
    let timeStr = "";
    let titleStr = "";

    for (const part of parts) {
      if (!timeStr && timeRegex.test(part)) {
        timeStr = part;
      } else if (
        !titleStr &&
        !/^(accepté|accepted|refusé|declined|peut-être|maybe|pas de rappel|no reminder|busy|occupé|calendar|calendrier)/i.test(part)
      ) {
        titleStr = part;
      }
    }

    return {
      title: titleStr || parts[0] || "Calendar Event",
      time: timeStr || "",
    };
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
