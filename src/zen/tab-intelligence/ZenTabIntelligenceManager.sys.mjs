// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenGoogleConnector } from "resource:///modules/zen/intelligence/ZenGoogleConnector.sys.mjs";
import { ZenOutlookConnector } from "resource:///modules/zen/intelligence/ZenOutlookConnector.sys.mjs";

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
    } catch (e) {
      console.warn("[ZenTabIntelligenceManager] Failed to init ZenGoogleConnector:", e);
    }

    try {
      ZenOutlookConnector.init();
      ZenOutlookConnector.addListener(this);
    } catch (e) {
      console.warn("[ZenTabIntelligenceManager] Failed to init ZenOutlookConnector:", e);
    }

    this.refreshImminentMeeting();
  }

  uninit() {
    ZenGoogleConnector.removeListener(this);
    ZenGoogleConnector.uninit();
    ZenOutlookConnector.removeListener(this);
    ZenOutlookConnector.uninit();
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
    let meeting = null;

    if (ZenGoogleConnector.isConfigured()) {
      try {
        meeting = await ZenGoogleConnector.getImminentMeeting();
      } catch {}
    }

    if (!meeting && ZenOutlookConnector.isConfigured()) {
      try {
        meeting = await ZenOutlookConnector.getImminentMeeting();
      } catch {}
    }

    this.#currentImminentMeeting = meeting;
    this.#notify("onImminentMeetingChanged", { tab: null, meeting });
  }

  onImminentMeetingUpdated() {
    this.refreshImminentMeeting();
  }

  getTabService(tab) {
    if (!tab || !tab.isConnected) return null;

    const url =
      tab.linkedBrowser?.currentURI?.spec ||
      tab.getAttribute("zen-pinned-url") ||
      tab.getAttribute("zen-url") ||
      tab._zenPinnedInitialState?.entry?.url ||
      tab.linkedBrowser?.userTypedValue ||
      tab.getAttribute("userTypedValue") ||
      "";

    const label = tab.label || tab.getAttribute("label") || "";
    const tooltip = tab.getAttribute("tooltiptext") || "";
    const image = tab.getAttribute("image") || "";

    // Check Gmail
    if (
      url.includes("mail.google.com") ||
      url.includes("google.com/mail") ||
      /gmail/i.test(label) ||
      /gmail/i.test(tooltip) ||
      /gmail|mail\.google/i.test(image)
    ) {
      return "gmail";
    }

    // Check Google Calendar
    if (
      url.includes("calendar.google.com") ||
      url.includes("google.com/calendar") ||
      /calendar|agenda/i.test(label) ||
      /calendar|agenda/i.test(tooltip) ||
      /calendar\.google/i.test(image)
    ) {
      return "google-calendar";
    }

    // Check WhatsApp
    if (
      url.includes("web.whatsapp.com") ||
      /whatsapp/i.test(label) ||
      /whatsapp/i.test(tooltip) ||
      /whatsapp/i.test(image)
    ) {
      return "whatsapp";
    }

    // Check Outlook / Microsoft 365
    if (
      url.includes("outlook.live.com") ||
      url.includes("outlook.office.com") ||
      url.includes("outlook.office365.com") ||
      url.includes("mail.live.com") ||
      /outlook/i.test(label) ||
      /outlook/i.test(tooltip) ||
      /outlook/i.test(image)
    ) {
      return "outlook";
    }

    return null;
  }

  isTargetTab(tab) {
    if (!tab) return false;
    if (!Services.prefs.getBoolPref("zen.tab-intelligence.enabled", true)) {
      return false;
    }

    const serviceKey = this.getTabService(tab);
    if (!serviceKey) return false;

    return Services.prefs.getBoolPref(
      "zen.tab-intelligence.service." + serviceKey,
      true
    );
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

    const service = this.getTabService(tab);

    if (service === "gmail") {
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

    if (service === "google-calendar") {
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

    if (service === "outlook") {
      if (!ZenOutlookConnector.isConfigured()) {
        return {
          type: "outlook",
          service: "Outlook",
          configured: false,
          items: [],
          totalUnread: 0,
        };
      }
      const [emailData, calData] = await Promise.all([
        ZenOutlookConnector.getUnreadEmails(),
        ZenOutlookConnector.getTodayEvents(),
      ]);
      return {
        type: "outlook",
        service: "Outlook",
        configured: true,
        items: emailData.items || [],
        totalUnread: emailData.totalUnread || 0,
        calendarItems: calData.items || [],
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
