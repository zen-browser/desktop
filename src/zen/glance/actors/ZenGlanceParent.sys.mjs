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

  #imageBitmapToBase64(imageBitmap) {
    // 1. Create a canvas with the same size as the ImageBitmap
    const canvas = this.browsingContext.topChromeWindow.document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    // 2. Draw the ImageBitmap onto the canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);

    // 3. Convert the canvas content to a Base64 string (PNG by default)
    const base64String = canvas.toDataURL('image/png');
    return base64String;
  }

  async openGlance(window, data) {
    const win = this.browsingContext.topChromeWindow;
    const tabPanels = win.gBrowser.tabpanels;
    // Make the rect relative to the tabpanels. We dont do it directly on the
    // content process since it does not take into account scroll. This way, we can
    // be sure that the coordinates are correct.
    const tabPanelsRect = tabPanels.getBoundingClientRect();
    const rect = new DOMRect(
      data.clientX + tabPanelsRect.left,
      data.clientY + tabPanelsRect.top,
      data.width,
      data.height
    );
    const elementData = await this.#imageBitmapToBase64(
      await win.browsingContext.currentWindowGlobal.drawSnapshot(rect, 1, 'transparent', true)
    );
    data.elementData = elementData;
    window.gZenGlanceManager.openGlance(data);
  }
}
