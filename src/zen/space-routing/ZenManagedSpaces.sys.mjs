/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ContextualIdentityService } from "resource://gre/modules/ContextualIdentityService.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

// Spaces seeded from configuration (a declarative dotfiles setup, an enterprise
// policy, …). The pref holds a JSON array of Space definitions; see
// getManagedSpaces() for the accepted shape. Live-updating so a changed pref is
// picked up without a restart.
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "managedSpacesJSON",
  "zen.space-routing.managed-spaces",
  ""
);

// Built-in selectable Space icons live here; see gZenEmojiPicker.getSVGURL().
const SELECTABLE_ICON_BASE = "chrome://browser/skin/zen-icons/selectable/";

class nsZenManagedSpaces {
  // Memoized parse of the managed-spaces pref. Re-parsed only when the raw pref
  // string changes.
  #managedSpacesRaw = null;
  #managedSpaces = [];
  #managedNames = new Set();

  /**
   * Parsed + normalized managed spaces. Accepted pref shape:
   *
   *   [ { "name": "Work", "icon": "briefcase",
   *       "container": "Work", "position": 0 }, … ]
   *
   * (an object `{ "spaces": [ … ] }` is also accepted). Each normalized entry is
   *   { name, icon, container, position }
   * where `icon` is an emoji kept as-is, or a chrome URL resolved from a bare
   * icon name / `*.svg`; `container` is the raw name or userContextId (resolved
   * at reconcile time); `position` is the entry's intended order.
   *
   * Invalid input never throws: a parse error or unexpected shape yields an
   * empty list (logged), so a malformed pref can't break startup.
   *
   * @returns {Array<object>}
   */
  getManagedSpaces() {
    const raw = lazy.managedSpacesJSON;
    if (raw === this.#managedSpacesRaw) {
      return this.#managedSpaces;
    }
    this.#managedSpacesRaw = raw;
    this.#managedSpaces = this.#parseManagedSpaces(raw);
    this.#managedNames = new Set(this.#managedSpaces.map(s => s.name));
    return this.#managedSpaces;
  }

  /**
   * @param {string} name
   * @returns {boolean} Whether a Space with this name is config-managed.
   */
  isManaged(name) {
    this.getManagedSpaces();
    return this.#managedNames.has(name);
  }

  #parseManagedSpaces(raw) {
    if (typeof raw !== "string" || raw.trim() === "") {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error(
        "[ZenManagedSpaces] Could not parse zen.space-routing.managed-spaces:",
        e
      );
      return [];
    }

    const list = Array.isArray(parsed) ? parsed : parsed?.spaces;
    if (!Array.isArray(list)) {
      console.error(
        "[ZenManagedSpaces] zen.space-routing.managed-spaces must be a JSON " +
          "array of spaces, or an object with a `spaces` array."
      );
      return [];
    }

    const spaces = [];
    for (let index = 0; index < list.length; index++) {
      const entry = list[index];
      if (
        !entry ||
        typeof entry.name !== "string" ||
        entry.name.trim() === ""
      ) {
        continue;
      }
      spaces.push({
        name: entry.name.trim(),
        icon: this.#resolveIcon(entry.icon),
        container: entry.container ?? null,
        position: Number.isInteger(entry.position) ? entry.position : index,
      });
    }
    return spaces;
  }

  /**
   * Normalizes an icon value: emoji / arbitrary text kept as-is; a full chrome
   * (or moz-icon/data) URL kept as-is; a bare icon name or `*.svg` expanded to
   * the selectable-icon chrome URL.
   *
   * @param {*} icon
   * @returns {string|undefined}
   */
  #resolveIcon(icon) {
    if (typeof icon !== "string" || icon.trim() === "") {
      return undefined;
    }
    const value = icon.trim();
    if (
      value.startsWith("chrome://") ||
      value.startsWith("moz-icon:") ||
      value.startsWith("data:")
    ) {
      return value;
    }
    if (value.endsWith(".svg")) {
      return SELECTABLE_ICON_BASE + value;
    }
    // A bare slug like "briefcase" is a built-in icon name; anything else (an
    // emoji, free text) is used verbatim.
    if (/^[a-z0-9][a-z0-9-]*$/i.test(value)) {
      return SELECTABLE_ICON_BASE + value + ".svg";
    }
    return value;
  }
}

export const gZenManagedSpaces = new nsZenManagedSpaces();
