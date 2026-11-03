// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  DeferredTask: "resource://gre/modules/DeferredTask.sys.mjs",
  ZenGoogleProvider:
    "resource:///modules/zen/integrations/ZenGoogleProvider.sys.mjs",
  ZenMicrosoftProvider:
    "resource:///modules/zen/integrations/ZenMicrosoftProvider.sys.mjs",
});

const PREF_NOTICE_MINUTES = "zen.integrations.meeting-notice-minutes";
const PREF_MOCK_ENABLED = "zen.integrations.mock-enabled";

const MINUTE_MS = 60 * 1000;
const POLL_INTERVAL = MINUTE_MS;
const EVENTS_TTL = 5 * MINUTE_MS;
const MAIL_TTL = MINUTE_MS;
const EVENTS_RANGE = 12 * 60 * MINUTE_MS;
const MAX_UNREAD_MAIL = 3;

/**
 * Fetches unread mail and upcoming events for the connected accounts, and
 * keeps track of the next meeting the user can join. Dispatches
 * "meetingchange" whenever that meeting, or the time left, changes.
 */
class nsZenIntegrationsManager extends EventTarget {
  #isInitialized = false;
  #task = null;
  #mailCache = new Map();
  #eventsCache = new Map();
  #upcoming = [];
  #dismissed = new Set();
  #meetings = [];

