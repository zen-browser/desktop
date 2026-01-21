// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenVimParent extends JSWindowActorParent {
  receiveMessage(message) {
    const window = this.browsingContext.topChromeWindow;
    const manager = window?.gZenVimManager;
    if (!manager) {
      return undefined;
    }

    switch (message.name) {
      case "ZenVim:GetMode":
        return { mode: manager.mode };
      case "ZenVim:RequestModeChange":
        manager.setMode(message.data?.mode || "normal");
        break;
      case "ZenVim:OpenCommandLine":
        manager.openCommandLine(":");
        break;
      case "ZenVim:OpenSearch":
        manager.openCommandLine("/");
        break;
      case "ZenVim:FindAgain":
        manager.findAgain(Boolean(message.data?.backwards));
        break;
      default:
        break;
    }

    return undefined;
  }
}
