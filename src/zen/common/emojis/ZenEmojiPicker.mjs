// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
{
  class ZenEmojiPicker extends nsZenDOMOperatedFeature {
    #panel;

    #anchor;

    #currentPromise = null;
    #currentPromiseResolve = null;
    #currentPromiseReject = null;

    init() {
      this.#panel = document.getElementById('PanelUI-zen-emojis-picker');
      this.#panel.addEventListener('popupshowing', this);
      this.#panel.addEventListener('popuphidden', this);
      document.getElementById('PanelUI-zen-emojis-picker-none').addEventListener('command', this);
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

    get searchInput() {
      return document.getElementById('PanelUI-zen-emojis-picker-search');
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
      const emojiList = this.emojiList;
      for (const emoji of this.#emojis) {
        const item = document.createXULElement('toolbarbutton');
        item.className = 'toolbarbutton-1 zen-emojis-picker-emoji';
        item.setAttribute('label', emoji.emoji);
        item.setAttribute('tooltiptext', emoji.annotation);
        item.addEventListener('command', () => {
          this.#selectEmoji(emoji.emoji);
        });
        emojiList.appendChild(item);
      }
      setTimeout(() => {
        this.searchInput.focus();
      }, 500);
    }

    #onPopupHidden(event) {
      if (event.target !== this.#panel) return;
      this.#clearEmojis();

      const emojiList = this.emojiList;
      emojiList.innerHTML = '';

      if (this.#currentPromiseReject) {
        this.#currentPromiseReject(new Error('Emoji picker closed without selection'));
      }

      this.#currentPromise = null;
      this.#currentPromiseResolve = null;
      this.#currentPromiseReject = null;

      this.#anchor.removeAttribute('zen-emoji-open');
      this.#anchor = null;
    }

    #selectEmoji(emoji) {
      this.#currentPromiseResolve?.(emoji);
      this.#panel.hidePopup();
    }

    open(anchor) {
      if (this.#currentPromise) {
        return null;
      }
      this.#currentPromise = new Promise((resolve, reject) => {
        this.#currentPromiseResolve = resolve;
        this.#currentPromiseReject = reject;
      });
      this.#anchor = anchor;
      this.#anchor.setAttribute('zen-emoji-open', 'true');
      this.#panel.openPopup(anchor, 'after_start', 0, 0, false, false);
      return this.#currentPromise;
    }
  }

  window.gZenEmojiPicker = new ZenEmojiPicker();
}
