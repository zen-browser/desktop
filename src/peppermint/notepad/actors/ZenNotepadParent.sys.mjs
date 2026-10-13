/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { parseNoteURL } from "resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs";

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

function isNotepadDocument(actor) {
  try {
    return !!parseNoteURL(actor.browsingContext?.currentURI?.spec);
  } catch {
    return false;
  }
}

function attachMintDocument(browsingContext) {
  if (!browsingContext || browsingContext.parent) {
    return;
  }
  let uri;
  try {
    uri = browsingContext.currentURI;
  } catch {
    return;
  }
  if (uri?.scheme !== "mint") {
    return;
  }
  const global = browsingContext.currentWindowGlobal;
  if (!global) {
    return;
  }
  try {
    global.getActor("ZenNotepad").sendAsyncMessage("ZenNotepad:Attach");
  } catch (error) {
    console.error("Notepad attach failed", error);
  }
}

/**
 * Asks the notepad actor to start only after a top-level mint: document
 * loads. The actor is not registered for page events, so ordinary pages
 * never construct it.
 *
 * @param {Window} win
 */
export function watchMintDocuments(win) {
  if (!win || win.closed) {
    return;
  }
  const install = () => {
    if (win.__mintNotepadWatching || win.closed || !win.gBrowser) {
      return;
    }
    win.__mintNotepadWatching = true;
    const listener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
      onStateChange(webProgress, request, flags) {
        if (!webProgress.isTopLevel) {
          return;
        }
        const stop = flags & Ci.nsIWebProgressListener.STATE_STOP;
        const windowStop = flags & Ci.nsIWebProgressListener.STATE_IS_WINDOW;
        if (!stop || !windowStop) {
          return;
        }
        attachMintDocument(webProgress.browsingContext);
      },
      onLocationChange(webProgress, request, location) {
        if (!webProgress.isTopLevel || location?.scheme !== "mint") {
          return;
        }
        attachMintDocument(webProgress.browsingContext);
      },
      onProgressChange() {},
      onStatusChange() {},
      onSecurityChange() {},
      onContentBlockingEvent() {},
    };
    win.__mintNotepadListener = listener;
    win.gBrowser.addProgressListener(
      listener,
      Ci.nsIWebProgress.NOTIFY_STATE_WINDOW | Ci.nsIWebProgress.NOTIFY_LOCATION
    );
    win.addEventListener(
      "unload",
      () => {
        try {
          win.gBrowser.removeProgressListener(listener);
        } catch {
          // The window is already closing.
        }
      },
      { once: true }
    );
    for (const browser of win.gBrowser.browsers) {
      attachMintDocument(browser.browsingContext);
    }
  };
  if (win.gBrowser) {
    install();
  } else {
    win.addEventListener("DOMContentLoaded", install, { once: true });
  }
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
    if (!isNotepadDocument(this)) {
      return null;
    }
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
