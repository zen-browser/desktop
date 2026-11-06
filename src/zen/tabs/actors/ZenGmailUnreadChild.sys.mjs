// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const UNREAD_TITLE_PATTERN = /^\(\d[\d.,]*\+?\)\s/;

export class ZenGmailUnreadChild extends JSWindowActorChild {
  #unread = null;

  handleEvent(event) {
    if (event.target !== this.document && event.target !== this.contentWindow) {
      return;
    }
    this.#report(event.type === "pagehide" ? false : undefined);
  }

  #report(unread = UNREAD_TITLE_PATTERN.test(this.document.title)) {
    if (unread === this.#unread) {
      return;
    }
    this.#unread = unread;
    this.sendAsyncMessage("ZenGmailUnread:Update", { unread });
  }
}
