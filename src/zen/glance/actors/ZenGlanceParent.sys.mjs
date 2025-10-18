// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
export class ZenGlanceParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenGlance:GetActivationMethod': {
        return Services.prefs.getStringPref('zen.glance.activation-method', 'ctrl');
      }
      case 'ZenGlance:OpenGlance': {
        this.openGlance(this.browsingContext.topChromeWindow, message.data);
        break;
      }
      case 'ZenGlance:CloseGlance': {
        const params = {
          onTabClose: true,
          ...message.data,
        };
        this.browsingContext.topChromeWindow.gZenGlanceManager.closeGlance(params);
        break;
      }
      default:
        console.warn(`[glance]: Unknown message: ${message.name}`);
    }
  }

  openGlance(window, data) {
    return window.gZenGlanceManager.openGlance(data);
  }
}
