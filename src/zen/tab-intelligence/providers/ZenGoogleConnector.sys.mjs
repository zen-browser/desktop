// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenGoogleAuth } from "resource:///modules/zen/intelligence/ZenGoogleAuth.sys.mjs";

const PREF_NOTIFY_MINUTES = "zen.tab-intelligence.notify-minutes-before";

const GMAIL_MESSAGES_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_LABELS_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX";
const CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const VIDEO_CONFERENCE_REGEX =
  /https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/\d+[^\s"'<>]*|teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+|webex\.com\/[^\s"'<>]+|meet\.jit\.si\/[^\s"'<>]+)/i;

class nsZenGoogleConnector {
  #cache = {
    gmail: { data: null, timestamp: 0 },
    calendar: { data: null, timestamp: 0 },
  };
  #cacheTtlMs = 30000; // 30 seconds
  #pollInterval = null;
  #listeners = new Set();

  init() {
    ZenGoogleAuth.addListener(this);
    this.#startPolling();
  }

  uninit() {
    ZenGoogleAuth.removeListener(this);
    this.#stopPolling();
    this.#clearCache();
    this.#listeners.clear();
  }

  #clearCache() {
    this.#cache.gmail = { data: null, timestamp: 0 };
    this.#cache.calendar = { data: null, timestamp: 0 };
  }

  onAuthStateChanged(data) {
    this.#clearCache();
    this.#notify("onImminentMeetingUpdated", null);
    if (data.authenticated) {
      this.getTodayEvents(true).then(() => {
        this.getImminentMeeting().then((meeting) => {
          this.#notify("onImminentMeetingUpdated", meeting);
        });
      }).catch(() => {});
    }
  }

  addListener(listener) {
    this.#listeners.add(listener);
  }

  removeListener(listener) {
    this.#listeners.delete(listener);
  }

  #notify(event, data) {
    for (const listener of this.#listeners) {
      try {
        if (typeof listener[event] === "function") {
          listener[event](data);
        }
      } catch (e) {
        console.error(`[ZenGoogleConnector] Listener error on ${event}:`, e);
      }
    }
  }

  isConfigured() {
    return ZenGoogleAuth.isAuthenticated();
  }

  async getUnreadEmails(force = false) {
    if (!this.isConfigured()) {
      return { configured: false, items: [], totalUnread: 0 };
    }

    const now = Date.now();
    if (
      !force &&
      this.#cache.gmail.data &&
      now - this.#cache.gmail.timestamp < this.#cacheTtlMs
    ) {
      return { ...this.#cache.gmail.data, configured: true };
    }

    const token = await ZenGoogleAuth.getValidAccessToken();
    if (!token) {
      return { configured: false, items: [], totalUnread: 0 };
    }

    try {
      // 1. Fetch the 3 latest unread messages
      const listUrl = `${GMAIL_MESSAGES_ENDPOINT}?q=is%3Aunread%20in%3Ainbox&maxResults=3`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!listRes.ok) {
        throw new Error(`Gmail API list error: ${listRes.status}`);
      }

      const listData = await listRes.json();
      const messages = Array.isArray(listData.messages) ? listData.messages : [];

      // 2. Fetch metadata for each message in parallel
      const items = await Promise.all(
        messages.map(async (msg) => {
          try {
            const detailUrl = `${GMAIL_MESSAGES_ENDPOINT}/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;
            const detailRes = await fetch(detailUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!detailRes.ok) return null;
            const detail = await detailRes.json();

            const headers = detail.payload?.headers || [];
            let from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "Expéditeur";
            const subject =
              headers.find((h) => h.name.toLowerCase() === "subject")?.value || "(Sans objet)";

            // Format sender: "First Last <email@domain>" -> "First Last"
            const nameMatch = from.match(/^"?([^"<]+)"?\s*<.*>$/);
            if (nameMatch) {
              from = nameMatch[1].trim();
            }

            return {
              id: detail.id,
              title: from,
              subtitle: subject,
              snippet: detail.snippet || "",
              date: detail.internalDate ? new Date(parseInt(detail.internalDate, 10)).toISOString() : "",
              url: `https://mail.google.com/mail/u/0/#inbox/${detail.threadId || detail.id}`,
            };
          } catch {
            return null;
          }
        })
      );

      const validItems = items.filter(Boolean);

      // 3. Fetch exact unread count from INBOX label
      let totalUnread = validItems.length;
      try {
        const labelRes = await fetch(GMAIL_LABELS_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (labelRes.ok) {
          const labelData = await labelRes.json();
          if (typeof labelData.messagesUnread === "number") {
            totalUnread = labelData.messagesUnread;
          }
        }
      } catch {}

      const result = { items: validItems, totalUnread };
      this.#cache.gmail = { data: result, timestamp: now };
      return { ...result, configured: true };
    } catch (e) {
      console.warn("[ZenGoogleConnector] Error fetching Gmail unread:", e);
      if (this.#cache.gmail.data) {
        return { ...this.#cache.gmail.data, configured: true };
      }
      return { configured: true, items: [], totalUnread: 0 };
    }
  }

  async getTodayEvents(force = false) {
    if (!this.isConfigured()) {
      return { configured: false, items: [] };
    }

    const now = Date.now();
    if (
      !force &&
      this.#cache.calendar.data &&
      now - this.#cache.calendar.timestamp < this.#cacheTtlMs
    ) {
      return { ...this.#cache.calendar.data, configured: true };
    }

    const token = await ZenGoogleAuth.getValidAccessToken();
    if (!token) {
      return { configured: false, items: [] };
    }

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const url = new URL(CALENDAR_EVENTS_ENDPOINT);
      url.searchParams.set("timeMin", startOfDay.toISOString());
      url.searchParams.set("timeMax", endOfDay.toISOString());
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Calendar API error: ${res.status}`);
      }

      const data = await res.json();
      const rawEvents = Array.isArray(data.items) ? data.items : [];
      const upcomingEvents = [];

      for (const ev of rawEvents) {
        const startStr = ev.start?.dateTime || ev.start?.date;
        const endStr = ev.end?.dateTime || ev.end?.date;
        if (!startStr) continue;

        const start = new Date(startStr);
        const end = new Date(endStr || startStr);
        const isAllDay = !ev.start?.dateTime;

        // Skip events already completed (unless all day)
        if (end.getTime() < now && !isAllDay) {
          continue;
        }

        // Detect video conference link:
        // 1. Google Meet hangoutLink
        // 2. conferenceData entry points
        // 3. Regex on description and location
        let videoUrl = ev.hangoutLink || null;
        if (!videoUrl && Array.isArray(ev.conferenceData?.entryPoints)) {
          const ep = ev.conferenceData.entryPoints.find((e) => e.entryPointType === "video");
          if (ep?.uri) videoUrl = ep.uri;
        }
        if (!videoUrl) {
          const combined = `${ev.description || ""} ${ev.location || ""}`;
          const match = combined.match(VIDEO_CONFERENCE_REGEX);
          if (match) videoUrl = match[0];
        }

        const diffMinutes = Math.round((start.getTime() - now) / 60000);

        let timeStr = "Toute la journée";
        if (!isAllDay) {
          const startFmt = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const endFmt = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          timeStr = `${startFmt} - ${endFmt}`;
        }

        upcomingEvents.push({
          id: ev.id,
          title: ev.summary || "Réunion",
          subtitle: timeStr,
          time: timeStr,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          videoUrl,
          isAllDay,
          diffMinutes,
          url: ev.htmlLink || "https://calendar.google.com/calendar/r",
        });
      }

      upcomingEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      const result = { items: upcomingEvents };
      this.#cache.calendar = { data: result, timestamp: now };
      return { ...result, configured: true };
    } catch (e) {
      console.warn("[ZenGoogleConnector] Error fetching Calendar events:", e);
      if (this.#cache.calendar.data) {
        return { ...this.#cache.calendar.data, configured: true };
      }
      return { configured: true, items: [] };
    }
  }

  async getImminentMeeting() {
    const eventsData = await this.getTodayEvents();
    if (!eventsData?.items) return null;

    const notifyMinutes = Services.prefs.getIntPref(PREF_NOTIFY_MINUTES, 5);
    const now = Date.now();

    for (const ev of eventsData.items) {
      if (!ev.videoUrl) continue;
      const startMs = new Date(ev.startTime).getTime();
      const diffMinutes = (startMs - now) / 60000;

      // Between 5 minutes past start and notifyMinutes before start
      if (diffMinutes >= -5 && diffMinutes <= notifyMinutes) {
        return {
          title: ev.title || "Meeting",
          videoUrl: ev.videoUrl,
          minutesLeft: Math.max(0, Math.ceil(diffMinutes)),
          calendar: "Google Calendar",
        };
      }
    }

    return null;
  }

  #startPolling() {
    this.#stopPolling();
    // Poll calendar every 90 seconds for imminent meeting detection
    this.#pollInterval = Services.tm.mainThread.setInterval(() => {
      if (this.isConfigured()) {
        this.getTodayEvents(true)
          .then(() => {
            this.getImminentMeeting().then((meeting) => {
              this.#notify("onImminentMeetingUpdated", meeting);
            });
          })
          .catch(() => {});
      }
    }, 90000);
  }

  #stopPolling() {
    if (this.#pollInterval) {
      Services.tm.mainThread.clearInterval(this.#pollInterval);
      this.#pollInterval = null;
    }
  }
}

export const ZenGoogleConnector = new nsZenGoogleConnector();
