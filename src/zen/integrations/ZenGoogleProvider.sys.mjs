// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenOAuthClient } from "resource:///modules/zen/integrations/ZenOAuthClient.sys.mjs";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const CALENDAR_API =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// "Jane Doe" <jane@example.com> -> Jane Doe
function getSenderName(from) {
  return from.match(/^"?(.*?)"?\s*<[^>]*>$/)?.[1] || from;
}

const EVENT_PALETTE = [
  "#818cf8", // Indigo
  "#34d399", // Emerald
  "#38bdf8", // Sky
  "#fbbf24", // Amber
  "#f472b6", // Pink
  "#a78bfa", // Purple
];

/**
 * Gmail and Google Calendar, read-only.
 */
class nsZenGoogleProvider {
  id = "google";

  client = new ZenOAuthClient({
    id: this.id,
    authURL: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenURL: "https://oauth2.googleapis.com/token",
    redirectURI: "http://127.0.0.1:49721/",
    scopes: [
      "https://www.googleapis.com/auth/gmail.metadata",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ],
    authParams: { access_type: "offline", prompt: "consent" },
  });

  get composeMailUrl() {
    return "https://mail.google.com/mail/u/0/?fs=1&tf=cm";
  }

  get composeEventUrl() {
    return "https://calendar.google.com/calendar/r/eventedit";
  }

  /**
   * @param {URL} url - The address of a tab.
   * @returns {"mail"|"calendar"|null} What the tab shows, if we handle it.
   */
  getTabKind(url) {
    switch (url.hostname) {
      case "mail.google.com":
        return "mail";
      case "calendar.google.com":
        return "calendar";
    }
    return null;
  }

  async getUnreadMail(token, limit) {
    const { messages = [] } = await this.#get(
      token,
      `${GMAIL_API}?labelIds=INBOX&labelIds=UNREAD&maxResults=${limit}`
    );

    return Promise.all(
      messages.map(async ({ id }) => {
        const message = await this.#get(
          token,
          `${GMAIL_API}/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`
        );
        const getHeader = name =>
          message.payload?.headers?.find(h => h.name.toLowerCase() === name)
            ?.value ?? "";
        return {
          id,
          sender: getSenderName(getHeader("from")),
          subject: getHeader("subject"),
          snippet: message.snippet ?? "",
          url: `https://mail.google.com/mail/u/0/#inbox/${id}`,
          date: message.internalDate ? parseInt(message.internalDate, 10) : Date.now(),
        };
      })
    );
  }

  async getEvents(token, from, to) {
    const url = new URL(CALENDAR_API);
    url.search = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "25",
    });
    const { items = [] } = await this.#get(token, url);

    return (
      items
        // All-day events have no start time.
        .filter(
          event =>
            event.start?.dateTime &&
            !event.attendees?.some(
              a => a.self && a.responseStatus === "declined"
            )
        )
        .map((event, index) => ({
          id: event.id,
          title: event.summary ?? "",
          start: Date.parse(event.start.dateTime),
          end: Date.parse(event.end.dateTime),
          joinUrl:
            event.hangoutLink ??
            event.conferenceData?.entryPoints?.find(
              entry => entry.entryPointType === "video"
            )?.uri ??
            null,
          url: event.htmlLink ?? "https://calendar.google.com/",
          color: EVENT_PALETTE[index % EVENT_PALETTE.length],
        }))
    );
  }

  async #get(token, url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Google API request failed: ${response.status}`);
    }
    return response.json();
  }
}

export const ZenGoogleProvider = new nsZenGoogleProvider();
