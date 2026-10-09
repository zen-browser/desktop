// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Gesture actions that map onto an existing browser command. Scrolling is
// handled in the child, it needs the page. The child is not trusted, so
// anything not listed here is ignored.
const kActionCommands = new Map([
  ["back", "Browser:Back"],
  ["forward", "Browser:Forward"],
  ["reload", "Browser:Reload"],
  ["stop", "Browser:Stop"],
  ["tab-prev", "Browser:PrevTab"],
  ["tab-next", "Browser:NextTab"],
  ["new-tab", "cmd_newNavigatorTab"],
  ["close-tab", "cmd_close"],
  ["restore-tab", "History:RestoreLastClosedTabOrWindowOrSession"],
]);

export class ZenMouseGesturesParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name !== "ZenMouseGestures:Action") {
      return;
    }
    const win = this.browsingContext.topChromeWindow;
    if (!win || win.closed) {
      return;
    }
    const commandId = kActionCommands.get(message.data?.action);
    const command = commandId && win.document.getElementById(commandId);
    if (!command || command.hasAttribute("disabled")) {
      return;
    }
    command.doCommand();
  }
}
