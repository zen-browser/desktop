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

// Icon colors for SVG icons
const ICON_COLORS = [
  { name: 'default', value: null },
  { name: 'red', value: '#ef4444' },
  { name: 'orange', value: '#f97316' },
  { name: 'amber', value: '#f59e0b' },
  { name: 'yellow', value: '#eab308' },
  { name: 'lime', value: '#84cc16' },
  { name: 'green', value: '#22c55e' },
  { name: 'teal', value: '#14b8a6' },
  { name: 'cyan', value: '#06b6d4' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'indigo', value: '#6366f1' },
  { name: 'purple', value: '#a855f7' },
  { name: 'pink', value: '#ec4899' },
];

class nsZenEmojiPicker extends nsZenDOMOperatedFeature {
  #panel;

  #anchor;

  #currentPromise = null;
  #currentPromiseResolve = null;
  #currentPromiseReject = null;

  #selectedColor = null;
  #initialColor = null;

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

  get colorList() {
    return document.getElementById('PanelUI-zen-emojis-picker-colors');
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

  #createColorButtons() {
    const colorList = this.colorList;
    colorList.innerHTML = '';

    for (const color of ICON_COLORS) {
      const item = document.createElement('div');
      item.className = 'zen-emojis-picker-color';
      item.setAttribute('data-color', color.value || 'default');
      item.setAttribute('title', color.name);

      if (color.value) {
        item.style.backgroundColor = color.value;
      } else {
        // Default color - use a gradient to indicate "no color"
        item.style.background = 'linear-gradient(135deg, #888 50%, #ccc 50%)';
      }

      // Mark initially selected color
      if (this.#selectedColor === color.value) {
        item.setAttribute('selected', 'true');
      }

      item.addEventListener('click', () => {
        this.#selectColor(color.value);
      });

      colorList.appendChild(item);
    }
  }

  #selectColor(color) {
    this.#selectedColor = color;
    // Update UI to show selected color
    const colorButtons = this.colorList.querySelectorAll('.zen-emojis-picker-color');
    for (const btn of colorButtons) {
      const btnColor = btn.getAttribute('data-color');
      if ((btnColor === 'default' && color === null) || btnColor === color) {
        btn.setAttribute('selected', 'true');
      } else {
        btn.removeAttribute('selected');
      }
    }

    // Update SVG icons preview with the selected color
    this.#updateSvgIconsColor();
  }

  #updateSvgIconsColor() {
    const svgButtons = this.svgList.querySelectorAll('.zen-emojis-picker-svg');
    for (const btn of svgButtons) {
      if (this.#selectedColor) {
        btn.style.setProperty('--zen-icon-color', this.#selectedColor);
        btn.setAttribute('has-color', 'true');
      } else {
        btn.style.removeProperty('--zen-icon-color');
        btn.removeAttribute('has-color');
      }
    }
  }

  // note: It's async on purpose so we can render the popup before processing the emojis
  async #onPopupShowing(event) {
    if (event.target !== this.#panel) return;
    this.searchInput.value = '';

    // Initialize selected color
    this.#selectedColor = this.#initialColor;

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

    // Create color buttons
    this.#createColorButtons();

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

    // Apply initial color to SVG icons
    this.#updateSvgIconsColor();
  }

  #onPopupHidden(event) {
    if (event.target !== this.#panel) return;
    this.#clearEmojis();

    this.#changePage(false);

    const emojiList = this.emojiList;
    emojiList.innerHTML = '';

    this.svgList.innerHTML = '';
    this.colorList.innerHTML = '';

    if (this.#currentPromiseReject) {
      this.#currentPromiseReject(new Error('Emoji picker closed without selection'));
    }

    this.#currentPromise = null;
    this.#currentPromiseResolve = null;
    this.#currentPromiseReject = null;
    this.#selectedColor = null;
    this.#initialColor = null;

    this.#anchor.removeAttribute('zen-emoji-open');
    this.#anchor = null;
  }

  #selectEmoji(emoji) {
    // Return an object with emoji and color for SVG icons, or just the emoji for regular emojis
    const isSvg = emoji && emoji.endsWith('.svg');
    const result = {
      icon: emoji,
      iconColor: isSvg ? this.#selectedColor : null,
    };
    this.#currentPromiseResolve?.(result);
    this.#panel.hidePopup();
  }

  open(anchor, { onlySvgIcons = false, initialColor = null } = {}) {
    if (this.#currentPromise) {
      return null;
    }
    this.#currentPromise = new Promise((resolve, reject) => {
      this.#currentPromiseResolve = resolve;
      this.#currentPromiseReject = reject;
    });
    this.#anchor = anchor;
    this.#initialColor = initialColor;
    this.#anchor.setAttribute('zen-emoji-open', 'true');
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
