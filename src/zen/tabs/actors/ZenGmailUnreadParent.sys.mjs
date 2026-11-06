// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenGmailUnreadParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name !== "ZenGmailUnread:Update") {
      return;
    }

    const win = this.browsingContext.topChromeWindow;
    const browser = this.browsingContext.top.embedderElement;
    const tab = win?.gBrowser?.getTabForBrowser(browser);
    tab?.toggleAttribute("zen-gmail-unread", message.data.unread === true);
  }
}
