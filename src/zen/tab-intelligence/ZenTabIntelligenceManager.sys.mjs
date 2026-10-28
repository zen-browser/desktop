// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

class nsZenTabIntelligenceManager {
  #tabData = new WeakMap();
  #trackedTabs = new Set();
  #listeners = new Set();
  #isInitialized = false;

  init() {
    if (this.#isInitialized) return;
    this.#isInitialized = true;
  }

  uninit() {
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

  isTargetTab(tab) {
    if (!tab) return false;
    return (
      tab.pinned ||
      tab.hasAttribute("zen-essential") ||
      tab.getAttribute("zen-essential") === "true"
    );
  }

  onTabStatusUpdate(tab, status, actorParent = null) {
    if (!tab || !tab.isConnected) return;

    this.#tabData.set(tab, { status, actorParent });
    this.#trackedTabs.add(tab);

    const isTarget = this.isTargetTab(tab);
    if (isTarget && status.hasUnread) {
      tab.setAttribute("zen-has-unread", "true");
    } else {
      tab.removeAttribute("zen-has-unread");
    }

    this.#notify("onTabStatusChanged", { tab, status });

    if (status.hasImminentMeeting && status.imminentMeeting) {
      this.#notify("onImminentMeetingChanged", {
        tab,
        meeting: status.imminentMeeting,
      });
    } else {
      this.#checkImminentMeetings();
    }
  }

  #checkImminentMeetings() {
    let latestMeeting = null;
    let meetingTab = null;

    for (const tab of this.#trackedTabs) {
      if (!tab.isConnected) {
        this.#trackedTabs.delete(tab);
        continue;
      }
      const data = this.#tabData.get(tab);
      if (data?.status?.hasImminentMeeting && data?.status?.imminentMeeting) {
        latestMeeting = data.status.imminentMeeting;
        meetingTab = tab;
        break;
      }
    }

    this.#notify("onImminentMeetingChanged", {
      tab: meetingTab,
      meeting: latestMeeting,
    });
  }

  getTabStatus(tab) {
    return this.#tabData.get(tab)?.status || null;
  }

  async requestTabDetails(tab) {
    if (!tab || !tab.isConnected) {
      return { items: [] };
    }

    const browser = tab.linkedBrowser;
    const global = browser?.browsingContext?.currentWindowGlobal;

    if (global) {
      try {
        const actor = global.getActor("ZenTabIntelligence");
        if (actor) {
          const details = await actor.requestDetails();
          if (details?.items && details.items.length > 0) {
            return details;
          }
        }
      } catch (e) {
        console.warn("[ZenTabIntelligenceManager] getActor failed:", e);
      }
    }

    // Fallback: derive details from web page title (handles renamed tabs with zenStaticLabel)
    const pageTitle =
      browser?.contentTitle ||
      browser?.browsingContext?.currentWindowGlobal?.documentTitle ||
      tab.label ||
      "";
    const match = pageTitle.match(/\((\d+)\)/);
    const count = match ? parseInt(match[1], 10) : 0;
    const hasUnread = count > 0 || tab.hasAttribute("zen-has-unread");
    const url = browser?.currentURI?.spec || "";
    const isCalendar = url.startsWith("https://calendar.google.com/");
    const isWhatsApp = url.startsWith("https://web.whatsapp.com/");

    if (isCalendar) {
      return {
        type: "calendar",
        service: "Google Calendar",
        items: [
          {
            title: "Google Calendar",
            subtitle: "Upcoming Schedule",
            snippet: "Click to view events",
            url,
          },
        ],
      };
    }

    if (!hasUnread) {
      return {
        type: isWhatsApp ? "chat" : "mail",
        service: isWhatsApp ? "WhatsApp" : "Gmail",
        items: [],
      };
    }

    const countToUse = count || 1;
    if (isWhatsApp) {
      return {
        type: "chat",
        service: "WhatsApp",
        items: [
          {
            title: "WhatsApp",
            subtitle: `${countToUse} unread conversation${countToUse > 1 ? "s" : ""}`,
            snippet: "Click to open chat",
            url,
          },
        ],
      };
    }

    return {
      type: "mail",
      service: "Gmail",
      items: [
        {
          title: "Gmail",
          subtitle: `${countToUse} unread email${countToUse > 1 ? "s" : ""}`,
          snippet: "Click to open inbox",
          url,
        },
      ],
    };
  }

  getActiveImminentMeeting() {
    for (const tab of this.#trackedTabs) {
      if (!tab.isConnected) continue;
      const data = this.#tabData.get(tab);
      if (data?.status?.hasImminentMeeting && data?.status?.imminentMeeting) {
        return {
          tab,
          meeting: data.status.imminentMeeting,
        };
      }
    }
    return null;
  }
}

export const ZenTabIntelligenceManager = new nsZenTabIntelligenceManager();
