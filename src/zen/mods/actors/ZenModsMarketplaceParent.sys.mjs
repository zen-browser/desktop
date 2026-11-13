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

          if (await this.#confirmInstall(mod)) {
            console.warn(
              `[ZenModsMarketplaceParent]: Installing mod ${mod.id}`
            );

            await lazy.gZenModsManager.installMod(mod);
          }
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

        // The page only hears about its own mods, never where others come
        // from.
        this.#sendToPage("ZenModsMarketplace:CheckForUpdatesFinished", {
          updates: updates?.filter(mod => !mod.source) ?? null,
        });
        break;
      }

      case "ZenModsMarketplace:IsModInstalled": {
        return lazy.gZenModsManager.isModInstalled(message.data.themeId);
      }
    }

    return undefined;
  }

  /**
   * @param {object} mod - What the store published about the mod
   * @returns {Promise<boolean>} Whether the user agreed to install it
   */
  async #confirmInstall(mod) {
    const window = this.browsingContext.topChromeWindow;
    const { prompt } = Services;
    const [title, message, accept] = await window.document.l10n.formatValues([
      { id: "zen-mods-install-prompt-title" },
      {
        id: "zen-mods-install-prompt-message",
        args: { name: mod.name, author: mod.author ?? "" },
      },
      { id: "zen-mods-install-prompt-accept" },
    ]);
    const flags =
      prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_IS_STRING +
      prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_CANCEL;

    const result = await prompt.asyncConfirmEx(
      window.browsingContext,
      prompt.MODAL_TYPE_INTERNAL_WINDOW,
      title,
      message,
      flags,
      accept,
      null,
      null,
      null,
      false
    );

    return result.getProperty("buttonNumClicked") === 0;
  }

  /**
   * Tells the store page an install or removal is done, so the mod's button
   * shows its state.
   *
   * @param {string} modId
   */
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
