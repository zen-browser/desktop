// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Utility to register JSWindowActors

window.gZenActorsManager = {
  _actors: new Set(),
  _lazy: {},

  init() {
    ChromeUtils.defineESModuleGetters(this._lazy, {
      ActorManagerParent: 'resource://gre/modules/ActorManagerParent.sys.mjs',
    });
  },

  addJSWindowActor(name, data) {
    if (!this._lazy.ActorManagerParent) {
      this.init();
    }
    if (this._actors.has(name)) {
      // Actor already registered, nothing to do
      return;
    }

    const decl = {};
    decl[name] = data;
    try {
      this._lazy.ActorManagerParent.addJSWindowActors(decl);
      this._actors.add(name);
    } catch (e) {
      console.warn(`Failed to register JSWindowActor: ${e}`);
    }
  },
};
