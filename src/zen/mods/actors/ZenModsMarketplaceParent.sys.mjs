// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenModsMarketplaceParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  get modsManager() {
    return this.browsingContext.topChromeWindow.gZenMods;
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenModsMarketplace:InstallMod': {
        const modId = message.data.modId;
        const mod = await this.modsManager.requestMod(modId);

        console.log(`[ZenModsMarketplaceParent]: Installing mod ${mod.id}`);

        mod.enabled = true;

        const mods = await this.modsManager.getMods();
        mods[mod.id] = mod;

        await this.modsManager.updateMods(mods);
        await this.updateChildProcesses(mod.id);

        break;
      }
      case 'ZenModsMarketplace:UninstallMod': {
        const modId = message.data.modId;
        console.log(`[ZenModsMarketplaceParent]: Uninstalling mod ${modId}`);

        const mods = await this.modsManager.getMods();

        delete mods[modId];

        await this.modsManager.removeMod(modId);
        await this.modsManager.updateMods(mods);

        await this.updateChildProcesses(modId);

        break;
      }
      case 'ZenModsMarketplace:CheckForUpdates': {
        const updates = await this.modsManager.checkForModsUpdates();
        this.sendAsyncMessage('ZenModsMarketplace:CheckForUpdatesFinished', { updates });
        break;
      }

      case 'ZenModsMarketplace:IsModInstalled': {
        const themeId = message.data.themeId;
        const themes = await this.modsManager.getMods();

        return Boolean(themes?.[themeId]);
      }
    }
  }

  async updateChildProcesses(modId) {
    this.sendAsyncMessage('ZenModsMarketplace:ModChanged', { modId });
  }
}
