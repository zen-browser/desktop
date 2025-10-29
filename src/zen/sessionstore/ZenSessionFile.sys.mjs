// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Note that changing this hidden pref will make the previous session file
// unused, causing a new session file to be created on next write.
const SHOULD_COMPRESS_FILE = Services.prefs.getBoolPref('zen.session-store.compress-file', true);

const FILE_NAME = SHOULD_COMPRESS_FILE ? 'zen-sessions.jsonlz4' : 'zen-sessions.json';

export class nsZenSessionFile {
  #path = PathUtils.join(PathUtils.profileDir, FILE_NAME);
  #sidebar = [];

  async read() {
    try {
      const data = await IOUtils.readJSON(this.#path, { compress: SHOULD_COMPRESS_FILE });
      this.#sidebar = data.sidebar || [];
    } catch {
      // File doesn't exist yet, that's fine.
    }
  }

  get sidebar() {
    return this.#sidebar;
  }

  set sidebar(data) {
    this.#sidebar = data;
  }

  async #write(data) {
    await IOUtils.writeJSON(this.#path, data, { compress: SHOULD_COMPRESS_FILE });
  }

  async store() {
    const data = { sidebar: this.#sidebar };
    await this.#write(data);
  }
}
