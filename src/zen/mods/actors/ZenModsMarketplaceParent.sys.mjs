// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenModsManager: "resource:///modules/zen/mods/ZenModsManager.sys.mjs",
});

export class ZenModsMarketplaceParent extends JSWindowActorParent {
  async receiveMessage(message) {
    switch (message.name) {
      case "ZenModsMarketplace:InstallMod": {
        const { modId } = message.data;

        try {
          const mod = await lazy.gZenModsManager.fetchStoreMod(modId);

          console.warn(`[ZenModsMarketplaceParent]: Installing mod ${mod.id}`);

          await lazy.gZenModsManager.installMod(mod);
        } catch (error) {
          console.error(
            `[ZenModsMarketplaceParent]: Could not install mod ${modId}:`,
            error
          );
        }

        this.#notifyModChanged(modId);
        break;
      }

      case "ZenModsMarketplace:UninstallMod": {
        const { modId } = message.data;

        console.warn(`[ZenModsMarketplaceParent]: Uninstalling mod ${modId}`);

        await lazy.gZenModsManager.uninstallMod(modId);

        this.#notifyModChanged(modId);
        break;
      }

      case "ZenModsMarketplace:CheckForUpdates": {
        const updates = await lazy.gZenModsManager.checkForUpdates();

        this.#sendToPage("ZenModsMarketplace:CheckForUpdatesFinished", {
          updates,
        });
        break;
      }

      case "ZenModsMarketplace:IsModInstalled": {
        return lazy.gZenModsManager.isModInstalled(message.data.themeId);
      }
    }

    return undefined;
  }

  #notifyModChanged(modId) {
    this.#sendToPage("ZenModsMarketplace:ModChanged", { modId });
  }

  /**
   * Downloads take a while; the page may be gone by the time they finish.
   *
   * @param {string} name
   * @param {object} data
   */
  #sendToPage(name, data) {
    if (!this.manager || this.manager.isClosed) {
      return;
    }

    this.sendAsyncMessage(name, data);
  }
}
