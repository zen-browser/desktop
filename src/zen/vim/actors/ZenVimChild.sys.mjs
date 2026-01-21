// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ZenVimChild extends JSWindowActorChild {
  #mode = "normal";
  #inputMode = null;
  #inputTarget = null;
  #inputVisual = false;
  #inputAnchor = null;
  #inputCursorPos = null;
  #pendingOperator = null;
  #pendingOperatorTimer = null;

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

  async on_keydown(event) {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }

    const editableTarget = this.#getEditableElement(event.target);
    const inEditable = !!editableTarget;
    const supportedEditable = inEditable && this.#isSupportedEditableTarget(editableTarget);

    if (event.key === "Escape") {
      if (inEditable && !supportedEditable) {
        return;
      }
      if (inEditable && this.#mode === "normal") {
        if (this.#inputMode === "insert") {
          this.#setInputMode("normal", { target: editableTarget, fromInsert: true });
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (this.#inputMode === "normal") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (this.#mode !== "normal") {
        this.#setMode("normal");
        this.sendAsyncMessage("ZenVim:RequestModeChange", { mode: "normal" });
      }
      if (inEditable) {
        this.#clearInputState();
        try {
          editableTarget.blur();
        } catch (e) {
          // ignore
        }
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.#mode === "command" || this.#mode === "search") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (inEditable && !supportedEditable) {
      return;
    }

    if (inEditable) {
      const handled = await this.#handleEditableKeydown(event, editableTarget);
      if (handled) {
        return;
      }
      return;
    }

    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    let handled = false;
    switch (event.key) {
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
        if (!this.#clickFocused()) {
          this.#clickSearchMatchTarget();
        }
        handled = true;
        break;
      default:
        if (event.key.length === 1) {
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  on_focusin(event) {
    if (this.#mode !== "normal") {
      return;
    }
    const editableTarget = this.#getEditableElement(event.target);
    if (!editableTarget) {
      return;
    }
    if (!this.#isSupportedEditableTarget(editableTarget)) {
      this.#clearInputState();
      return;
    }
    if (this.#inputTarget && this.#inputTarget !== editableTarget) {
      this.#clearInputState();
    }
    this.#inputTarget = editableTarget;
    this.#setInputMode("normal", { target: editableTarget, preserveCursor: true });
  }

  on_focusout(event) {
    if (!this.#inputTarget) {
      return;
    }
    const editableTarget = this.#getEditableElement(event.target);
    if (!editableTarget || editableTarget !== this.#inputTarget) {
      return;
    }
    const relatedTarget = this.#getEditableElement(event.relatedTarget);
    if (relatedTarget && relatedTarget === this.#inputTarget) {
      return;
    }
    this.#clearInputState();
  }

  on_mouseup(event) {
    if (this.#mode !== "normal" || this.#inputMode !== "normal") {
      return;
    }
    if (this.#inputVisual) {
      return;
    }
    const editableTarget = this.#getEditableElement(event.target);
    if (!editableTarget || editableTarget !== this.#inputTarget) {
      return;
    }
    if (!this.#isSupportedEditableTarget(editableTarget)) {
      return;
    }
    this.#normalizeSelectionForNormal(editableTarget);
  }

  #setMode(mode) {
    this.#mode = mode;
    const doc = this.contentWindow?.document;
    if (doc?.documentElement) {
      doc.documentElement.setAttribute("data-zen-vim-mode", mode);
    }
    if (mode !== "normal") {
      this.#clearInputState();
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
      "}" +
      ".zen-vim-input-normal {" +
      "caret-color: transparent !important;" +
      "}" +
      ".zen-vim-input-normal::selection {" +
      "background: #ffcc00 !important;" +
      "color: #000000 !important;" +
      "}" +
      ".zen-vim-input-normal *::selection {" +
      "background: #ffcc00 !important;" +
      "color: #000000 !important;" +
      "}";
    doc.documentElement.appendChild(style);
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

  #clickSearchMatchTarget() {
    const doc = this.contentWindow?.document;
    if (!doc) {
      return false;
    }

    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return false;
    }

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (!node) {
      return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element && element !== doc.body && element !== doc.documentElement) {
      if (this.#isButtonLike(element)) {
        try {
          element.click();
          return true;
        } catch (e) {
          return false;
        }
      }
      element = element.parentElement;
    }

    return false;
  }

  #isButtonLike(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const tag = element.tagName.toLowerCase();
    if (tag === "button") {
      return !element.disabled;
    }

    if (tag === "input") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      if (["button", "submit", "reset", "image"].includes(type)) {
        return !element.disabled;
      }
      return false;
    }

    const role = element.getAttribute("role");
    if (role && role.toLowerCase() === "button") {
      return element.getAttribute("aria-disabled") !== "true";
    }

    return false;
  }

  #getEditableElement(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element) {
      if (this.#isTextControlElement(element)) {
        return element;
      }
      if (element.isContentEditable) {
        return element.closest("[contenteditable]") || element;
      }
      const role = element.getAttribute?.("role");
      if (role && role.toLowerCase() === "textbox") {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  #isTextControlElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
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

    return false;
  }

  #isSupportedEditableTarget(element) {
    return this.#isTextControlElement(element);
  }

  async #handleEditableKeydown(event, editableTarget) {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }

    if (this.#inputTarget && this.#inputTarget !== editableTarget) {
      this.#clearInputState();
    }

    if (!this.#inputTarget) {
      this.#inputTarget = editableTarget;
      this.#setInputMode("normal", { target: editableTarget, preserveCursor: true });
    }

    if (this.#inputMode === "insert") {
      return false;
    }

    const key = event.key;
    if (this.#pendingOperator === "d" && key !== "d") {
      this.#clearPendingOperator();
    }

    let handled = false;

    switch (key) {
      case "i":
        this.#setInputMode("insert", { target: editableTarget });
        handled = true;
        break;
      case "v":
        this.#toggleVisualMode(editableTarget);
        handled = true;
        break;
      case "h":
      case "ArrowLeft":
        this.#moveEditable(editableTarget, "backward", "character");
        handled = true;
        break;
      case "l":
      case "ArrowRight":
        this.#moveEditable(editableTarget, "forward", "character");
        handled = true;
        break;
      case "k":
      case "ArrowUp":
        this.#moveEditable(editableTarget, "backward", "line");
        handled = true;
        break;
      case "j":
      case "ArrowDown":
        this.#moveEditable(editableTarget, "forward", "line");
        handled = true;
        break;
      case "0":
        this.#moveEditable(editableTarget, "backward", "lineboundary");
        handled = true;
        break;
      case "$":
        this.#moveEditable(editableTarget, "forward", "lineboundary");
        handled = true;
        break;
      case "d":
        if (this.#hasEditableSelection(editableTarget)) {
          event.preventDefault();
          event.stopPropagation();
          void this.#cutSelection(editableTarget);
          return true;
        }
        handled = this.#handleDeleteOperator(editableTarget);
        break;
      case "p":
        event.preventDefault();
        event.stopPropagation();
        void this.#pasteIntoEditable(editableTarget, { before: false });
        return true;
      case "P":
        event.preventDefault();
        event.stopPropagation();
        void this.#pasteIntoEditable(editableTarget, { before: true });
        return true;
      case ":":
      case "/":
        this.#exitInputForCommand(key === "/" ? "search" : "command");
        handled = true;
        break;
      default:
        if (key.length === 1 || key === "Enter" || key === "Backspace" || key === "Delete") {
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }

    return handled;
  }

  #exitInputForCommand(mode) {
    this.#clearInputState();
    this.#setMode(mode);
    if (mode === "search") {
      this.sendAsyncMessage("ZenVim:OpenSearch");
    } else {
      this.sendAsyncMessage("ZenVim:OpenCommandLine");
    }
  }

  #setInputMode(mode, { target, fromInsert = false, preserveCursor = false } = {}) {
    if (!target) {
      return;
    }
    this.#inputMode = mode;
    this.#inputVisual = false;
    this.#inputAnchor = null;
    this.#clearPendingOperator();

    if (mode === "normal") {
      target.classList.add("zen-vim-input-normal");
      this.#normalizeSelectionForNormal(target, { fromInsert, preserveCursor });
    } else {
      target.classList.remove("zen-vim-input-normal");
      this.#collapseSelectionForInsert(target);
    }
  }

  #clearInputState() {
    if (this.#inputTarget) {
      this.#inputTarget.classList.remove("zen-vim-input-normal");
    }
    this.#inputMode = null;
    this.#inputTarget = null;
    this.#inputVisual = false;
    this.#inputAnchor = null;
    this.#inputCursorPos = null;
    this.#clearPendingOperator();
  }

  #clearPendingOperator() {
    this.#pendingOperator = null;
    if (this.#pendingOperatorTimer) {
      clearTimeout(this.#pendingOperatorTimer);
      this.#pendingOperatorTimer = null;
    }
  }

  #toggleVisualMode(editableTarget) {
    if (this.#inputVisual) {
      this.#inputVisual = false;
      this.#inputAnchor = null;
      this.#normalizeSelectionForNormal(editableTarget);
      return;
    }

    this.#inputVisual = true;
    if (this.#isTextControlElement(editableTarget)) {
      const pos = this.#getTextControlCursor(editableTarget);
      this.#inputAnchor = pos;
      this.#applyTextControlSelection(editableTarget, pos);
      return;
    }

    const selection = this.contentWindow?.getSelection();
    if (!selection) {
      return;
    }
    if (!selection.isCollapsed) {
      selection.collapse(selection.focusNode, selection.focusOffset);
    }
    this.#ensureContentEditableBlock(selection);
  }

  #normalizeSelectionForNormal(editableTarget, { fromInsert = false, preserveCursor = false } = {}) {
    if (this.#isTextControlElement(editableTarget)) {
      let pos = this.#getTextControlCursor(editableTarget, { preserveCursor });
      if (fromInsert && pos > 0) {
        pos -= 1;
      }
      this.#applyTextControlSelection(editableTarget, pos);
      return;
    }

    const selection = this.contentWindow?.getSelection();
    if (!selection) {
      return;
    }
    if (!selection.isCollapsed) {
      selection.collapse(selection.focusNode, selection.focusOffset);
    }
    if (fromInsert) {
      selection.modify("move", "backward", "character");
    }
    this.#ensureContentEditableBlock(selection);
  }

  #collapseSelectionForInsert(editableTarget) {
    if (this.#isTextControlElement(editableTarget)) {
      const start = editableTarget.selectionStart ?? 0;
      editableTarget.setSelectionRange(start, start);
      return;
    }

    const selection = this.contentWindow?.getSelection();
    if (!selection) {
      return;
    }
    selection.collapse(selection.anchorNode, selection.anchorOffset);
  }

  #moveEditable(editableTarget, direction, granularity) {
    if (this.#isTextControlElement(editableTarget)) {
      this.#moveTextControl(editableTarget, direction, granularity);
      return;
    }
    this.#moveContentEditable(direction, granularity);
  }

  #moveTextControl(editableTarget, direction, granularity) {
    const value = editableTarget.value ?? "";
    if (!value.length) {
      editableTarget.setSelectionRange(0, 0);
      this.#inputCursorPos = 0;
      return;
    }

    let pos = this.#getTextControlCursor(editableTarget);
    if (granularity === "character") {
      pos += direction === "backward" ? -1 : 1;
      pos = Math.max(0, Math.min(pos, value.length - 1));
      this.#applyTextControlSelection(editableTarget, pos);
      return;
    }

    const { lineStart, lineEnd, column } = this.#getLineBounds(value, pos);
    if (granularity === "line") {
      if (direction === "backward") {
        if (lineStart === 0) {
          return;
        }
        const prevLineEnd = lineStart - 1;
        const prevLineStart = value.lastIndexOf("\n", prevLineEnd - 1) + 1;
        const prevLineLength = prevLineEnd - prevLineStart;
        const targetColumn = Math.min(column, Math.max(0, prevLineLength - 1));
        pos = prevLineStart + targetColumn;
      } else {
        if (lineEnd >= value.length) {
          return;
        }
        const nextLineStart = lineEnd + 1;
        const nextLineEnd = value.indexOf("\n", nextLineStart);
        const resolvedEnd = nextLineEnd === -1 ? value.length : nextLineEnd;
        const nextLineLength = resolvedEnd - nextLineStart;
        const targetColumn = Math.min(column, Math.max(0, nextLineLength - 1));
        pos = nextLineStart + targetColumn;
      }
      this.#applyTextControlSelection(editableTarget, pos);
      return;
    }

    if (granularity === "lineboundary") {
      if (direction === "backward") {
        pos = lineStart;
      } else {
        pos = lineEnd > lineStart ? lineEnd - 1 : lineStart;
      }
      this.#applyTextControlSelection(editableTarget, pos);
    }
  }

  #moveContentEditable(direction, granularity) {
    const selection = this.contentWindow?.getSelection();
    if (!selection) {
      return;
    }
    const action = this.#inputVisual ? "extend" : "move";
    selection.modify(action, direction, granularity);
    if (!this.#inputVisual) {
      this.#ensureContentEditableBlock(selection);
    }
  }

  #ensureContentEditableBlock(selection) {
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    selection.collapse(selection.focusNode, selection.focusOffset);
    selection.modify("extend", "forward", "character");
    if (selection.isCollapsed) {
      selection.modify("extend", "backward", "character");
    }
  }

  #getTextControlCursor(editableTarget, { preserveCursor = false } = {}) {
    if (preserveCursor && typeof this.#inputCursorPos === "number") {
      return this.#inputCursorPos;
    }
    const valueLength = (editableTarget.value ?? "").length;
    let pos = editableTarget.selectionStart ?? 0;
    if (this.#inputVisual) {
      const end = editableTarget.selectionEnd ?? pos;
      const direction = editableTarget.selectionDirection;
      if (direction === "backward") {
        pos = pos;
      } else {
        pos = Math.max(0, end - 1);
      }
    } else if (valueLength > 0) {
      pos = Math.min(pos, valueLength - 1);
    }
    this.#inputCursorPos = pos;
    return pos;
  }

  #applyTextControlSelection(editableTarget, pos) {
    const valueLength = (editableTarget.value ?? "").length;
    if (!valueLength) {
      editableTarget.setSelectionRange(0, 0);
      this.#inputCursorPos = 0;
      return;
    }
    const clamped = Math.max(0, Math.min(pos, valueLength - 1));
    this.#inputCursorPos = clamped;
    if (this.#inputVisual) {
      const anchor = typeof this.#inputAnchor === "number" ? this.#inputAnchor : clamped;
      const start = Math.min(anchor, clamped);
      const end = Math.max(anchor, clamped) + 1;
      const direction = clamped < anchor ? "backward" : "forward";
      editableTarget.setSelectionRange(start, end, direction);
    } else {
      editableTarget.setSelectionRange(clamped, clamped + 1, "forward");
    }
  }

  #getLineBounds(value, pos) {
    const safePos = Math.max(0, Math.min(pos, Math.max(0, value.length - 1)));
    const lineStart = value.lastIndexOf("\n", Math.max(0, safePos - 1)) + 1;
    let lineEnd = value.indexOf("\n", safePos);
    if (lineEnd === -1) {
      lineEnd = value.length;
    }
    const column = safePos - lineStart;
    return { lineStart, lineEnd, column };
  }

  #hasEditableSelection(editableTarget) {
    if (this.#isTextControlElement(editableTarget)) {
      const start = editableTarget.selectionStart ?? 0;
      const end = editableTarget.selectionEnd ?? start;
      if (this.#inputVisual) {
        return start !== end;
      }
      return Math.abs(end - start) > 1;
    }

    const selection = this.contentWindow?.getSelection();
    if (!selection || selection.isCollapsed) {
      return false;
    }
    if (this.#inputVisual) {
      return selection.toString().length > 0;
    }
    return selection.toString().length > 1;
  }

  #handleDeleteOperator(editableTarget) {
    if (this.#pendingOperator === "d") {
      this.#clearPendingOperator();
      this.#deleteCurrentLine(editableTarget);
      return true;
    }

    this.#pendingOperator = "d";
    this.#pendingOperatorTimer = setTimeout(() => {
      this.#clearPendingOperator();
    }, 600);
    return true;
  }

  async #deleteCurrentLine(editableTarget) {
    if (this.#isTextControlElement(editableTarget)) {
      const value = editableTarget.value ?? "";
      if (!value.length) {
        return;
      }
      const pos = this.#getTextControlCursor(editableTarget);
      const { lineStart, lineEnd } = this.#getLineBounds(value, pos);
      const deleteEnd = lineEnd < value.length ? lineEnd + 1 : lineEnd;
      editableTarget.setSelectionRange(lineStart, deleteEnd);
      let cutOk = false;
      try {
        cutOk = this.contentWindow?.document?.execCommand?.("cut") ?? false;
      } catch (e) {
        cutOk = false;
      }
      if (!cutOk) {
        const text = value.slice(lineStart, deleteEnd);
        await this.#writeClipboard(text);
        editableTarget.setRangeText("", lineStart, deleteEnd, "start");
      }
      this.#inputVisual = false;
      this.#inputAnchor = null;
      const newLength = (editableTarget.value ?? "").length;
      const newPos = newLength ? Math.min(lineStart, newLength - 1) : 0;
      this.#applyTextControlSelection(editableTarget, newPos);
      return;
    }

    const selection = this.contentWindow?.getSelection();
    if (!selection) {
      return;
    }
    selection.modify("move", "backward", "lineboundary");
    selection.modify("extend", "forward", "line");
    let cutOk = false;
    try {
      cutOk = this.contentWindow?.document?.execCommand?.("cut") ?? false;
    } catch (e) {
      cutOk = false;
    }
    if (!cutOk) {
      const text = selection.toString();
      await this.#writeClipboard(text);
      selection.deleteFromDocument();
    }
    this.#inputVisual = false;
    this.#inputAnchor = null;
    this.#ensureContentEditableBlock(selection);
  }

  async #cutSelection(editableTarget) {
    this.#clearPendingOperator();

    if (this.#isTextControlElement(editableTarget)) {
      const start = editableTarget.selectionStart ?? 0;
      const end = editableTarget.selectionEnd ?? start;
      if (start === end) {
        return;
      }
      let cutOk = false;
      try {
        cutOk = this.contentWindow?.document?.execCommand?.("cut") ?? false;
      } catch (e) {
        cutOk = false;
      }
      if (!cutOk) {
        const value = editableTarget.value ?? "";
        const text = value.slice(Math.min(start, end), Math.max(start, end));
        await this.#writeClipboard(text);
        editableTarget.setRangeText("", Math.min(start, end), Math.max(start, end), "start");
      }
      this.#inputVisual = false;
      this.#inputAnchor = null;
      const newLength = (editableTarget.value ?? "").length;
      const newPos = newLength ? Math.min(start, newLength - 1) : 0;
      this.#applyTextControlSelection(editableTarget, newPos);
      return;
    }

    const selection = this.contentWindow?.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }
    let cutOk = false;
    try {
      cutOk = this.contentWindow?.document?.execCommand?.("cut") ?? false;
    } catch (e) {
      cutOk = false;
    }
    if (!cutOk) {
      const text = selection.toString();
      await this.#writeClipboard(text);
      selection.deleteFromDocument();
    }
    this.#inputVisual = false;
    this.#inputAnchor = null;
    this.#ensureContentEditableBlock(selection);
  }

  async #pasteIntoEditable(editableTarget, { before = false } = {}) {
    this.#clearPendingOperator();
    const text = await this.#readClipboard();
    if (text === null) {
      if (this.#isTextControlElement(editableTarget)) {
        const selectionStart = editableTarget.selectionStart ?? 0;
        const selectionEnd = editableTarget.selectionEnd ?? selectionStart;
        const selectionSize = Math.abs(selectionEnd - selectionStart);
        if (!(this.#inputVisual || selectionSize > 1)) {
          const valueLength = (editableTarget.value ?? "").length;
          const cursorPos = this.#getTextControlCursor(editableTarget, { preserveCursor: true });
          const insertPos = before
            ? Math.max(0, Math.min(cursorPos, valueLength))
            : Math.min(cursorPos + 1, valueLength);
          editableTarget.setSelectionRange(insertPos, insertPos);
        }
      } else {
        const selection = this.contentWindow?.getSelection();
        if (selection && !selection.isCollapsed) {
          const selectionText = selection.toString();
          const hasLargeSelection = selectionText.length > 1;
          if (!(this.#inputVisual || hasLargeSelection)) {
            const range = selection.getRangeAt(0);
            if (before) {
              selection.collapse(range.startContainer, range.startOffset);
            } else {
              selection.collapse(range.endContainer, range.endOffset);
            }
          }
        }
      }
      try {
        const ok = this.contentWindow?.document?.execCommand?.("paste") ?? false;
        if (ok) {
          this.#normalizeSelectionForNormal(editableTarget, { preserveCursor: false });
          return true;
        }
      } catch (e) {
        // ignore
      }
      return true;
    }

    if (text === "") {
      return true;
    }

    if (this.#isTextControlElement(editableTarget)) {
      const valueLength = (editableTarget.value ?? "").length;
      const selectionStart = editableTarget.selectionStart ?? 0;
      const selectionEnd = editableTarget.selectionEnd ?? selectionStart;
      const selectionSize = Math.abs(selectionEnd - selectionStart);
      if (this.#inputVisual || selectionSize > 1) {
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);
        editableTarget.setRangeText(text, start, end, "end");
        this.#inputVisual = false;
        this.#inputAnchor = null;
        const newPos = start + text.length - 1;
        if (text.length > 0) {
          this.#applyTextControlSelection(editableTarget, newPos);
        }
        return true;
      }

      const cursorPos = this.#getTextControlCursor(editableTarget, { preserveCursor: true });
      const insertPos = before
        ? Math.max(0, Math.min(cursorPos, valueLength))
        : Math.min(cursorPos + 1, valueLength);
      editableTarget.setRangeText(text, insertPos, insertPos, "end");
      const newPos = insertPos + text.length - 1;
      if (text.length > 0) {
        this.#applyTextControlSelection(editableTarget, newPos);
      }
      return true;
    }

    const selection = this.contentWindow?.getSelection();
    if (!selection) {
      return true;
    }
    const selectionText = selection.toString();
    const hasLargeSelection = selectionText.length > 1;
    if ((this.#inputVisual || hasLargeSelection) && !selection.isCollapsed) {
      selection.deleteFromDocument();
      this.#inputVisual = false;
      this.#inputAnchor = null;
    } else if (!selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      if (before) {
        selection.collapse(range.startContainer, range.startOffset);
      } else {
        selection.collapse(range.endContainer, range.endOffset);
      }
    }
    this.contentWindow?.document?.execCommand?.("insertText", false, text);
    selection.modify("move", "backward", "character");
    this.#ensureContentEditableBlock(selection);
    return true;
  }

  async #readClipboard() {
    const clipboard = this.contentWindow?.navigator?.clipboard;
    if (!clipboard?.readText) {
      return null;
    }
    try {
      return await clipboard.readText();
    } catch (e) {
      return null;
    }
  }

  async #writeClipboard(text) {
    const clipboard = this.contentWindow?.navigator?.clipboard;
    if (!clipboard?.writeText) {
      return false;
    }
    try {
      await clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }
}
