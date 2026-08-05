// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

// prettier-ignore
const SVG_ICONS = [
  "airplane.svg", "american-football.svg", "baseball.svg", "basket.svg",
  "bed.svg", "bell.svg", "bookmark.svg", "book.svg",
  "briefcase.svg", "brush.svg", "bug.svg", "build.svg",
  "cafe.svg", "call.svg", "card.svg", "chat.svg",
  "checkbox.svg", "circle.svg", "cloud.svg", "code.svg",
  "coins.svg", "construct.svg", "cutlery.svg", "egg.svg",
  "extension-puzzle.svg", "eye.svg", "fast-food.svg", "fish.svg",
  "flag.svg", "flame.svg", "flask.svg", "folder.svg",
  "game-controller.svg", "globe-1.svg", "globe.svg", "grid-2x2.svg",
  "grid-3x3.svg", "heart.svg", "ice-cream.svg", "image.svg",
  "inbox.svg", "key.svg", "layers.svg", "leaf.svg",
  "lightning.svg", "location.svg", "lock-closed.svg", "logo-rss.svg",
  "logo-usd.svg", "mail.svg", "map.svg", "megaphone.svg",
  "moon.svg", "music.svg", "navigate.svg", "nuclear.svg",
  "page.svg", "palette.svg", "paw.svg", "people.svg",
  "pizza.svg", "planet.svg", "present.svg", "rocket.svg",
  "school.svg", "shapes.svg", "shirt.svg", "skull.svg",
  "squares.svg", "square.svg", "star-1.svg", "star.svg",
  "stats-chart.svg", "sun.svg", "tada.svg", "terminal.svg",
  "ticket.svg", "time.svg", "trash.svg", "triangle.svg",
  "video.svg", "volume-high.svg", "wallet.svg", "warning.svg",
  "water.svg", "weight.svg",
];

// Custom icons are stored inline as data URLs on the object that owns them
// (e.g. a space), which is persisted to the session store, so they have to stay
// small. Raster images are re-encoded down to this size; 192px still covers a
// 32px icon on a 4x display while keeping the encoded result at a few KB.
const CUSTOM_ICON_MAX_DIMENSION = 192;

// Refused before we try to decode, so a mistakenly picked huge file can't stall
// the browser.
const CUSTOM_ICON_MAX_FILE_SIZE = 10 * 1024 * 1024;

class nsZenEmojiPicker extends nsZenDOMOperatedFeature {
  #panel;

  #anchor;
  #emojiAsSVG = false;
  #closeOnSelect = true;
  #onSelect = null;
  #hasSelection = false;
  #lastSelectedEmoji = null;
  #allowCustomImage = false;

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

  /**
   * Whether an icon value is meant to be rendered as an image rather than as
   * text. Covers both the bundled `chrome://` SVGs and the data URLs produced
   * for custom images and for emojis rasterized via `emojiAsSVG`.
   *
   * @param {string} [icon] The stored icon value.
   * @returns {boolean} True when the icon should be rendered as an image.
   */
  isImageIcon(icon) {
    return (
      typeof icon === "string" &&
      (icon.endsWith(".svg") || icon.startsWith("data:image/"))
    );
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
          this.#changePage("emojis");
        } else if (event.target.id === "PanelUI-zen-emojis-picker-change-svg") {
          this.#changePage("svg");
        } else if (
          event.target.id === "PanelUI-zen-emojis-picker-change-custom"
        ) {
          this.#changePage("custom");
        } else if (
          event.target.id === "PanelUI-zen-emojis-picker-custom-choose"
        ) {
          this.#pickCustomImage();
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

  get customPreview() {
    return document.getElementById("PanelUI-zen-emojis-picker-custom-preview");
  }

  #changePage(page = "emojis", { animate = true } = {}) {
    const pages = document.getElementById("PanelUI-zen-emojis-picker-pages");
    const itemToScroll = pages.querySelector(`[page="${page}"]`);
    if (animate) {
      itemToScroll.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
    } else {
      pages.scrollLeft = itemToScroll.offsetLeft;
    }
    for (const button of document.getElementById(
      "PanelUI-zen-emojis-buttons-wrapper"
    ).children) {
      button.classList.toggle(
        "selected",
        button.id === `PanelUI-zen-emojis-picker-change-${page}`
      );
    }
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
    const input = event.target;
    const value = input.value.trim().toLowerCase();
    // search for emojis.tags and order by emojis.order
    const filteredEmojis = this.#emojis
      .filter(emoji => {
        return emoji.tags.some(tag => tag.toLowerCase().includes(value));
      })
      .sort((a, b) => a.order - b.order);
    for (const button of this.emojiList.children) {
      const buttonEmoji = button.getAttribute("label");
      const emojiObject = filteredEmojis.find(
        emoji => emoji.emoji === buttonEmoji
      );
      if (emojiObject) {
        button.hidden = !emojiObject.tags.some(tag =>
          tag.toLowerCase().includes(value)
        );
        button.style.order = emojiObject.order;
      } else {
        button.hidden = true;
      }
    }
  }

