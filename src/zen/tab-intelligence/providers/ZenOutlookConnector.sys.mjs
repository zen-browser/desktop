// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenOutlookAuth } from "resource:///modules/zen/intelligence/ZenOutlookAuth.sys.mjs";

const PREF_NOTIFY_MINUTES = "zen.tab-intelligence.notify-minutes-before";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

const VIDEO_CONFERENCE_REGEX =
  /https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+|meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/\d+[^\s"'<>]*|webex\.com\/[^\s"'<>]+|meet\.jit\.si\/[^\s"'<>]+)/i;

class nsZenOutlookConnector {
  #cache = {
    outlook: { data: null, timestamp: 0 },
    calendar: { data: null, timestamp: 0 },
  };
  #cacheTtlMs = 30000; // 30 seconds
  #pollInterval = null;
  #listeners = new Set();

  init() {
    ZenOutlookAuth.addListener(this);
    this.#startPolling();
  }

  uninit() {
    ZenOutlookAuth.removeListener(this);
    this.#stopPolling();
    this.#clearCache();
    this.#listeners.clear();
  }

  #clearCache() {
    this.#cache.outlook = { data: null, timestamp: 0 };
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
        console.error(`[ZenOutlookConnector] Listener error on ${event}:`, e);
      }
    }
  }

  isConfigured() {
    return ZenOutlookAuth.isAuthenticated();
  }

  async getUnreadEmails(force = false) {
    if (!this.isConfigured()) {
      return { configured: false, items: [], totalUnread: 0 };
    }

    const now = Date.now();
    if (!force && this.#cache.outlook.data && (now - this.#cache.outlook.timestamp < this.#cacheTtlMs)) {
      return this.#cache.outlook.data;
    }

    const token = await ZenOutlookAuth.getValidAccessToken();
    if (!token) {
      return { configured: false, items: [], totalUnread: 0 };
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch total unread count from inbox folder
      let totalUnread = 0;
      try {
        const folderRes = await fetch(`${GRAPH_API_BASE}/me/mailFolders/inbox?$select=unreadItemCount`, { headers });
        if (folderRes.ok) {
          const folderData = await folderRes.json();
          totalUnread = folderData.unreadItemCount || 0;
        }
      } catch (e) {
        console.warn("[ZenOutlookConnector] Failed to fetch inbox unread count:", e);
      }

      // 2. Fetch top 3 unread messages
      const msgsUrl = `${GRAPH_API_BASE}/me/mailFolders/inbox/messages?$top=3&$filter=isRead eq false&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,webLink`;
      const msgsRes = await fetch(msgsUrl, { headers });

      const items = [];
      if (msgsRes.ok) {
        const msgsData = await msgsRes.json();
        for (const msg of msgsData.value || []) {
          const sender = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Inconnu";
          const subject = msg.subject || "(Sans objet)";
          const dateStr = msg.receivedDateTime || "";
          let time = "";
          if (dateStr) {
            try {
              const d = new Date(dateStr);
              time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            } catch {}
          }

          items.push({
            id: msg.id,
            title: subject,
            sender,
            time,
            url: msg.webLink || "https://outlook.live.com/mail/inbox",
          });
        }
      }

      const result = {
        configured: true,
        items,
        totalUnread: Math.max(totalUnread, items.length),
      };

      this.#cache.outlook = { data: result, timestamp: now };
      return result;
    } catch (e) {
      console.warn("[ZenOutlookConnector] Failed to fetch unread emails:", e);
      return { configured: true, items: [], totalUnread: 0 };
    }
  }

  async getTodayEvents(force = false) {
    if (!this.isConfigured()) {
      return { configured: false, items: [] };
    }

    const now = Date.now();
    if (!force && this.#cache.calendar.data && (now - this.#cache.calendar.timestamp < this.#cacheTtlMs)) {
      return this.#cache.calendar.data;
    }

    const token = await ZenOutlookAuth.getValidAccessToken();
    if (!token) {
      return { configured: false, items: [] };
    }

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const calUrl = `${GRAPH_API_BASE}/me/calendarView?startDateTime=${encodeURIComponent(startOfDay)}&endDateTime=${encodeURIComponent(endOfDay)}&$orderby=start/dateTime asc&$select=id,subject,start,end,isAllDay,onlineMeeting,onlineMeetingUrl,webLink,bodyPreview`;
      const res = await fetch(calUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.warn("[ZenOutlookConnector] Calendar fetch returned status:", res.status);
        return { configured: true, items: [] };
      }

      const data = await res.json();
      const rawEvents = data.value || [];

      const items = [];
      for (const ev of rawEvents) {
        const startRaw = ev.start?.dateTime;
        const endRaw = ev.end?.dateTime;
        const isAllDay = !!ev.isAllDay;

        let startTime = "";
        let endTime = "";
        let startDateObj = null;

        if (startRaw) {
          try {
            startDateObj = new Date(startRaw.endsWith("Z") ? startRaw : startRaw + "Z");
            startTime = startDateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          } catch {}
        }
        if (endRaw) {
          try {
            const endDateObj = new Date(endRaw.endsWith("Z") ? endRaw : endRaw + "Z");
            endTime = endDateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          } catch {}
        }

        // Detect video call link (Teams, Zoom, Meet, Webex)
        let videoUrl = ev.onlineMeetingUrl || ev.onlineMeeting?.joinUrl || "";
        if (!videoUrl && ev.bodyPreview) {
          const m = ev.bodyPreview.match(VIDEO_CONFERENCE_REGEX);
          if (m) videoUrl = m[0];
        }

        const isTeams = /teams\.microsoft\.com/i.test(videoUrl);
        const isMeet = /meet\.google\.com/i.test(videoUrl);
        const isZoom = /zoom\.us/i.test(videoUrl);

        let videoService = null;
        if (isTeams) videoService = "teams";
        else if (isMeet) videoService = "meet";
        else if (isZoom) videoService = "zoom";
        else if (videoUrl) videoService = "video";

        items.push({
          id: ev.id,
          title: ev.subject || "Réunion",
          time: isAllDay ? "Toute la journée" : (startTime ? `${startTime} - ${endTime}` : ""),
          startTime: startDateObj ? startDateObj.toISOString() : "",
          videoUrl,
          videoService,
          eventUrl: ev.webLink || "https://outlook.live.com/calendar",
        });
      }

      const result = { configured: true, items };
      this.#cache.calendar = { data: result, timestamp: now };
      return result;
    } catch (e) {
      console.warn("[ZenOutlookConnector] Failed to fetch calendar events:", e);
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

      if (diffMinutes >= -5 && diffMinutes <= notifyMinutes) {
        return {
          title: ev.title || "Meeting",
          videoUrl: ev.videoUrl,
          minutesLeft: Math.max(0, Math.ceil(diffMinutes)),
          timeStr: ev.time,
          service: ev.videoService || "teams",
        };
      }
    }

    return null;
  }

  #startPolling() {
    if (this.#pollInterval) return;

    this.#pollInterval = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.#pollInterval.initWithCallback(
      async () => {
        if (!this.isConfigured()) return;
        try {
          const meeting = await this.getImminentMeeting();
          this.#notify("onImminentMeetingUpdated", meeting);
        } catch (e) {
          console.warn("[ZenOutlookConnector] Polling error:", e);
        }
      },
      90000, // 90 seconds
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );
  }

  #stopPolling() {
    if (this.#pollInterval) {
      this.#pollInterval.cancel();
      this.#pollInterval = null;
    }
  }
}

export const ZenOutlookConnector = new nsZenOutlookConnector();
ZenOutlookConnector.init();
