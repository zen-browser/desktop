// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenSnapChild extends JSWindowActorChild {
  #activeInput = null;

  receiveMessage(message) {
    if (message.name === "ZenSnap:FilesSelected") {
      const { files } = message.data;
      if (this.#activeInput && files?.length) {
        this.#assignFilesToInput(this.#activeInput, files);
      }
    }
  }

  #assignFilesToInput(input, fileObjects) {
    try {
      input.mozSetFileArray(fileObjects);

      const win =
        this.contentWindow ||
        input.ownerGlobal ||
        input.ownerDocument?.documentGlobal;

      if (win) {
        input.dispatchEvent(
          new win.Event("input", { bubbles: true, composed: true })
        );
        input.dispatchEvent(
          new win.Event("change", { bubbles: true, composed: true })
        );
      }
      console.warn(
        "[ZenSnapChild] Assigned files to input successfully:",
        fileObjects.length
      );
    } catch (error) {
      console.error("[ZenSnapChild] Failed to assign files to input:", error);
    }
  }

  handleEvent(event) {
    if (!Services.prefs.getBoolPref("zen.snap.enabled", true)) {
      return;
    }

    if (event.type === "keydown") {
      if (event.key === "Escape" && this.#activeInput) {
        this.sendAsyncMessage("ZenSnap:Dismiss", {});
        this.#activeInput = null;
      }
      return;
    }

    if (event.type === "click") {
      let target = event.target;

      // Supports clicking on labels associated with file inputs
      if (target?.tagName !== "INPUT" && target?.closest) {
        const fileInput =
          target.closest("label")?.control ||
          target.closest("input[type='file']");
        if (fileInput) {
          target = fileInput;
        }
      }

      if (
        target?.tagName === "INPUT" &&
        (target.type === "file" || target.type === "image")
      ) {
        // Prevent default native OS file picker from opening immediately
        event.preventDefault();
        event.stopPropagation();

        this.#activeInput = target;
        console.warn("[ZenSnapChild] Input click intercepted:", target.type);

        const rect = target.getBoundingClientRect?.();
        this.sendAsyncMessage("ZenSnap:InputClicked", {
          inputType: target.type,
          accept: target.accept || "*",
          multiple: !!target.multiple,
          rect: rect
            ? {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              }
            : null,
        });
      }
    }
  }
}
