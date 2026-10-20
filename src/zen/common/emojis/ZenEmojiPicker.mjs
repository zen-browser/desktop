// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

import SelectableIcons from "chrome://browser/content/zen-components/SelectableIcons.mjs";

function title(name) {
  return name
    .split("-")
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

const SVG_ICONS = Object.entries(SelectableIcons).map(([name, tags]) => ({
  file: `${name}.svg`,
  name: title(name),
  tags,
}));

class nsZenEmojiPicker extends nsZenDOMOperatedFeature {
  #panel;

  #anchor;
  #searchTerms = new WeakMap();
  #emojiAsSVG = false;
  #closeOnSelect = true;
  #onSelect = null;
  #hasSelection = false;
  #lastSelectedEmoji = null;

  #currentPromise = null;
  #currentPromiseResolve = null;
  #currentPromiseReject = null;

  init() {
    this.#panel = document.getElementById("PanelUI-zen-emojis-picker");
    this.#panel.addEventListener("popupshowing", this);
    this.#panel.addEventListener("popupshown", this);
    this.#panel.addEventListener("popuphidden", this);
    this.#panel.addEventListener("command", this);
    this.searchInput.addEventListener("input", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "popupshowing":
        this.#onPopupShowing(event);
        break;
      case "popupshown":
        this.#onPopupShown(event);
        break;
      case "popuphidden":
        this.#onPopupHidden(event);
        break;
      case "command":
        if (event.target.id === "PanelUI-zen-emojis-picker-none") {
          this.#selectEmoji(null);
        } else if (
          event.target.id === "PanelUI-zen-emojis-picker-change-emojis"
        ) {
          this.#changePage(false);
        } else if (event.target.id === "PanelUI-zen-emojis-picker-change-svg") {
          this.#changePage(true);
        } else if (event.target.classList.contains("zen-emojis-picker-emoji")) {
          this.#selectEmoji(event.target.getAttribute("label"));
        } else if (event.target.classList.contains("zen-emojis-picker-svg")) {
          this.#selectEmoji(this.getSVGURL(event.target.getAttribute("icon")));
        }
        break;
      case "input":
        this.#onSearchInput(event);
        break;
    }
  }

  get #emojis() {
    if (this._emojis) {
      return this._emojis;
    }
    const lazy = {};
    Services.scriptloader.loadSubScript(
      "chrome://browser/content/zen-components/ZenEmojisData.min.mjs",
      lazy
    );
    /* eslint-disable mozilla/valid-lazy */
    this._emojis = lazy.ZenEmojisData;
    return this._emojis;
  }

  get emojiList() {
    return document.getElementById("PanelUI-zen-emojis-picker-list");
  }

  get svgList() {
    return document.getElementById("PanelUI-zen-emojis-picker-svgs");
  }

  get searchInput() {
    return document.getElementById("PanelUI-zen-emojis-picker-search");
  }

  #changePage(toSvg = false, { animate = true } = {}) {
    const pages = document.getElementById("PanelUI-zen-emojis-picker-pages");
    const itemToScroll = toSvg
      ? this.svgList
      : pages.querySelector('[emojis="true"]');
    if (animate) {
      itemToScroll.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
    } else {
      pages.scrollLeft = toSvg ? itemToScroll.offsetLeft : 0;
    }
    const button = document.getElementById(
      `PanelUI-zen-emojis-picker-change-${toSvg ? "svg" : "emojis"}`
    );
    const otherButton = document.getElementById(
      `PanelUI-zen-emojis-picker-change-${toSvg ? "emojis" : "svg"}`
    );
    button.classList.add("selected");
    otherButton.classList.remove("selected");
    document.l10n.setAttributes(
      this.searchInput,
      toSvg ? "zen-icons-picker-search" : "zen-emojis-picker-search"
    );
    this.searchInput.focus({ preventScroll: true });
  }

  #clearEmojis() {
    delete this._emojis;
  }

  #setAllowNone(allowNone) {
    if (allowNone) {
      this.#panel.removeAttribute("hide-none-option");
      return;
    }
    this.#panel.setAttribute("hide-none-option", "true");
  }

  #onSearchInput(event) {
    const terms = event.target.value.trim().toLowerCase().split(/\s+/);
    for (const list of [this.emojiList, this.svgList]) {
      for (const button of list.children) {
        const keywords = this.#searchTerms.get(button);
        button.hidden = !terms.every(term => keywords.includes(term));
      }
      list.scrollTop = 0;
    }
  }

  #onPopupShowing(event) {
    if (event.target !== this.#panel) {
      return;
    }
    this.searchInput.value = "";
    this.#searchTerms = new WeakMap();
    const allowEmojis = !this.#panel.hasAttribute("only-svg-icons");
    if (allowEmojis) {
      const emojis = document.createDocumentFragment();
      for (const emoji of this.#emojis) {
        const item = document.createXULElement("toolbarbutton");
        item.className = "toolbarbutton-1 zen-emojis-picker-emoji";
        item.setAttribute("label", emoji.emoji);
        item.setAttribute("tooltiptext", "");
        item.style.order = emoji.order;
        this.#searchTerms.set(
          item,
          [emoji.emoji, ...emoji.tags].join(" ").toLowerCase()
        );
        emojis.appendChild(item);
      }
      this.emojiList.replaceChildren(emojis);
    }
    const icons = document.createDocumentFragment();
    for (const icon of SVG_ICONS) {
      const item = document.createXULElement("toolbarbutton");
      item.className = "toolbarbutton-1 zen-emojis-picker-svg";
      item.setAttribute("label", icon.name);
      item.setAttribute("tooltiptext", icon.name);
      item.style.listStyleImage = `url(${this.getSVGURL(icon.file)})`;
      item.setAttribute("icon", icon.file);
      this.#searchTerms.set(
        item,
        [icon.name, ...icon.tags].join(" ").toLowerCase()
      );
      icons.appendChild(item);
    }
    this.svgList.replaceChildren(icons);
  }

  #onPopupShown(event) {
    if (event.target !== this.#panel) {
      return;
    }
    this.#changePage(this.#panel.hasAttribute("only-svg-icons"), {
      animate: false,
    });
  }

  #onPopupHidden(event) {
    if (event.target !== this.#panel) {
      return;
    }
    this.#clearEmojis();
    this.#searchTerms = new WeakMap();

    this.emojiList.replaceChildren();
    this.svgList.replaceChildren();

    if (!this.#hasSelection) {
      this.#currentPromiseReject?.(
        new Error("Emoji picker closed without selection")
      );
    } else if (!this.#closeOnSelect) {
      this.#currentPromiseResolve?.(this.#lastSelectedEmoji);
    }

    this.#currentPromise = null;
    this.#currentPromiseResolve = null;
    this.#currentPromiseReject = null;
    this.#onSelect = null;
    this.#closeOnSelect = true;
    this.#hasSelection = false;
    this.#lastSelectedEmoji = null;

    this.#anchor.removeAttribute("zen-emoji-open");
    this.#anchor.parentElement.removeAttribute("zen-emoji-open");
    this.#anchor = null;
  }

  #selectEmoji(emoji) {
    if (this.#emojiAsSVG && emoji && !emoji.startsWith("chrome://")) {
      emoji = `data:image/svg+xml;base64,${btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28" x="0">${unescape(
          encodeURIComponent(emoji)
        )}</text></svg>`
      )}`;
    }
    this.#setAllowNone(Boolean(emoji));
    this.#hasSelection = true;
    this.#lastSelectedEmoji = emoji;
    this.#onSelect?.(emoji);
    if (!this.#closeOnSelect) {
      return;
    }
    this.#currentPromiseResolve?.(emoji);
    this.#panel.hidePopup();
  }

  open(
    anchor,
    {
      onlySvgIcons = false,
      emojiAsSVG = false,
      allowNone = true,
      closeOnSelect = true,
      onSelect = null,
    } = {}
  ) {
    if (this.#currentPromise) {
      return null;
    }
    this.#emojiAsSVG = emojiAsSVG;
    this.#closeOnSelect = closeOnSelect;
    this.#onSelect = onSelect;
    this.#hasSelection = false;
    this.#lastSelectedEmoji = null;
    this.#currentPromise = new Promise((resolve, reject) => {
      this.#currentPromiseResolve = resolve;
      this.#currentPromiseReject = reject;
    });
    this.#anchor = anchor;
    this.#anchor.setAttribute("zen-emoji-open", "true");
    this.#anchor.parentElement.setAttribute("zen-emoji-open", "true");
    if (onlySvgIcons) {
      this.#panel.setAttribute("only-svg-icons", "true");
    } else {
      this.#panel.removeAttribute("only-svg-icons");
    }
    this.#setAllowNone(allowNone);
    this.#panel.openPopup(anchor, "after_start", 0, 0, false, false);
    return this.#currentPromise;
  }

  getSVGURL(icon) {
    return `chrome://browser/skin/zen-icons/selectable/${icon}`;
  }
}

window.gZenEmojiPicker = new nsZenEmojiPicker();
