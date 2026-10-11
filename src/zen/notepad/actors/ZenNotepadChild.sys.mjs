/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class ZenNotepadChild extends JSWindowActorChild {
  handleEvent(event) {
    if (event.type !== "DOMContentLoaded") {
      return;
    }
    const doc = this.document;
    if (!doc?.documentURI?.startsWith("mint:")) {
      return;
    }
    const root = doc.documentElement;
    if (!root || root.dataset.mintNotepad) {
      return;
    }
    root.dataset.mintNotepad = "pending";
    this.#attach(doc);
  }

  #adoptURL(spec) {
    const uri = Services.io.newURI(spec);
    this.docShell?.setCurrentURIForSessionStore(uri);
    try {
      const history = this.browsingContext?.sessionHistory;
      if (history?.count) {
        const entry = history.getEntryAtIndex(history.index);
        entry.URI = uri;
        entry.originalURI = uri;
      }
    } catch (error) {
      console.error("Notepad history update failed", error);
    }
  }

  async #attach(doc) {
    try {
      const { attachNotepad } = ChromeUtils.importESModule(
        "resource:///modules/zen/notepad/ZenNotepadPage.mjs"
      );
      const bridge = {
        load: id => this.sendQuery("ZenNotepad:Load", { id }),
        save: (id, markdown, title) =>
          this.sendQuery("ZenNotepad:Save", { id, markdown, title }),
        exportNote: (markdown, fileName) =>
          this.sendQuery("ZenNotepad:Export", { markdown, fileName }),
        adoptURL: spec => this.#adoptURL(spec),
      };
      await attachNotepad(doc, bridge);
      this.sendAsyncMessage("ZenNotepad:ShowTabIcon");
    } catch (error) {
      console.error("Notepad failed to start", error);
      if (doc.documentElement?.dataset.mintNotepad === "pending") {
        delete doc.documentElement.dataset.mintNotepad;
      }
    }
  }
}
