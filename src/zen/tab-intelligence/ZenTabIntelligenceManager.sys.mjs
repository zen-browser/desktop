// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenWindowSync: "resource:///modules/zen/ZenWindowSync.sys.mjs",
});

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

  onTabStatusUpdate(tab, status, actorParent) {
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
    const data = this.#tabData.get(tab);
    if (!data?.actorParent) {
      return { items: [] };
    }
    return await data.actorParent.requestDetails();
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
