/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
});

const PREF_ENABLED = "zen.workspaces.per-space-extensions.enabled";
// Add-on IDs that are currently disabled because of the active space, as
// opposed to add-ons the user disabled themselves from about:addons. Only
// these are ever re-enabled by us.
const PREF_DISABLED_BY_SPACE =
  "zen.workspaces.per-space-extensions.disabled-by-space";

/**
 * Lets each space carry a list of extensions that should be turned off
 * while that space is active.
 *
 * Extensions are global to the profile, so this is a convenience toggle
 * and not an isolation boundary: the state of the most recently activated
 * space wins across every window of the profile.
 */
class nsZenSpaceExtensions {
  #queue = Promise.resolve();

  get enabled() {
    return Services.prefs.getBoolPref(PREF_ENABLED, false);
  }

  #readDisabledBySpace() {
    try {
      const value = JSON.parse(
        Services.prefs.getStringPref(PREF_DISABLED_BY_SPACE, "[]")
      );
      return new Set(Array.isArray(value) ? value : []);
    } catch {
      return new Set();
    }
  }

  #writeDisabledBySpace(ids) {
    if (ids.size) {
      Services.prefs.setStringPref(
        PREF_DISABLED_BY_SPACE,
        JSON.stringify([...ids])
      );
    } else {
      Services.prefs.clearUserPref(PREF_DISABLED_BY_SPACE);
    }
  }

  #canToggle(addon) {
    const { PERM_CAN_DISABLE, PERM_CAN_ENABLE } = lazy.AddonManager;
    return !!(addon.permissions & (PERM_CAN_DISABLE | PERM_CAN_ENABLE));
  }

  /**
   * Extensions the user can assign to spaces. Add-ons the user disabled
   * manually are left out, we never touch those.
   *
   * @returns {Promise<Array<object>>} Add-ons sorted by name.
   */
  async getManageableAddons() {
    const disabledBySpace = this.#readDisabledBySpace();
    const addons = await lazy.AddonManager.getAddonsByTypes(["extension"]);
    return addons
      .filter(
        addon =>
          !addon.isSystem &&
          !addon.isBuiltin &&
          !addon.hidden &&
          this.#canToggle(addon) &&
          (!addon.userDisabled || disabledBySpace.has(addon.id))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  isDisabledInSpace(space, addonId) {
    return !!space?.disabledExtensions?.includes(addonId);
  }

  /**
   * Updates the space data in place. The caller is responsible for saving
   * the space and for calling applyForSpace if the space is active.
   *
   * @param {object} space The space data object.
   * @param {string} addonId The add-on ID.
   * @param {boolean} disabled Whether the add-on is off in this space.
   */
  setDisabledInSpace(space, addonId, disabled) {
    const ids = new Set(space.disabledExtensions ?? []);
    if (disabled) {
      ids.add(addonId);
    } else {
      ids.delete(addonId);
    }
    if (ids.size) {
      space.disabledExtensions = [...ids];
    } else {
      delete space.disabledExtensions;
    }
  }

  /**
   * Enables/disables extensions so that they match the given (now active)
   * space. Calls are serialized so quick space switches can't interleave.
   *
   * @param {object|null} space The active space data object.
   * @returns {Promise<void>}
   */
  applyForSpace(space) {
    const wanted = new Set((this.enabled && space?.disabledExtensions) || []);
    this.#queue = this.#queue
      .then(() => this.#apply(wanted))
      .catch(e => console.error("ZenSpaceExtensions: failed to apply", e));
    return this.#queue;
  }

  async #apply(wanted) {
    const disabledBySpace = this.#readDisabledBySpace();
    if (!wanted.size && !disabledBySpace.size) {
      return;
    }
    let changed = false;
    for (const id of [...disabledBySpace]) {
      if (wanted.has(id)) {
        continue;
      }
      const addon = await lazy.AddonManager.getAddonByID(id);
      if (addon?.userDisabled) {
        await addon.enable();
      }
      disabledBySpace.delete(id);
      changed = true;
    }
    for (const id of wanted) {
      if (disabledBySpace.has(id)) {
        continue;
      }
      const addon = await lazy.AddonManager.getAddonByID(id);
      // If the user already disabled it, leave it alone and don't track
      // it, so we don't re-enable it behind their back later.
      if (!addon || addon.userDisabled || !this.#canToggle(addon)) {
        continue;
      }
      await addon.disable();
      disabledBySpace.add(id);
      changed = true;
    }
    if (changed) {
      this.#writeDisabledBySpace(disabledBySpace);
    }
  }
}

export const ZenSpaceExtensions = new nsZenSpaceExtensions();
