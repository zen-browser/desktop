/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ContextualIdentityService:
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
});

const kContainerTopics = [
  "contextual-identity-created",
  "contextual-identity-updated",
  "contextual-identity-deleted",
  "contextual-identity-reordered",
];
const kContainersPref = "privacy.userContext.enabled";
const kContainerDialogURL =
  "chrome://browser/content/preferences/dialogs/containers.xhtml";
const kContainerDragType = "application/x-zen-settings-container";

export class ZenSettingsContainers {
  constructor(settings) {
    this.settings = settings;
    this.#initContainers();
  }

  get actions() {
    return {
      "containers-add": () => this.settings.openDialog(kContainerDialogURL, {}),
    };
  }

  #initContainers() {
    const list = document.getElementById("zen-settings-containers-list");
    this.settings.watchPrefs([kContainersPref], () => {
      const enabled = Services.prefs.getBoolPref(kContainersPref, false);
      document.querySelector(
        '.zen-settings-category[data-pane="containers"]'
      ).hidden = !enabled;
      if (!enabled && this.settings.currentPane == "containers") {
        this.settings.showPane();
      }
    });
    this.settings.watchTopics(kContainerTopics, () => this.#updateContainers());
    this.#updateContainers();

    list.addEventListener("click", event => {
      const row = event.target.closest(".zen-settings-container");
      if (!row) {
        return;
      }
      const userContextId = Number(row.dataset.id);
      if (event.target.closest(".zen-settings-row-remove")) {
        this.#removeContainer(userContextId);
      } else if (event.target.closest(".zen-settings-icon-button")) {
        this.#editContainer(userContextId);
      }
    });
    list.addEventListener("keydown", event => {
      const row = event.target.closest(".zen-settings-container");
      const offset = { ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (!row || !offset || !event.altKey || event.target != row) {
        return;
      }
      event.preventDefault();
      const index = [...list.children].indexOf(row) + offset;
      if (index >= 0 && index < list.children.length) {
        this.#moveContainer(Number(row.dataset.id), index, { keepFocus: true });
      }
    });

    list.addEventListener("dragstart", event => {
      const row = event.target.closest(".zen-settings-container");
      if (!row) {
        return;
      }
      event.dataTransfer.setData(kContainerDragType, row.dataset.id);
      event.dataTransfer.effectAllowed = "move";
      row.setAttribute("data-dragging", "true");
    });
    list.addEventListener("dragend", () => this.#clearContainerDrag());
    list.addEventListener("dragover", event => {
      const target = this.#containerDropTarget(event);
      if (!target) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      for (const row of list.children) {
        row.removeAttribute("data-drop");
      }
      target.row.setAttribute("data-drop", target.after ? "after" : "before");
    });
    list.addEventListener("drop", event => {
      const target = this.#containerDropTarget(event);
      const dragged = list.querySelector("[data-dragging]");
      this.#clearContainerDrag();
      if (!target || !dragged || dragged == target.row) {
        return;
      }
      event.preventDefault();
      const rows = [...list.children].filter(row => row != dragged);
      const index = rows.indexOf(target.row) + (target.after ? 1 : 0);
      this.#moveContainer(Number(dragged.dataset.id), index);
    });
  }

  #containerDropTarget(event) {
    if (!event.dataTransfer.types.includes(kContainerDragType)) {
      return null;
    }
    const row = event.target.closest(".zen-settings-container");
    if (!row) {
      return null;
    }
    const rect = row.getBoundingClientRect();
    return { row, after: event.clientY > rect.top + rect.height / 2 };
  }

  #clearContainerDrag() {
    const list = document.getElementById("zen-settings-containers-list");
    for (const row of list.children) {
      row.removeAttribute("data-dragging");
      row.removeAttribute("data-drop");
    }
  }

  #updateContainers() {
    const identities = lazy.ContextualIdentityService;
    const list = document.getElementById("zen-settings-containers-list");
    const focusedId = document.activeElement?.closest(".zen-settings-container")
      ?.dataset.id;
    const fragment = document.createDocumentFragment();
    for (const identity of identities.getPublicIdentities()) {
      const row = document.createElement("div");
      row.className = "zen-settings-row zen-settings-container";
      row.dataset.id = identity.userContextId;
      row.role = "listitem";
      row.tabIndex = 0;
      row.draggable = true;

      const handle = document.createElement("img");
      handle.className = "zen-settings-drag-handle";
      handle.src = "chrome://browser/skin/zen-icons/drag-indicator.svg";
      handle.alt = "";

      const icon = document.createElement("img");
      icon.className = "zen-settings-row-icon zen-settings-container-icon";
      icon.src = identities.getContainerIconURL(identity.icon) ?? "";
      icon.alt = "";
      icon.style.fill = identities.getContainerColorCode(identity.color) ?? "";

      const label = document.createElement("span");
      label.className = "zen-settings-row-text";
      label.textContent = identities.getUserContextLabel(
        identity.userContextId
      );

      const edit = this.settings.createIconButton(
        "settings",
        "zen-settings-window-containers-edit"
      );
      const remove = this.settings.createIconButton(
        "trash",
        "zen-settings-window-containers-remove"
      );
      remove.classList.add("zen-settings-row-remove");

      row.append(handle, icon, label, edit, remove);
      fragment.append(row);
    }
    list.replaceChildren(fragment);
    if (focusedId) {
      list.querySelector(`[data-id="${focusedId}"]`)?.focus();
    }
  }

  /**
   * @param {number} userContextId The container to move.
   * @param {number} index Where it goes among the other containers.
   * @param {object} [options]
   * @param {boolean} [options.keepFocus] Whether its row keeps the focus.
   */
  #moveContainer(userContextId, index, { keepFocus = false } = {}) {
    lazy.ContextualIdentityService.move([userContextId], index);
    if (keepFocus) {
      document
        .querySelector(`.zen-settings-container[data-id="${userContextId}"]`)
        ?.focus();
    }
  }

  #editContainer(userContextId) {
    const identities = lazy.ContextualIdentityService;
    const identity = identities.getPublicIdentityFromId(userContextId);
    if (!identity) {
      return;
    }
    identity.name = identities.getUserContextLabel(userContextId);
    this.settings.openDialog(kContainerDialogURL, { userContextId, identity });
  }

  async #removeContainer(userContextId) {
    const identities = lazy.ContextualIdentityService;
    const count = identities.countContainerTabs(userContextId);
    if (count) {
      const [title, body, confirmLabel, cancelLabel] =
        await document.l10n.formatValues([
          { id: "zen-settings-window-containers-remove-title" },
          { id: "zen-settings-window-containers-remove-body", args: { count } },
          { id: "zen-settings-window-containers-remove-confirm" },
          { id: "zen-settings-window-containers-remove-cancel" },
        ]);
      if (!this.settings.confirm(title, body, confirmLabel, cancelLabel)) {
        return;
      }
      await identities.closeContainerTabs(userContextId);
    }
    identities.remove(userContextId);
  }
}
