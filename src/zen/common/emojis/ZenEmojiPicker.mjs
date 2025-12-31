// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from 'chrome://browser/content/zen-components/ZenCommonUtils.mjs';

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

class nsZenEmojiPicker extends nsZenDOMOperatedFeature {
  #panel;

  #anchor;
  #emojiAsSVG = false;

  #currentPromise = null;
  #currentPromiseResolve = null;
  #currentPromiseReject = null;

  init() {
    this.#panel = document.getElementById('PanelUI-zen-emojis-picker');
    this.#panel.addEventListener('popupshowing', this);
    this.#panel.addEventListener('popuphidden', this);
    this.#panel.addEventListener('command', this);
    this.searchInput.addEventListener('input', this);
  }

  handleEvent(event) {
    switch (event.type) {
      case 'popupshowing':
        this.#onPopupShowing(event);
        break;
      case 'popuphidden':
        this.#onPopupHidden(event);
        break;
      case 'command':
        if (event.target.id === 'PanelUI-zen-emojis-picker-none') {
          this.#selectEmoji(null);
        } else if (event.target.id === 'PanelUI-zen-emojis-picker-change-emojis') {
          this.#changePage(false);
        } else if (event.target.id === 'PanelUI-zen-emojis-picker-change-svg') {
          this.#changePage(true);
        }
        break;
      case 'input':
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
      'chrome://browser/content/zen-components/ZenEmojisData.min.mjs',
      lazy
    );
    this._emojis = lazy.ZenEmojisData;
    return this._emojis;
  }

  get emojiList() {
    return document.getElementById('PanelUI-zen-emojis-picker-list');
  }

  get svgList() {
    return document.getElementById('PanelUI-zen-emojis-picker-svgs');
  }

  get searchInput() {
    return document.getElementById('PanelUI-zen-emojis-picker-search');
  }

  #changePage(toSvg = false) {
    const itemToScroll = toSvg
      ? this.svgList
      : document.getElementById('PanelUI-zen-emojis-picker-pages').querySelector('[emojis="true"]');
    itemToScroll.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
    const button = document.getElementById(
      `PanelUI-zen-emojis-picker-change-${toSvg ? 'svg' : 'emojis'}`
    );
    const otherButton = document.getElementById(
      `PanelUI-zen-emojis-picker-change-${toSvg ? 'emojis' : 'svg'}`
    );
    button.classList.add('selected');
    otherButton.classList.remove('selected');
  }

  #clearEmojis() {
    delete this._emojis;
  }

  #onSearchInput(event) {
    const input = event.target;
    const value = input.value.trim().toLowerCase();
    // search for emojis.tags and order by emojis.order
    const filteredEmojis = this.#emojis
      .filter((emoji) => {
        return emoji.tags.some((tag) => tag.toLowerCase().includes(value));
      })
      .sort((a, b) => a.order - b.order);
    for (const button of this.emojiList.children) {
      const buttonEmoji = button.getAttribute('label');
      const emojiObject = filteredEmojis.find((emoji) => emoji.emoji === buttonEmoji);
      if (emojiObject) {
        button.hidden = !emojiObject.tags.some((tag) => tag.toLowerCase().includes(value));
        button.style.order = emojiObject.order;
      } else {
        button.hidden = true;
      }
    }
  }

  // note: It's async on purpose so we can render the popup before processing the emojis
  async #onPopupShowing(event) {
    if (event.target !== this.#panel) return;
    this.searchInput.value = '';
    const allowEmojis = !this.#panel.hasAttribute('only-svg-icons');
    if (allowEmojis) {
      const emojiList = this.emojiList;
      for (const emoji of this.#emojis) {
        const item = document.createXULElement('toolbarbutton');
        item.className = 'toolbarbutton-1 zen-emojis-picker-emoji';
        item.setAttribute('label', emoji.emoji);
        item.setAttribute('tooltiptext', '');
        item.addEventListener('command', () => {
          this.#selectEmoji(emoji.emoji);
        });
        emojiList.appendChild(item);
      }
      setTimeout(() => {
        this.searchInput.focus();
      }, 500);
    }
    const svgList = this.svgList;
    for (const icon of SVG_ICONS) {
      const item = document.createXULElement('toolbarbutton');
      item.className = 'toolbarbutton-1 zen-emojis-picker-svg';
      item.setAttribute('label', icon);
      item.setAttribute('tooltiptext', '');
      item.style.listStyleImage = `url(${this.getSVGURL(icon)})`;
      item.setAttribute('icon', icon);
      item.addEventListener('command', () => {
        this.#selectEmoji(this.getSVGURL(icon));
      });
      svgList.appendChild(item);
    }
  }

  #onPopupHidden(event) {
    if (event.target !== this.#panel) return;
    this.#clearEmojis();

    this.#changePage(false);

    const emojiList = this.emojiList;
    emojiList.innerHTML = '';

    this.svgList.innerHTML = '';

    if (this.#currentPromiseReject) {
      this.#currentPromiseReject(new Error('Emoji picker closed without selection'));
    }

    this.#currentPromise = null;
    this.#currentPromiseResolve = null;
    this.#currentPromiseReject = null;

    this.#anchor.removeAttribute('zen-emoji-open');
    this.#anchor.parentElement.removeAttribute('zen-emoji-open');
    this.#anchor = null;
  }

  #selectEmoji(emoji) {
    if (this.#emojiAsSVG && emoji && !emoji.startsWith('chrome://')) {
      emoji = `data:image/svg+xml;base64,${btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28" x="0">${unescape(
          encodeURIComponent(emoji)
        )}</text></svg>`
      )}`;
    }
    this.#currentPromiseResolve?.(emoji);
    this.#panel.hidePopup();
  }

  open(anchor, { onlySvgIcons = false, emojiAsSVG = false } = {}) {
    if (this.#currentPromise) {
      return null;
    }
    this.#emojiAsSVG = emojiAsSVG;
    this.#currentPromise = new Promise((resolve, reject) => {
      this.#currentPromiseResolve = resolve;
      this.#currentPromiseReject = reject;
    });
    this.#anchor = anchor;
    this.#anchor.setAttribute('zen-emoji-open', 'true');
    this.#anchor.parentElement.setAttribute('zen-emoji-open', 'true');
    if (onlySvgIcons) {
      this.#panel.setAttribute('only-svg-icons', 'true');
    } else {
      this.#panel.removeAttribute('only-svg-icons');
    }
    this.#panel.openPopup(anchor, 'after_start', 0, 0, false, false);
    return this.#currentPromise;
  }

  getSVGURL(icon) {
    return `chrome://browser/skin/zen-icons/selectable/${icon}`;
  }
}

window.gZenEmojiPicker = new nsZenEmojiPicker();
