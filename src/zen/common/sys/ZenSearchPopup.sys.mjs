/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Generic searchable XUL <panel> driver. One instance owns one panel +
 * its search input + list + (optional) no-results element, and exposes
 * `populate(items)` and `open(anchor, options)`.
 *
 * Each item passed to `populate` is `{ label, render?, onPick }`:
 *   - label: string used for the data-label search filter.
 *   - render: optional () => Element factory. If omitted a bare hbox
 *     with a <label> is created.
 *   - onPick: callback invoked when the item is clicked or activated
 *     via Enter on the keyboard.
 *
 * The driver handles:
 *   - filtering by lowercased substring match against data-label;
 *   - arrow-key / Tab navigation with [selected="true"] highlight;
 *   - Enter to activate the highlighted item;
 *   - autofocus of the search input on popupshown;
 *   - cleanup of all listeners on popuphidden.
 */
export class ZenSearchPopup {
  #panel = null;
  #searchInput = null;
  #list = null;
  #noResults = null;
  #itemSelector = ".zen-search-popup-item";
  #items = [];

  /**
   * @param {object} aOptions
   * @param {Element} aOptions.panel        The <panel> XUL element.
   * @param {Element} aOptions.searchInput  The search <html:input>.
   * @param {Element} aOptions.list         The container holding items.
   * @param {Element} [aOptions.noResults]  Optional "no results" element.
   * @param {string}  [aOptions.itemSelector] Per-item selector. Default
   *   is `.zen-search-popup-item`; custom items must carry that class
   *   or override this option.
   */
  constructor({ panel, searchInput, list, noResults, itemSelector }) {
    this.#panel = panel;
    this.#searchInput = searchInput;
    this.#list = list;
    this.#noResults = noResults;
    if (itemSelector) this.#itemSelector = itemSelector;
  }

  populate(items) {
    this.#items = items;
    this.#list.innerHTML = "";
    const doc = this.#panel.ownerDocument;
    for (const item of items) {
      let node;
      if (typeof item.render === "function") {
        node = item.render();
      } else {
        node = doc.createXULElement("hbox");
        const label = doc.createXULElement("label");
        label.setAttribute("value", item.label);
        node.appendChild(label);
      }
      node.classList.add(this.#itemSelector.replace(/^\./, ""));
      node.setAttribute("data-label", item.label);
      node.addEventListener("click", () => {
        this.#panel.hidePopup();
        item.onPick?.(item);
      });
      this.#list.appendChild(node);
    }
  }

  open(anchor, { position = "after_end", onShown, onHidden } = {}) {
    if (!this.#panel || !this.#list) return;

    this.#panel.hidden = false;

    if (this.#searchInput) this.#searchInput.value = "";
    if (this.#noResults) this.#noResults.hidden = true;

    const doc = this.#panel.ownerDocument;
    const sel = this.#itemSelector;

    const onSearch = () => {
      const query = (this.#searchInput?.value || "").toLowerCase();
      let visible = 0;
      for (const item of this.#list.querySelectorAll(sel)) {
        const label = item.getAttribute("data-label")?.toLowerCase() || "";
        const found = label.includes(query);
        item.hidden = !found;
        if (found) visible++;
      }
      if (this.#noResults) this.#noResults.hidden = visible > 0;
    };
    if (this.#searchInput) {
      this.#searchInput.addEventListener("input", onSearch);
    }

    const onKeyDown = event => {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Tab"
      ) {
        event.preventDefault();
        const isUp =
          event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
        const items = Array.from(this.#list.querySelectorAll(sel)).filter(
          it => !it.hidden
        );
        if (!items.length) return;
        let index = items.indexOf(
          this.#list.querySelector(`${sel}[selected="true"]`)
        );
        index = isUp
          ? (index - 1 + items.length) % items.length
          : (index + 1) % items.length;
        items.forEach(it => it.removeAttribute("selected"));
        const target = items[index];
        target.setAttribute("selected", "true");
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (event.key === "Enter") {
        const sel2 = this.#list.querySelector(`${sel}[selected="true"]`);
        if (sel2) sel2.click();
      }
    };
    doc.addEventListener("keydown", onKeyDown);

    const onPanelShown = event => {
      if (event.target !== this.#panel) return;
      this.#searchInput?.focus();
      this.#searchInput?.select?.();
      onShown?.();
    };
    this.#panel.addEventListener("popupshown", onPanelShown);

    const onPanelHidden = event => {
      if (event.target !== this.#panel) return;
      if (this.#searchInput) {
        this.#searchInput.removeEventListener("input", onSearch);
      }
      doc.removeEventListener("keydown", onKeyDown);
      this.#panel.removeEventListener("popupshown", onPanelShown);
      this.#panel.removeEventListener("popuphidden", onPanelHidden);
      onHidden?.();
    };
    this.#panel.addEventListener("popuphidden", onPanelHidden);

    this.#panel.openPopup(anchor, position);
  }
}
