// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenSnapChild extends JSWindowActorChild {
  handleEvent(event) {
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
        console.warn("[ZenSnapChild] Input clicked:", target.type);

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
