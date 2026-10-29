// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenGoogleConnector } from "resource:///modules/zen/intelligence/ZenGoogleConnector.sys.mjs";

class nsZenTabIntelligenceManager {
  #tabData = new WeakMap();
  #trackedTabs = new Set();
  #listeners = new Set();
  #isInitialized = false;
  #currentImminentMeeting = null;

  init() {
    if (this.#isInitialized) return;
    this.#isInitialized = true;

    try {
      ZenGoogleConnector.init();
      ZenGoogleConnector.addListener(this);
      this.refreshImminentMeeting();
    } catch (e) {
      console.warn("[ZenTabIntelligenceManager] Failed to init ZenGoogleConnector:", e);
    }
  }

  uninit() {
    ZenGoogleConnector.removeListener(this);
    ZenGoogleConnector.uninit();
    this.#currentImminentMeeting = null;
    this.#tabData = new WeakMap();
    this.#trackedTabs.clear();
    this.#listeners.clear();
    this.#isInitialized = false;
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
        console.error(`[ZenTabIntelligenceManager] Listener error on ${event}:`, e);
      }
    }
  }

  async refreshImminentMeeting() {
    if (!ZenGoogleConnector.isConfigured()) {
      this.#currentImminentMeeting = null;
      this.#notify("onImminentMeetingChanged", { tab: null, meeting: null });
      return;
    }

    try {
      const meeting = await ZenGoogleConnector.getImminentMeeting();
      this.#currentImminentMeeting = meeting;
      this.#notify("onImminentMeetingChanged", { tab: null, meeting });
    } catch {}
  }

  onImminentMeetingUpdated(meeting) {
    this.#currentImminentMeeting = meeting;
    this.#notify("onImminentMeetingChanged", { tab: null, meeting });
  }

  isTargetTab(tab) {
    if (!tab) return false;
    if (!Services.prefs.getBoolPref("zen.tab-intelligence.enabled", true)) {
      return false;
    }

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    let serviceKey = null;
    if (url.startsWith("https://mail.google.com/")) serviceKey = "gmail";
    else if (url.startsWith("https://calendar.google.com/")) serviceKey = "google-calendar";
    else if (url.startsWith("https://web.whatsapp.com/")) serviceKey = "whatsapp";

    if (
      serviceKey &&
      !Services.prefs.getBoolPref("zen.tab-intelligence.service." + serviceKey, true)
    ) {
      return false;
    }

    return true;
  }

  onTabStatusUpdate(tab, status, actorParent = null) {
    if (!tab || !tab.isConnected) return;

    this.#tabData.set(tab, { status, actorParent });
    this.#trackedTabs.add(tab);

    const isTarget = this.isTargetTab(tab);
    const isPinnedOrEssential =
      tab.pinned ||
      tab.hasAttribute("zen-essential") ||
      tab.getAttribute("zen-essential") === "true";

    if (isTarget && isPinnedOrEssential && status.hasUnread) {
      tab.setAttribute("zen-has-unread", "true");
    } else {
      tab.removeAttribute("zen-has-unread");
    }

    this.#notify("onTabStatusChanged", { tab, status });
  }

  getTrackedTabs() {
    return Array.from(this.#trackedTabs);
  }

  getTabStatus(tab) {
    return this.#tabData.get(tab)?.status || null;
  }

  async requestTabDetails(tab) {
    if (!tab || !tab.isConnected) {
      return { items: [] };
    }

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    const isGmail = url.startsWith("https://mail.google.com/");
    const isCalendar = url.startsWith("https://calendar.google.com/");

    if (isGmail) {
      if (!ZenGoogleConnector.isConfigured()) {
        return {
          type: "mail",
          service: "Gmail",
          configured: false,
          items: [],
          totalUnread: 0,
        };
      }
      const data = await ZenGoogleConnector.getUnreadEmails();
      return {
        type: "mail",
        service: "Gmail",
        configured: data.configured,
        items: data.items || [],
        totalUnread: data.totalUnread || 0,
      };
    }

    if (isCalendar) {
      if (!ZenGoogleConnector.isConfigured()) {
        return {
          type: "calendar",
          service: "Google Calendar",
          configured: false,
          items: [],
        };
      }
      const data = await ZenGoogleConnector.getTodayEvents();
      return {
        type: "calendar",
        service: "Google Calendar",
        configured: data.configured,
        items: data.items || [],
      };
    }

    // WhatsApp: no hover popup (user requested: unread badge remains, hover removed)
    return { items: [] };
  }

  getActiveImminentMeeting() {
    if (this.#currentImminentMeeting) {
      return {
        tab: null,
        meeting: this.#currentImminentMeeting,
      };
    }
    return null;
  }
}

export const ZenTabIntelligenceManager = new nsZenTabIntelligenceManager();
