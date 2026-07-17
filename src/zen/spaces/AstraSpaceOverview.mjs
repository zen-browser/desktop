/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Lazy Space Peek — inspect/manage another Space without switching.
 * No webpage previews, Places, remote work, or startup DOM build.
 */

import {
  switchSpaceSafely,
  moveTabToSpace,
} from "resource:///modules/zen/AstraSpaceRouting.mjs";

const PEEK_PANEL_ID = "PanelUI-astra-space-peek";
const BATCH_SIZE = 40;

export class AstraSpaceOverview {
  #win;
  #spaceId = null;
  #destroyed = false;
  #opener = null;
  #filter = "";
  #filterTimer = null;
  #boundKey = null;

  constructor(win) {
    this.#win = win;
  }

  get panel() {
    return this.#win.document.getElementById(PEEK_PANEL_ID);
  }

  destroy() {
    this.#destroyed = true;
    this.#clearFilterTimer();
    this.#detachKeyHandler();
    this.#clearList();
    this.#spaceId = null;
    this.#opener = null;
  }

  /**
   * Open Peek for a Space anchored to an element.
   * @param {object} [options]
   * @param {boolean} [options.focusSearch=false] Move focus into search (keyboard/context only).
   */
  async open(spaceId, openerEl, { focusSearch = false } = {}) {
    if (this.#destroyed || !this.#win || this.#win.closed) {
      return false;
    }
    const ws = this.#win.gZenWorkspaces;
    const space = ws?.getWorkspaceFromId?.(spaceId);
    const panel = this.panel;
    if (!space || !panel) {
      return false;
    }
    // Do not reopen while already showing the same Space.
    try {
      if (
        panel.state === "open" &&
        this.#spaceId === spaceId &&
        !focusSearch
      ) {
        return true;
      }
    } catch {
      // continue
    }
    this.#spaceId = spaceId;
    this.#opener = openerEl || null;
    this.#filter = "";
    this.#renderHeader(space);
    this.#renderList();
    this.#attachKeyHandler();
    try {
      if (typeof panel.openPopup === "function" && openerEl) {
        panel.openPopup(openerEl, "topcenter bottomleft");
      } else if (typeof panel.openPopup === "function") {
        panel.openPopup(openerEl);
      }
    } catch (error) {
      console.warn("[AstraSpacePeek] openPopup failed");
      return false;
    }
    if (focusSearch) {
      const search = this.#win.document.getElementById(
        "astra-space-peek-search"
      );
      search?.focus?.();
    }
    return true;
  }

  close() {
    const panel = this.panel;
    try {
      panel?.hidePopup?.();
    } catch {
      // ignore
    }
    this.#clearList();
    this.#detachKeyHandler();
    const opener = this.#opener;
    this.#opener = null;
    this.#spaceId = null;
    try {
      opener?.focus?.();
    } catch {
      // ignore
    }
  }

  #attachKeyHandler() {
    this.#detachKeyHandler();
    this.#boundKey = event => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.close();
      }
    };
    this.panel?.addEventListener("keydown", this.#boundKey);
    this.panel?.addEventListener("popuphidden", () => this.#onHidden(), {
      once: true,
    });
  }

  #detachKeyHandler() {
    if (this.#boundKey) {
      try {
        this.panel?.removeEventListener("keydown", this.#boundKey);
      } catch {
        // ignore
      }
      this.#boundKey = null;
    }
  }

  #onHidden() {
    this.#clearList();
    this.#detachKeyHandler();
    const opener = this.#opener;
    this.#opener = null;
    try {
      opener?.focus?.();
    } catch {
      // ignore
    }
  }

  #renderHeader(space) {
    const doc = this.#win.document;
    const title = doc.getElementById("astra-space-peek-title");
    const meta = doc.getElementById("astra-space-peek-meta");
    const icon = doc.getElementById("astra-space-peek-icon");
    if (title) {
      title.setAttribute("value", space.name || "Space");
    }
    if (icon) {
      const hasIcon = this.#win.gZenWorkspaces?.workspaceHasIcon?.(space);
      icon.textContent = hasIcon ? space.icon : "";
      icon.toggleAttribute("no-icon", !hasIcon);
    }
    const counts = this.#countTabs(space.uuid);
    if (meta) {
      meta.setAttribute(
        "value",
        `${counts.normal} tabs · ${counts.pinned} pinned · ${counts.folders} folders`
      );
    }
    const search = doc.getElementById("astra-space-peek-search");
    if (search) {
      search.value = "";
      search.oninput = () => this.#onFilterInput(search.value);
    }
    const switchBtn = doc.getElementById("astra-space-peek-switch");
    const moveBtn = doc.getElementById("astra-space-peek-move");
    const newTabBtn = doc.getElementById("astra-space-peek-newtab");
    if (switchBtn) {
      switchBtn.onclick = () => void this.#onSwitch();
    }
    if (moveBtn) {
      moveBtn.onclick = () => void this.#onMoveCurrent();
    }
    if (newTabBtn) {
      newTabBtn.onclick = () => void this.#onNewTab();
    }
  }

  #countTabs(spaceId) {
    const ws = this.#win.gZenWorkspaces;
    let normal = 0;
    let pinned = 0;
    let folders = 0;
    let unloaded = 0;
    try {
      for (const tab of ws?.allStoredTabs || []) {
        if (tab.getAttribute?.("zen-workspace-id") !== spaceId) {
          continue;
        }
        if (tab.hasAttribute?.("zen-empty-tab")) {
          continue;
        }
        if (tab.hasAttribute?.("zen-essential")) {
          continue;
        }
        if (tab.pinned) {
          pinned += 1;
        } else {
          normal += 1;
        }
        if (tab.hasAttribute?.("pending")) {
          unloaded += 1;
        }
      }
      for (const group of this.#win.gBrowser?.tabGroups || []) {
        if (group.getAttribute?.("zen-workspace-id") === spaceId) {
          folders += 1;
        }
      }
    } catch {
      // ignore
    }
    return { normal, pinned, folders, unloaded };
  }

  #onFilterInput(value) {
    this.#clearFilterTimer();
    this.#filterTimer = this.#win.setTimeout(() => {
      this.#filter = String(value || "")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .trim();
      this.#renderList();
    }, 120);
  }

  #clearFilterTimer() {
    if (this.#filterTimer) {
      try {
        this.#win.clearTimeout(this.#filterTimer);
      } catch {
        // ignore
      }
      this.#filterTimer = null;
    }
  }

  #clearList() {
    const list = this.#win.document.getElementById("astra-space-peek-list");
    if (!list) {
      return;
    }
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
  }

  #collectTabs(spaceId) {
    const ws = this.#win.gZenWorkspaces;
    const out = [];
    for (const tab of ws?.allStoredTabs || []) {
      if (tab.getAttribute?.("zen-workspace-id") !== spaceId) {
        continue;
      }
      if (tab.hasAttribute?.("zen-empty-tab") || tab.hasAttribute?.("zen-essential")) {
        continue;
      }
      const label = tab.label || tab.getAttribute?.("label") || "Tab";
      if (this.#filter && !label.toLocaleLowerCase().includes(this.#filter)) {
        continue;
      }
      out.push(tab);
      if (out.length >= 300) {
        break;
      }
    }
    return out;
  }

  #renderList() {
    if (!this.#spaceId) {
      return;
    }
    const list = this.#win.document.getElementById("astra-space-peek-list");
    if (!list) {
      return;
    }
    this.#clearList();
    const tabs = this.#collectTabs(this.#spaceId);
    const batch = tabs.slice(0, BATCH_SIZE);
    const frag = this.#win.document.createDocumentFragment();
    for (const tab of batch) {
      frag.appendChild(this.#createRow(tab));
    }
    list.appendChild(frag);
    if (tabs.length > BATCH_SIZE) {
      const more = this.#win.document.createXULElement("label");
      more.classList.add("astra-space-peek-more");
      try {
        document.l10n?.setAttributes?.(more, "astra-space-peek-more", {
          shown: BATCH_SIZE,
          total: tabs.length,
        });
      } catch {
        more.setAttribute(
          "value",
          `Showing ${BATCH_SIZE} of ${tabs.length}`
        );
      }
      list.appendChild(more);
    }
  }

  #createRow(tab) {
    const row = this.#win.document.createXULElement("toolbarbutton");
    row.classList.add("astra-space-peek-row", "subviewbutton");
    row.setAttribute("tabindex", "0");
    const label = tab.label || "Tab";
    row.setAttribute("tooltiptext", label);
    document.l10n?.setAttributes?.(row, "astra-space-peek-tab-row", {
      title: label,
    });
    // Accessible name even if Fluent missing.
    row.setAttribute("aria-label", label);

    const fav = this.#win.document.createElement("img");
    fav.classList.add("astra-space-peek-favicon");
    fav.setAttribute("alt", "");
    fav.setAttribute("draggable", "false");
    const image = tab.getAttribute?.("image") || "";
    if (image && (image.startsWith("data:") || image.startsWith("chrome:") || image.startsWith("moz-anno:"))) {
      fav.src = image;
    }
    row.appendChild(fav);

    const text = this.#win.document.createXULElement("label");
    text.classList.add("astra-space-peek-row-label");
    text.setAttribute("value", label);
    text.setAttribute("crop", "end");
    text.setAttribute("flex", "1");
    row.appendChild(text);

    if (tab.soundPlaying || tab.muted) {
      const audio = this.#win.document.createXULElement("label");
      audio.classList.add("astra-space-peek-audio");
      audio.setAttribute("value", tab.muted ? "🔇" : "🔊");
      row.appendChild(audio);
    }

    row.addEventListener("command", () => void this.#activateTab(tab));
    row.addEventListener("click", event => {
      if (event.button === 0) {
        void this.#activateTab(tab);
      }
    });
    return row;
  }

  async #activateTab(tab) {
    if (!tab || !this.#spaceId) {
      return;
    }
    const result = await switchSpaceSafely(this.#win, this.#spaceId, {
      reason: "peek-activate",
    });
    if (result.ok && tab.isConnected && this.#win.gBrowser) {
      try {
        this.#win.gBrowser.selectedTab = tab;
      } catch {
        // ignore
      }
    }
    this.close();
  }

  async #onSwitch() {
    if (!this.#spaceId) {
      return;
    }
    await switchSpaceSafely(this.#win, this.#spaceId, { reason: "peek-switch" });
    this.close();
  }

  async #onMoveCurrent() {
    const tab = this.#win.gBrowser?.selectedTab;
    if (!tab || !this.#spaceId) {
      return;
    }
    const result = moveTabToSpace(this.#win, tab, this.#spaceId, {
      select: false,
    });
    if (!result.ok) {
      try {
        this.#win.gZenUIManager?.showToast?.("astra-space-peek-error");
      } catch {
        // ignore
      }
      return;
    }
    this.#renderList();
  }

  async #onNewTab() {
    if (!this.#spaceId || !this.#win.gBrowser) {
      return;
    }
    try {
      const tab = this.#win.gBrowser.addTrustedTab("about:newtab", {
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
        inBackground: true,
      });
      const ws = this.#win.gZenWorkspaces;
      if (tab && typeof ws?.moveTabToWorkspace === "function") {
        ws.moveTabToWorkspace(tab, this.#spaceId, { trackUndo: false });
      }
    } catch {
      try {
        this.#win.gZenUIManager?.showToast?.("astra-space-peek-error");
      } catch {
        // ignore
      }
    }
    this.#renderList();
  }
}

/** Per-window lazy Peek facade. */
export function getSpaceOverview(win) {
  if (!win) {
    return null;
  }
  if (!win.gAstraSpaceOverview) {
    win.gAstraSpaceOverview = new AstraSpaceOverview(win);
    win.addEventListener(
      "unload",
      () => {
        try {
          win.gAstraSpaceOverview?.destroy?.();
        } catch {
          // ignore
        }
        win.gAstraSpaceOverview = null;
      },
      { once: true }
    );
  }
  return win.gAstraSpaceOverview;
}

export async function openSpacePeek(win, spaceId, openerEl, options = {}) {
  const overview = getSpaceOverview(win);
  return overview?.open(spaceId, openerEl, options);
}