  // note: It's async on purpose so we can render the popup before processing the emojis
  async #onPopupShowing(event) {
    if (event.target !== this.#panel) {
      return;
    }
    this.searchInput.value = "";
    const allowEmojis = !this.#panel.hasAttribute("only-svg-icons");
    if (allowEmojis) {
      const emojiList = this.emojiList;
      for (const emoji of this.#emojis) {
        const item = document.createXULElement("toolbarbutton");
        item.className = "toolbarbutton-1 zen-emojis-picker-emoji";
        item.setAttribute("label", emoji.emoji);
        item.setAttribute("tooltiptext", "");
        item.addEventListener("command", () => {
          this.#selectEmoji(emoji.emoji);
        });
        emojiList.appendChild(item);
      }
    }
    const svgList = this.svgList;
    for (const icon of SVG_ICONS) {
      const item = document.createXULElement("toolbarbutton");
      item.className = "toolbarbutton-1 zen-emojis-picker-svg";
      item.setAttribute("label", icon);
      item.setAttribute("tooltiptext", "");
      item.style.listStyleImage = `url(${this.getSVGURL(icon)})`;
      item.setAttribute("icon", icon);
      item.addEventListener("command", () => {
        this.#selectEmoji(this.getSVGURL(icon));
      });
      svgList.appendChild(item);
    }
  }

  #onPopupShown(event) {
    if (event.target !== this.#panel) {
      return;
    }
    const allowEmojis = !this.#panel.hasAttribute("only-svg-icons");
    if (allowEmojis) {
      this.searchInput.focus({ preventScroll: true });
    }
    this.#changePage(allowEmojis ? "emojis" : "svg", { animate: false });
  }

  #onPopupHidden(event) {
    if (event.target !== this.#panel) {
      return;
    }
    this.#clearEmojis();

    const emojiList = this.emojiList;
    emojiList.innerHTML = "";

    this.svgList.innerHTML = "";
    this.customPreview.removeAttribute("src");
    this.customPreview.hidden = true;

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
    this.#allowCustomImage = false;

    this.#anchor.removeAttribute("zen-emoji-open");
    this.#anchor.parentElement.removeAttribute("zen-emoji-open");
    this.#anchor = null;
  }

  /**
   * Prompts for an image file and turns it into a data URL usable as an icon.
   * Kept inline (rather than copied into the profile) so that an icon travels
   * with the object that owns it, including across synced devices.
   */
  async #pickCustomImage() {
    if (!this.#allowCustomImage) {
      return;
    }

    // A modal file dialog takes focus and dismisses the panel on some
    // platforms, so hold on to the callbacks and report the result directly
    // instead of going back through #selectEmoji, whose state may already have
    // been torn down by then.
    const onSelect = this.#onSelect;
    const resolveSelection = this.#currentPromiseResolve;
    const closeOnSelect = this.#closeOnSelect;

    // Keeps #onPopupHidden from rejecting the pending promise if the panel goes
    // away while the dialog is up.
    this.#hasSelection = true;

    const path = await this.#promptForImageFile();
    if (!path) {
      return;
    }

    let icon;
    try {
      icon = await this.#encodeCustomImage(path);
    } catch (error) {
      console.error("Failed to import a custom icon:", error);
      gZenUIManager.showToast("zen-icons-picker-custom-failed");
      return;
    }
    if (!icon) {
      return;
    }

    if (this.#panel.state === "open") {
      this.customPreview.src = icon;
      this.customPreview.hidden = false;
    }
    this.#lastSelectedEmoji = icon;
    this.#setAllowNone(true);
    onSelect?.(icon);
    resolveSelection?.(icon);
    if (closeOnSelect) {
      this.#panel.hidePopup();
    }
  }

  /**
   * @returns {Promise<string|null>} Path of the picked file, or null if the
   *   dialog was dismissed.
   */
  async #promptForImageFile() {
    const filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(
      Ci.nsIFilePicker
    );
    filePicker.init(
      window.browsingContext,
      await document.l10n.formatValue("zen-icons-picker-custom-title"),
      Ci.nsIFilePicker.modeOpen
    );
    filePicker.appendFilters(Ci.nsIFilePicker.filterImages);

    const result = await new Promise(resolve => filePicker.open(resolve));
    if (result !== Ci.nsIFilePicker.returnOK || !filePicker.file) {
      return null;
    }
    return filePicker.file.path;
  }

  /**
   * @param {string} path Absolute path of the image the user picked.
   * @returns {Promise<string|null>} A data URL, or null if the file was rejected.
   */
  async #encodeCustomImage(path) {
    const { size } = await IOUtils.stat(path);
    if (size > CUSTOM_ICON_MAX_FILE_SIZE) {
      gZenUIManager.showToast("zen-icons-picker-custom-too-large", {
        l10nArgs: { limit: CUSTOM_ICON_MAX_FILE_SIZE / (1024 * 1024) },
      });
      return null;
    }

    const bytes = await IOUtils.read(path);

    // SVGs are kept as-is so they stay sharp at any size. Rendering happens in
    // an <img>, which does not run scripts or load external references, so an
    // untrusted document is inert here.
    if (path.toLowerCase().endsWith(".svg")) {
      return this.#blobToDataURL(new Blob([bytes], { type: "image/svg+xml" }));
    }

    // Throws for anything that is not a decodable image, which is also how we
    // reject files that merely have an image extension.
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const scale = Math.min(
      1,
      CUSTOM_ICON_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // WebP keeps transparency and stays far smaller than PNG for photos. If the
    // encoder does not support it, it falls back to PNG on its own.
    return this.#blobToDataURL(
      await canvas.convertToBlob({ type: "image/webp", quality: 0.9 })
    );
  }

  #blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  #selectEmoji(emoji) {
    if (this.#emojiAsSVG && emoji && !this.isImageIcon(emoji)) {
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
      allowCustomImage = false,
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
    this.#allowCustomImage = allowCustomImage;
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
    if (this.#allowCustomImage) {
      this.#panel.setAttribute("allow-custom-image", "true");
    } else {
      this.#panel.removeAttribute("allow-custom-image");
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
