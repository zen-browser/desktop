// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyServiceGetter(
  lazy,
  "zenDragAndDropService",
  "@mozilla.org/zen/drag-and-drop;1",
  Ci.nsIZenDragAndDrop
);

export class ZenWindowDragParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name !== "ZenWindowDrag:StartDrag") {
      return;
    }
    const win = this.browsingContext.topChromeWindow;
    if (!win || win.closed || win.windowState === win.STATE_FULLSCREEN) {
      return;
    }
    lazy.zenDragAndDropService.beginNativeWindowMove(win);
  }
}
