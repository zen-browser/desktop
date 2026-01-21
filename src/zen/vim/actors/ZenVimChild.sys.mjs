// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const EDITABLE_SELECTOR = [
  "textarea",
  "input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio])",
  "input:not([type=file]):not([type=image]):not([type=reset])",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[role='textbox']",
].join(",");

export class ZenVimChild extends JSWindowActorChild {
  #mode = "normal";

  async handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      await handler.call(this, event);
    }
  }

  async on_DOMContentLoaded() {
    this.#ensureStyle();
    try {
      const response = await this.sendQuery("ZenVim:GetMode");
      this.#setMode(response?.mode || "normal");
    } catch (e) {
      this.#setMode("normal");
    }
  }

  receiveMessage(message) {
    switch (message.name) {
      case "ZenVim:SetMode":
        this.#setMode(message.data?.mode || "normal");
        break;
      default:
        break;
    }
  }

  on_keydown(event) {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }

    if (event.key === "Escape") {
      if (this.#mode !== "normal") {
        this.#setMode("normal");
        this.sendAsyncMessage("ZenVim:RequestModeChange", { mode: "normal" });
      }
      if (this.#isEditableElement(event.target)) {
        try {
          event.target.blur();
        } catch (e) {
          // ignore
        }
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.#mode === "insert") {
      return;
    }

    if (this.#mode === "command" || this.#mode === "search") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    let handled = false;
    switch (event.key) {
      case "h":
        this.#moveFocus(Ci.nsIFocusManager.MOVEFOCUS_LEFT);
        handled = true;
        break;
      case "j":
        this.#moveFocus(Ci.nsIFocusManager.MOVEFOCUS_DOWN);
        handled = true;
        break;
      case "k":
        this.#moveFocus(Ci.nsIFocusManager.MOVEFOCUS_UP);
        handled = true;
        break;
      case "l":
        this.#moveFocus(Ci.nsIFocusManager.MOVEFOCUS_RIGHT);
        handled = true;
        break;
      case "i":
        this.#enterInsertMode();
        handled = true;
        break;
      case ":":
        this.#setMode("command");
        this.sendAsyncMessage("ZenVim:OpenCommandLine");
        handled = true;
        break;
      case "/":
        this.#setMode("search");
        this.sendAsyncMessage("ZenVim:OpenSearch");
        handled = true;
        break;
      case "n":
        this.sendAsyncMessage("ZenVim:FindAgain", { backwards: false });
        handled = true;
        break;
      case "N":
        this.sendAsyncMessage("ZenVim:FindAgain", { backwards: true });
        handled = true;
        break;
      case "Enter":
      case "Return":
        this.#clickFocused();
        handled = true;
        break;
      default:
        if (this.#isEditableElement(event.target)) {
          handled = true;
        } else if (event.key.length === 1) {
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  #setMode(mode) {
    this.#mode = mode;
    const doc = this.contentWindow?.document;
    if (doc?.documentElement) {
      doc.documentElement.setAttribute("data-zen-vim-mode", mode);
    }
  }

  #ensureStyle() {
    const doc = this.contentWindow?.document;
    if (!doc?.documentElement || doc.getElementById("zen-vim-style")) {
      return;
    }

    const style = doc.createElement("style");
    style.id = "zen-vim-style";
    style.textContent =
      ":root[data-zen-vim-mode='normal'] :focus {" +
      "outline: 2px solid #ffcc00 !important;" +
      "outline-offset: 2px !important;" +
      "}";
    doc.documentElement.appendChild(style);
  }

  #moveFocus(direction) {
    try {
      Services.focus.moveFocus(this.contentWindow, null, direction, Ci.nsIFocusManager.FLAG_BYKEY);
    } catch (e) {
      // ignore
    }
  }

  #clickFocused() {
    const doc = this.contentWindow?.document;
    if (!doc) {
      return false;
    }

    const target = doc.activeElement;
    if (!target || target === doc.body || target === doc.documentElement) {
      return false;
    }

    if (typeof target.click === "function") {
      target.click();
      return true;
    }

    return false;
  }

  #enterInsertMode() {
    const doc = this.contentWindow?.document;
    if (!doc) {
      return false;
    }

    if (this.#isEditableElement(doc.activeElement)) {
      this.#setMode("insert");
      this.sendAsyncMessage("ZenVim:RequestModeChange", { mode: "insert" });
      return true;
    }

    const focused = this.#focusNearestEditable();
    if (focused) {
      this.#setMode("insert");
      this.sendAsyncMessage("ZenVim:RequestModeChange", { mode: "insert" });
    }
    return focused;
  }

  #focusNearestEditable() {
    const doc = this.contentWindow?.document;
    if (!doc) {
      return false;
    }

    const candidates = Array.from(doc.querySelectorAll(EDITABLE_SELECTOR)).filter((el) =>
      this.#isEditableElement(el)
    );

    if (!candidates.length) {
      return false;
    }

    const originRect = doc.activeElement?.getBoundingClientRect?.();
    const originX = originRect
      ? originRect.left + originRect.width / 2
      : this.contentWindow.innerWidth / 2;
    const originY = originRect
      ? originRect.top + originRect.height / 2
      : this.contentWindow.innerHeight / 2;

    let best = null;
    let bestDistance = Infinity;

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = centerX - originX;
      const dy = centerY - originY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = el;
      }
    }

    if (!best) {
      return false;
    }

    try {
      best.focus();
      return true;
    } catch (e) {
      return false;
    }
  }

  #isEditableElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (element.isContentEditable) {
      return true;
    }

    const tag = element.tagName.toLowerCase();
    if (tag === "textarea") {
      return !element.disabled && !element.readOnly;
    }

    if (tag === "input") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      if (["button", "submit", "checkbox", "radio", "file", "image", "reset"].includes(type)) {
        return false;
      }
      if (element.disabled || element.readOnly) {
        return false;
      }
      return true;
    }

    if (element.getAttribute("role") === "textbox") {
      return element.getAttribute("aria-disabled") !== "true";
    }

    return false;
  }
}
