/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ContainerEditor } from "chrome://browser/content/usercontext/ContainerEditor.mjs";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ContextualIdentityService:
    "moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs",
});

/**
 * Returns true when the element is actually laid out, unlike a plain `hidden`
 * attribute check, which misses hidden ancestors.
 */
function isRendered(el) {
  return !!el && !!el.getClientRects().length;
}

/**
 * Picks a visible element to anchor a container panel to. The new-tab button
 * of the active space is preferred, but it is hidden while a space is being
 * created, and popups anchored to non-rendered elements are placed off-screen.
 */
function getFallbackAnchor(win) {
  let doc = win.document;
  let candidates = [
    win.gZenWorkspaces?.activeWorkspaceStrip?.querySelector(
      "#tabs-newtab-button"
    ),
    doc.querySelector(".zen-workspace-creation-profile"),
    doc.getElementById("navigator-toolbox"),
  ];
  return candidates.find(isRendered) ?? null;
}

function html(doc, tag, className, attrs = {}) {
  let el = doc.createElementNS(HTML_NS, tag);
  if (className) {
    el.className = className;
  }
  for (let [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  return el;
}

/**
 * A container icon tinted with its color, used by the picker rows and the
 * editor preview.
 */
function createContainerChip(doc, identity) {
  let chip = html(doc, "span", "zen-container-chip", { role: "presentation" });
  let icon = html(doc, "span", "userContext-icon");
  chip.append(icon);
  updateContainerChip(chip, identity);
  return chip;
}

function updateContainerChip(chip, { color, icon }) {
  chip.className = `zen-container-chip identity-color-${color}`;
  chip.firstChild.className = `userContext-icon identity-icon-${icon}`;
}

/**
 * Wraps the shared Firefox editor's fields in Zen's layout: a name row with a
 * live preview of the container, like the space creation form.
 */
function decorateEditor(editor) {
  let doc = editor.document;
  let form = editor.form;
  form.classList.add("zen-container-editor");

  let nameRow = html(doc, "div", "zen-container-editor-name-row");
  let chip = createContainerChip(doc, editor.identity);
  editor._name.replaceWith(nameRow);
  nameRow.append(chip, editor._name);
  doc.l10n.setAttributes(editor._name, "zen-container-creation-name");

  let updatePreview = () => {
    let data = new FormData(form);
    updateContainerChip(chip, {
      color: data.get("color"),
      icon: data.get("icon"),
    });
  };
  form.addEventListener("change", updatePreview);
  form.addEventListener("input", updatePreview);
  updatePreview();
}

/**
 * Reads the editor form and creates or updates the container.
 *
 * @returns {number} The userContextId of the saved container.
 */
function saveEditor(editor) {
  let data = new FormData(editor.form);
  // The text field reports its value to the form asynchronously, so read it
  // from the element to not lose a name typed right before submitting.
  let name = editor._name.value.trim();
  let icon = data.get("icon");
  let color = data.get("color");
  if (editor.userContextId) {
    lazy.ContextualIdentityService.update(
      editor.userContextId,
      name,
      icon,
      color
    );
    return editor.userContextId;
  }
  return lazy.ContextualIdentityService.create(name, icon, color).userContextId;
}

/**
 * Deletes a container, closing its tabs first like about:preferences does.
 */
async function deleteContainer(userContextId) {
  await lazy.ContextualIdentityService.closeContainerTabs(userContextId);
  lazy.ContextualIdentityService.remove(userContextId);
}

/**
 * The container picker: a Zen panel to choose, create, edit and delete
 * containers. One instance per browser window.
 */
class nsZenContainerPicker {
  #win;
  #doc;
  #panel;
  #title;
  #backButton;
  #view;
  #options = {};

  constructor(win) {
    this.#win = win;
    this.#doc = win.document;
  }

  get #service() {
    return lazy.ContextualIdentityService;
  }

  #build() {
    if (this.#panel) {
      return;
    }
    let doc = this.#doc;
    doc.defaultView.MozXULElement.insertFTLIfNeeded(
      "browser/zen-containers.ftl"
    );
    doc.defaultView.MozXULElement.insertFTLIfNeeded(
      "toolkit/global/contextual-identity.ftl"
    );

    let panel = doc.createXULElement("panel");
    panel.id = "zen-container-picker";
    panel.className = "panel-no-padding";
    panel.setAttribute("type", "arrow");
    panel.setAttribute("orient", "vertical");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "zen-container-picker-title");

    let content = html(doc, "div", "zen-container-picker-content");
    let header = html(doc, "div", "zen-container-picker-header");
    this.#backButton = html(doc, "button", "zen-container-picker-back", {
      "data-l10n-id": "zen-container-picker-back",
    });
    this.#backButton.addEventListener("click", () => this.#showList(-1));
    this.#title = html(doc, "h1", "", { id: "zen-container-picker-title" });
    header.append(this.#backButton, this.#title);
    this.#view = html(doc, "div", "zen-container-picker-view");
    content.append(header, this.#view);
    panel.append(content);

    panel.addEventListener("popuphidden", event => {
      if (event.target == panel) {
        this.#view.replaceChildren();
        this.#options = {};
      }
    });
    panel.addEventListener("keydown", event => {
      if (
        event.key == "Backspace" &&
        !this.#backButton.hidden &&
        !event.target.closest?.("moz-input-text, input")
      ) {
        this.#showList(-1);
      }
    });

    doc.getElementById("mainPopupSet").append(panel);
    this.#panel = panel;
  }

  /**
   * @param {object} options
   * @param {Element} [options.anchor] Element to anchor to, when visible.
   * @param {number} [options.selectedId] The currently chosen container.
   * @param {Function} [options.onSelect] Called with the chosen userContextId.
   *   Without it, the picker only manages containers.
   * @param {string} [options.view] "list" or "create".
   */
  open({ anchor = null, selectedId = 0, onSelect = null, view = "list" } = {}) {
    this.#build();
    if (this.#panel.state == "open" || this.#panel.state == "showing") {
      this.#panel.hidePopup();
    }
    if (!isRendered(anchor)) {
      anchor = getFallbackAnchor(this.#win);
    }
    if (!anchor) {
      return;
    }
    this.#options = { selectedId, onSelect, startView: view };
    if (view == "create") {
      this.#showEditor(null, 0);
    } else {
      this.#showList(0);
    }
    this.#panel.openPopup(
      anchor,
      this.#win.gZenUIManager.panelUIPosition(this.#panel, anchor)
    );
  }

  close() {
    this.#panel?.hidePopup();
  }

  #setView(titleId, children, direction, { back = true } = {}) {
    this.#doc.l10n.setAttributes(this.#title, titleId);
    this.#backButton.hidden = !back;
    this.#view.replaceChildren(...children);
    this.#view.classList.remove("slide-forward", "slide-back");
    if (direction) {
      // Restart the animation.
      void this.#view.offsetWidth;
      this.#view.classList.add(direction > 0 ? "slide-forward" : "slide-back");
    }
  }

  #select(userContextId) {
    this.#options.selectedId = userContextId;
    this.#options.onSelect?.(userContextId);
  }

  #showList(direction) {
    if (this.#options.startView == "create") {
      // Opened straight into the editor (an "Add new container" item), so
      // there is no list to go back to.
      this.close();
      return;
    }
    let doc = this.#doc;
    let { selectedId, onSelect } = this.#options;
    let list = html(doc, "div", "zen-container-picker-list", {
      role: "listbox",
    });

    if (onSelect) {
      list.append(this.#createRow({ userContextId: 0 }, selectedId == 0));
    }
    for (let identity of this.#service.getPublicIdentities()) {
      list.append(
        this.#createRow(identity, identity.userContextId == selectedId)
      );
    }

    let footer = html(doc, "div", "zen-container-picker-footer");
    let create = html(doc, "button", "zen-container-picker-action", {
      "data-l10n-id": "zen-container-picker-new",
      "data-icon": "add",
    });
    create.addEventListener("click", () => this.#showEditor(null, 1));
    let manage = html(doc, "button", "zen-container-picker-action", {
      "data-l10n-id": "zen-container-picker-manage",
      "data-icon": "settings",
    });
    manage.addEventListener("click", () => {
      this.close();
      this.#win.openPreferences("paneContainers");
    });
    footer.append(create, manage);

    this.#setView("zen-container-picker-title", [list, footer], direction, {
      back: false,
    });
  }

  #createRow(identity, selected) {
    let doc = this.#doc;
    let { onSelect } = this.#options;
    let id = identity.userContextId;
    let row = html(doc, "div", "zen-container-picker-row", {
      role: "option",
      tabindex: "0",
      "aria-selected": String(selected),
    });

    let main = html(doc, "span", "zen-container-picker-row-main");
    if (id) {
      main.append(createContainerChip(doc, identity));
    } else {
      main.append(
        html(doc, "span", "zen-container-chip zen-container-chip-none")
      );
    }
    let name = html(doc, "span", "zen-container-picker-row-name");
    if (id) {
      name.textContent = this.#service.getUserContextLabel(id);
    } else {
      doc.l10n.setAttributes(name, "zen-container-picker-default");
    }
    main.append(name);
    row.append(main);

    if (selected && onSelect) {
      row.append(html(doc, "span", "zen-container-picker-check"));
    }

    if (id) {
      let actions = html(doc, "span", "zen-container-picker-row-actions");
      let edit = html(doc, "button", "zen-container-picker-icon-button", {
        "data-l10n-id": "zen-container-picker-edit-button",
        "data-icon": "edit",
      });
      edit.addEventListener("click", event => {
        event.stopPropagation();
        this.#showEditor(identity, 1);
      });
      let remove = html(doc, "button", "zen-container-picker-icon-button", {
        "data-l10n-id": "zen-container-picker-delete-button",
        "data-icon": "delete",
      });
      remove.addEventListener("click", event => {
        event.stopPropagation();
        this.#showDelete(identity, 1);
      });
      actions.append(edit, remove);
      row.append(actions);
    }

    let activate = () => {
      if (onSelect) {
        this.#select(id);
        this.close();
      } else if (id) {
        this.#showEditor(identity, 1);
      }
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", event => {
      if (event.target == row && (event.key == "Enter" || event.key == " ")) {
        event.preventDefault();
        activate();
      }
    });
    return row;
  }

  #showEditor(identity, direction) {
    let doc = this.#doc;
    let host = html(doc, "div", "zen-container-picker-editor");
    let editor = new ContainerEditor(host, {
      userContextId: identity?.userContextId ?? null,
      identity: identity
        ? {
            name: this.#service.getUserContextLabel(identity.userContextId),
            icon: identity.icon,
            color: identity.color,
          }
        : null,
    });
    editor.render();
    decorateEditor(editor);

    let footer = html(doc, "div", "zen-container-picker-buttons");
    let save = html(doc, "button", "zen-container-picker-primary", {
      "data-l10n-id": identity
        ? "zen-container-picker-save"
        : "zen-container-picker-create",
    });
    let cancel = html(doc, "button", "zen-container-picker-secondary", {
      "data-l10n-id": "zen-container-picker-cancel",
    });
    footer.append(save, cancel);

    let updateValidity = () => {
      save.disabled = !editor.isValid;
    };
    editor.form.addEventListener("input", updateValidity);
    updateValidity();

    let commit = () => {
      if (!editor.isValid) {
        return;
      }
      let id = saveEditor(editor);
      if (!identity && this.#options.onSelect) {
        // A container created while choosing one is what the user wants.
        this.#select(id);
        this.close();
        return;
      }
      if (this.#options.startView == "create") {
        this.close();
        return;
      }
      this.#showList(-1);
    };
    save.addEventListener("click", commit);
    cancel.addEventListener("click", () => this.#showList(-1));
    editor.form.addEventListener("submit", event => {
      event.preventDefault();
      commit();
    });

    this.#setView(
      identity
        ? "zen-container-picker-edit-title"
        : "zen-container-picker-new-title",
      [host, footer],
      direction,
      { back: this.#options.startView != "create" }
    );
    if (this.#panel.state == "open") {
      // Wait for the text field to render its input before focusing it.
      editor._name.updateComplete.then(() => editor.focus());
    } else {
      this.#panel.addEventListener("popupshown", () => editor.focus(), {
        once: true,
      });
    }
  }

  #showDelete(identity, direction) {
    let doc = this.#doc;
    let id = identity.userContextId;
    let host = html(doc, "div", "zen-container-picker-delete");
    host.append(createContainerChip(doc, identity));
    let message = html(doc, "p", "zen-container-picker-delete-message");
    doc.l10n.setAttributes(message, "zen-container-picker-delete-message", {
      name: this.#service.getUserContextLabel(id),
    });
    let description = html(doc, "p", "zen-container-picker-delete-description");
    doc.l10n.setAttributes(
      description,
      "zen-container-picker-delete-description",
      { tabs: this.#service.countContainerTabs(id) }
    );
    host.append(message, description);

    let footer = html(doc, "div", "zen-container-picker-buttons");
    let confirm = html(doc, "button", "zen-container-picker-danger", {
      "data-l10n-id": "zen-container-picker-delete",
    });
    let cancel = html(doc, "button", "zen-container-picker-secondary", {
      "data-l10n-id": "zen-container-picker-cancel",
    });
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      await deleteContainer(id);
      if (this.#options.selectedId == id) {
        this.#select(0);
      }
      this.#showList(-1);
    });
    cancel.addEventListener("click", () => this.#showList(-1));
    footer.append(confirm, cancel);

    this.#setView(
      "zen-container-picker-delete-title",
      [host, footer],
      direction
    );
  }
}

const pickers = new WeakMap();

export const ZenContainerPicker = {
  open(win, options) {
    win = win.top;
    let picker = pickers.get(win);
    if (!picker) {
      picker = new nsZenContainerPicker(win);
      pickers.set(win, picker);
    }
    picker.open(options);
  },
};
