/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const GHOST_ICON = "chrome://browser/skin/zen-icons/ghost/ghost.png";

export const ZenGhostModeWidget = {
  id: "zen-ghost-mode-button",
  l10nId: "zen-ghost-mode-button",
  overflows: false,

  onCreated(node) {
    node.classList.add("zen-sidebar-action-button");
    node.setAttribute("image", GHOST_ICON);
  },

  onCommand(event) {
    event.view.OpenBrowserWindow({ private: true });
  },
};
