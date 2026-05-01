/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ZenSearchPopup } from "resource:///modules/ZenSearchPopup.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenSessionStore: "resource:///modules/zen/ZenSessionManager.sys.mjs",
});

/*
 * Owns the "send to a synced window" split-button that lives in the
 * nav-bar of a little window. Main click opens the urlbar's current
 * value in a fresh synced browser window using the active workspace;
 * the dropdown opens a ZenSearchPopup over #zen-spaces-popup so the
 * user can pick a different workspace to land in.
 */
class ZenSpacesSearchService {
  /**
   * Per-window setup.
   * @param {Window} aWindow A little window.
   */
  init(aWindow) {
    if (!aWindow || aWindow._zenSpacesSearchInited) return;
    aWindow._zenSpacesSearchInited = true;

    const doc = aWindow.document;
    const panel = doc.getElementById("zen-spaces-popup");
    if (!panel) return;

    const popup = new ZenSearchPopup({
      panel,
      searchInput: doc.getElementById("zen-spaces-list-search"),
      list: doc.getElementById("zen-spaces-list"),
      noResults: doc.getElementById("zen-spaces-search-no-results"),
      itemSelector: ".zen-spaces-list-item",
    });

    const parts = this.#injectButton(aWindow);
    if (!parts) return;
    const { button, main, dropmarker } = parts;

    main.addEventListener("click", event => {
      if (event.button !== 0) return;
      this.#openInWorkspace(aWindow, null);
    });

    dropmarker.addEventListener("click", event => {
      if (event.button !== 0) return;
      event.stopPropagation();
      this.#openSpacesPopup(aWindow, popup, button);
    });
  }

  #injectButton(aWindow) {
    const doc = aWindow.document;
    const target = doc.getElementById("nav-bar-customization-target");
    if (!target) return null;

    const button = doc.createXULElement("hbox");
    button.id = "zen-little-window-send-to-window";
    button.setAttribute("removable", "false");

    const main = doc.createXULElement("hbox");
    main.classList.add("zen-stw-main");

    const prefix = doc.createXULElement("label");
    prefix.classList.add("zen-stw-prefix");
    prefix.setAttribute(
      "data-l10n-id",
      "zen-little-window-send-to-window-prefix"
    );

    const spaceName = doc.createXULElement("label");
    spaceName.classList.add("zen-stw-space-name");
    spaceName.setAttribute(
      "value",
      aWindow.gZenWorkspaces?.getActiveWorkspaceFromCache?.()?.name || ""
    );

    main.appendChild(prefix);
    main.appendChild(spaceName);

    const separator = doc.createXULElement("hbox");
    separator.classList.add("zen-stw-separator");

    const dropmarker = doc.createXULElement("hbox");
    dropmarker.classList.add("zen-stw-dropmarker");
    const dropIcon = doc.createXULElement("image");
    dropIcon.classList.add("zen-stw-dropmarker-icon");
    dropmarker.appendChild(dropIcon);

    button.appendChild(main);
    button.appendChild(separator);
    button.appendChild(dropmarker);

    target.appendChild(button);
    return { button, main, dropmarker, spaceName };
  }

  #openSpacesPopup(aWindow, popup, anchor) {
    const workspaces = lazy.ZenSessionStore.getClonedSpaces();

    popup.populate(
      workspaces.map(space => ({
        label: space.name || space.uuid,
        render: () => {
          const node = aWindow.document.createXULElement("hbox");
          const label = aWindow.document.createXULElement("label");
          label.setAttribute("value", space.name || space.uuid);
          label.classList.add("zen-spaces-list-item-label");
          node.appendChild(label);
          return node;
        },
        onPick: () => this.#openInWorkspace(aWindow, space.uuid),
      }))
    );
    popup.open(anchor);
  }

  #openInWorkspace(aWindow, workspaceUuid) {
    const url = aWindow.gURLBar?.value?.trim();
    if (!url) return;

    const args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    const urlString = Cc["@mozilla.org/supports-string;1"].createInstance(
      Ci.nsISupportsString
    );
    urlString.data = url;
    args.appendElement(urlString);

    const opts = { args, zenSyncedWindow: true };
    if (workspaceUuid) opts.zenInitialWorkspace = workspaceUuid;

    const newWin = aWindow.OpenBrowserWindow(opts);
    if (newWin) aWindow.close();
  }
}

export const ZenSpacesSearch = new ZenSpacesSearchService();
