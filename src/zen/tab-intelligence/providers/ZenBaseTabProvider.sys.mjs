// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenBaseTabProvider {
  /**
   * The type of provider ("mail" | "calendar").
   * @type {string}
   */
  get type() {
    return "mail";
  }

  /**
   * Human-readable service name.
   * @type {string}
   */
  get serviceName() {
    return "";
  }

  /**
   * Checks whether the current URL matches this provider.
   * @param {string} url
   * @returns {boolean}
   */
  matches(url) {
    return false;
  }

  /**
   * Performs a lightweight check on the page to retrieve unread status or imminent meetings.
   * Runs inside the content process.
   * @param {Document} document
   * @param {Window} window
   * @returns {{ hasUnread: boolean, unreadCount: number, hasImminentMeeting: boolean, imminentMeeting: object | null }}
   */
  checkQuickStatus(document, window) {
    return {
      hasUnread: false,
      unreadCount: 0,
      hasImminentMeeting: false,
      imminentMeeting: null,
    };
  }

  /**
   * Scrapes detailed list of messages or upcoming calendar events on demand (e.g. for hover preview).
   * Runs inside the content process.
   * @param {Document} document
   * @param {Window} window
   * @returns {{ type: string, service: string, items: Array<{ title: string, subtitle?: string, snippet?: string, url?: string, videoUrl?: string, time?: string }> }}
   */
  fetchDetails(document, window) {
    return {
      type: this.type,
      service: this.serviceName,
      items: [],
    };
  }
}
