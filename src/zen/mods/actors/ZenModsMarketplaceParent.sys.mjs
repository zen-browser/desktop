// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenModsMarketplaceParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenModsMarketplace:InstallMod': {
        const mod = message.data.mod;

        console.log(`[ZenModsMarketplaceParent]: Installing mod ${mod.id}`);

        mod.enabled = true;

        const mods = await gZenMods.getMods();
        mods[mod.id] = mod;

        await gZenMods.updateMods(mods);
        await this.updateChildProcesses(mod.id);

        break;
      }
      case 'ZenModsMarketplace:UninstallMod': {
        const modId = message.data.modId;
        console.log(`[ZenModsMarketplaceParent]: Uninstalling mod ${modId}`);

        const mods = await gZenMods.getMods();

        delete mods[modId];

        await gZenMods.removeMod(modId);
        await gZenMods.updateMods(mods);

        await this.updateChildProcesses(modId);

        break;
      }
      case 'ZenModsMarketplace:CheckForUpdates': {
        gZenMods.checkForModUpdates();
        break;
      }
    }
  }

  async updateChildProcesses(modId) {
    this.sendAsyncMessage('ZenModsMarketplace:ModChanged', { modId });
  }
}
