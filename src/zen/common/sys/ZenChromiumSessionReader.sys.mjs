/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Reader for Chromium SNSS session files (used by Chrome, Brave, Edge, Opera, Vivaldi).
 * Extracts currently open tabs, navigation URLs, and pinned states.
 */
export class ZenChromiumSessionReader {
  /**
   * Command IDs used by Chromium SNSS session storage.
   */
  static COMMANDS = {
    SET_TAB_WINDOW: 0,
    SET_SELECTED_NAVIGATION_INDEX: 1,
    SET_SELECTED_TAB_IN_INDEX: 2,
    UPDATE_TAB_NAVIGATION: 6,
    SET_PINNED_STATE: 7,
  };

  /**
   * Reads open tabs from a Chromium profile directory.
   *
   * @param {string} profileDir - Path to the Chromium profile (e.g. Default)
   * @returns {Promise<Array<{ url: string, title?: string, pinned: boolean }>>}
   */
  static async getOpenTabs(profileDir) {
    try {
      const sessionsPath = PathUtils.join(profileDir, "Sessions");
      if (!(await IOUtils.exists(sessionsPath))) {
        return [];
      }

      const entries = await IOUtils.getChildren(sessionsPath);
      const sessionFiles = entries
        .filter(path => {
          const leaf = PathUtils.filename(path);
          return leaf.startsWith("Session_") || leaf.startsWith("Tabs_");
        });

      if (!sessionFiles.length) {
        return [];
      }

      // Sort files by modification time (most recent first)
      const withStats = await Promise.all(
        sessionFiles.map(async path => {
          const stat = await IOUtils.stat(path).catch(() => null);
          return { path, mtime: stat ? stat.lastModified : 0 };
        })
      );
      withStats.sort((a, b) => b.mtime - a.mtime);

      for (const item of withStats) {
        const tabs = await this.readSessionFile(item.path);
        if (tabs && tabs.length > 0) {
          return tabs;
        }
      }
    } catch (e) {
      console.warn("ZenChromiumSessionReader: could not read session tabs:", e);
    }
    return [];
  }

  /**
   * Parses a single Chromium SNSS binary file.
   *
   * @param {string} filePath - Absolute path to the session file
   * @returns {Promise<Array<{ url: string, title?: string, pinned: boolean }>>}
   */
  static async readSessionFile(filePath) {
    try {
      const buffer = await IOUtils.read(filePath);
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

      // Check SNSS magic bytes: 'S', 'N', 'S', 'S'
      if (
        view.byteLength < 8 ||
        view.getUint8(0) !== 0x53 ||
        view.getUint8(1) !== 0x4e ||
        view.getUint8(2) !== 0x53 ||
        view.getUint8(3) !== 0x53
      ) {
        return [];
      }

      const tabsById = new Map();
      let pos = 8;
      const totalLen = view.byteLength;

      while (pos + 3 <= totalLen) {
        const size = view.getUint16(pos, true);
        const cmdId = view.getUint8(pos + 2);
        pos += 3;

        const payloadLen = size - 1;
        if (pos + payloadLen > totalLen) {
          break;
        }

        const payloadPos = pos;
        pos += payloadLen;

        if (cmdId === this.COMMANDS.UPDATE_TAB_NAVIGATION) {
          // Payload contains: tab_id (int32 at 0), index (int32 at 4)
          if (payloadLen >= 16) {
            const tabId = view.getInt32(payloadPos, true);
            // Scan for http/https in payload
            const url = this.#extractUrl(view, payloadPos, payloadLen);
            if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
              const current = tabsById.get(tabId) || { tabId, pinned: false };
              current.url = url;
              tabsById.set(tabId, current);
            }
          }
        } else if (cmdId === this.COMMANDS.SET_PINNED_STATE) {
          if (payloadLen >= 5) {
            const tabId = view.getInt32(payloadPos, true);
            const isPinned = view.getUint8(payloadPos + 4) === 1;
            const current = tabsById.get(tabId) || { tabId, pinned: false };
            current.pinned = isPinned;
            tabsById.set(tabId, current);
          }
        }
      }

      // Filter out invalid/empty entries and deduplicate
      const uniqueTabs = [];
      const seenUrls = new Set();
      for (const tab of tabsById.values()) {
        if (tab.url && !seenUrls.has(tab.url)) {
          seenUrls.add(tab.url);
          uniqueTabs.push({
            url: tab.url,
            title: tab.title || tab.url,
            pinned: !!tab.pinned,
          });
        }
      }
      return uniqueTabs;
    } catch (e) {
      console.warn("ZenChromiumSessionReader: error parsing file:", filePath, e);
      return [];
    }
  }

  /**
   * Helper to scan for an HTTP/HTTPS ASCII string inside the payload.
   */
  static #extractUrl(view, offset, len) {
    let urlStart = -1;
    for (let i = offset; i <= offset + len - 8; i++) {
      if (
        (view.getUint8(i) === 0x68 && // 'h'
          view.getUint8(i + 1) === 0x74 && // 't'
          view.getUint8(i + 2) === 0x74 && // 't'
          view.getUint8(i + 3) === 0x70 && // 'p'
          view.getUint8(i + 4) === 0x3a && // ':'
          view.getUint8(i + 5) === 0x2f && // '/'
          view.getUint8(i + 6) === 0x2f) || // '/'
        (view.getUint8(i) === 0x68 && // 'h'
          view.getUint8(i + 1) === 0x74 && // 't'
          view.getUint8(i + 2) === 0x74 && // 't'
          view.getUint8(i + 3) === 0x70 && // 'p'
          view.getUint8(i + 4) === 0x73 && // 's'
          view.getUint8(i + 5) === 0x3a && // ':'
          view.getUint8(i + 6) === 0x2f && // '/'
          view.getUint8(i + 7) === 0x2f) // '/'
      ) {
        urlStart = i;
        break;
      }
    }

    if (urlStart === -1) {
      return null;
    }

    let urlEnd = urlStart;
    while (urlEnd < offset + len && view.getUint8(urlEnd) > 0x20) {
      urlEnd++;
    }

    const chars = [];
    for (let i = urlStart; i < urlEnd; i++) {
      chars.push(String.fromCharCode(view.getUint8(i)));
    }
    return chars.join("");
  }
}
