// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const PREF_WEBAPP_URL = "zen.tab-intelligence.google.webapp-url";
const PREF_API_KEY = "zen.tab-intelligence.google.api-key";
const PREF_NOTIFY_MINUTES = "zen.tab-intelligence.google.notify-minutes-before";

class nsZenGoogleConnector {
  #cache = {
    gmail: { data: null, timestamp: 0 },
    calendar: { data: null, timestamp: 0 },
  };
  #cacheTtlMs = 30000; // 30 seconds
  #pollInterval = null;
  #listeners = new Set();

  init() {
    this.#startPolling();
  }

  uninit() {
    this.#stopPolling();
    this.#cache.gmail = { data: null, timestamp: 0 };
    this.#cache.calendar = { data: null, timestamp: 0 };
    this.#listeners.clear();
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
    const url = Services.prefs.getStringPref(PREF_WEBAPP_URL, "").trim();
    return url.length > 0 && url.startsWith("https://script.google.com/");
  }

  #buildUrl(action) {
    let urlStr = Services.prefs.getStringPref(PREF_WEBAPP_URL, "").trim();
    if (!urlStr) return null;

    try {
      const url = new URL(urlStr);
      url.searchParams.set("action", action);
      const key = Services.prefs.getStringPref(PREF_API_KEY, "").trim();
      if (key) {
        url.searchParams.set("key", key);
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  async getUnreadEmails(force = false) {
    if (!this.isConfigured()) {
      return { configured: false, items: [], totalUnread: 0 };
    }

    const now = Date.now();
    if (!force && this.#cache.gmail.data && (now - this.#cache.gmail.timestamp < this.#cacheTtlMs)) {
      return { ...this.#cache.gmail.data, configured: true };
    }

    const url = this.#buildUrl("gmail");
    if (!url) {
      return { configured: false, items: [], totalUnread: 0 };
    }

    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      if (json && json.success && json.gmail) {
        const result = {
          items: Array.isArray(json.gmail.items) ? json.gmail.items : [],
          totalUnread: json.gmail.totalUnread || 0,
        };
        this.#cache.gmail = { data: result, timestamp: now };
        return { ...result, configured: true };
      }
    } catch (e) {
      console.warn("[ZenGoogleConnector] Failed to fetch Gmail unread:", e);
    }

    if (this.#cache.gmail.data) {
      return { ...this.#cache.gmail.data, configured: true };
    }
    return { configured: true, items: [], totalUnread: 0 };
  }

  async getTodayEvents(force = false) {
    if (!this.isConfigured()) {
      return { configured: false, items: [] };
    }

    const now = Date.now();
    if (!force && this.#cache.calendar.data && (now - this.#cache.calendar.timestamp < this.#cacheTtlMs)) {
      return { ...this.#cache.calendar.data, configured: true };
    }

    const url = this.#buildUrl("calendar");
    if (!url) {
      return { configured: false, items: [] };
    }

    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      if (json && json.success && json.calendar) {
        const result = {
          items: Array.isArray(json.calendar.items) ? json.calendar.items : [],
        };
        this.#cache.calendar = { data: result, timestamp: now };
        return { ...result, configured: true };
      }
    } catch (e) {
      console.warn("[ZenGoogleConnector] Failed to fetch Calendar events:", e);
    }

    if (this.#cache.calendar.data) {
      return { ...this.#cache.calendar.data, configured: true };
    }
    return { configured: true, items: [] };
  }

  async getImminentMeeting() {
    const eventsData = await this.getTodayEvents();
    if (!eventsData || !eventsData.items) return null;

    const notifyMinutes = Services.prefs.getIntPref(PREF_NOTIFY_MINUTES, 10);
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
        this.getTodayEvents(true).then(() => {
          this.getImminentMeeting().then(meeting => {
            this.#notify("onImminentMeetingUpdated", meeting);
          });
        }).catch(() => {});
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
