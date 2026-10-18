/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const TAB_ORDER_PREF = "zen.library.tab-order";
const EDIT_ICON = "chrome://browser/skin/zen-icons/arrow-down.svg";
const SAVE_ICON = "chrome://browser/skin/zen-icons/arrow-up.svg";

/**
 * Whatever was saved comes first, as far as this window has those sections,
 * and the rest follow in their default order, so a section added since still
 * shows up.
 *
 * @param {string} saved - The section ids the order pref holds, comma separated
 * @param {string[]} available - The ids of this window's sections, by default
 * @returns {string[]} Every available id, once
 */
function resolveSectionOrder(saved, available) {
  const order = saved
    .split(",")
    .map(id => id.trim())
    .filter(id => available.includes(id));
  return [...new Set([...order, ...available])];
}

export class ZenLibrarySidebarEdit {
  #host;
  // The order being worked on, or null while the sidebar is not edited.
  #draft = null;
  #list = null;
  #tab = null;
  #tabs = [];
  #pointerId = -1;
  #dragIndex = -1;
  #dropIndex = -1;
  #startY = 0;
  #dragCenterY = 0;
  #slotCenters = [];
  #slotTops = [];
  #slot = null;
  // Between a drop and the list standing in its new order, when the buttons
  // still carry the styles of the drag.
  #settling = false;

  constructor(host) {
    this.#host = host;
  }

  get editing() {
    return this.#draft !== null;
  }

  /**
   * @returns {string[]} The section ids in the order the sidebar shows them
   */
  get order() {
    return this.#draft ?? this.#savedOrder;
  }

  get footerButton() {
    return {
      id: "zen-library-edit-button",
      image: EDIT_ICON,
      l10nId: "library-footer-edit-button",
      command: () => this.toggle(),
    };
  }

  get #savedOrder() {
    return resolveSectionOrder(
      Services.prefs.getStringPref(TAB_ORDER_PREF, ""),
      Object.keys(this.#host.zenLibrarySections)
    );
  }

  toggle() {
    if (!this.editing) {
      this.#setDraft(this.#savedOrder);
      return;
    }
    const order = this.#draft;
    if (order.join() !== this.#savedOrder.join()) {
      Services.prefs.setStringPref(TAB_ORDER_PREF, order.join(","));
    }
    this.#setDraft(null);
  }

  /**
   * Leaves editing without keeping the order, which is what closing the
   * library does whether or not it was being edited.
   */
  discard() {
    if (this.editing) {
      this.#cancelDrag();
      this.#setDraft(null);
    }
  }

