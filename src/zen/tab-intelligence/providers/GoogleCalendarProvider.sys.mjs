// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenBaseTabProvider } from "resource:///modules/zen/intelligence/ZenBaseTabProvider.sys.mjs";

const VIDEO_CONFERENCE_REGEX =
  /https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/\d+[^\s"'<>]*|teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+|webex\.com\/[^\s"'<>]+|meet\.jit\.si\/[^\s"'<>]+)/i;

export class GoogleCalendarProvider extends ZenBaseTabProvider {
  get type() {
    return "calendar";
  }

  get serviceName() {
    return "Google Calendar";
  }

  matches(url) {
    return (
      typeof url === "string" && url.startsWith("https://calendar.google.com/")
    );
  }

  #findVideoUrl(element) {
    if (!element) return null;

    const directAnchor = element.querySelector("a[href*='meet.google.com'], a[href*='zoom.us'], a[href*='teams.microsoft.com']");
    if (directAnchor?.href) {
      const match = directAnchor.href.match(VIDEO_CONFERENCE_REGEX);
      if (match) return match[0];
    }

    const htmlContent = element.innerHTML || "";
    const htmlMatch = htmlContent.match(VIDEO_CONFERENCE_REGEX);
    if (htmlMatch) {
      return htmlMatch[0];
    }

    return null;
  }

  #parseTimeString(text) {
    if (!text) return null;
    // Match 24h format "14:30" or "14h30" or 12h "2:30 PM"
    const match = text.match(/(\d{1,2})[:h](\d{2})(?:\s*([ap]\.?m\.?))?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toLowerCase();

    if (meridiem) {
      if (meridiem.startsWith("p") && hours < 12) hours += 12;
      if (meridiem.startsWith("a") && hours === 12) hours = 0;
    }

    const eventDate = new Date();
    eventDate.setHours(hours, minutes, 0, 0);
    return eventDate;
  }

  #extractEvents(document) {
    const events = [];
    const eventElements = document.querySelectorAll(
      "[data-eventid], [data-eventchip], div[role='button'][aria-label*=':']"
    );

    const now = new Date();

    for (const el of eventElements) {
      const aria = el.getAttribute("aria-label") || el.textContent || "";
      if (!aria) continue;

      const videoUrl = this.#findVideoUrl(el);
      const eventTime = this.#parseTimeString(aria);

      let title = aria.split(",")[0]?.trim() || "Calendar Event";
      // Clean up common prefixes
      title = title.replace(/^(Event|Évènement)\s*:\s*/i, "");

      events.push({
        title,
        element: el,
        time: eventTime,
        timeStr: aria.match(/\d{1,2}[:h]\d{2}(?:\s*[ap]\.?m\.?)?/i)?.[0] || "",
        videoUrl,
      });
    }

    return events;
  }

  checkQuickStatus(document, window) {
    const events = this.#extractEvents(document);
    const now = Date.now();
    let imminentMeeting = null;

    for (const ev of events) {
      if (!ev.videoUrl) continue;

      if (ev.time) {
        const diffMs = ev.time.getTime() - now;
        const diffMinutes = diffMs / (60 * 1000);
        const notifyMinutes = Services.prefs.getIntPref(
          "zen.tab-intelligence.system-calendar.notify-minutes-before",
          10
        );

        // Within notifyMinutes before start, or up to 5 minutes after start
        if (diffMinutes >= -5 && diffMinutes <= notifyMinutes) {
          imminentMeeting = {
            title: ev.title,
            videoUrl: ev.videoUrl,
            timeStr: ev.timeStr,
            minutesLeft: Math.max(0, Math.ceil(diffMinutes)),
          };
          break;
        }
      } else {
        // Fallback: If there's an active video button in current viewport
        imminentMeeting = {
          title: ev.title,
          videoUrl: ev.videoUrl,
          timeStr: ev.timeStr || "Now",
          minutesLeft: 0,
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

  fetchDetails(document, window) {
    const rawEvents = this.#extractEvents(document);
    const items = [];

    for (let i = 0; i < Math.min(rawEvents.length, 5); i++) {
      const ev = rawEvents[i];
      items.push({
        title: ev.title,
        subtitle: ev.timeStr || "",
        videoUrl: ev.videoUrl || null,
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
