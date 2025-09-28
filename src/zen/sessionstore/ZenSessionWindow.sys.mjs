// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenSessionWindow {
  #id;
  #selectedWorkspace;
  #selectedTab;

  constructor(id) {
    this.#id = id;
    this.#selectedWorkspace = null;
    this.#selectedTab = null;
  }

  get id() {
    return this.#id;
  }

  get selectedWorkspace() {
    return this.#selectedWorkspace;
  }

  set selectedWorkspace(workspace) {
    this.#selectedWorkspace = workspace;
  }

  get selectedTab() {
    return this.#selectedTab;
  }

  set selectedTab(tab) {
    this.#selectedTab = tab;
  }
}