  constructor() {
    super();
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "noticeMinutes",
      PREF_NOTICE_MINUTES,
      5,
      () => this.#updateMeeting()
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "isMockEnabled",
      PREF_MOCK_ENABLED,
      false,
      () => {
        this.#mailCache.clear();
        this.#eventsCache.clear();
        this.#poll();
      }
    );
  }

  get providers() {
    return [lazy.ZenGoogleProvider, lazy.ZenMicrosoftProvider];
  }

  /**
   * @returns {object|null} The primary meeting to offer to join, if any.
   */
  get meeting() {
    return this.#meetings[0] ?? null;
  }

  /**
   * @returns {object[]} All upcoming meetings that can be joined.
   */
  get meetings() {
    return this.#meetings;
  }

  init() {
    if (this.#isInitialized) {
      return;
    }
    this.#isInitialized = true;

    for (const provider of this.providers) {
      provider.client.addEventListener("change", this);
    }
    this.#task = new lazy.DeferredTask(() => this.#poll(), POLL_INTERVAL);
    this.#poll();
  }

  uninit() {
    if (!this.#isInitialized) {
      return;
    }

    this.#task?.disarm();
    for (const provider of this.providers) {
      provider.client.removeEventListener("change", this);
    }
    this.#isInitialized = false;
  }

  // An account got connected or disconnected.
  handleEvent() {
    this.#mailCache.clear();
    this.#eventsCache.clear();
    this.#poll();
  }

  /**
   * @param {MozTabbrowserTab} tab
   * @returns {{provider: object|null, kind: string, isMock?: boolean}|null} What a tab can preview.
   *   Only pinned and essential tabs qualify.
   */
  getTabTarget(tab) {
    if (!tab.pinned && !tab.hasAttribute("zen-essential")) {
      return null;
    }

    // Unloaded pinned tabs have no address yet, use the pinned one.
    let spec = tab.linkedBrowser?.currentURI?.spec;
    if (!spec || spec === "about:blank") {
      spec = tab._zenPinnedInitialState?.entry?.url;
    }
    const url = URL.parse(spec ?? "");
    if (!url) {
      return null;
    }

    // WhatsApp tab check (never mocked)
    if (url.hostname === "web.whatsapp.com") {
      return { provider: null, kind: "chat", service: "whatsapp" };
    }

    for (const provider of this.providers) {
      const kind = provider.getTabKind(url);
      if (kind) {
        if (provider.client.isConnected) {
          return { provider, kind, isMock: false };
        }
        if (this.isMockEnabled) {
          return { provider, kind, isMock: true };
        }
      }
    }
    return null;
  }

  /**
   * @param {object} target - The result of getTabTarget.
   * @returns {Promise<object[]>} The latest unread mails, or the events that
   *   are not over yet.
   */
  async getPreview(target) {
    if (target.isMock || (this.isMockEnabled && !target.provider?.client.isConnected)) {
      return this.#getMockPreview(target.kind, target.provider?.id);
    }

    if (target.kind === "mail" && target.provider) {
      return this.#getMail(target.provider);
    }
    if (target.kind === "calendar" && target.provider) {
      const events = await this.#getEvents(target.provider);
      return events.filter(event => event.end > Date.now());
    }
    return [];
  }

  #getMockPreview(kind, providerId = null) {
    const now = Date.now();
    if (kind === "mail") {
      return [
        {
          id: "mock-1",
          sender: "Linus Torvalds",
          subject: "Linux Kernel 6.14 release candidate",
          snippet: "Hey folks, please test the latest patch series before Friday...",
          url: "https://en.wikipedia.org/wiki/Linux_kernel",
          date: now - 35 * MINUTE_MS,
        },
        {
          id: "mock-2",
          sender: "Brendan Eich",
          subject: "Zen Browser performance milestone",
          snippet: "Great work on the memory optimizations and tab integrations...",
          url: "https://en.wikipedia.org/wiki/Zen_browser",
          date: now - 4 * 60 * MINUTE_MS,
        },
        {
          id: "mock-3",
          sender: "Mozilla Team",
          subject: "Web standards and integrations review",
          snippet: "All automated integration checks have passed successfully. Ready to merge!",
          url: "https://en.wikipedia.org/wiki/Mozilla",
          date: now - 28 * 60 * MINUTE_MS,
        },
      ];
    }

    if (kind === "calendar") {
      if (providerId === "microsoft") {
        return [
          {
            id: "mock-ms-1",
            title: "Sprint Standup",
            start: now + 3 * MINUTE_MS,
            end: now + 33 * MINUTE_MS,
            joinUrl: "https://teams.microsoft.com/mock-standup",
            url: "https://en.wikipedia.org/wiki/Microsoft_Teams",
            color: "#0284c7",
          },
          {
            id: "mock-ms-2",
            title: "Architecture Review",
            start: now + 3 * MINUTE_MS,
            end: now + 48 * MINUTE_MS,
            joinUrl: "https://teams.microsoft.com/mock-arch-review",
            url: "https://en.wikipedia.org/wiki/Microsoft_Teams",
            color: "#8b5cf6",
          },
          {
            id: "mock-ms-3",
            title: "Client Demo",
            start: now + 2 * 60 * MINUTE_MS,
            end: now + 3 * 60 * MINUTE_MS,
            joinUrl: null,
            url: "https://en.wikipedia.org/wiki/Outlook_on_the_web",
            color: "#10b981",
          },
          {
            id: "mock-ms-4",
            title: "Q4 Strategy",
            start: now + 2 * 60 * MINUTE_MS + 15 * MINUTE_MS,
            end: now + 3 * 60 * MINUTE_MS + 15 * MINUTE_MS,
            joinUrl: "https://teams.microsoft.com/mock-strategy",
            url: "https://en.wikipedia.org/wiki/Microsoft_Teams",
            color: "#f59e0b",
          },
        ];
      }

      // Default (Google Calendar): non-overlapping events
      return [
        {
          id: "mock-cal-1",
          title: "Cybertruck call",
          start: now + 4 * MINUTE_MS,
          end: now + 34 * MINUTE_MS,
          joinUrl: "https://meet.google.com/mock-meet-test",
          url: "https://en.wikipedia.org/wiki/Google_Meet",
          color: "#818cf8",
        },
        {
          id: "mock-cal-2",
          title: "Design Sync",
          start: now + 2 * 60 * MINUTE_MS,
          end: now + 3 * 60 * MINUTE_MS,
          joinUrl: "https://meet.google.com/mock-design-sync",
          url: "https://en.wikipedia.org/wiki/Google_Calendar",
          color: "#34d399",
        },
        {
          id: "mock-cal-3",
          title: "Sprint Planning",
          start: now + 5 * 60 * MINUTE_MS,
          end: now + 6 * 60 * MINUTE_MS,
          joinUrl: null,
          url: "https://en.wikipedia.org/wiki/Software_development",
          color: "#f472b6",
        },
      ];
    }

    return [];
  }

  /**
   * Stops offering the current meeting, e.g. once the user joined it.
   */
  dismissMeeting(key) {
    const meetingKey = key || this.meeting?.key;
    if (meetingKey) {
      this.#dismissed.add(meetingKey);
      this.#updateMeeting();
    }
  }

  #getMail(provider) {
    return this.#cached(this.#mailCache, provider, MAIL_TTL, async () => {
      const token = await provider.client.getAccessToken();
      return token ? provider.getUnreadMail(token, MAX_UNREAD_MAIL) : [];
    });
  }

  #getEvents(provider) {
    return this.#cached(this.#eventsCache, provider, EVENTS_TTL, async () => {
      const token = await provider.client.getAccessToken();
      if (!token) {
        return [];
      }

      const now = Date.now();
      const events = await provider.getEvents(
        token,
        new Date(now),
        new Date(now + EVENTS_RANGE)
      );
      // Links come from calendar invites, only ever open secure ones.
      return events.map(event => ({
        ...event,
        joinUrl:
          URL.parse(event.joinUrl ?? "")?.protocol === "https:"
            ? event.joinUrl
            : null,
      }));
    });
  }

  // Shares in-flight requests and keeps results for a while.
  #cached(cache, provider, ttl, fetchData) {
    const entry = cache.get(provider);
    if (entry && Date.now() - entry.time < ttl) {
      return entry.promise;
    }

    const promise = fetchData();
    cache.set(provider, { time: Date.now(), promise });
    promise.catch(() => cache.delete(provider));
    return promise;
  }

  async #poll() {
    let allEvents = [];

    if (this.isMockEnabled) {
      const gEvents = this.#getMockPreview("calendar", "google").map(event => ({
        ...event,
        key: `mock:google:${event.id}`,
      }));
      const msEvents = this.#getMockPreview("calendar", "microsoft").map(event => ({
        ...event,
        key: `mock:microsoft:${event.id}`,
      }));
      allEvents.push(...gEvents, ...msEvents);
    }

    const connected = this.providers.filter(p => p.client.isConnected);
    if (connected.length) {
      const lists = await Promise.all(
        connected.map(async provider => {
          try {
            const events = await this.#getEvents(provider);
            return events.map(event => ({
              ...event,
              key: `${provider.id}:${event.id}`,
            }));
          } catch (e) {
            console.warn(`Could not fetch ${provider.id} events`, e);
            return [];
          }
        })
      );
      allEvents.push(...lists.flat());
    }

    this.#upcoming = allEvents;
    this.#updateMeeting();
    if (connected.length || this.isMockEnabled) {
      this.#task.arm();
    }
  }

  #updateMeeting() {
    const now = Date.now();
    const limit = now + this.noticeMinutes * MINUTE_MS;
    this.#meetings = this.#upcoming
      .filter(
        event =>
          event.joinUrl &&
          !this.#dismissed.has(event.key) &&
          event.start <= limit &&
          event.end > now
      )
      .sort((a, b) => a.start - b.start);
    this.dispatchEvent(new Event("meetingchange"));
  }
}

export const ZenIntegrationsManager = new nsZenIntegrationsManager();
