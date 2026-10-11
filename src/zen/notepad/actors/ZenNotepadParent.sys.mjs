/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  TAB_ICON_CHROME: "resource:///modules/zen/notepad/ZenNotepadAssets.mjs",
  loadNote: "resource:///modules/zen/notepad/ZenNotepadStore.sys.mjs",
  saveNote: "resource:///modules/zen/notepad/ZenNotepadStore.sys.mjs",
  writePlainMarkdown: "resource:///modules/zen/notepad/ZenNotepadStore.sys.mjs",
});

const EXPORT_PATH_PREF = "zen.notepad.test.export-path";

function exportBrowsingContext(actor) {
  const embedder = actor.browsingContext?.top?.embedderElement;
  return embedder?.ownerGlobal?.browsingContext || actor.browsingContext;
}

function exportMarkdown(browsingContext, markdown, fileName) {
  const override = Services.prefs.getStringPref(EXPORT_PATH_PREF, "");
  if (override) {
    return lazy.writePlainMarkdown(override, markdown).then(() => true);
  }
  const picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  picker.init(browsingContext, "Export note", Ci.nsIFilePicker.modeSave);
  picker.defaultString = fileName || "note.md";
  picker.defaultExtension = "md";
  picker.appendFilter("Markdown", "*.md");
  return new Promise(resolve => {
    picker.open(async result => {
      if (
        result !== Ci.nsIFilePicker.returnOK &&
        result !== Ci.nsIFilePicker.returnReplace
      ) {
        resolve(false);
        return;
      }
      try {
        await lazy.writePlainMarkdown(picker.file.path, markdown);
        resolve(true);
      } catch (error) {
        console.error("Notepad export failed", error);
        resolve(false);
      }
    });
  });
}

export class ZenNotepadParent extends JSWindowActorParent {
  #syncTabIcon() {
    try {
      const browser = this.browsingContext?.top?.embedderElement;
      const win = browser?.ownerGlobal;
      if (!browser || !win?.gBrowser) {
        return;
      }
      const tab = win.gBrowser.getTabForBrowser(browser);
      if (tab) {
        win.gBrowser.setIcon(tab, lazy.TAB_ICON_CHROME);
      }
    } catch (error) {
      console.error("Notepad tab icon failed", error);
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "ZenNotepad:ShowTabIcon":
        this.#syncTabIcon();
        return null;
      case "ZenNotepad:Load":
        return lazy.loadNote(message.data.id);
      case "ZenNotepad:Save":
        await lazy.saveNote(
          message.data.id,
          message.data.markdown,
          message.data.title
        );
        return true;
      case "ZenNotepad:Export":
        return exportMarkdown(
          exportBrowsingContext(this),
          message.data.markdown,
          message.data.fileName
        );
      default:
        return null;
    }
  }
}
