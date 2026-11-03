// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenOAuthClient } from "resource:///modules/zen/integrations/ZenOAuthClient.sys.mjs";

const GRAPH_API = "https://graph.microsoft.com/v1.0/me";
const OUTLOOK_HOSTS = new Set([
  "outlook.cloud.microsoft",
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
]);

const EVENT_PALETTE = [
  "#38bdf8", // Sky
  "#818cf8", // Indigo
  "#34d399", // Emerald
  "#fbbf24", // Amber
  "#f472b6", // Pink
  "#a78bfa", // Purple
];

// Graph returns UTC times without a suffix, e.g. 2026-11-03T10:00:00.0000000
function parseDate({ dateTime }) {
  return Date.parse(dateTime.replace(/\.\d+$/, "") + "Z");
}

/**
 * Outlook mail and calendar through Microsoft Graph, read-only.
 */
class nsZenMicrosoftProvider {
  id = "microsoft";

  client = new ZenOAuthClient({
    id: this.id,
    authURL: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    redirectURI: "http://localhost/",
    scopes: ["offline_access", "Mail.ReadBasic", "Calendars.Read"],
  });

  getComposeMailUrl(host = "outlook.live.com") {
    const domain = OUTLOOK_HOSTS.has(host) ? host : "outlook.live.com";
    return `https://${domain}/mail/deeplink/compose`;
  }

  getComposeEventUrl(host = "outlook.live.com") {
    const domain = OUTLOOK_HOSTS.has(host) ? host : "outlook.live.com";
    return `https://${domain}/calendar/deeplink/compose`;
  }

  get composeMailUrl() {
    return this.getComposeMailUrl();
  }

  get composeEventUrl() {
    return this.getComposeEventUrl();
  }

  /**
   * @param {URL} url - The address of a tab.
   * @returns {"mail"|"calendar"|null} What the tab shows, if we handle it.
   */
  getTabKind(url) {
    if (!OUTLOOK_HOSTS.has(url.hostname) && !url.hostname.startsWith("outlook.")) {
      return null;
    }
    return url.pathname.includes("/calendar") ? "calendar" : "mail";
  }

  async getUnreadMail(token, limit) {
    const { value = [] } = await this.#get(
      token,
      `/mailFolders/inbox/messages?$filter=isRead eq false&$select=from,subject,bodyPreview,webLink,receivedDateTime&$top=${limit}`
    );
    return value.map(message => ({
      id: message.id,
      sender:
        message.from?.emailAddress?.name ||
        message.from?.emailAddress?.address ||
        "",
      subject: message.subject ?? "",
      snippet: message.bodyPreview ?? "",
      url: message.webLink || `https://outlook.live.com/mail/0/id/${message.id}`,
      date: message.receivedDateTime ? Date.parse(message.receivedDateTime) : Date.now(),
    }));
  }

  async getEvents(token, from, to) {
    const query = new URLSearchParams({
      startDateTime: from.toISOString(),
      endDateTime: to.toISOString(),
      $select:
        "subject,start,end,isAllDay,isCancelled,onlineMeeting,responseStatus,webLink",
      $orderby: "start/dateTime",
      $top: "25",
    });
    const { value = [] } = await this.#get(token, `/calendarView?${query}`);

    return value
      .filter(
        event =>
          !event.isAllDay &&
          !event.isCancelled &&
          event.responseStatus?.response !== "declined"
      )
      .map((event, index) => ({
        id: event.id,
        title: event.subject ?? "",
        start: parseDate(event.start),
        end: parseDate(event.end),
        joinUrl: event.onlineMeeting?.joinUrl ?? null,
        url: event.webLink || "https://outlook.live.com/calendar/",
        color: EVENT_PALETTE[index % EVENT_PALETTE.length],
      }));
  }

  async #get(token, path) {
    const response = await fetch(GRAPH_API + path, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (!response.ok) {
      throw new Error(`Microsoft Graph request failed: ${response.status}`);
    }
    return response.json();
  }
}

export const ZenMicrosoftProvider = new nsZenMicrosoftProvider();
