/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const TAG_NAME = "zen-essentials-promo";

class nsZenEssentialsPromo extends MozXULElement {
  #hasConnected = false;

  static markup = `
    <image src="${gZenEmojiPicker.getSVGURL("heart.svg")}" />
    <label data-l10n-id="zen-essentials-promo-label" class="zen-essentials-promo-title"></label>
    <label data-l10n-id="zen-essentials-promo-sublabel" class="zen-essentials-promo-sublabel"></label>
  `;

  connectedCallback() {
    if (this.delayConnectedCallback() || this.#hasConnected) {
      return;
    }

    this.appendChild(this.constructor.fragment);
    this.classList.add("zen-drop-target");
    this.#hasConnected = true;
  }

  remove() {
    const section = this.parentElement;
    if (section) {
      delete section.essentialsPromo;
    }
    super.remove();
  }
}

/**
 * Create and append the Zen Essentials promo element to the given container.
 *
 * @param {number|undefined} container - The container to append the promo to.
 *  If undefined, appends to the current workspace's tab strip.
 * @returns {"created"|"shown"|false} - "created" if the promo was created and appended,
 *  "exists" if the promo already exists, or false if the section is not empty.
 */
export function createZenEssentialsPromo(container = undefined) {
  if (!Services.prefs.getBoolPref("zen.tabs.essentials.dnd-promo-enabled", true)) {
    return false;
  }
  if (container === undefined) {
    container = gZenWorkspaces.getCurrentSpaceContainerId();
  }
  const section = gZenWorkspaces.getEssentialsSection(container);
  if (!section || section.essentialsPromo) {
    return "shown";
  }
  if (section.children.length) {
    return false;
  }
  const element = document.createXULElement(TAG_NAME);
  section.appendChild(element);
  section.essentialsPromo = element;
  return "created";
}

customElements.define(TAG_NAME, nsZenEssentialsPromo);