  /**
   * Escape backs out of a drag, then out of editing, before it closes the
   * library.
   *
   * @param {KeyboardEvent} event
   * @returns {boolean} Whether the key was used up
   */
  onEscape(event) {
    if (!this.editing || document.activeElement?.matches?.("input, textarea")) {
      return false;
    }
    if (!this.#cancelDrag()) {
      this.discard();
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  #setDraft(order) {
    const editing = order !== null;
    this.#draft = order;
    this.#host.requestUpdate();
    this.#host.toggleAttribute("editing", editing);
    const button = this.#host.querySelector("#zen-library-edit-button");
    button?.setAttribute("image", editing ? SAVE_ICON : EDIT_ICON);
    button?.setAttribute(
      "data-l10n-id",
      editing ? "library-footer-save-button" : "library-footer-edit-button"
    );
  }

  onPointerDown(event) {
    const tab = event.target.closest?.(".zen-library-tab");
    if (
      !this.editing ||
      !tab ||
      event.button !== 0 ||
      this.#dragIndex !== -1 ||
      this.#settling
    ) {
      return;
    }
    const list = event.currentTarget;
    const tabs = [...list.querySelectorAll(".zen-library-tab")];
    const index = tabs.indexOf(tab);
    if (tabs.length < 2) {
      return;
    }
    // Nothing has changed yet, so this throwing leaves nothing to undo.
    tab.setPointerCapture(event.pointerId);

    const rects = tabs.map(item =>
      window.windowUtils.getBoundsWithoutFlushing(item)
    );
    const rect = rects[index];
    // Passing a button moves each of the others by the room this one takes,
    // whatever their own heights are.
    const spacing = rects[1].top - rects[0].bottom;

    this.#list = list;
    this.#tab = tab;
    this.#tabs = tabs;
    this.#pointerId = event.pointerId;
    this.#dragIndex = index;
    this.#dropIndex = index;
    this.#startY = event.clientY;
    this.#dragCenterY = rect.top + rect.height / 2;
    const others = rects.filter((other, i) => i !== index);
    this.#slotCenters = others.map(other => other.top + other.height / 2);

    // Where the button would land for each place it can be dropped.
    const listRect = window.windowUtils.getBoundsWithoutFlushing(list);
    let top = rects[0].top - listRect.top;
    this.#slotTops = [top];
    for (const other of others) {
      top += other.height + spacing;
      this.#slotTops.push(top);
    }

    const slot = document.createElement("div");
    slot.className = "zen-library-drop-slot";
    slot.setAttribute("aria-hidden", "true");
    slot.style.left = `${rect.left - listRect.left}px`;
    slot.style.width = `${rect.width}px`;
    slot.style.height = `${rect.height}px`;
    slot.style.translate = `0 ${this.#slotTops[index]}px`;
    list.append(slot);
    this.#slot = slot;

    list.style.setProperty(
      "--zen-library-tab-shift",
      `${rect.height + spacing}px`
    );
    tab.setAttribute("dragging", "true");
    event.preventDefault();
  }

  onPointerMove(event) {
    if (this.#dragIndex === -1 || event.pointerId !== this.#pointerId) {
      return;
    }
    const offset = event.clientY - this.#startY;
    this.#tab.style.translate = `0 ${offset}px`;

    const centerY = this.#dragCenterY + offset;
    const index = this.#slotCenters.filter(center => centerY > center).length;
    if (index !== this.#dropIndex) {
      this.#dropIndex = index;
      this.#slot.style.translate = `0 ${this.#slotTops[index]}px`;
      this.#shiftTabs();
    }
  }

  onPointerUp(event) {
    if (this.#dragIndex === -1 || event.pointerId !== this.#pointerId) {
      return;
    }
    this.#end(event.type === "pointerup");
  }

  /**
   * Puts a dragged button back where it was.
   *
   * @returns {boolean} Whether there was a drag to cancel
   */
  #cancelDrag() {
    if (this.#dragIndex === -1) {
      return false;
    }
    this.#end(false);
    return true;
  }

  #shiftTabs() {
    this.#tabs.forEach((tab, i) => {
      let shift = "";
      if (this.#dragIndex < i && i <= this.#dropIndex) {
        shift = "up";
      } else if (this.#dropIndex <= i && i < this.#dragIndex) {
        shift = "down";
      }
      if (shift) {
        tab.setAttribute("shift", shift);
      } else {
        tab.removeAttribute("shift");
      }
    });
  }

  /**
   * @param {boolean} drop - Whether to keep where the button was dropped, or
   *   have it and the buttons it moved glide back
   */
  #end(drop) {
    const tab = this.#tab;
    const tabs = this.#tabs;
    const list = this.#list;
    const dragIndex = this.#dragIndex;
    const dropIndex = this.#dropIndex;
    const pointerId = this.#pointerId;
    this.#slot.remove();
    this.#reset();
    if (tab.hasPointerCapture(pointerId)) {
      tab.releasePointerCapture(pointerId);
    }

    if (!drop || dropIndex === dragIndex) {
      this.#clearStyles(tabs, list);
      return;
    }

    // The buttons already stand where they will be, so none of them slides.
    list.setAttribute("no-transition", "true");
    const order = tabs.map(item => item.dataset.section);
    order.splice(dropIndex, 0, ...order.splice(dragIndex, 1));
    this.#draft = order;
    this.#host.requestUpdate();
    this.#settle(tabs, list).catch(console.error);
  }

  /**
   * Waits for the list to stand in its new order, then lets go of what the
   * drag put on the buttons.
   *
   * @param {Element[]} tabs - The buttons the drag moved
   * @param {Element} list - The list they are in
   */
  async #settle(tabs, list) {
    this.#settling = true;
    try {
      await this.#host.updateComplete;
      this.#clearStyles(tabs, list);
      await new Promise(resolve => requestAnimationFrame(resolve));
    } finally {
      this.#settling = false;
      list.removeAttribute("no-transition");
    }
  }

  #reset() {
    this.#list = null;
    this.#tab = null;
    this.#tabs = [];
    this.#pointerId = -1;
    this.#dragIndex = -1;
    this.#dropIndex = -1;
    this.#slotCenters = [];
    this.#slotTops = [];
    this.#slot = null;
  }

  #clearStyles(tabs, list) {
    for (const tab of tabs) {
      tab.removeAttribute("dragging");
      tab.removeAttribute("shift");
      tab.style.translate = "";
    }
    list.style.removeProperty("--zen-library-tab-shift");
  }
}
