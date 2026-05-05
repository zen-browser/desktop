// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenSplitViewChild extends JSWindowActorChild {
  #glanceActivationMethod;

  async handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      await handler.call(this, event);
    }
  }

  async on_DOMContentLoaded() {
    this.#glanceActivationMethod = await this.sendQuery(
      "ZenSplitView:GetGlanceActivationMethod"
    );
  }

  on_click(event) {
    if (event.button !== 0 || event.defaultPrevented) {
      return;
    }
    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    if (this.#glanceActivationMethod === "shift") {
      return;
    }
    const anchor = event.target.closest("a[href]");
    if (!anchor) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.sendAsyncMessage("ZenSplitView:OpenInSplit", { url: anchor.href });
  }
}
