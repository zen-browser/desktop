// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

export class ZenSnapParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name === "ZenSnap:InputClicked") {
      const win = this.browsingContext?.topChromeWindow;
      win?.gZenSnapManager?.onInputClicked(message.data, this);
    } else if (message.name === "ZenSnap:Dismiss") {
      const win = this.browsingContext?.topChromeWindow;
      win?.gZenSnapManager?.hideModal();
    }
  }

  async sendFilesToContent(paths) {
    try {
      const files = [];
      for (const path of paths) {
        try {
          const file = await File.createFromFileName(path);
          files.push(file);
        } catch (err) {
          console.error(
            "[ZenSnapParent] Failed to create File from path:",
            path,
            err
          );
        }
      }

      if (files.length) {
        console.warn(
          "[ZenSnapParent] Sending privileged File objects to content:",
          files.length
        );
        this.sendAsyncMessage("ZenSnap:FilesSelected", { files });
      }
    } catch (e) {
      console.error("[ZenSnapParent] Error in sendFilesToContent:", e);
    }
  }

  #isPickerOpen = false;

  openNativeFilePicker(accept = "*", multiple = false) {
    if (this.#isPickerOpen) {
      console.warn(
        "[ZenSnapParent] File picker already open, ignoring duplicate call."
      );
      return;
    }
    this.#isPickerOpen = true;

    console.warn(
      "[ZenSnapParent] openNativeFilePicker triggered with accept:",
      accept,
      "multiple:",
      multiple
    );
    try {
      const nsIFilePicker = Ci.nsIFilePicker;
      const fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

      const mode = multiple
        ? nsIFilePicker.modeOpenMultiple
        : nsIFilePicker.modeOpen;

      const win =
        this.browsingContext?.topChromeWindow ||
        Services.wm.getMostRecentWindow("navigator:browser");
      const bc = win?.browsingContext;

      console.warn(
        "[ZenSnapParent] Initializing filepicker with chrome bc:",
        bc
      );
      fp.init(bc, "Select File", mode);

      if (accept && accept !== "*") {
        if (accept.includes("image/")) {
          fp.appendFilters(nsIFilePicker.filterImages);
        } else {
          fp.appendFilters(nsIFilePicker.filterAll);
        }
      } else {
        fp.appendFilters(nsIFilePicker.filterAll);
      }

      console.warn("[ZenSnapParent] Opening native file picker dialog...");
      fp.open(result => {
        this.#isPickerOpen = false;
        console.warn("[ZenSnapParent] File picker closed with result:", result);
        if (
          result === nsIFilePicker.returnOK ||
          result === nsIFilePicker.returnReplace
        ) {
          if (multiple && fp.files) {
            const files = [];
            const enumerator = fp.files;
            while (enumerator.hasMoreElements()) {
              const file = enumerator.getNext().QueryInterface(Ci.nsIFile);
              files.push(file.path);
            }
            console.warn("[ZenSnapParent] Sending selected files:", files);
            this.sendFilesToContent(files);
          } else if (fp.file) {
            console.warn(
              "[ZenSnapParent] Sending selected file:",
              fp.file.path
            );
            this.sendFilesToContent([fp.file.path]);
          }
        }
      });
    } catch (e) {
      console.error("[ZenSnapParent] Failed to open native file picker:", e);
    }
  }
}
