// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const FILE_NAME = 'zen-sessions.jsonlz4';

export class nsZenSessionFile {
  #path;

  #windows;

  constructor() {
    this.#path = PathUtils.join(profileDir, FILE_NAME);
  }

  async read() {
    try {
      return await IOUtils.readJSON(this.#path, { compress: true });
    } catch (e) {
      return {};
    }
  }

  async write(data) {
    await IOUtils.writeJSON(this.#path, data, { compress: true });
  }
}
